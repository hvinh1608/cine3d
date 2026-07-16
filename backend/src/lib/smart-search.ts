export function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function editDistance(first: string, second: string) {
  const row = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= second.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (first[i - 1] === second[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[second.length];
}

export function smartSearchScore(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const queryWords = normalizedQuery.split(' ');
  let best = 0;
  for (const value of values) {
    const normalized = normalizeSearchText(value || '');
    if (!normalized) continue;
    if (normalized === normalizedQuery) best = Math.max(best, 100);
    else if (normalized.startsWith(normalizedQuery)) best = Math.max(best, 85);
    else if (normalized.includes(normalizedQuery)) best = Math.max(best, 70);
    else {
      const words = normalized.split(' ');
      const fuzzyMatches = queryWords.filter((queryWord) => words.some((word) => queryWord.length >= 4 && editDistance(queryWord, word) <= Math.min(2, Math.floor(queryWord.length / 3))));
      if (fuzzyMatches.length === queryWords.length) best = Math.max(best, 45 + fuzzyMatches.length);
    }
  }
  return best;
}
