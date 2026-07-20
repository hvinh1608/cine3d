import { isCacheEntryFresh, selectCacheEvictions } from './cache-policy';

describe('cache policy', () => {
  it('applies TTL at the exact stale boundary', () => {
    expect(isCacheEntryFresh(101, 100)).toBe(true);
    expect(isCacheEntryFresh(100, 100)).toBe(false);
  });

  it('evicts stale and oldest entries until under the byte budget', () => {
    const entries = [
      { key: 'fresh', bytes: 60, staleAt: 1_000, updatedAt: 30 },
      { key: 'stale-old', bytes: 30, staleAt: 50, updatedAt: 10 },
      { key: 'stale-new', bytes: 30, staleAt: 60, updatedAt: 20 },
    ];
    expect(selectCacheEvictions(entries, 65, 100)).toEqual(['stale-old', 'stale-new']);
  });
});
