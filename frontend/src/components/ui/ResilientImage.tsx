'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useState } from 'react';

const PROXY_FALLBACK_HOSTS = new Set(['img.phimapi.com']);
const ATOM_EVE_IMAGE_PATH = '/invincible-atom-eve-poster.jpg';
const MOVIE_PLACEHOLDER_PATH = '/movie-placeholder.svg';
const failedSources = new Set<string>();
const failedProxySources = new Set<string>();

function knownLocalReplacement(src: ImageProps['src']): string | null {
  if (typeof src !== 'string') return null;
  try {
    const url = new URL(src);
    if (url.hostname === 'phimimg.com' && url.pathname.includes('/invincible-nguon-goc-atom-eve')) {
      return ATOM_EVE_IMAGE_PATH;
    }
  } catch {
    // Relative paths and static imports do not need replacement.
  }
  return null;
}

function canFallbackToProxy(src: ImageProps['src']): src is string {
  if (typeof src !== 'string') return false;
  try {
    return PROXY_FALLBACK_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/** Retry supported movie artwork directly when an optimized CDN request fails. */
export default function ResilientImage({ src, onError, unoptimized, ...props }: ImageProps) {
  const source = typeof src === 'string' ? src : null;
  const [failedSource, setFailedSource] = useState<string | null>(() =>
    source && failedSources.has(source) ? source : null
  );
  const [, forceFallbackRender] = useState(0);
  const sourceFailed = source !== null && failedSource === source;
  const useProxyFallback = sourceFailed && canFallbackToProxy(src) && !failedProxySources.has(source);
  const resolvedSource = knownLocalReplacement(src)
    || (sourceFailed
      ? useProxyFallback
        ? `/api/image-proxy?url=${encodeURIComponent(source)}`
        : MOVIE_PLACEHOLDER_PATH
      : src);

  return (
    <NextImage
      {...props}
      src={resolvedSource}
      unoptimized={unoptimized || sourceFailed}
      onError={(event) => {
        onError?.(event);
        if (!sourceFailed && source) {
          failedSources.add(source);
          setFailedSource(source);
        } else if (useProxyFallback) {
          failedProxySources.add(source);
          forceFallbackRender((version) => version + 1);
        }
      }}
    />
  );
}
