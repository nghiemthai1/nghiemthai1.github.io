# Digital twin maintenance

The portfolio chat uses `assets/data/experience.json` as a compact, public-only companion to the website and resume. It is prompt context, not model training data, so updates do not require retraining or replacing the model.

## Publishing checklist

1. Update the portfolio HTML and/or `assets/documents/resumes/Resume.pdf`.
2. Make the matching change in `assets/data/experience.json`.
3. Keep every record `id` stable; add a new unique ID for new roles, credentials, or projects.
4. Update `lastUpdated` using `YYYY-MM-DD`.
5. Include only facts that are safe to answer publicly. Do not add phone numbers, email addresses, home addresses, client-confidential details, or other private data.
6. Deploy `cloudflare-worker/` when its instructions, limits, or model configuration change.
7. Run `python scripts/check_local_references.py` before publishing.
8. Test at least one supported, unsupported, and unrelated question in the chat widget.

The chat runs entirely through the `thai-digital-twin-api` Cloudflare Worker. Visitors do not download a model or the chat's evidence-selection logic. The browser sends only the current question and at most four recent exchanges to Cloudflare; it never chooses or supplies facts. The Worker independently loads the authoritative public records from the published `experience.json`. It has no storage, tools, or persistent memory. Conversation history is cleared on reload, and the site permanently discloses both Cloudflare processing and the possibility of inaccurate AI output.

## Grounded answer pipeline

The Worker uses a fail-closed pipeline:

1. `@cf/meta/llama-3.2-1b-instruct` classifies the question's intent and professional facet. It never receives the profile and does not answer the question.
2. The Worker searches only fields relevant to that facet, using terms derived from the current public profile rather than a hardcoded question taxonomy. Every meaningful named term must occur in eligible evidence: AWS can match AWS, but it cannot satisfy AWS CodePipeline, and Google ADK cannot satisfy an employment question about Google.
3. `@cf/meta/llama-3.2-3b-instruct` answers using only the selected records, with temperature zero. Conversation history can clarify a follow-up but is never treated as factual evidence.
4. The 3B model checks every claim in the completed draft against the selected facts. If intent output is malformed, evidence is missing, the verifier is uncertain, or any claim is unsupported, the Worker replaces the draft with: “That detail is not included in my public experience profile.”

This design uses no browser-side intent keywords, embedding model, vector database, or persistent index. Stable record IDs remain internal to the Worker. Degree answers, named technologies, employers, credentials, dates, and results are subject to the same field-aware evidence selection and post-generation grounding check.

## Cloudflare deployment

The Worker source and Wrangler configuration are in `cloudflare-worker/`. It uses the Workers AI binding named `AI`, allows the production GitHub Pages origin plus the two documented local-development origins, validates bounded request bodies, and streams model output without logging chat content.

The endpoint is protected by a managed Turnstile check, server-side origin and security validation, a 16 KB body limit, and a six-request-per-minute rate limit per visitor IP. After the first successful Turnstile check, the Worker issues a signed, IP-and-browser-bound session token that lasts up to 30 minutes and remains only in page memory. This avoids another visible human check for every message without weakening server-side validation. The signing and Turnstile secrets are stored only as encrypted Worker bindings. The account remains on the Workers AI Free allocation, so inference stops at Cloudflare's daily free limit instead of creating paid overage.

The connected Cloudflare account is sufficient for deployment; no API key or secret belongs in this repository or the browser. A manual deployment can be made from `cloudflare-worker/` with `npx wrangler login`, `npx wrangler secret put TURNSTILE_SECRET`, `npx wrangler secret put SESSION_SECRET`, and `npx wrangler deploy`. The public endpoint configured in the site is `https://thai-digital-twin-api.nghiemthai1.workers.dev/chat`.
