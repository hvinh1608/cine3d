import { normalizeRecentSearches } from '@/data/cache/recent-searches';
import { serializeMovieQuery } from '@/features/discovery/domain/discovery-repository';

describe('serializeMovieQuery', () => {
  it('serializes only strict supported filters', () => {
    expect(serializeMovieQuery({
      page: 2.8,
      limit: 100,
      search: '  dune  ',
      genre: 'khoa-hoc',
      country: 'my',
      year: 2024,
      type: 'movie',
      sortBy: 'ratingAvg',
    })).toBe('page=2&limit=64&search=dune&genre=khoa-hoc&country=my&year=2024&type=movie&sortBy=ratingAvg');
  });

  it('clamps pagination and drops invalid years', () => {
    expect(serializeMovieQuery({ page: -3, limit: 0, year: 1200 })).toBe('page=1&limit=1');
  });
});

describe('normalizeRecentSearches', () => {
  it('trims, de-duplicates case-insensitively, and limits recents', () => {
    expect(normalizeRecentSearches(['  Dune ', 'dune', 'Tam   Quốc', '', 'Avatar'], 2))
      .toEqual(['Dune', 'Tam Quốc']);
  });
});
