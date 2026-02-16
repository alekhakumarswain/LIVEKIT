import { STTService } from "./services/stt.js";
import { LLMService } from "./services/llm.js";
import { TTSService } from "./services/tts.js";
import { VectorService } from "./services/vector.js";

// Singleton Vector Store (Shared across agents/connections for this demo)
const vectorStore = new VectorService();

export class VoiceAgent {
    constructor(socket) {
        this.socket = socket;

        this.stt = new STTService(socket);
        this.llm = new LLMService();
        this.tts = new TTSService();

        // Default System Prompt
        this.systemPrompt = "You are a helpful voice assistant. Keep answers concise.";
    }

    async start() {
        console.log("🚀 Voice Agent Started");

        // Handle Incoming Messages
        this.socket.on("message", async (data, isBinary) => {
            if (isBinary) {
                // console.log(`🎤 Agent: Received Audio (${data.length} bytes)`);
                this.stt.sendAudio(data);
            } else {
                // Control Messages (JSON)
                try {
                    const msg = JSON.parse(data.toString());
                    console.log("⚙️ CONTROL RECEIVED:", msg);

                    if (msg.type === "config") {
                        console.log("⚙️ CONFIG RECEIVED, starting STT...");
                        // Start STT with client's sample rate
                        await this.stt.start(async (data) => {
                            // 1. Handle Interruption
                            if (data.type === "speech_started") {
                                console.log("🛑 Agent: User Speaking -> Interrupting TTS");
                                this.socket.send(JSON.stringify({ type: "interrupt" }));
                                return;
                            }

                            // 2. Handle Transcript
                            if (data.type === "transcript") {
                                // Always send to UI for live feedback (partial/final)
                                this.socket.send(JSON.stringify({
                                    type: "transcript",
                                    text: data.text,
                                    isFinal: data.isFinal
                                }));

                                if (data.isFinal && data.text.trim().length > 2) {
                                    console.log(`🧠 Agent: Query Finalized: "${data.text}"`);
                                    await this.handleUserQuery(data.text);
                                }
                            }
                        }, { sampleRate: msg.sampleRate });

                    } else if (msg.type === "update_prompt") {
                        this.systemPrompt = msg.prompt;
                        this.llm.systemPrompt = msg.prompt;
                        console.log("📝 System Prompt Updated:", this.systemPrompt);
                    }
                } catch (e) {
                    console.warn("⚠️ Agent: Failed to parse control message:", e.message);
                }
            }
        });

        this.socket.on("close", () => {
            this.stt.stop();
            console.log("🛑 Voice Agent Stopped");
        });
    }

    async handleUserQuery(query) {
        console.log("🧠 Agent: Handling query:", query);

        // 1. RAG Retrieval
        const retrievedDocs = await vectorStore.search(query);
        console.log(`🧠 Agent: Retrieved ${retrievedDocs.length} docs`);

        const context = retrievedDocs.map(d => d.text);

        // Send RAG sources to UI
        this.socket.send(JSON.stringify({
            type: "rag_sources",
            sources: retrievedDocs.map(d => ({ source: d.source, text: d.text.substring(0, 50) + "..." }))
        }));

        // 2. LLM Generation
        const responseStream = this.llm.generateStream(query, context);

        // 3. TTS & Streaming back
        let sentenceBuffer = "";

        for await (const token of responseStream) {
            sentenceBuffer += token;

            // Simple heuristic: stream by sentence to TTS
            // (Advanced: use a proper tokenizer or buffer by byte length)
            if (sentenceBuffer.match(/[.!?]\s$/) || sentenceBuffer.length > 50) {
                await this.processTTS(sentenceBuffer);
                sentenceBuffer = "";
            }
        }

        // Flush remaining
        if (sentenceBuffer.trim().length > 0) {
            await this.processTTS(sentenceBuffer);
        }
    }

    async processTTS(text) {
        // Send text to UI
        this.socket.send(JSON.stringify({ type: "agent_text", text }));

        // Generate Audio
        const audioBuffer = await this.tts.generateAudio(text);
        if (audioBuffer) {
            // Send Audio to Frontend
            this.socket.send(audioBuffer);
        }
    }
}

// Export the shared vector store to allow uploading from Express routes
export { vectorStore };
