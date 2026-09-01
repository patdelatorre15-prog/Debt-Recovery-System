const API_ORIGIN = 'https://debt-recovery-system.pat-delatorre15.workers.dev';

export async function onRequest({ request }) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, API_ORIGIN);
  const headers = new Headers(request.headers);

  // Keep the browser-facing Pages origin so the API's existing origin allowlist
  // and mutation safeguards continue to apply through this temporary proxy.
  headers.set('origin', incomingUrl.origin);
  headers.delete('host');

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  });

  return fetch(upstreamRequest);
}
