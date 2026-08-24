from sentence_transformers import SentenceTransformer

# Load the embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")


def generate_embedding(text: str):
    """
    Convert text into a numerical embedding vector.
    """
    embedding = model.encode(text)
    return embedding.tolist()