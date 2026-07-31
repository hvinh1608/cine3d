import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type MemoryEntry = { value: unknown; expiresAt: number };
const memory = new Map<string, MemoryEntry>();
const MAX_MEMORY_ENTRIES = 500;
// Shared cache payloads can grow quickly and are disposable. Keep them in
// process memory by default so small/free PostgreSQL instances are reserved
// for durable application data. Deployments can opt in explicitly.
const databaseCacheEnabled = process.env.POSTGRES_CACHE_ENABLED === 'true';
let nextCleanupAt = 0;
let lastWarningAt = 0;

function warnOnce(message: string, error: unknown) {
  const now = Date.now();
  if (now - lastWarningAt < 60_000) return;
  lastWarningAt = now;
  console.warn(message, error);
}

function pruneMemory(now: number) {
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
  while (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = memory.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memory.delete(oldestKey);
  }
}

function scheduleDatabaseCleanup(now: number) {
  if (!databaseCacheEnabled) return;
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + 60 * 60 * 1000;
  void prisma.cacheEntry.deleteMany({
    where: { expiresAt: { lte: new Date(now) } },
  }).catch((error) => warnOnce('PostgreSQL cache cleanup failed.', error));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const local = memory.get(key);
  if (local && local.expiresAt > now) return local.value as T;
  if (local) memory.delete(key);
  if (!databaseCacheEnabled) return null;

  try {
    const stored = await prisma.cacheEntry.findUnique({ where: { key } });
    if (!stored) return null;
    if (stored.expiresAt.getTime() <= now) {
      void prisma.cacheEntry.delete({ where: { key } }).catch(() => undefined);
      return null;
    }
    pruneMemory(now);
    memory.set(key, { value: stored.value, expiresAt: stored.expiresAt.getTime() });
    return stored.value as T;
  } catch (error) {
    warnOnce('PostgreSQL cache read failed; continuing without shared cache.', error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlMs: number) {
  const now = Date.now();
  const expiresAt = new Date(now + Math.max(1, ttlMs));
  pruneMemory(now);
  memory.set(key, { value, expiresAt: expiresAt.getTime() });
  if (!databaseCacheEnabled) return;
  scheduleDatabaseCleanup(now);

  try {
    const jsonValue = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    await prisma.cacheEntry.upsert({
      where: { key },
      update: { value: jsonValue, expiresAt },
      create: { key, value: jsonValue, expiresAt },
    });
  } catch (error) {
    warnOnce('PostgreSQL cache write failed; in-memory cache remains active.', error);
  }
}

export async function cacheDelete(key: string) {
  memory.delete(key);
  if (!databaseCacheEnabled) return;
  try {
    await prisma.cacheEntry.deleteMany({ where: { key } });
  } catch (error) {
    warnOnce('PostgreSQL cache delete failed.', error);
  }
}

export function cacheStatus() {
  return databaseCacheEnabled ? 'postgres' : 'memory';
}
