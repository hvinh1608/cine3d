const test = require('node:test');
const assert = require('node:assert/strict');

test('PostgreSQL cache keeps hot values in memory and honors TTL', async () => {
  const previousCacheSetting = process.env.POSTGRES_CACHE_ENABLED;
  process.env.POSTGRES_CACHE_ENABLED = 'true';
  const { prisma } = require('../dist/lib/prisma');
  const delegate = prisma.cacheEntry;
  const originals = {
    findUnique: delegate.findUnique,
    upsert: delegate.upsert,
    delete: delegate.delete,
    deleteMany: delegate.deleteMany,
  };
  const stored = new Map();

  delegate.findUnique = async ({ where }) => stored.get(where.key) || null;
  delegate.upsert = async ({ where, update, create }) => {
    const value = stored.has(where.key) ? { key: where.key, ...update } : create;
    stored.set(where.key, value);
    return value;
  };
  delegate.delete = async ({ where }) => {
    const value = stored.get(where.key);
    stored.delete(where.key);
    return value;
  };
  delegate.deleteMany = async ({ where }) => {
    let count = 0;
    for (const [key, value] of stored) {
      if ((where.key && key === where.key) || (where.expiresAt?.lte && value.expiresAt <= where.expiresAt.lte)) {
        stored.delete(key);
        count += 1;
      }
    }
    return { count };
  };

  try {
    const { cacheGet, cacheSet } = require('../dist/lib/cache');
    await cacheSet('test:ttl', { ok: true }, 20);
    assert.deepEqual(await cacheGet('test:ttl'), { ok: true });
    assert.deepEqual(stored.get('test:ttl').value, { ok: true });

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(await cacheGet('test:ttl'), null);
  } finally {
    Object.assign(delegate, originals);
    if (previousCacheSetting === undefined) delete process.env.POSTGRES_CACHE_ENABLED;
    else process.env.POSTGRES_CACHE_ENABLED = previousCacheSetting;
  }
});
