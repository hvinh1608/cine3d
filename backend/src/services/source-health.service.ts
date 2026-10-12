import dns from 'dns';
import net from 'net';
import { prisma } from '../lib/prisma';

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|^::$|fc|fd|fe[89ab]|::ffff:(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.))/i;

function isPrivateIp(rawAddress: string): boolean {
  const address = rawAddress.trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (!address || PRIVATE_HOST.test(address)) return true;
  if (address.startsWith('::ffff:')) {
    const mapped = address.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return isPrivateIp(mapped);
    if (/^(7f|0a|00|a9fe|c0a8|ac1[0-f])/i.test(mapped.replace(/:/g, ''))) return true;
  }
  if (net.isIPv4(address)) {
    const parts = address.split('.').map((octet) => Number(octet));
    const [a, b] = parts;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  if (net.isIPv6(address)) {
    if (
      address === '::1' ||
      address === '::' ||
      /^(0+:){7}0*1$/.test(address) ||
      /^(0+:){7}0+$/.test(address) ||
      /^f[cd][0-9a-f]{2}:/i.test(address) ||
      /^fe[89ab][0-9a-f]:/i.test(address)
    ) {
      return true;
    }
  }
  return false;
}

export async function isSafePublicUrl(rawUrl: string | URL): Promise<URL> {
  const target = new URL(String(rawUrl));
  const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    PRIVATE_HOST.test(hostname) ||
    isPrivateIp(hostname)
  ) {
    throw new Error('URL nguồn không được phép kiểm tra.');
  }
  const records = await dns.promises.lookup(hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error('URL nguồn không được phép kiểm tra.');
  }
  return target;
}

async function fetchWithSafeRedirects(initialUrl: URL, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirectCount === maxRedirects) {
        return response;
      }
      currentUrl = await isSafePublicUrl(new URL(location, currentUrl));
      continue;
    }
    return response;
  }
  throw new Error('Quá nhiều lần chuyển hướng.');
}

export async function checkVideoSource(source: { id: string; url: string; consecutiveFailures: number }) {
  const checkedAt = new Date();
  const startedAt = Date.now();
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  try {
    const target = await isSafePublicUrl(source.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      let response = await fetchWithSafeRedirects(target, { method: 'HEAD', signal: controller.signal });
      if (response.status === 405 || response.status === 403) {
        response = await fetchWithSafeRedirects(target, { method: 'GET', headers: { Range: 'bytes=0-1023' }, signal: controller.signal });
        await response.body?.cancel();
      }
      statusCode = response.status;
      if (!response.ok) errorMessage = `HTTP ${response.status}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 500) : 'Không thể kết nối nguồn.';
  }
  const healthy = !errorMessage && statusCode !== null && statusCode >= 200 && statusCode < 400;
  return prisma.videoSource.update({
    where: { id: source.id },
    data: {
      healthStatus: healthy ? 'healthy' : 'failed',
      lastCheckedAt: checkedAt,
      lastStatusCode: statusCode,
      lastResponseTimeMs: Date.now() - startedAt,
      lastError: errorMessage,
      consecutiveFailures: healthy ? 0 : source.consecutiveFailures + 1,
    },
  });
}

export async function checkDueVideoSources(limit = 20) {
  const staleAt = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const sources = await prisma.videoSource.findMany({
    where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleAt } }] },
    orderBy: [{ healthStatus: 'asc' }, { lastCheckedAt: 'asc' }],
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true, url: true, consecutiveFailures: true },
  });
  return Promise.allSettled(sources.map(checkVideoSource));
}
