export function normalizeRecentSearches(values: string[], limit = 8): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const query = value.trim().replace(/\s+/g, ' ');
    const comparable = query.toLocaleLowerCase('vi');
    if (query && !unique.has(comparable)) unique.set(comparable, query);
  }
  return [...unique.values()].slice(0, limit);
}
