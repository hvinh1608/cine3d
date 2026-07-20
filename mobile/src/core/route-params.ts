export function firstRouteParam(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  try {
    const decoded = decodeURIComponent(candidate).trim();
    return decoded && decoded.length <= 160 ? decoded : null;
  } catch {
    return null;
  }
}

export function yearRouteParam(value: string | string[] | undefined): number | null {
  const candidate = firstRouteParam(value);
  if (!candidate || !/^\d{4}$/.test(candidate)) return null;
  const year = Number(candidate);
  return year >= 1900 && year <= 2100 ? year : null;
}
