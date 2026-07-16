import { prisma } from '../lib/prisma';

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1$|fc|fd)/i;

export async function checkVideoSource(source: { id: string; url: string; consecutiveFailures: number }) {
  const checkedAt = new Date();
  const startedAt = Date.now();
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  try {
    const target = new URL(source.url);
    if (!['http:', 'https:'].includes(target.protocol) || PRIVATE_HOST.test(target.hostname)) throw new Error('URL nguồn không được phép kiểm tra.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      let response = await fetch(target, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
      if (response.status === 405 || response.status === 403) {
        response = await fetch(target, { method: 'GET', headers: { Range: 'bytes=0-1023' }, redirect: 'follow', signal: controller.signal });
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
