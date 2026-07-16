import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
type ScheduledEpisode = { id: string; title: string; episodeOrder: number; seasonNumber?: number; airDate: string; movie: { slug: string; title: string; posterUrl: string } };

export const metadata = { title: 'Lịch phát hành phim | CINE3D', description: 'Lịch các tập phim sắp phát hành trong 30 ngày tới.' };

export default async function SchedulePage() {
  let episodes: ScheduledEpisode[] = [];
  try { const response = await fetch(`${API_URL}/schedule`, { next: { revalidate: 900 } }); if (response.ok) episodes = await response.json(); } catch { /* show empty state */ }
  const groups = episodes.reduce((map, episode) => { const key = new Date(episode.airDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }); map.set(key, [...(map.get(key) || []), episode]); return map; }, new Map<string, ScheduledEpisode[]>());
  return <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8"><div className="mb-8"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">Không bỏ lỡ tập mới</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black"><CalendarDays className="h-8 w-8 text-amber-400" /> Lịch phát hành</h1><p className="mt-2 text-sm text-slate-500">Các tập dự kiến phát trong 30 ngày tới.</p></div>{episodes.length ? <div className="space-y-8">{[...groups.entries()].map(([date, items]) => <section key={date}><h2 className="mb-3 text-sm font-black capitalize text-slate-300">{date}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((episode) => <Link key={episode.id} href={`/watch/${episode.movie.slug}?ep=${episode.episodeOrder}`} className="flex gap-3 rounded-xl border border-white/5 bg-slate-950/70 p-3 transition hover:border-red-500/30 hover:bg-slate-900"><Image src={episode.movie.posterUrl} alt="" width={48} height={68} className="h-[68px] w-12 rounded-md object-cover" /><div className="min-w-0"><h3 className="truncate text-sm font-bold text-white">{episode.movie.title}</h3><p className="mt-1 text-xs text-slate-400">Phần {episode.seasonNumber || 1} · {episode.title}</p><time className="mt-2 block text-[10px] font-bold text-amber-300">{new Date(episode.airDate).toLocaleString('vi-VN')}</time></div></Link>)}</div></section>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-sm text-slate-500">Chưa có lịch phát hành được công bố.</div>}</main>;
}
