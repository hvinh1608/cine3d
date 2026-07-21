import Image from '@/components/ui/ResilientImage';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock3, Play } from 'lucide-react';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
type ScheduledEpisode = { id: string; title: string; episodeOrder: number; seasonNumber?: number; airDate: string; isReleased: boolean; movie: { slug: string; title: string; posterUrl: string } };

export const metadata = { title: 'Lịch phát hành phim | CINE3D', description: 'Theo dõi lịch phát hành tập phim mới trên CINE3D.' };

export default async function SchedulePage() {
  let episodes: ScheduledEpisode[] = [];
  try {
    const response = await fetch(`${API_URL}/schedule`, { next: { revalidate: 60 } });
    if (response.ok) episodes = await response.json();
  } catch { /* Render the empty state when the API is temporarily unavailable. */ }

  const upcoming = episodes.filter((episode) => !episode.isReleased);
  const released = episodes.filter((episode) => episode.isReleased).reverse();
  const groups = upcoming.reduce((map, episode) => {
    const key = new Date(episode.airDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    map.set(key, [...(map.get(key) || []), episode]);
    return map;
  }, new Map<string, ScheduledEpisode[]>());

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 overflow-hidden rounded-3xl border border-amber-400/10 bg-gradient-to-br from-amber-400/10 via-slate-950 to-purple-500/10 p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">Không bỏ lỡ tập mới</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black md:text-4xl"><CalendarDays className="h-9 w-9 text-amber-400" /> Lịch phát hành</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Lịch dự kiến trong 30 ngày tới. Khi đến giờ phát, tập phim sẽ tự chuyển sang trạng thái có thể xem và người theo dõi phim sẽ nhận thông báo.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-amber-400/10 px-3 py-1.5 text-amber-300">{upcoming.length} tập sắp chiếu</span><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-300">{released.length} tập vừa phát</span></div>
      </header>

      {upcoming.length ? <div className="space-y-8">{[...groups.entries()].map(([date, items]) => <section key={date}><h2 className="mb-3 flex items-center gap-2 text-sm font-black capitalize text-slate-200"><Clock3 className="h-4 w-4 text-amber-400" /> {date}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((episode) => <article key={episode.id} className="flex gap-3 rounded-2xl border border-white/5 bg-slate-950/70 p-3"><Image src={episode.movie.posterUrl} alt="" width={56} height={80} className="h-20 w-14 rounded-lg object-cover" /><div className="min-w-0"><h3 className="truncate text-sm font-bold text-white">{episode.movie.title}</h3><p className="mt-1 text-xs text-slate-400">Phần {episode.seasonNumber || 1} · {episode.title}</p><time className="mt-3 block text-[11px] font-black text-amber-300">{new Date(episode.airDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time><span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-slate-600">Sắp phát hành</span></div></article>)}</div></section>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-slate-500">Chưa có tập phim sắp phát được công bố.</div>}

      {released.length > 0 && <section className="mt-12"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CheckCircle2 className="h-5 w-5 text-emerald-400" /> Vừa phát hành</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{released.slice(0, 12).map((episode) => <Link key={episode.id} href={`/watch/${episode.movie.slug}?ep=${episode.episodeOrder}`} className="group flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06]"><Image src={episode.movie.posterUrl} alt="" width={48} height={68} className="h-[68px] w-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-white">{episode.movie.title}</h3><p className="mt-1 text-xs text-slate-400">Phần {episode.seasonNumber || 1} · {episode.title}</p><time className="mt-2 block text-[10px] text-emerald-300">{new Date(episode.airDate).toLocaleString('vi-VN')}</time></div><Play className="h-4 w-4 fill-current text-emerald-400 transition group-hover:scale-110" /></Link>)}</div></section>}
    </main>
  );
}
