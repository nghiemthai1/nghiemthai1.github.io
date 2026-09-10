# Professional AI Assistant maintenance

The Professional AI Assistant uses `assets/data/experience.json` as a compact, public-only companion to the website and resume. It is prompt context, not model training data, so updates do not require retraining or replacing the model.

The visible Th[AI] assistant uses the shared portrait animation frames on phones and desktops.
Desktop artwork is enlarged by 5% relative to the phone scale and aligned to the right, with the chat composer positioned nearby.
Three.js removes the green background and adds restrained parallax and breathing motion.
The loading poster stays hidden to avoid flashing an unprocessed image before the animation is ready.
Accessible HTML renders every conversation message and control directly inside the scene.
The visual state shifts while a question is reviewed and while the response stream is active.
No voice or mouth animation is used.

## Version 1 rollback

The original portfolio immediately before the animated assistant is preserved by the Git tag `portfolio-v1` at commit `164a0bd8910c92b00e9103ffdf10e982f6b37e1d`.
The tag is also published to the GitHub remote.
To restore Version 1 without rewriting shared history, create a new rollback branch from `portfolio-v1`, verify it locally, and merge that branch through the normal workflow.
Do not reset the shared `master` branch or force-push it.

## Publishing checklist

1. Update the portfolio HTML and/or `assets/documents/resumes/Resume.pdf`.
2. Make the matching change in `assets/data/experience.json`.
3. Keep every record `id` stable; add a new unique ID for new roles, credentials, or projects.
4. Update `lastUpdated` using `YYYY-MM-DD`.
5. Include only facts that are safe to answer publicly. Do not add phone numbers, email addresses, home addresses, client-confidential details, or other private data.
6. Deploy `cloudflare-worker/` when its instructions, limits, or model configuration change.
7. Run `python scripts/check_local_references.py` before publishing.
8. Test at least one supported, unsupported, and unrelated question in the chat widget.

The chat calls `@cf/meta/llama-3.2-3b-instruct` through the `thai-digital-twin-api` Cloudflare Worker. Visitors do not download a model. The browser sends only the current question, IDs for the locally selected public records, and at most four recent exchanges to Cloudflare. The Worker independently loads the authoritative records from the published `experience.json`; it does not trust browser-supplied facts. It has no storage, tools, or persistent memory. Conversation history is cleared on reload, and the site permanently discloses both Cloudflare processing and the possibility of inaccurate AI output.

## How question context is selected

The full `experience.json` file is not placed in every prompt.
On page load, the browser builds a small in-memory lexical index from the public records.
For each question it removes common words, scores exact normalized token matches, gives extra weight to matching organizations, roles, projects, and credentials, and injects at most the four highest-ranked records.
Broad overview questions receive the profile summary and three recent roles.
Maintained topic routes provide deliberate cross-career context for industries, tools and technologies, professional differentiators, web development, physical robotics, Rowan University, and career progression questions.
Behavioral questions about project approach are answered locally with an invitation to continue the discussion in a real conversation.
The prompt also includes only the latest four conversation exchanges.

Education and degree questions are answered deterministically from the structured education records in `experience.json`. These answers do not call the generative model, which keeps degree names, institutions, dates, GPAs, and honors exact and prevents unsupported degrees from being invented.

This is a lightweight local retrieval step rather than vector search: it requires no embedding model, vector database, or persistent index. Only stable record IDs are sent to the inference Worker, which resolves those IDs against the published profile.

## Cloudflare deployment

The Worker source and Wrangler configuration are in `cloudflare-worker/`. It uses the Workers AI binding named `AI`, allows the production GitHub Pages origin plus the two documented local-development origins, validates bounded request bodies, and streams model output without logging chat content.

The endpoint is protected by a managed Turnstile check, server-side origin and scope validation, a 16 KB body limit, and a six-request-per-minute rate limit per visitor IP. After the first successful Turnstile check, the Worker issues a signed, IP-and-browser-bound session token that lasts up to 30 minutes and remains only in page memory. This avoids another visible human check for every message without weakening server-side validation. The signing and Turnstile secrets are stored only as encrypted Worker bindings. The account remains on the Workers AI Free allocation, so inference stops at Cloudflare's daily free limit instead of creating paid overage.

The connected Cloudflare account is sufficient for deployment; no API key or secret belongs in this repository or the browser. A manual deployment can be made from `cloudflare-worker/` with `npx wrangler login`, `npx wrangler secret put TURNSTILE_SECRET`, `npx wrangler secret put SESSION_SECRET`, and `npx wrangler deploy`. The public endpoint configured in the site is `https://thai-digital-twin-api.nghiemthai1.workers.dev/chat`.

## Local Cloudflare development

Local pages automatically use Cloudflare's always-pass Turnstile test site key and the Worker at `http://localhost:8787/chat`.
Production pages continue to use the production Turnstile site key and deployed Worker.
The local Turnstile secret and a local-only session signing secret live in the ignored `cloudflare-worker/.dev.vars` file.
That file also enables `TURNSTILE_TEST_MODE`, which accepts a successful Siteverify result only when the browser origin is one of the allowlisted local origins.
Never copy these local values into the deployed Worker.

Wrangler 4.130.0 requires Node.js 22 or newer.
Use only one Windows Node version manager so its Node executable is not shadowed by another manager.
If NVM for Windows is already installed, open PowerShell as Administrator and run `nvm install 22.23.2` followed by `nvm use 22.23.2`.
Otherwise, install Volta with `winget install Volta.Volta`, close and reopen PowerShell, and then run `volta install node@22`.
Do not pipe `https://get.volta.sh` to `bash` from PowerShell because that installs the Unix build into a Linux or WSL environment instead of Windows.
From `cloudflare-worker/`, run `npm install` to install the project-pinned Wrangler version.
Run `npx wrangler login` once and then run `npm run dev`.
Workers AI uses a remote binding because Cloudflare does not simulate AI inference locally.
The remote AI call uses the connected Cloudflare account and can consume its Workers AI allocation.

In a second PowerShell terminal at the repository root, run `./serve-local.ps1 -NoBrowser`.
Open `http://localhost:8000/` and use the Professional AI Assistant normally.
Both `http://localhost:8000` and `http://127.0.0.1:8000` are accepted origins, but the frontend Worker endpoint remains `http://localhost:8787/chat`.
