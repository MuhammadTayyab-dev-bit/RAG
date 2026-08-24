print("🔥🔥🔥 THIS IS MY LATEST MAIN.PY 🔥🔥🔥", flush=True)
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from models.schemas import ChatRequest, ChatResponse
from services.embedding_service import generate_embedding
from services.pinecone_service import search_similar
from services.llm_service import generate_answer


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
print("🔥 CORS MIDDLEWARE LOADED")


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    # 1. Convert question into embedding
    embedding = generate_embedding(request.question)

    # 2. Hybrid search
    results = search_similar(
        embedding,
        request.question,
        top_k=5
    )

    # 3. Extract retrieved context
    context = "\n\n".join(
        match["metadata"]["content"]
        for match in results["matches"]
    )

    # 4. Generate answer using Groq
    answer = generate_answer(
        request.question,
        context
    )

    # 5. Return final answer
    return ChatResponse(answer=answer)


# Serve frontend
app.mount(
    "/",
    StaticFiles(directory="frontend", html=True),
    name="frontend"
)