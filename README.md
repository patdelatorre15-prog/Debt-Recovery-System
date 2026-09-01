# Debt Recovery System

Standalone Step 5 Build for Tiny Tools Studio. The approved visual baseline is **Design D — Soft Modern Hybrid**. The application consists of a static Cloudflare Pages frontend, a separate Cloudflare Worker API, and Cloudflare D1.

## Repository layout

- Frontend: `index.html`, `styles.css`, `script.js`, `config.js`, `api-client.js`, `auth.js`
- Protected Admin frontend: `admin.html`, `admin.js`
- Worker API: `worker/src/index.js`
- D1 migrations: `worker/migrations/`
- Worker configuration template: `worker/wrangler.toml`
- Automated validation: `tests/`
- Final conformance evidence: `CONFORMANCE-GAP-LIST.md`

No credentials, API keys, OAuth secrets, database IDs, or production URLs are included.

## Local validation

Prerequisite: Node.js 22 or newer. No npm dependencies are required.

```sh
npm test
npm run check
```

For visual review, serve the repository root with any static HTTP server and open `index.html`. `config.js` defaults to local review mode, which uses an isolated browser-only fixture. Do not treat fixture data as production data.

## GitHub upload

1. Create an empty private GitHub repository for the Debt Recovery System.
2. Upload the **contents of this folder** to the repository root. Do not add another enclosing folder.
3. Confirm `index.html` and the `worker/` folder are both visible at repository root.
4. Do not commit generated deployment output, credentials, `.dev.vars`, logs, caches, local databases, or `node_modules`.

## Cloudflare D1 development setup

Run from the `worker` directory after installing Wrangler locally or using Cloudflare's supported Wrangler runner:

```sh
wrangler d1 create debt-recovery-system-development
wrangler d1 migrations apply debt-recovery-system-development --local
wrangler d1 migrations apply debt-recovery-system-development --remote
```

Copy the created development database ID into a deployment-specific copy of `worker/wrangler.toml`. Never place production secrets in that file.

## Cloudflare Worker settings

- Worker name: `debt-recovery-system-api`
- Root directory: `worker`
- Configuration file: `wrangler.toml`
- Entry point: `src/index.js`
- D1 binding: `DB`
- Compatibility date: preserve the value in `wrangler.toml` unless Cloudflare requires an owner-approved update
- Cron: one consolidated daily trigger, already declared in `wrangler.toml`

Required non-secret variables:

- `APP_ENV`: `development`, `review`, or `production`
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins
- `GOOGLE_CLIENT_ID`: Google web OAuth client ID
- `PAYMENT_PROVIDER_MODE`: `payhip`, `paypal`, or `payhip_paypal`
- `PAYHIP_PRODUCT_MAP`: JSON mapping final Payhip product IDs/keys to `3months`, `6months`, or `12months`
- `PAYPAL_PRODUCT_MAP`: JSON mapping direct PayPal references to the same plan values when direct PayPal events are enabled
- `PAYPAL_ENVIRONMENT`: `sandbox` during testing, `live` only after launch approval
- `EMAIL_PROVIDER_MODE`: `development` during local/review testing, `brevo` after owner configuration
- `BREVO_SENDER_EMAIL`: `tiny.tools.studio.ph@gmail.com` unless Operations approves another sender
- `BREVO_SENDER_NAME`: `Tiny Tools Studio`

Required Worker secrets, depending on enabled providers:

- `PAYHIP_API_KEY`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `BREVO_API_KEY`

Configure secrets with Wrangler or the Cloudflare dashboard. Never put them in GitHub or frontend files.

## Google OAuth setup

Create a Web application OAuth client in the owner's Google Cloud project. Add only the exact development/review/production frontend origins that will use Google Sign-In. Put the client ID in the Worker variable and frontend `config.js`; do not use or expose a Google client secret in the browser.

## Payment setup

Payhip webhook verification follows Payhip's documented signature rule. PayPal verification posts the received webhook headers and body to PayPal's official verification endpoint using server-side credentials. Final product IDs and prices remain Operations configuration. Do not enable production payment processing until product maps have been verified with sandbox/test purchases.

Webhook endpoint: `https://<worker-domain>/api/webhooks/payment`

## Brevo setup

Brevo is required before public launch but may remain owner-configuration-pending at handoff. Set the API key as a Worker secret, verify the sender, switch `EMAIL_PROVIDER_MODE` to `brevo`, and run the approved transactional-email scenarios.

## Cloudflare Pages settings

- Project type: Pages connected to the GitHub repository
- Production branch: owner-selected launch branch (normally `main`)
- Framework preset: None
- Build command: leave blank
- Build output directory: `/`
- Root directory: repository root

Before deploying Pages, edit `config.js`: set `mode` to `production`, `apiBase` to the deployed Worker HTTPS origin, and `googleClientId` to the approved Google web OAuth client ID.

The generated `pages.dev` URL is acceptable for development/review. Public production is intended to use the owner-approved Tiny Tools Studio subdomain.

## Owner-deployed environment validation

These checks genuinely require owner-controlled deployment configuration and occur after upload in Testing:

- real Cloudflare Worker CPU time and D1 query/subrequest measurements;
- remote D1 migration and concurrency behavior;
- Google OAuth origin and real sign-in validation;
- Payhip sandbox purchase/license/refund webhook delivery;
- PayPal sandbox dispute/refund verification when enabled;
- Brevo sender/API-key delivery and retry visibility;
- deployed desktop/mobile browser visual, interaction, and accessibility acceptance;
- Cron execution and Cloudflare backup/retention infrastructure confirmation.

Passing Build conformance and receiving this package do not authorize public launch. Testing, pre-launch requirements, Final Operations Review, and Launch Approval still apply.
