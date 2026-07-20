export interface EvictableCacheEntry {
  key: string;
  bytes: number;
  staleAt: number;
  updatedAt: number;
}

export function isCacheEntryFresh(staleAt: number, now = Date.now()): boolean {
  return Number.isFinite(staleAt) && staleAt > now;
}

export function selectCacheEvictions(
  entries: EvictableCacheEntry[],
  maxBytes: number,
  now = Date.now(),
): string[] {
  let total = entries.reduce((sum, entry) => sum + Math.max(0, entry.bytes), 0);
  if (total <= maxBytes) return [];
  const ordered = [...entries].sort((a, b) => {
    const aStale = a.staleAt <= now ? 0 : 1;
    const bStale = b.staleAt <= now ? 0 : 1;
    return aStale - bStale || a.updatedAt - b.updatedAt;
  });
  const selected: string[] = [];
  for (const entry of ordered) {
    if (total <= maxBytes) break;
    selected.push(entry.key);
    total -= Math.max(0, entry.bytes);
  }
  return selected;
}
