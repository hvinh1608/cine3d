import { fetchNewMovies } from './kkphim.client';
import { extractListPagination } from './kkphim.mapper';
import { ensureMovieInDb } from './movie.upsert';

const ENABLE_AUTO_SYNC = process.env.ENABLE_AUTO_MOVIE_SYNC !== 'false';
const INTERVAL_MINUTES = Math.max(15, Number(process.env.AUTO_MOVIE_SYNC_INTERVAL_MINUTES) || 60);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const DELAY_BETWEEN_MOVIES_MS = 3_000; // Nghỉ 3s giữa các phim để tuyệt đối không nghẽn DB và không lag server

let isRunning = false;
let syncTimer: NodeJS.Timeout | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Quét trang 1 phim mới cập nhật từ KKPhim và nạp tự động vào Database.
 * Chạy hoàn toàn ngầm với tốc độ chậm (throttled) để không ảnh hưởng hiệu năng web.
 */
export async function runAutoMovieSyncOnce(): Promise<{ scanned: number; updated: number }> {
  if (isRunning) return { scanned: 0, updated: 0 };
  isRunning = true;
  let updated = 0;
  let scanned = 0;

  try {
    const raw = await fetchNewMovies(1);
    const list = extractListPagination(raw);
    const items = list.items || [];
    scanned = items.length;

    for (const item of items) {
      if (!item?.slug) continue;
      try {
        await ensureMovieInDb(item.slug);
        updated++;
      } catch (err: any) {
        // Lỗi một phim riêng lẻ không dừng toàn bộ tiến trình
        console.warn(`[AutoMovieSync] Bỏ qua ${item.slug}:`, err?.message || err);
      }
      // Nghỉ giữa các phim để nhường tài nguyên CPU & connection pool cho người dùng đang xem web
      await sleep(DELAY_BETWEEN_MOVIES_MS);
    }

    if (updated > 0) {
      console.log(`[AutoMovieSync] Đã đồng bộ ngầm thành công ${updated}/${scanned} phim mới từ KKPhim.`);
    }
  } catch (error: any) {
    console.warn('[AutoMovieSync] Quét phim mới tạm thời thất bại:', error?.message || error);
  } finally {
    isRunning = false;
  }

  return { scanned, updated };
}

/**
 * Khởi động tiến trình đồng bộ phim tự động định kỳ.
 */
export function startAutoMovieSync(): void {
  if (!ENABLE_AUTO_SYNC) {
    console.log('[AutoMovieSync] Tự động đồng bộ phim đang tắt (ENABLE_AUTO_MOVIE_SYNC=false).');
    return;
  }

  console.log(`[AutoMovieSync] Đã kích hoạt chu kỳ đồng bộ phim ngầm: mỗi ${INTERVAL_MINUTES} phút.`);

  // Chạy lần đầu sau khi server khởi động 2 phút (để server tập trung khởi tạo các dịch vụ chính trước)
  const initialDelay = setTimeout(() => {
    void runAutoMovieSyncOnce();
  }, 2 * 60 * 1000);
  initialDelay.unref();

  syncTimer = setInterval(() => {
    void runAutoMovieSyncOnce();
  }, INTERVAL_MS);
  syncTimer.unref();
}

export function stopAutoMovieSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
