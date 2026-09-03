# Synchronized deployment required — V7 Modal Contract

The frontend and Worker must be deployed from this same package. Deploying only the static site leaves the browser calling an older API, which causes saving actions inside modals to return `not_found`.

## Required deployment order

1. Deploy `worker/src/index.js` using `worker/wrangler.toml` and the existing production bindings.
2. Confirm `GET /api/health` returns build `2026-09-03-v7-modal-contract`.
3. Deploy the site files, including `script.js`, `api-client.js`, and the Pages Function proxy.
4. Clear the Cloudflare build cache if the old JavaScript remains visible.
5. Retest modal Save/Confirm actions on every page.

No database reset or migration is required for this correction.
