import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function cine3dDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync('cine3d.db').then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
      `);
      return database;
    });
  }
  return databasePromise;
}
