'use client';

import { movieImageUrl } from './movie-image';

type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * Responsive Cloudinary Fetch for movie artwork.
 * Width-aware srcset so first open does not download a multi‑MB backdrop.
 */
export default function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  return movieImageUrl(src, width, quality || 'auto:good');
}
