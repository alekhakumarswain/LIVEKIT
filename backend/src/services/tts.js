import { createClient } from "@deepgram/sdk";
import dotenv from "dotenv";
dotenv.config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export class TTSService {
    constructor() { }

    /**
     * Generates audio from text using Deepgram.
     * @param {string} text The text to speak.
     * @param {string} language The language code (e.g., en-US, hi-IN).
     * @returns {Promise<Buffer>} The audio buffer.
     */
    async generateAudio(text, language = "en-US") {
        console.log(`🔊 TTS: Generating audio for [${language}] "${text.substring(0, 20)}..."`);

        // Model Selection based on language
        let model = "aura-asteria-en"; // Default English

        if (language.startsWith("hi")) model = "aura-stella-en"; // Fallback to English but maybe better? 
        // Note: Deepgram Aura is primarily English. For true multilingual, 
        // we might eventually need different providers or specific models.

        if (language.startsWith("es")) model = "aura-stella-en";

        try {
            const response = await deepgram.speak.request(
                { text },
                {
                    model: model,
                    encoding: "linear16",
                    container: "wav",
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
