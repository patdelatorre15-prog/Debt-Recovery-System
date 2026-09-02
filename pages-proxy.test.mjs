import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';

test('Pages API proxy preserves the API path, query, origin, and cookie', async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async request => {
    forwarded = request;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'drs_session=test; Path=/; HttpOnly; Secure; SameSite=None'
      }
    });
  };

  try {
    const request = new Request('https://debt-recoverysystem.pages.dev/api/session?check=1', {
      headers: { cookie: 'drs_session=test' }
    });
    const response = await onRequest({ request });

    assert.equal(forwarded.url, 'https://debt-recovery-system.pat-delatorre15.workers.dev/api/session?check=1');
    assert.equal(forwarded.headers.get('origin'), 'https://debt-recoverysystem.pages.dev');
    assert.equal(forwarded.headers.get('cookie'), 'drs_session=test');
    assert.match(response.headers.get('set-cookie'), /drs_session=test/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
