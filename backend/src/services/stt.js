import { createClient } from "@deepgram/sdk";
import dotenv from "dotenv";
dotenv.config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

if (!process.env.DEEPGRAM_API_KEY) {
    console.error("❌ STT: DEEPGRAM_API_KEY is missing from environment variables!");
} else {
    console.log("✅ STT: Deepgram Client Initialized");
}

export class STTService {
    constructor(socket) {
        this.socket = socket;
        this.audioQueue = [];
        this.isReady = false;
    }

    async start(callback, options = {}) {
        const sampleRate = options.sampleRate || 16000;
        this.isReady = false;

        try {
            console.log(`🎤 STT: Attempting to connect to Deepgram @ ${sampleRate}Hz...`);

            this.connection = deepgram.listen.live({
                model: "nova-2",
                language: "en-US",
                smart_format: true,
                interim_results: true,
                encoding: "linear16",
                sample_rate: sampleRate,
                channels: 1,
                endpointing: 500
            });

            // Diagnostics: Check if 'open' fires
            const connectionTimeout = setTimeout(() => {
                if (!this.isReady) {
                    console.error("❌ STT: Deepgram CONNECTION TIMEOUT. 'open' event never fired after 5s.");
                    console.log("🎤 STT: Current State:", this.connection?.getReadyState ? this.connection.getReadyState() : "Unknown");
                }
            }, 5000);

            this.connection.on("open", () => {
                clearTimeout(connectionTimeout);
                console.log("✅ STT: Deepgram Connection Successfully Opened");
                this.isReady = true;
                this.flushQueue();
            });

            this.connection.on("metadata", (data) => {
                console.log("🎤 STT: Metadata Received:", JSON.stringify(data));
            });

            const handleResults = (data) => {
                const channel = data.channel || (data.results ? data.results.channels[0] : null);
                const transcript = channel?.alternatives?.[0]?.transcript || "";

                if (transcript.trim()) {
                    console.log(`🎤 STT: [${(data.is_final || data.isFinal) ? 'FINAL' : 'PARTIAL'}] ${transcript}`);
                    callback({
                        type: "transcript",
                        text: transcript,
                        isFinal: data.is_final || data.isFinal,
                        speechFinal: data.speech_final || data.speechFinal
                    });
                }
            };

            this.connection.on("Results", handleResults);
            this.connection.on("results", handleResults);
            this.connection.on("transcript", handleResults);

            this.connection.on("SpeechStarted", () => {
                console.log("🎤 STT: Speech Started Event");
                callback({ type: "speech_started" });
            });

            this.connection.on("error", (err) => {
                console.error("❌ STT: Deepgram WebSocket Error:", err);
            });

            this.connection.on("close", () => {
                console.log("🔌 STT: Deepgram Connection Closed");
                this.isReady = false;
            });

        } catch (error) {
            console.error("❌ STT: Setup Exception:", error);
        }
    }

    sendAudio(chunk) {
        const connReady = this.connection &&
            typeof this.connection.getReadyState === 'function' &&
            this.connection.getReadyState() === 1;

        if (this.isReady && connReady) {
            this.connection.send(chunk);
        } else {
            if (this.audioQueue.length === 0) {
                console.log("⏳ STT: Connection not ready yet, started buffering audio...");
            }
            if (this.audioQueue.length < 1000) {
                this.audioQueue.push(chunk);
            }
        }
    }

    flushQueue() {
        if (!this.connection || this.connection.getReadyState() !== 1) return;
        if (this.audioQueue.length > 0) {
            console.log(`🚀 STT: Flushing ${this.audioQueue.length} buffered chunks to Deepgram...`);
            while (this.audioQueue.length > 0) {
                this.connection.send(this.audioQueue.shift());
            }
        }
    }

    stop() {
        if (this.connection) {
            console.log("🛑 STT: Stopping service");
            try {
                this.connection.finish();
            } catch (e) {
                console.warn("🛑 STT: Error finishing connection:", e.message);
            }
            this.connection = null;
            this.isReady = false;
            this.audioQueue = [];
        }
    }
}
