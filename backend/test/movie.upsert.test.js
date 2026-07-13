const test = require('node:test');
const assert = require('node:assert/strict');
const { mapStoredMovie } = require('../dist/services/movie.upsert');

test('mapStoredMovie preserves VIP gating and admin playback data', () => {
  const movie = mapStoredMovie({
    id: 'movie-1',
    title: 'VIP movie',
    slug: 'vip-movie',
    isVip: true,
    episodeCount: 1,
    country: null,
    movieGenres: [],
    movieActors: [],
    movieDirectors: [],
    episodes: [{
      id: 'episode-1',
      title: 'Full',
      episodeOrder: 1,
      videoSources: [{ id: 'source-1', server: 'Admin', quality: '1080p', url: 'https://cdn.test/movie.m3u8', type: 'hls' }],
      subtitles: [{ id: 'subtitle-1', language: 'Vietnamese', url: 'https://cdn.test/movie.vtt' }],
    }],
  });

  assert.equal(movie.isVip, true);
  assert.equal(movie.episodes[0].videoSources[0].server, 'Admin');
  assert.equal(movie.episodes[0].subtitles[0].language, 'Vietnamese');
});
