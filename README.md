# Document AI Demo

Python + Streamlit app to summarize PDFs and ask questions about them using OpenAI models.

## Setup

1. Python 3.10+
2. Create a virtual environment and install deps:

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Set your OpenAI API key:

```
export OPENAI_API_KEY=your_key_here
```

Optionally, create a `.env` file with:

```
OPENAI_API_KEY=your_key_here
```

## Run

```
streamlit run app.py
```

Upload a PDF, get a concise summary and key points, then use the Q&A box to ask questions about the document.
