# Debt Recovery System

Standalone source package for the Debt Recovery System. This package is intentionally plain HTML, CSS, and JavaScript so it can be reviewed or uploaded without React, Next.js, a database, or install commands.

## Local review
Open `index.html` in a browser, or serve this folder with any static file server.

## GitHub + Cloudflare Pages
1. Create a private repository named `debt-recovery-system`.
2. Upload all files in this folder to the repository root and commit to `main`.
3. In Cloudflare Pages, connect the repository.
4. Framework preset: **None**.
5. Build command: leave blank. Output directory: `.`.
6. Keep the project private until public access is approved.

## Later production architecture
The interactive mockup is the visual foundation only. The approved production plan adds server-side Google authentication, Cloudflare Worker API routes, Cloudflare D1 persistence, Payhip/PayPal events, and Brevo transactional email. Those credentials and production bindings must be configured in the deployment environment, never inside this ZIP.

## Included
`index.html`, `styles.css`, `script.js`, and this README. No secrets, caches, `node_modules`, build output, or runtime data are included.
