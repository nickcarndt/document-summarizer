from io import BytesIO
from typing import List

from pypdf import PdfReader


def extract_text_from_pdf(pdf_bytes: BytesIO) -> str:
    """
    Extracts text from a PDF represented as a BytesIO stream.
    Returns a single concatenated string of all page texts.
    """
    reader = PdfReader(pdf_bytes)
    pages_text: List[str] = []
    for page in reader.pages:
        try:
            content = page.extract_text() or ""
        except Exception:
            content = ""
        pages_text.append(content.strip())
    return "\n\n".join(t for t in pages_text if t)
