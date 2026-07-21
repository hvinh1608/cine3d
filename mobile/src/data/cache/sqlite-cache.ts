import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeRecentSearches } from '@/data/cache/recent-searches';
import { selectCacheEvictions } from '@/data/cache/cache-policy';
import { cine3dDatabase } from '@/data/sqlite/database';

const SCHEMA_VERSION = 2;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

export interface CacheEntry<T> {
  key: string;
  value: T;
  updatedAt: number;
  staleAt: number;
}

type CacheRow = {
  key: string;
  value: string;
  updated_at: number;
  stale_at: number;
};

type RecentSearchRow = { query: string };

export class SQLiteCacheRepository {
  private databasePromise: Promise<SQLiteDatabase> | null = null;

  private async database(): Promise<SQLiteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = cine3dDatabase().then(async (database) => {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            applied_at INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS cache_entries (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            stale_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS cache_entries_stale_at_idx ON cache_entries(stale_at);
          CREATE TABLE IF NOT EXISTS recent_searches (
            query TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
            searched_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS recent_searches_searched_at_idx ON recent_searches(searched_at DESC);
          INSERT OR IGNORE INTO schema_migrations(version, applied_at)
          VALUES (1, unixepoch() * 1000);
        `);
        const migration = await database.getFirstAsync<{ version: number }>(
          'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
        );
        if ((migration?.version ?? 0) < SCHEMA_VERSION) {
          await database.withTransactionAsync(async () => {
            await database.execAsync(`
              CREATE INDEX IF NOT EXISTS cache_entries_updated_at_idx ON cache_entries(updated_at);
              INSERT OR IGNORE INTO schema_migrations(version, applied_at)
              VALUES (2, unixepoch() * 1000);
            `);
          });
        }
        const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA quick_check');
        if (integrity?.integrity_check !== 'ok') {
          await database.execAsync(`
            DROP TABLE IF EXISTS cache_entries;
            DROP TABLE IF EXISTS recent_searches;
            CREATE TABLE cache_entries (
              key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL,
              updated_at INTEGER NOT NULL, stale_at INTEGER NOT NULL
            );
            CREATE INDEX cache_entries_stale_at_idx ON cache_entries(stale_at);
            CREATE INDEX cache_entries_updated_at_idx ON cache_entries(updated_at);
            CREATE TABLE recent_searches (
              query TEXT PRIMARY KEY NOT NULL COLLATE NOCASE, searched_at INTEGER NOT NULL
            );
            CREATE INDEX recent_searches_searched_at_idx ON recent_searches(searched_at DESC);
          `);
        }
        return database;
      });
    }
    return this.databasePromise;
  }

  async set<T>(key: string, value: T, staleTimeMs: number): Promise<void> {
    const now = Date.now();
    const database = await this.database();
    await database.runAsync(
      `INSERT INTO cache_entries(key, value, updated_at, stale_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
       stale_at = excluded.stale_at`,
      key,
      JSON.stringify(value),
      now,
      now + staleTimeMs,
    );
    await this.enforceSizeLimit();
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<CacheRow>(
      'SELECT key, value, updated_at, stale_at FROM cache_entries WHERE key = ?',
      key,
    );
    if (!row) return null;
    try {
      return {
        key: row.key,
        value: JSON.parse(row.value) as T,
        updatedAt: row.updated_at,
        staleAt: row.stale_at,
      };
    } catch {
      await this.remove(key);
      return null;
    }
  }

  async getFresh<T>(key: string, now = Date.now()): Promise<CacheEntry<T> | null> {
    const entry = await this.get<T>(key);
    return entry && entry.staleAt > now ? entry : null;
  }

  async isStale(key: string, now = Date.now()): Promise<boolean> {
    const entry = await this.get(key);
    return !entry || entry.staleAt <= now;
  }

  async remove(key: string): Promise<void> {
    const database = await this.database();
    await database.runAsync('DELETE FROM cache_entries WHERE key = ?', key);
  }

  async pruneStale(now = Date.now()): Promise<number> {
    const database = await this.database();
    const result = await database.runAsync('DELETE FROM cache_entries WHERE stale_at <= ?', now);
    return result.changes;
  }

  async enforceSizeLimit(maxBytes = DEFAULT_MAX_BYTES): Promise<number> {
    const database = await this.database();
    const rows = await database.getAllAsync<{
      key: string; bytes: number; stale_at: number; updated_at: number;
    }>('SELECT key, LENGTH(key) + LENGTH(value) AS bytes, stale_at, updated_at FROM cache_entries');
    const keys = selectCacheEvictions(
      rows.map((row) => ({
        key: row.key,
        bytes: Number(row.bytes),
        staleAt: row.stale_at,
        updatedAt: row.updated_at,
      })),
      maxBytes,
    );
    if (!keys.length) return 0;
    await database.runAsync(
      `DELETE FROM cache_entries WHERE key IN (${keys.map(() => '?').join(',')})`,
      ...keys,
    );
    return keys.length;
  }

  async addRecentSearch(value: string): Promise<void> {
    const [query] = normalizeRecentSearches([value], 1);
    if (!query) return;
    const database = await this.database();
    await database.runAsync(
      `INSERT INTO recent_searches(query, searched_at) VALUES (?, ?)
       ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at`,
      query,
      Date.now(),
    );
    await database.runAsync(
      'DELETE FROM recent_searches WHERE query NOT IN (SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT 8)',
    );
  }

  async getRecentSearches(limit = 8): Promise<string[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<RecentSearchRow>(
      'SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT ?',
      Math.min(20, Math.max(1, limit)),
    );
    return normalizeRecentSearches(rows.map((row) => row.query), limit);
  }

  async clearRecentSearches(): Promise<void> {
    const database = await this.database();
    await database.runAsync('DELETE FROM recent_searches');
  }

  async clearAll(): Promise<void> {
    const database = await this.database();
    await database.execAsync('DELETE FROM cache_entries; DELETE FROM recent_searches;');
  }

  async storageBytes(): Promise<number> {
    const database = await this.database();
    const row = await database.getFirstAsync<{ bytes: number }>(
      'SELECT COALESCE(SUM(LENGTH(key) + LENGTH(value)), 0) AS bytes FROM cache_entries',
    );
    return Number(row?.bytes || 0);
  }
}

export const cacheRepository = new SQLiteCacheRepository();
