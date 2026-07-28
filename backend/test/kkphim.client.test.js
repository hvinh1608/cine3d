const test = require('node:test');
const assert = require('node:assert/strict');

process.env.KKPHIM_CACHE_TTL_MS = '1';
process.env.KKPHIM_STALE_CACHE_TTL_MS = '1000';
process.env.KKPHIM_RETRY_BASE_DELAY_MS = '1';
process.env.KKPHIM_CIRCUIT_FAILURE_THRESHOLD = '100';
process.env.POSTGRES_CACHE_ENABLED = 'false';

test('searchMovies forwards filters and serves stale data during an upstream outage', async () => {
  const originalFetch = global.fetch;
  let requestedUrl = '';
  const successfulResponse = { status: true, data: { items: [{ slug: 'cached-movie' }] } };
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => successfulResponse };
  };

  try {
    const { searchMovies } = require('../dist/services/kkphim.client');
    const first = await searchMovies('tinh', 2, 12, {
      category: 'hanh-dong',
      country: 'trung-quoc',
      year: 2024,
      sort_field: 'view',
      sort_type: 'desc',
    });

    const url = new URL(requestedUrl);
    assert.equal(url.pathname, '/v1/api/tim-kiem');
    assert.equal(url.searchParams.get('keyword'), 'tinh');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('limit'), '12');
    assert.equal(url.searchParams.get('category'), 'hanh-dong');
    assert.equal(url.searchParams.get('country'), 'trung-quoc');
    assert.equal(url.searchParams.get('year'), '2024');
    assert.equal(url.searchParams.get('sort_field'), 'view');
    assert.equal(url.searchParams.get('sort_type'), 'desc');
    assert.deepEqual(first, successfulResponse);

    await new Promise((resolve) => setTimeout(resolve, 10));
    let failedRequests = 0;
    global.fetch = async () => {
      failedRequests += 1;
      return { ok: false, status: 502 };
    };

    const stale = await searchMovies('tinh', 2, 12, {
      category: 'hanh-dong',
      country: 'trung-quoc',
      year: 2024,
      sort_field: 'view',
      sort_type: 'desc',
    });
    assert.deepEqual(stale, successfulResponse);
    assert.equal(failedRequests, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
