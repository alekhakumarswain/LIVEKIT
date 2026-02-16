# 🤖 Real-Time Voice AI Orchestrator

This project is a production-ready, end-to-end real-time voice agent. It integrates LiveKit for WebRTC, Deepgram for STT/TTS, and Gemini for LLM and RAG (Retrieval-Augmented Generation).

## 🚀 Features

- **Real-Time Voice Interaction**: Low-latency audio streaming via WebRTC (LiveKit).
- **Intelligent RAG**: Upload `.txt` files to provide the agent with custom knowledge.
- **Adaptive STT**: Uses Deepgram Nova-2 with custom buffering to handle network jitter.
- **Seamless Interruption**: The agent stops speaking immediately when the user interrupts.
- **Live Diagnostics**:
    - **Partial Transcripts**: See your words in real-time as you speak.
    - **RAG Sources Panel**: View the exact document snippets the agent retrieved to answer your query.
- **Modular Architecture**: Clean separation between STT, LLM, TTS, and Vector services.

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **LiveKit Cloud account** (or a local LiveKit server instance)
- **Deepgram API Key**
- **Google Gemini API Key**

### 2. Installation
Clone the repository and install dependencies:
```bash
cd backend
npm install
```

### 3. Environment Variables
Create a `.env` file in the `backend/` directory and populate it with your keys:
```env
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

GEMINI_API_KEY=your_gemini_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
```

---

## 🏃 Running the Project

### Start the Backend
From the `backend/` directory:
```bash
node server.js
```
The server will start at `http://localhost:3000`.

### Start the Frontend
The frontend is served statically by the backend via Express. You can simply open `http://localhost:3000` in your browser.
*(Alternatively, you can run a separate dev server like `npx serve public`, but ensure it communicates with the correct backend port).*

---

## 📡 LiveKit Configuration

### Cloud Setup (Recommended)
1. Create a project at [LiveKit Cloud](https://cloud.livekit.io/).
2. Copy your **Server URL**, **API Key**, and **API Secret** into the `.env` file.
3. Ensure the `index.html` file (line 274) uses your project's `wss://` URL.

### Local Setup
If running LiveKit locally:
1. Follow the [LiveKit Local Setup Guide](https://docs.livekit.io/realtime/self-hosting/local-setup/).
2. Update the `LIVEKIT_URL` in `.env` to `ws://localhost:7800`.
3. Update `index.html` to connect to `ws://localhost:7800`.

---

## 📚 How to Use (Demo Flow)
1. **Connect**: Open the dashboard and click **Start Call**.
2. **Ingest Knowledge**: 
   - Choose a `.txt` file containing specific information.
   - Click **Ingest Document**. Wait for the "✅ Indexed" status.
3. **Ask a Question**: Ask the agent something specific present in your document.
4. **Observe RAG**:
   - The "Knowledge Retrieval" panel will show the retrieved sources.
   - The agent will answer based on the document.
5. **Interrupt**: Try talking while the agent is speaking; it should stop immediately to listen to you.

---

## ⚠️ Known Limitations & Tradeoffs

- **Memory-Based Vector Store**: For this demo, the vector store is in-memory. Restarting the server will clear the indexed documents. In production, this should be replaced with a persistent store like Pinecone or Chroma.
- **Audio Sample Rates**: The system uses the browser's native sample rate (typically 44.1kHz or 48kHz) and downsamples/configures the pipeline accordingly. Some hardware might experience jitter if the network is unstable.
- **Single Room Demo**: The current implementation is hardcoded for a `demo-room`. For multi-tenant use, dynamically generate room names via the UI.
- **Sentence-Based TTS**: The backend buffers text into sentences before sending them to TTS to ensure natural prosody. This adds a slight (200-500ms) latency between LLM generation and voice output.
