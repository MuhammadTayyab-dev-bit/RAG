
import requests

from config import GROQ_API_KEY


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def generate_answer(question: str, context: str):
    """
    Send the question and retrieved context to Groq.
    """

    prompt = f"""
Answer the user's question using only the provided context.

Context:
{context}

Question:
{question}

If the answer is not present in the context, say:
"I don't have enough information in the provided context."
"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0
    }

    response = requests.post(
        GROQ_URL,
        headers=headers,
        json=data
    )
    
    result = response.json()

    return result["choices"][0]["message"]["content"]