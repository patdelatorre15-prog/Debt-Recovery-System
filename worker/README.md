# Debt Recovery System Worker — Build Source

This directory contains the in-progress Cloudflare Worker and D1 implementation for Step 5 — Build. It is not a deployment handoff.

## Local development configuration

1. Create a development D1 database and replace only the development database ID in `wrangler.toml`.
2. Apply migrations in order.
3. Set a development Google OAuth client ID and matching local origin.
4. Keep payment mode disabled until provider secrets and verified product mappings exist. Supported values are `payhip`, `paypal`, and `payhip_paypal`; `normalized_gateway` is retained only for controlled adapter testing.
5. Keep email mode set to `development` until Brevo is configured and tested.

Never commit production secrets. Configure `PAYHIP_API_KEY` for Payhip signature verification. Configure `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENVIRONMENT` for PayPal's server-side verification endpoint. Store product-to-plan mappings as JSON in `PAYHIP_PRODUCT_MAP` and `PAYPAL_PRODUCT_MAP` after the owner creates the final products; allowed plan values are `3months`, `6months`, and `12months`. Brevo credentials, production OAuth configuration, final product IDs, and production origins remain environment configuration.

The adapters follow provider documentation rather than accepting an unsigned normalized payload: Payhip compares the payload signature to the SHA-256 hash of the API key; PayPal posts the received headers and event to PayPal's verify-webhook-signature endpoint. Raw credentials remain Worker secrets.

The consolidated daily scheduled handler performs bounded batches for activation recovery, email delivery, expiry notices, retention, interest, and snapshots. It must be benchmarked against the Cloudflare Free limits before production clearance.
