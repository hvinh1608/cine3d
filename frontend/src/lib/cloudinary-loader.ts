'use client';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'hnlripqh';
// phimimg.com rejects some Cloudinary Fetch requests (notably /public/images/Post),
// so load that already-CDN-backed host directly and reserve Cloudinary for phimapi.
const CLOUDINARY_FETCH_HOSTS = new Set(['img.phimapi.com']);

type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * Generate responsive Cloudinary Fetch URLs for movie artwork only.
 * Local assets and unrelated remote images bypass Cloudinary entirely.
 */
export default function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  try {
    const source = new URL(src);
    if (
      source.hostname === 'phimimg.com'
      && source.pathname.includes('/invincible-nguon-goc-atom-eve')
    ) {
      return '/invincible-atom-eve-poster.jpg';
    }
    if (CLOUDINARY_FETCH_HOSTS.has(source.hostname)) {
      const transformations = [
        'f_auto',
        'c_limit',
        `w_${width}`,
        `q_${quality || 'auto:eco'}`,
      ].join(',');

      return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${encodeURIComponent(source.toString())}`;
    }
  } catch {
    // Relative local assets intentionally bypass the remote image CDN.
  }

  return src;
}
