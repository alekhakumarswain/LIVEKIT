# Real-Time Voice AI Orchestration Architecture

## 1. High-Level Pipeline

```mermaid
graph TD
    User[User (Frontend)] <-->|WebRTC Audio/Video| LiveKit[LiveKit SFU]
    User -->|WebSocket Audio Stream (PCM)| Agent[Node.js Orchestrator]
    
    subgraph "Backend Services"
        Agent -->|Stream PCM| STT[Deepgram STT]
        STT -->|Transcript Events| Agent
        
        Agent -->|Query| VectorDB[(Vector DB)]
        VectorDB -->|Retrieved Context| Agent
        
        Agent -->|Context + Query| LLM[Gemini 2.5 Flash]
        LLM -->|Stream Text| Agent
        
        Agent -->|Stream Text| TTS[TTS Service]
        TTS -->|Stream Audio| Agent
    end
    
    Agent -->|WebSocket Audio Stream (Response)| User
```

## 2. Module Breakdown

### A. Frontend (Client)
- **Audio Capture**: `AudioWorklet` capturing 16kHz Mono PCM.
- **Transport**: WebSocket (Double-duty: Upstream Mic, Downstream TTS).
- **Playback**: `AudioContext` queue to play streaming TTS chunks seamlessly.
- **State**: Handling "Listening", "Processing", "Speaking" states.

### B. Backend (Orchestrator)
The backend is split into modular services to ensure separation of concerns.

**Folder Structure:**
```
backend/
├── public/              # Frontend Assets
├── src/
│   ├── config/          # Env, Constants
│   ├── services/
│   │   ├── stt.js       # Deepgram Streaming Wrapper
│   │   ├── llm.js       # Gemini Chat & RAG orchestration
│   │   ├── tts.js       # Text-to-Speech Streaming
│   │   └── vector.js    # Pinecone/Chroma integration
│   ├── utils/           # Audio conversion helpers
│   └── agent.js         # Main WebSocket orchestration logic
├── server.js            # Entry point
└── .env
```

## 3. Detailed Service Design

### 1. STT Service (`stt.js`)
- **Provider**: Deepgram (Nova-2).
- **Mode**: Streaming (WebSocket).
- **Key Features**:
    - `Interim Results`: For low-latency visual feedback ("User is speaking...").
    - `Endpointing`: Detecting when the user *stopped* speaking to trigger the LLM.
    - **VAD**: Built-in Voice Activity Detection to ignore silence.

### 2. Knowledge Base & RAG (`vector.js`)
- **Database**: Pinecone (Serverless) or Chroma (Local).
- **Embedding**: Google `embedding-001` or OpenAI `text-embedding-3-small`.
- **Chunking Strategy**:
    - Recursive Character Splitter (Overlap: 50 tokens, Chunk Size: 300-500 tokens).
    - Metadata: Source filename, page number.
- **Retrieval**: Semantic Similarity (Cosine).

### 3. LLM Service (`llm.js`)
- **Provider**: Gemini 2.5 Flash (Low latency).
- **Prompting**:
    - System Message: "You are a helpful voice assistant. Keep answers concise (under 2 sentences) for speech."
    - Context Injection: "Use the following context to answer: {retrieved_chunks}"
- **Streaming**: Must return an `AsyncGenerator` yielding tokens to feed TTS immediately.

### 4. TTS Service (`tts.js`)
- **Provider**: Deepgram Aura (Fastest) or ElevenLabs (High Quality, slower).
- **Input**: Stream of text tokens from LLM.
- **Output**: Stream of MP3/RAW Audio.
- **Optimization**: "Sentence Buffering" - Wait for a full sentence delimiter (`.`, `?`, `!`) before sending to TTS to ensure correct intonation.

## 4. State Management (Orchestrator)
The `agent.js` orchestrator manages the critical loop:

1.  **Listening State**: Buffering audio to STT.
2.  **Processing State**:
    - User stops speaking (VAD triggers).
    - Send finalized transcript to Vector Store -> Retrieve.
    - Send Context + Query to LLM.
3.  **Speaking State**:
    - Pipe LLM token stream -> Sentence Buffer -> TTS.
    - Pipe TTS Audio -> WebSocket -> User.
    - **Interruption**: If user speaks while Agent is speaking -> *Clears Audio Queue* (Barge-in).

## 5. Streaming TTS Back to LiveKit
*Directly publishing a track from Node.js is complex and resource-heavy.*
**Recommended Approach**:
Send the TTS audio bytes via the validity established WebSocket connection. The Frontend receives these bytes and plays them using the Web Audio API. This provides the lowest latency loop.

## 6. Implementation Plan
1.  **Refactor**: Move monolithic `server.js` matching the folder structure.
2.  **STT**: Polish the Deepgram integration in `stt.js`.
3.  **Vector**: Implement simple in-memory vector store first (or Pinecone) for the "Upload" demo.
4.  **LLM**: Connect Gemini with context injection.
5.  **TTS**: Hook up a TTS stream.
