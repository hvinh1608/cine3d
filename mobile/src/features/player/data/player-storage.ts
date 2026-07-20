import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { DownloadStatus } from '@/features/player/domain/player-utils';
import { playerApi } from './player-api';
import { redactErrorMessage } from '@/core/reliability';

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export interface PlaybackCheckpoint {
  profileKey: string;
  movieId: string;
  episodeId: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export interface DownloadRecord {
  id: string;
  movieId: string;
  episodeId: string;
  sourceId: string;
  title: string;
  quality: string;
  localUri: string;
  status: DownloadStatus;
  bytesWritten: number;
  totalBytes: number;
  pauseState?: DownloadPauseState | null;
  error?: string | null;
  updatedAt: number;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
async function database() {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('cine3d.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS playback_checkpoints (
          profile_key TEXT NOT NULL, movie_id TEXT NOT NULL, episode_id TEXT NOT NULL,
          position REAL NOT NULL, duration REAL NOT NULL, updated_at INTEGER NOT NULL,
          PRIMARY KEY(profile_key, movie_id)
        );
        CREATE TABLE IF NOT EXISTS player_downloads (
          id TEXT PRIMARY KEY NOT NULL, movie_id TEXT NOT NULL, episode_id TEXT NOT NULL,
          source_id TEXT NOT NULL, title TEXT NOT NULL, quality TEXT NOT NULL,
          local_uri TEXT NOT NULL, status TEXT NOT NULL, bytes_written INTEGER NOT NULL DEFAULT 0,
          total_bytes INTEGER NOT NULL DEFAULT 0, pause_state TEXT, error TEXT, updated_at INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export const checkpointRepository = {
  async get(profileKey: string, movieId: string): Promise<PlaybackCheckpoint | null> {
    const db = await database();
    const row = await db.getFirstAsync<{
      profile_key: string; movie_id: string; episode_id: string; position: number; duration: number; updated_at: number;
    }>('SELECT * FROM playback_checkpoints WHERE profile_key = ? AND movie_id = ?', profileKey, movieId);
    return row ? {
      profileKey: row.profile_key,
      movieId: row.movie_id,
      episodeId: row.episode_id,
      position: row.position,
      duration: row.duration,
      updatedAt: row.updated_at,
    } : null;
  },
  async save(value: PlaybackCheckpoint) {
    const db = await database();
    await db.runAsync(
      `INSERT INTO playback_checkpoints VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_key, movie_id) DO UPDATE SET episode_id=excluded.episode_id,
       position=excluded.position, duration=excluded.duration, updated_at=excluded.updated_at`,
      value.profileKey, value.movieId, value.episodeId, value.position, value.duration, value.updatedAt,
    );
  },
};

type DownloadListener = (record: DownloadRecord) => void;
const activeTasks = new Map<string, DownloadTask>();
const listeners = new Set<DownloadListener>();
const lastProgressPersistedAt = new Map<string, number>();

function emit(record: DownloadRecord) {
  listeners.forEach((listener) => listener(record));
}

async function persist(record: DownloadRecord) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO player_downloads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET local_uri=excluded.local_uri, status=excluded.status,
     bytes_written=excluded.bytes_written, total_bytes=excluded.total_bytes,
     pause_state=excluded.pause_state, error=excluded.error, updated_at=excluded.updated_at`,
    record.id, record.movieId, record.episodeId, record.sourceId, record.title, record.quality,
    record.localUri, record.status, record.bytesWritten, record.totalBytes,
    record.pauseState ? JSON.stringify(record.pauseState) : null, record.error ?? null, record.updatedAt,
  );
  emit(record);
}

async function getRecord(id: string): Promise<DownloadRecord | null> {
  const db = await database();
  const row = await db.getFirstAsync<Record<string, string | number | null>>('SELECT * FROM player_downloads WHERE id = ?', id);
  if (!row) return null;
  return {
    id: String(row.id), movieId: String(row.movie_id), episodeId: String(row.episode_id),
    sourceId: String(row.source_id), title: String(row.title), quality: String(row.quality),
    localUri: String(row.local_uri), status: String(row.status) as DownloadStatus,
    bytesWritten: Number(row.bytes_written), totalBytes: Number(row.total_bytes),
    pauseState: (() => {
      try { return row.pause_state ? JSON.parse(String(row.pause_state)) as DownloadPauseState : null; }
      catch { return null; }
    })(),
    error: row.error ? String(row.error) : null, updatedAt: Number(row.updated_at),
  };
}

async function runTask(record: DownloadRecord, task: DownloadTask, resume = false) {
  activeTasks.set(record.id, task);
  const running = { ...record, status: 'downloading' as const, pauseState: null, error: null, updatedAt: Date.now() };
  await persist(running);
  try {
    const file = await (resume ? task.resumeAsync() : task.downloadAsync());
    if (file) {
      activeTasks.delete(record.id);
      await persist({ ...running, status: 'completed', localUri: file.uri, updatedAt: Date.now() });
    }
  } catch (error) {
    activeTasks.delete(record.id);
    const latest = await getRecord(record.id);
    if (latest?.status !== 'cancelled') {
      await persist({ ...running, status: 'failed', error: redactErrorMessage(error), updatedAt: Date.now() });
    }
  }
}

export const downloadRepository = {
  subscribe(listener: DownloadListener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  async list(): Promise<DownloadRecord[]> {
    const db = await database();
    const ids = await db.getAllAsync<{ id: string }>('SELECT id FROM player_downloads ORDER BY updated_at DESC');
    const records = (await Promise.all(ids.map(({ id }) => getRecord(id)))).filter((item): item is DownloadRecord => Boolean(item));
    return Promise.all(records.map(async (record) => {
      if (record.status === 'completed') {
        const file = new File(record.localUri);
        if (file.exists) return record;
        const missing = { ...record, status: 'failed' as const, error: 'Tệp tải xuống không còn trên thiết bị.', updatedAt: Date.now() };
        await persist(missing);
        return missing;
      }
      if (record.status !== 'downloading' || activeTasks.has(record.id)) return record;
      const interrupted = { ...record, status: 'failed' as const, error: 'Tải xuống bị gián đoạn khi ứng dụng đóng. Hãy xóa và tải lại.', updatedAt: Date.now() };
      await persist(interrupted);
      return interrupted;
    }));
  },
  get: getRecord,
  async start(input: { movieId: string; episodeId: string; sourceId: string; title: string }) {
    const existing = await downloadRepository.list();
    const usedBytes = existing
      .filter((record) => record.status === 'completed')
      .reduce((sum, record) => sum + Math.max(record.totalBytes, record.bytesWritten), 0);
    if (usedBytes >= MAX_DOWNLOAD_BYTES) {
      throw new Error('Đã đạt giới hạn 2 GB tải ngoại tuyến. Hãy xóa một số nội dung trước.');
    }
    const entitlement = await playerApi.resolveDownload(input.episodeId, input.sourceId);
    if (entitlement.source.type.toLowerCase() !== 'mp4') {
      throw new Error('Máy chủ chưa cho phép tải ngoại tuyến HLS. Chỉ nguồn MP4 được ủy quyền mới có thể tải.');
    }
    const directory = new Directory(Paths.document, 'downloads');
    if (!directory.exists) directory.create({ intermediates: true });
    const id = `${input.episodeId}-${input.sourceId}`;
    const destination = new File(directory, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`);
    const record: DownloadRecord = {
      id, ...input, quality: entitlement.source.quality, localUri: destination.uri,
      status: 'queued', bytesWritten: 0, totalBytes: 0, updatedAt: Date.now(),
    };
    await persist(record);
    const task = File.createDownloadTask(entitlement.source.url, destination, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const now = Date.now();
        if (now - (lastProgressPersistedAt.get(id) ?? 0) < 500 && bytesWritten < totalBytes) return;
        lastProgressPersistedAt.set(id, now);
        void persist({ ...record, status: 'downloading', bytesWritten, totalBytes, updatedAt: Date.now() });
      },
    });
    void runTask(record, task);
    return record;
  },
  async pause(id: string) {
    const task = activeTasks.get(id);
    const record = await getRecord(id);
    if (!task || !record) return;
    await task.pauseAsync();
    activeTasks.delete(id);
    await persist({ ...record, status: 'paused', pauseState: task.savable(), updatedAt: Date.now() });
  },
  async resume(id: string) {
    const record = await getRecord(id);
    if (!record?.pauseState) throw new Error('Không còn dữ liệu để tiếp tục tải.');
    const task = DownloadTask.fromSavable(record.pauseState, {
      onProgress: ({ bytesWritten, totalBytes }) => void persist({ ...record, status: 'downloading', bytesWritten, totalBytes, updatedAt: Date.now() }),
    });
    void runTask(record, task, true);
  },
  async cancel(id: string) {
    activeTasks.get(id)?.cancel();
    activeTasks.delete(id);
    lastProgressPersistedAt.delete(id);
    const record = await getRecord(id);
    if (record) await persist({ ...record, status: 'cancelled', pauseState: null, updatedAt: Date.now() });
  },
  async retry(id: string) {
    const record = await getRecord(id);
    if (!record) throw new Error('Không tìm thấy bản tải.');
    await downloadRepository.remove(id);
    return downloadRepository.start({
      movieId: record.movieId,
      episodeId: record.episodeId,
      sourceId: record.sourceId,
      title: record.title,
    });
  },
  async remove(id: string) {
    await this.cancel(id);
    const record = await getRecord(id);
    if (record) {
      const file = new File(record.localUri);
      if (file.exists) file.delete();
    }
    const db = await database();
    await db.runAsync('DELETE FROM player_downloads WHERE id = ?', id);
  },
};
