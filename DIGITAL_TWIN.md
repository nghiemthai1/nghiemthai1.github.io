# Digital twin maintenance

The portfolio chat uses `assets/data/experience.json` as a compact, public-only companion to the website and resume. It is prompt context, not model training data, so updates do not require retraining or replacing the model.

## Publishing checklist

1. Update the portfolio HTML and/or `assets/documents/resumes/Resume.pdf`.
2. Make the matching change in `assets/data/experience.json`.
3. Keep every record `id` stable; add a new unique ID for new roles, credentials, or projects.
4. Update `lastUpdated` using `YYYY-MM-DD`.
5. Include only facts that are safe to answer publicly. Do not add phone numbers, email addresses, home addresses, client-confidential details, or other private data.
6. Run `python scripts/check_local_references.py` before publishing.
7. Test at least one supported, unsupported, and unrelated question in the chat widget.

The browser downloads the pinned Qwen2.5 0.5B instruct `q4` model (about 800 MB including tokenizer/configuration files) from Hugging Face only after a visitor opts in. The same graph supports the user-approved WASM fallback. Prompts, answers, and conversation history stay in memory in the visitor's browser and are cleared on reload.

## How question context is selected

The full `experience.json` file is not placed in every prompt. On page load, the browser builds a small in-memory lexical index from the public records. For each question it removes common words, scores exact normalized token matches, gives extra weight to matching organizations, roles, projects, and credentials, and injects at most the four highest-ranked records. Broad overview questions receive the profile summary and three recent roles. The prompt also includes only the latest four conversation exchanges.

This is a lightweight local retrieval step rather than vector search: it requires no embedding-model download, vector database, server, or persistent index.
