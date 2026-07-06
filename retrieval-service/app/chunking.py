"""Chunking simples por caracteres, quebrando em espaço quando possível.

Suficiente para o MVP de RAG. Estratégias mais finas (por sentença/token) ficam para depois.
"""


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        # tenta cortar no último espaço dentro da janela (chunk mais limpo)
        if end < n:
            ws = text.rfind(" ", start, end)
            if ws > start + size // 2:
                end = ws
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks
