import re
import pandas as pd
from pinecone import Pinecone

from config import PINECONE_API_KEY, PINECONE_INDEX_NAME
from services.embedding_service import model


# ============================================================
# Pinecone Connection
# ============================================================

pc = Pinecone(api_key=PINECONE_API_KEY)

index = pc.Index(PINECONE_INDEX_NAME)


# ============================================================
# Upload Dataset
# ============================================================

def upload_dataset():
    """
    Generate embeddings for all chunks and upload them to Pinecone.
    """

    df = pd.read_csv("dataset/fastapi_rag_chunks.csv")

    embeddings = model.encode(
        df["content"].tolist()
    )

    vectors = []

    for i, row in df.iterrows():

        vectors.append({
            "id": row["chunk_id"],
            "values": embeddings[i].tolist(),
            "metadata": {
                "document_id": row["document_id"],
                "title": row["title"],
                "category": row["category"],
                "topic": row["topic"],
                "content": row["content"],
                "source": row["source"]
            }
        })

    index.upsert(
        vectors=vectors
    )

    return len(vectors)


# ============================================================
# Extract Technical Terms
# ============================================================

def extract_technical_terms(query):
    """
    Extract important technical terms from a query.

    Examples:
        response_model
        item_id
        user_agent
        OAuth2PasswordBearer
        BackgroundTasks
        OpenAPI
        Authorization
    """

    query_lower = query.lower()

    terms = set()

    # --------------------------------------------------------
    # Snake_case identifiers
    # --------------------------------------------------------

    snake_case_terms = re.findall(
        r'(?<![a-zA-Z0-9_])'
        r'[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9_]+'
        r'(?![a-zA-Z0-9_])',
        query_lower
    )

    terms.update(snake_case_terms)

    # --------------------------------------------------------
    # Technical / meaningful words
    # --------------------------------------------------------

    technical_words = re.findall(
        r'\b[A-Za-z][A-Za-z0-9]{4,}\b',
        query
    )

    stop_words = {
        "what",
        "does",
        "how",
        "when",
        "where",
        "which",
        "why",
        "this",
        "that",
        "these",
        "those",
        "with",
        "from",
        "into",
        "than",
        "then",
        "they",
        "them",
        "their",
        "about",
        "using",
        "use",
        "used",
        "fastapi",
        "parameter",
        "parameters",
        "python",
        "function"
    }

    for word in technical_words:

        word_lower = word.lower()

        if word_lower not in stop_words:
            terms.add(word_lower)

    return terms


# ============================================================
# Exact Term Search
# ============================================================

def exact_term_search(query):
    """
    Search the original CSV for exact technical terms.
    """

    df = pd.read_csv(
        "dataset/fastapi_rag_chunks.csv"
    )

    terms = extract_technical_terms(query)

    matches = []

    for _, row in df.iterrows():

        content = row["content"].lower()

        matched_terms = []

        for term in terms:

            pattern = (
                r'(?<![a-zA-Z0-9_])'
                + re.escape(term)
                + r'(?![a-zA-Z0-9_])'
            )

            if re.search(pattern, content):
                matched_terms.append(term)

        if matched_terms:

            matches.append({
                "id": row["chunk_id"],
                "metadata": {
                    "document_id": row["document_id"],
                    "title": row["title"],
                    "category": row["category"],
                    "topic": row["topic"],
                    "content": row["content"],
                    "source": row["source"]
                },
                "matched_terms": matched_terms
            })

    return matches


# ============================================================
# Hybrid Search
# ============================================================

def search_similar(embedding, query, top_k=5):
    """
    Hybrid retrieval system.

    Step 1:
        Semantic search through Pinecone.

    Step 2:
        Exact technical-term search through CSV.

    Step 3:
        Merge both candidate sets.

    Step 4:
        Rerank candidates using semantic similarity
        and exact technical-term matches.

    Step 5:
        Return final Top K results.
    """

    # ========================================================
    # STEP 1: Semantic Retrieval
    # ========================================================

    semantic_results = index.query(
        vector=embedding,
        top_k=10,
        include_metadata=True
    )

    candidates = {}

    for match in semantic_results["matches"]:

        candidates[match["id"]] = {
            "id": match["id"],
            "semantic_score": float(match["score"]),
            "exact_matches": [],
            "metadata": match["metadata"]
        }

    # ========================================================
    # STEP 2: Exact Technical-Term Retrieval
    # ========================================================

    exact_results = exact_term_search(query)

    for match in exact_results:

        chunk_id = match["id"]

        if chunk_id not in candidates:

            candidates[chunk_id] = {
                "id": chunk_id,
                "semantic_score": 0.0,
                "exact_matches": match["matched_terms"],
                "metadata": match["metadata"]
            }

        else:

            candidates[chunk_id]["exact_matches"] = (
                match["matched_terms"]
            )

    # ========================================================
    # STEP 3: Calculate Scores
    # ========================================================

    query_terms = extract_technical_terms(query)

    total_terms = len(query_terms)

    reranked = []

    for candidate in candidates.values():

        semantic_score = candidate["semantic_score"]

        matched_terms = candidate["exact_matches"]

        # ----------------------------------------------------
        # Term Score
        # ----------------------------------------------------

        if total_terms > 0:

            term_score = (
                len(matched_terms) / total_terms
            )

        else:

            term_score = 0.0

        # ----------------------------------------------------
        # Identifier Bonus
        # ----------------------------------------------------

        identifier_bonus = 0.0

        for term in matched_terms:

            if "_" in term:
                identifier_bonus += 0.15

        identifier_bonus = min(
            identifier_bonus,
            0.30
        )

        # ----------------------------------------------------
        # Exact Match Bonus
        # ----------------------------------------------------

        exact_bonus = 0.0

        if matched_terms:
            exact_bonus = 0.10

        # ----------------------------------------------------
        # Combined Score
        # ----------------------------------------------------

        combined_score = (
            semantic_score
            + (term_score * 0.20)
            + identifier_bonus
            + exact_bonus
        )

        # ----------------------------------------------------
        # Strong boost for exact technical identifiers
        #
        # Example:
        # response_model -> CH014
        # item_id        -> CH005
        # user_agent     -> CH023
        # ----------------------------------------------------

        if any(
            "_" in term
            for term in matched_terms
        ):
            combined_score = max(
                combined_score,
                0.90
            )

        # ----------------------------------------------------
        # Store result
        # ----------------------------------------------------

        reranked.append({
            "id": candidate["id"],
            "score": combined_score,
            "semantic_score": semantic_score,
            "term_score": term_score,
            "identifier_bonus": identifier_bonus,
            "exact_bonus": exact_bonus,
            "matched_terms": matched_terms,
            "metadata": candidate["metadata"]
        })

    # ========================================================
    # STEP 4: Sort
    # ========================================================

    reranked.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    # ========================================================
    # STEP 5: Final Top K
    # ========================================================

    return {
        "matches": reranked[:top_k]
    }