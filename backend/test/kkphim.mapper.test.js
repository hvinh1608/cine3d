const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDuration,
  mapEpisodes,
  extractListPagination,
} = require('../dist/services/kkphim.mapper');

test('parseDuration extracts minutes safely', () => {
  assert.equal(parseDuration('45 phút/tập'), 45);
  assert.equal(parseDuration(null), 0);
});

test('mapEpisodes merges matching episodes from multiple servers', () => {
  const episodes = mapEpisodes([
    { server_name: 'A', server_data: [{ name: 'Tập 1', slug: 'tap-1', link_m3u8: 'https://a/1.m3u8' }] },
    { server_name: 'B', server_data: [{ name: 'Tập 1', slug: 'tap-1', link_m3u8: 'https://b/1.m3u8' }] },
  ]);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].videoSources.length, 2);
  assert.equal(episodes[0].episodeOrder, 1);
});

test('extractListPagination handles KKPhim flat response', () => {
  const result = extractListPagination({
    items: [{ slug: 'movie' }],
    pagination: { totalItems: 10, currentPage: 2, totalItemsPerPage: 1, totalPages: 10 },
  });
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 10);
  assert.equal(result.items.length, 1);
});
