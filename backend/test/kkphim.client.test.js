const test = require('node:test');
const assert = require('node:assert/strict');

test('searchMovies forwards professional search filters to KKPhim', async () => {
  const originalFetch = global.fetch;
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ status: true, data: { items: [] } }) };
  };

  try {
    const { searchMovies } = require('../dist/services/kkphim.client');
    await searchMovies('tinh', 2, 12, {
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
  } finally {
    global.fetch = originalFetch;
  }
});
