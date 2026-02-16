import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testEmbedding() {
    const models = ["text-embedding-004", "embedding-001", "gemini-embedding-001"];
    console.log("🧪 Testing Embedding Models...");

    for (const m of models) {
        try {
            console.log(`\nChecking model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.embedContent("Hello world");
            if (result.embedding) {
                console.log(`✅ SUCCESS: ${m} is working!`);
                return;
            }
        } catch (err) {
            console.log(`❌ FAILED: ${m} - ${err.message}`);
        }
    }
    console.log("\n❌ All models failed. Please check if your API Key has Generative AI access enabled.");
}

testEmbedding();
