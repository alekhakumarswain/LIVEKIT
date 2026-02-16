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
        this.language = "en-IN"; // Default
        this.interruptGeneration = false;
        this.currentQueryId = 0;
        this.history = []; // Conversation memory

        // Default System Prompt
        this.systemPrompt = "You are a helpful voice assistant. Keep answers concise. Respond in the user's language.";
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
                        this.language = msg.language || "en-IN";

                        // Start STT with client's sample rate and selected language
                        await this.stt.start(async (data) => {
                            // 1. Handle Interruption
                            if (data.type === "speech_started") {
                                console.log("🛑 Agent: User Speaking -> Interrupting TTS");
                                this.interruptGeneration = true;
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
                                    this.interruptGeneration = false; // Reset for new query
                                    this.currentQueryId++;
                                    await this.handleUserQuery(data.text, this.currentQueryId);
                                }
                            }
                        }, {
                            sampleRate: msg.sampleRate,
                            language: this.language
                        });

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

    async handleUserQuery(query, queryId) {
        console.log(`🧠 Agent: Handling query [${queryId}]:`, query);

        // 1. RAG Retrieval
        const retrievedDocs = await vectorStore.search(query);
        if (this.interruptGeneration || queryId !== this.currentQueryId) return;

        console.log(`🧠 Agent: Retrieved ${retrievedDocs.length} docs`);

        const context = retrievedDocs.map(d => d.text);

        // Send RAG sources to UI
        this.socket.send(JSON.stringify({
            type: "rag_sources",
            sources: retrievedDocs.map(d => ({ source: d.source, text: d.text.substring(0, 50) + "..." }))
        }));

        // 2. LLM Generation
        const responseStream = this.llm.generateStream(query, context, this.history);

        // 3. TTS & Streaming back
        let sentenceBuffer = "";
        let fullResponse = "";

        for await (const token of responseStream) {
            // Stop if user interrupted or a newer query started
            if (this.interruptGeneration || queryId !== this.currentQueryId) {
                console.log(`🛑 Agent: Aborting response [${queryId}] (Interrupted)`);
                return;
            }

            sentenceBuffer += token;
            fullResponse += token;

            // Simple heuristic: stream by sentence to TTS
            // (Advanced: use a proper tokenizer or buffer by byte length)
            if (sentenceBuffer.match(/[.!?]\s$/) || sentenceBuffer.length > 50) {
                await this.processTTS(sentenceBuffer);
                sentenceBuffer = "";
            }
        }

        // Flush remaining
        if (sentenceBuffer.trim().length > 0 && !this.interruptGeneration) {
            await this.processTTS(sentenceBuffer);
        }

        // 4. Update memory (only if not interrupted)
        if (!this.interruptGeneration && fullResponse.trim()) {
            this.history.push({ role: "user", text: query });
            this.history.push({ role: "model", text: fullResponse });

            // Keep last 10 turns (20 entries)
            if (this.history.length > 20) {
                this.history = this.history.slice(-20);
            }
            console.log(`🧠 Agent: Memory updated. Current turns: ${this.history.length / 2}`);
        }
    }

    async processTTS(text) {
        if (this.interruptGeneration) return;

        // Send text to UI
        this.socket.send(JSON.stringify({ type: "agent_text", text }));

        // Generate Audio
        const audioBuffer = await this.tts.generateAudio(text, this.language);
        if (audioBuffer && !this.interruptGeneration) {
            // Send Audio to Frontend
            this.socket.send(audioBuffer);
        }
    }
}

// Export the shared vector store to allow uploading from Express routes
export { vectorStore };
