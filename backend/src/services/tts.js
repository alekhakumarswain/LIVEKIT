import { createClient } from "@deepgram/sdk";
import dotenv from "dotenv";
dotenv.config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export class TTSService {
    constructor() { }

    /**
     * Generates audio from text using Deepgram Aura.
     * @param {string} text The text to speak.
     * @returns {Promise<Buffer>} The audio buffer (MP3/WAV).
     */
    async generateAudio(text) {
        console.log(`🔊 TTS: Generating audio for "${text.substring(0, 20)}..."`);
        try {
            const response = await deepgram.speak.request(
                { text },
                {
                    model: "aura-asteria-en", // Start with a fast model
                    encoding: "linear16", // Raw PCM for easy playback? Or mp3 for smaller payload?
                    container: "wav", // WAV container header included
                    sample_rate: 16000,
                }
            );

            const stream = await response.getStream();
            if (stream) {
                const buffer = await this.streamToBuffer(stream);
                return buffer;
            }
            return null;
        } catch (error) {
            console.error("TTS Error:", error);
            return null;
        }
    }

    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
}
