import { parseBulkEpisodes, validateEpisode, validateMovie } from './validation';

const movie = {
  title: 'Phim', englishTitle: '', slug: 'phim-hay', description: 'Mô tả', posterUrl: 'https://cdn/p.jpg',
  backdropUrl: 'https://cdn/b.jpg', trailerUrl: '', releaseYear: 2026, duration: 120, countryId: 'vn',
  quality: 'FHD', isSeries: false, isDubbed: false, status: 'Completed', isFeatured: false,
  isTrending: false, isProposed: false, isVip: false, vipEarlyAccessUntil: null, genreIds: [],
};

describe('admin form validation', () => {
  it('validates complete movie payloads and URL/year failures', () => {
    expect(validateMovie(movie)).toEqual({});
    expect(validateMovie({ ...movie, slug: 'Bad Slug', posterUrl: 'file://x', releaseYear: 1800 })).toMatchObject({
      slug: expect.any(String), posterUrl: expect.any(String), releaseYear: expect.any(String),
    });
  });
  it('strictly validates nested episode sources and timing', () => {
    const result = validateEpisode({
      movieId: 'm', title: 'Tập 1', episodeOrder: 1, seasonNumber: 1, airDate: null,
      introEndSeconds: 100, outroStartSeconds: 50,
      videoSources: [{ server: '', quality: '', url: 'bad', type: 'hls', isPremium: true }],
      subtitles: [{ language: '', url: 'bad' }],
    });
    expect(result).toMatchObject({
      outroStartSeconds: expect.any(String), 'source.0.server': expect.any(String), 'source.0.url': expect.any(String),
      'subtitle.0.language': expect.any(String), 'subtitle.0.url': expect.any(String),
    });
  });
  it('parses web-compatible bulk rows and rejects duplicates', () => {
    const parsed = parseBulkEpisodes('1 | 1 | Tập 1 | https://cdn/1.m3u8 |\n1 | 1 | Trùng | https://cdn/2.mp4 |', 'Main', '1080p');
    expect(parsed.rows[1]?.type).toBe('mp4');
    expect(parsed.errors.duplicates).toBeDefined();
  });
});
