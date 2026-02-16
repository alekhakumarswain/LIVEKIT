import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from dotenv import load_dotenv
from services.rag_service import RAGEngine

load_dotenv()

rag = RAGEngine()

CURRENT_SYSTEM_PROMPT = (
    "Your name is Suusri. You are a helpful AI assistant. "
    "Use the provided context to answer questions accurately. "
    "If the answer isn't in the context, use your general knowledge but mention it."
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up RAG in background so first upload isn't slow
    import asyncio
    asyncio.get_event_loop().run_in_executor(None, rag._ensure_initialized)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── LiveKit ───────────────────────────────────────────────────────────────────

@app.get("/config")
def get_config():
    return {"livekit_url": os.getenv("LIVEKIT_URL")}


@app.get("/get-token")
def get_token(participant_name: str = "user"):
    token = (
        api.AccessToken(os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET"))
        .with_identity(f"{participant_name}-{uuid.uuid4().hex[:4]}")
        .with_grants(api.VideoGrants(room_join=True, room="voice-room", can_publish=True, can_subscribe=True))
    )
    return {"token": token.to_jwt(), "room": "voice-room"}


# ── System prompt ─────────────────────────────────────────────────────────────

@app.get("/get-prompt")
def get_prompt():
    return {"prompt": CURRENT_SYSTEM_PROMPT}


@app.post("/update-prompt")
def update_prompt(prompt: str = Form(...)):
    global CURRENT_SYSTEM_PROMPT
    CURRENT_SYSTEM_PROMPT = prompt
    return {"message": "Prompt updated", "current_prompt": CURRENT_SYSTEM_PROMPT}


# ── Knowledge Base ────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    chunk_count = await rag.ingest_document(file_path)
    return {
        "message": f"Successfully ingested {file.filename}",
        "chunks": chunk_count,
        "filename": file.filename,
    }


@app.get("/list-docs")
def list_docs():
    sources = rag.list_documents()
    return {"documents": sources}


@app.post("/clear-kb")
def clear_kb():
    rag.clear_db()
    return {"message": "Knowledge base cleared."}


@app.post("/query-kb")
def query_kb(text: str = Form(...)):
    context, sources = rag.query(text)
    return {"context": context, "sources": sources}


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)