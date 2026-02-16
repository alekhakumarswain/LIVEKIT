import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Basic in-memory vector store implementation for the prototype.
// For production, replace this with Pinecone or Chroma client.

export class VectorService {
    constructor() {
        this.documents = []; // Array of { id, text, embedding, source }
    }

    async addDocument(text, filename) {
        const chunks = this.chunkText(text, 500); // ~500 chars per chunk
        console.log(`Processing ${chunks.length} chunks from ${filename}...`);

        for (const chunk of chunks) {
            let success = false;
            // Try different models as fallback (gemini-embedding-001 confirmed working)
            const modelsToTry = ["gemini-embedding-001", "text-embedding-004", "embedding-001"];

            for (const modelName of modelsToTry) {
                if (success) break;
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.embedContent(chunk);
                    const embedding = result.embedding.values;

                    this.documents.push({
                        id: Date.now() + Math.random(),
                        text: chunk,
                        embedding: embedding,
                        source: filename
                    });
                    success = true;
                } catch (err) {
                    if (modelName === modelsToTry[modelsToTry.length - 1]) {
                        console.error(`❌ Embedding failed for all models:`, err.message);
                    }
                }
            }
        }
        console.log(`Added ${filename}. Total chunks: ${this.documents.length}`);
    }

    async search(query, topK = 3) {
        console.log(`🔍 Vector: Searching for "${query}"`);
        if (this.documents.length === 0) {
            console.log("🔍 Vector: No documents in store.");
            return [];
        }

        try {
            let queryEmbedding = null;
            const modelsToTry = ["gemini-embedding-001", "text-embedding-004", "embedding-001"];

            for (const modelName of modelsToTry) {
                if (queryEmbedding) break;
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.embedContent(query);
                    queryEmbedding = result.embedding.values;
                } catch (err) {
                    if (modelName === modelsToTry[modelsToTry.length - 1]) throw err;
                }
            }

            if (!queryEmbedding) return [];

            // Calculate Cosine Similarity
            const scoredDocs = this.documents.map(doc => ({
                ...doc,
                score: this.cosineSimilarity(queryEmbedding, doc.embedding)
            }));

            // Sort by score desceding
            scoredDocs.sort((a, b) => b.score - a.score);

            return scoredDocs.slice(0, topK);
        } catch (err) {
            console.error("Search error:", err);
            return [];
        }
    }

    chunkText(text, size) {
        // Split by sentences or paragraphs while trying to stay within 'size'
        const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= size) {
                currentChunk += sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
    }
}
