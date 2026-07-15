'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ListVideo, Play } from 'lucide-react';
import api from '../../../lib/api';
import type { Movie } from '../../../types/movie';

type PublicPlaylist = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  user: { username: string; avatar?: string | null };
  items: { id: string; movie: Movie }[];
};

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PublicPlaylist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/playlists/${id}`).then((response) => setPlaylist(response.data)).catch(() => setPlaylist(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-red-500" /></div>;
  if (!playlist) return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center"><ListVideo className="h-12 w-12 text-slate-700" /><h1 className="mt-4 text-xl font-black">Playlist không tồn tại hoặc đang riêng tư</h1><Link href="/" className="mt-5 text-sm text-red-400">Về trang chủ</Link></div>;

  return <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
    <Link href="/" className="text-sm text-slate-500 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" /> Trang chủ</Link>
    <header className="mt-7 rounded-3xl border border-white/10 bg-gradient-to-br from-red-950/40 via-slate-950/70 to-purple-950/40 p-7 md:p-10">
      <span className="text-xs font-black uppercase tracking-[.2em] text-red-400">Playlist CINE3D</span>
      <h1 className="mt-2 text-3xl font-black md:text-5xl">{playlist.name}</h1>
      {playlist.description && <p className="mt-3 max-w-2xl text-sm text-slate-400">{playlist.description}</p>}
      <p className="mt-4 text-xs text-slate-500">Tạo bởi {playlist.user.username} · {playlist.items.length} phim</p>
    </header>
    <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {playlist.items.map(({ id: itemId, movie }) => <Link key={itemId} href={`/movies/${movie.slug}`} className="group">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-900"><Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width:640px) 50vw, 17vw" className="object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100"><Play className="h-10 w-10 fill-white" /></div></div>
        <h2 className="mt-2 line-clamp-2 text-sm font-bold group-hover:text-red-300">{movie.title}</h2>
      </Link>)}
    </div>
  </main>;
}
