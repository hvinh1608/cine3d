'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useState } from 'react';

const FALLBACK_HOSTS = new Set(['phimimg.com', 'img.phimapi.com']);

function canFallbackToSource(src: ImageProps['src']): src is string {
  if (typeof src !== 'string') return false;
  try {
    return FALLBACK_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/** Retry supported movie artwork directly when an optimized CDN request fails. */
export default function ResilientImage({ src, onError, unoptimized, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = typeof src === 'string' ? src : null;
  const useSourceFallback = source !== null && failedSource === source;
  const resolvedSource = useSourceFallback
    ? `/api/image-proxy?url=${encodeURIComponent(source)}`
    : src;

  return (
    <NextImage
      {...props}
      src={resolvedSource}
      unoptimized={unoptimized || useSourceFallback}
      onError={(event) => {
        onError?.(event);
        if (!useSourceFallback && canFallbackToSource(src)) setFailedSource(src);
      }}
    />
  );
}
