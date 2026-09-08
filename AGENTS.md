## General Guidance

### Version 1 artifacts

- Product specification: `docs/version-1-specification.md` and GitHub issue #1.
- Domain language: `CONTEXT.md`.
- Visual system: `DESIGN.md`; replace all Solara Health content with the shipping interface.
- Architecture decisions: `docs/adr/0001-azure-deployment-foundation.md` and `docs/adr/0002-google-sheets-as-record-and-calculation-engine.md`.
- Implementation tickets: GitHub issues #2 through #10.
- Work the dependency frontier; issue #2 is the first unblocked ticket.

### Version 1 constraints

- Build a mobile-first React and TypeScript frontend with a Python Azure Functions backend.
- Use Google Sheets as the sole business record and calculation engine; preserve its formulas and unrelated structures.
- Use `MM.YYYY` monthly worksheets, Customer Name as Customer ID, and STT as a per-month Customer-group counter.
- Store the current Exchange Rate in a protected `Settings` worksheet and embed the effective rate in each new VND formula.
- Version 1 creates Product Entries only; edits stay in Google Sheets and Kg is out of scope.
- Exchange the shared passphrase for a signed access token held only in page memory; require a fresh sign-in after reload, close, or sign-out; keep Google credentials and secrets exclusively in the backend.
- Use Docker Compose locally and Bicep, Key Vault, and managed identity in Azure.
- Run integration and end-to-end tests only against the separate test spreadsheet; never write test data to production.
- The primary test seam is browser to React to Azure Functions to the test spreadsheet and back to the rendered result.

### Engineering standards

- Never use the em dash character; use a plain dash (`-`) instead.
- Never auto-add an agent name as a commit-message co-author.
- Never manually modify `CHANGELOG.md` files or files marked as auto-generated.
- When writing or substantially editing long Markdown files, put each full sentence on its own line.
- Preserve normal Markdown structure, but do not wrap multiple sentences onto one physical line.
- When making technical decisions, prioritize quality, simplicity, robustness, scalability, and long-term maintainability over development cost.
- For bug fixes, first reproduce the bug in an end-to-end setting that closely reflects the end-user experience.
- When end-to-end testing, inspect the UI closely and aim for pixel-perfect results.
- If an unrelated UI issue is clearly visible during end-to-end testing, fix it along the way when practical.
- Maintain the same high standard for engineering excellence, including lint failures, test failures, and test flakiness.
- Fix observed lint failures, test failures, and test flakiness even when they are unrelated to the immediate task, when practical.
- Use enterprise-level logging and set up environments for observability.
- Always look for existing code to iterate on before creating new code.
- When fixing an issue, exhaust options within the existing implementation before introducing a new pattern or technology.
- If a new implementation is necessary, remove the old implementation to avoid duplicate logic.
- Avoid files exceeding too many lines of code; refactor them as they approach that size.
- Write thorough tests for all major functionality.
- Avoid major changes to established feature patterns and architecture unless explicitly instructed.

### Security
- Use best practices for security enterprise production, even for MVP and V1.
- rate limit all API endpoints
- Use row level security where aplicable (RLS)

### Docker dependencies

Development uses Docker.
Whenever adding a backend package, update the corresponding `package.json` or `requirements.txt` file.
After adding a backend package, tell the user to rebuild the Docker image with `docker compose up --build`.

### Issue tracker

Issues are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` at the root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.
