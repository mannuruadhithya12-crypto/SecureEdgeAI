import os

import numpy as np

EMBEDDINGS_DIR = os.path.join(os.path.dirname(__file__), "embeddings")


def embedding_path(name: str) -> str:
    os.makedirs(EMBEDDINGS_DIR, exist_ok=True)
    if not name.endswith(".npy"):
        name = f"{name}.npy"
    return os.path.join(EMBEDDINGS_DIR, name)


def save_embedding(name: str, embedding: np.ndarray) -> str:
    path = embedding_path(name)
    np.save(path, embedding)
    return path


def load_embedding(name: str) -> np.ndarray:
    path = embedding_path(name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Embedding not found: {path}")
    return np.load(path)


def cosine_similarity(a, b):
    return np.dot(a, b.T) / (np.linalg.norm(a) * np.linalg.norm(b))
