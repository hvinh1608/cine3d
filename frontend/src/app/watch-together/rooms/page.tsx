'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CirclePlus, Clock3, Film, LockKeyhole, Radio, Search, SlidersHorizontal, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from '../../../lib/api';
import { useStore } from '../../../hooks/useStore';
import type { Movie } from '../../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
type PublicRoom = { id: string; slug: string; episode: number; hostName: string; viewerCount: number; playing: boolean; isPrivate?: boolean; createdAt: number };

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'vừa tạo';
  if (minutes < 60) return `${minutes} phút trước`;
  return `${Math.floor(minutes / 60)} giờ trước`;
}

export default function WatchTogetherRoomsPage() {
  const { user, accessToken } = useStore();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [movies, setMovies] = useState<Record<string, Movie>>({});
  const [connected, setConnected] = useState(false);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const [mineOnly, setMineOnly] = useState(false);
  const loadingSlugs = useRef(new Set<string>());

  useEffect(() => {
    if (!accessToken) return;
    const socket = io(SOCKET_URL, { auth: { token: accessToken }, withCredentials: true, reconnection: true });
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('rooms:list', (initialRooms: PublicRoom[]) => setRooms(initialRooms || []));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('rooms:update', (nextRooms: PublicRoom[]) => setRooms(nextRooms || []));
    return () => { socket.disconnect(); };
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    const missing = [...new Set(rooms.map((room) => room.slug))]
      .filter((slug) => !movies[slug] && !loadingSlugs.current.has(slug));
    if (!missing.length) return;
    missing.forEach((slug) => loadingSlugs.current.add(slug));
    Promise.all(missing.map(async (slug) => {
      try {
        const response = await axios.get(`${API_URL}/movies/${slug}`);
        return [slug, response.data as Movie] as const;
      } catch {
        return null;
      } finally {
        loadingSlugs.current.delete(slug);
      }
    })).then((entries) => {
      if (!active) return;
      setMovies((current) => {
        const next = { ...current };
        entries.forEach((entry) => { if (entry) next[entry[0]] = entry[1]; });
        return next;
      });
    });
    return () => { active = false; };
  }, [movies, rooms]);

  const visibleRooms = useMemo(() => {
    const filtered = mineOnly && user ? rooms.filter((room) => room.hostName === user.username) : rooms;
    return [...filtered].sort((first, second) => sortMode === 'popular'
      ? second.viewerCount - first.viewerCount || second.createdAt - first.createdAt
      : second.createdAt - first.createdAt);
  }, [mineOnly, rooms, sortMode, user]);
  const totalViewers = rooms.reduce((sum, room) => sum + room.viewerCount, 0);

  if (!user) return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4"><div className="glass-panel w-full rounded-3xl p-8 text-center"><Users className="mx-auto h-12 w-12 text-red-400" /><h1 className="mt-4 text-2xl font-black">Đăng nhập để xem chung</h1><p className="mt-2 text-sm text-slate-400">Danh sách phòng và tính năng xem chung chỉ dành cho thành viên.</p><Link href="/account" className="mt-6 block rounded-xl bg-red-600 py-3 text-sm font-black">Đăng nhập / Đăng ký</Link></div></main>;

  return <main className="min-h-screen pb-20 text-white">
    <section className="relative isolate overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 -z-20 bg-[#090b16]" />
      <div className="absolute inset-0 -z-10 opacity-80" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,.28), transparent 54%), repeating-radial-gradient(ellipse at 50% 110%, rgba(127,29,29,.5) 0 18px, rgba(20,10,25,.7) 20px 42px)' }} />
      <div className="mx-auto flex min-h-[310px] max-w-7xl flex-col items-center justify-center px-4 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"><Radio className="h-3.5 w-3.5 animate-pulse" /> CÔNG CHIẾU CINE3D</span>
        <h1 className="text-3xl font-black tracking-tight md:text-5xl">Xem phim cùng bạn bè</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300 md:text-base">Tham gia phòng đang phát hoặc chọn một bộ phim để tạo phòng mới.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button onClick={() => setMineOnly((current) => !current)} className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-black transition ${mineOnly ? 'border-white bg-white text-black' : 'border-white/20 bg-black/30 text-white hover:bg-white/10'}`}><SlidersHorizontal className="h-4 w-4" /> {mineOnly ? 'Hiện tất cả' : 'Phòng của tôi'}</button>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"><CirclePlus className="h-4 w-4" /> Tạo phòng mới</Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-3"><h2 className="text-2xl font-black">Phòng xem chung</h2><span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400'}`} /></div><p className="mt-1 text-sm text-slate-500">{rooms.length} phòng trực tuyến · {totalViewers} người đang xem</p></div>
        <div className="flex rounded-xl border border-white/10 bg-slate-950/60 p-1 text-xs font-bold"><button onClick={() => setSortMode('latest')} className={`rounded-lg px-4 py-2 ${sortMode === 'latest' ? 'bg-white text-black' : 'text-slate-400'}`}>Mới nhất</button><button onClick={() => setSortMode('popular')} className={`rounded-lg px-4 py-2 ${sortMode === 'popular' ? 'bg-white text-black' : 'text-slate-400'}`}>Phổ biến</button></div>
      </div>

      {visibleRooms.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
        {visibleRooms.map((room) => {
          const movie = movies[room.slug];
          const image = movie?.backdropUrl || movie?.posterUrl;
          return <Link key={room.id} href={`/watch-together?room=${room.id}&slug=${encodeURIComponent(room.slug)}&ep=${room.episode}`} className="group block">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:border-red-500/40 group-hover:shadow-red-950/30">
              {image ? <Image src={image} alt={movie?.title || room.slug} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Film className="h-10 w-10 text-slate-700" /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
              <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black ${room.playing ? 'bg-red-600 text-white' : 'bg-slate-950/85 text-slate-300'}`}>{room.playing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{room.playing ? 'LIVE' : 'ĐANG CHỜ'}</span>
              {room.isPrivate && <span className="absolute right-3 top-3 rounded-md bg-black/75 p-1.5 text-amber-300" title="Phòng có mật khẩu"><LockKeyhole className="h-3.5 w-3.5" /></span>}
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold"><Users className="h-3 w-3" /> {room.viewerCount}</span>
            </div>
            <div className="mt-3 flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-red-500 bg-gradient-to-br from-red-500/30 to-purple-500/30 text-xs font-black">{room.hostName.charAt(0).toUpperCase()}</div><div className="min-w-0"><h3 className="truncate text-sm font-black text-white group-hover:text-red-300">Cùng xem {movie?.title || room.slug}</h3><p className="mt-0.5 truncate text-xs text-slate-400">Tập {room.episode} · {room.hostName}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 className="h-3 w-3" /> {timeAgo(room.createdAt)}</p></div></div>
          </Link>;
        })}
      </div> : <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center"><Search className="h-12 w-12 text-slate-700" /><h3 className="mt-4 text-lg font-black">Chưa có phòng đang mở</h3><p className="mt-1 text-sm text-slate-500">Hãy chọn một bộ phim và trở thành chủ phòng đầu tiên.</p><Link href="/search" className="mt-5 rounded-full bg-red-600 px-6 py-2.5 text-sm font-black">Chọn phim ngay</Link></div>}
    </section>
  </main>;
}
