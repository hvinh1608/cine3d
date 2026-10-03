const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'hnlripqh';
const CLOUDINARY_FETCH_HOSTS = new Set(['img.phimapi.com', 'phimimg.com']);

/** Build a sized Cloudinary Fetch URL (or passthrough) for movie artwork. */
export function movieImageUrl(src: string, width = 1600, quality: number | string = 'auto:good'): string {
  try {
    const source = new URL(src);
    if (
      source.hostname === 'phimimg.com'
      && source.pathname.includes('/invincible-nguon-goc-atom-eve')
    ) {
      return '/invincible-atom-eve-poster.jpg';
    }
    if (CLOUDINARY_FETCH_HOSTS.has(source.hostname)) {
      // Allow retina hero widths; keep a sane upper bound for bandwidth.
      const safeWidth = Math.min(Math.max(width, 64), 1920);
      const transformations = [
        'f_auto',
        'c_limit',
        `w_${safeWidth}`,
        `q_${quality}`,
      ].join(',');
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${encodeURIComponent(source.toString())}`;
    }
  } catch {
    // Relative paths stay unchanged.
  }
  return src;
}
