import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export class LLMService {
    constructor() {
        this.systemPrompt = `You are a helpful voice assistant for a technical evaluation. 
Keep your answers brief, conversational, and under 2 sentences unless asked for more details.
Do not use markdown formatting like bold or headers as this will be spoken.`;
    }

    /**
     * Generates a response based on the user's query and retrieved context.
     * @param {string} query The user's question.
     * @param {string[]} contextChunks Array of relevant text chunks.
     * @returns {AsyncGenerator<string>} Stream of text chunks.
     */
    async *generateStream(query, contextChunks = []) {
        let contextText = "";
        if (contextChunks.length > 0) {
            contextText = `
Here is some relevant context to answer the question:
${contextChunks.join("\n---\n")}
`;
        }

        const fullPrompt = `${this.systemPrompt}\n${contextText}\nUser: ${query}\nAssistant:`;

        console.log("🤖 LLM: Generating response for query:", query);
        console.log("🤖 LLM: Context used:", contextChunks.length > 0 ? "Yes" : "No");

        try {
            const result = await model.generateContentStream(fullPrompt);
            console.log("🤖 LLM: Stream started");

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    yield text;
                }
            }
        } catch (error) {
            console.error("LLM Generation Error:", error);
            yield "I'm sorry, I encountered an error generating the response.";
        }
    }
}
