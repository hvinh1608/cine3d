import { createClient, type RedisClientType } from 'redis';

type MemoryEntry = { value: string; expiresAt: number };
const memory = new Map<string, MemoryEntry>();
let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let retryAfter = 0;

export async function getRedisClient() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (retryAfter > Date.now()) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const next = createClient({ url, socket: { connectTimeout: 5_000, reconnectStrategy: (retries) => Math.min(retries * 250, 3_000) } });
      next.on('error', (error) => console.warn('Redis connection error:', error.message));
      await next.connect();
      client = next as RedisClientType;
      console.log('Redis connected.');
      retryAfter = 0;
      return client;
    } catch (error) {
      console.warn('Redis unavailable; using in-memory fallback.', error);
      retryAfter = Date.now() + 30_000;
      return null;
    } finally { connecting = null; }
  })();
  return connecting;
}

function readMemory(key: string) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { memory.delete(key); return null; }
  return entry.value;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    const raw = redis ? await redis.get(key) : readMemory(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch (error) {
    console.warn(`Cache read failed for ${key}.`, error);
    const raw = readMemory(key);
    return raw ? JSON.parse(raw) as T : null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlMs: number) {
  const raw = JSON.stringify(value);
  memory.set(key, { value: raw, expiresAt: Date.now() + ttlMs });
  try { const redis = await getRedisClient(); if (redis) await redis.set(key, raw, { PX: ttlMs }); }
  catch (error) { console.warn(`Cache write failed for ${key}; memory fallback remains active.`, error); }
}

export async function cacheDelete(key: string) {
  memory.delete(key);
  try { const redis = await getRedisClient(); if (redis) await redis.del(key); }
  catch (error) { console.warn(`Cache delete failed for ${key}.`, error); }
}

export async function redisStatus() {
  const redis = await getRedisClient();
  return redis?.isReady ? 'connected' : process.env.REDIS_URL ? 'fallback' : 'disabled';
}

export async function closeRedis() {
  if (client?.isOpen) await client.quit();
  client = null;
}
