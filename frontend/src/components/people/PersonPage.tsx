'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BellPlus, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Movie } from '../../types/movie';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

export type PersonData = { id: string; name: string; avatarUrl?: string | null; movies: Movie[] };

export default function PersonPage({ person, role, kind }: { person: PersonData; role: string; kind: 'actor' | 'director' }) {
  const { user, showToast } = useStore();
  const [following, setFollowing] = useState(false);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!user) return;
    api.get(`/people/${kind}/${person.id}/follow`).then((response) => setFollowing(Boolean(response.data?.following))).catch(() => setFollowing(false));
  }, [kind, person.id, user]);
  const toggleFollow = async () => {
    if (!user) { showToast('Vui lòng đăng nhập để theo dõi nghệ sĩ.', 'info'); return; }
    setUpdating(true);
    try { const response = await api.post(`/people/${kind}/${person.id}/follow`); setFollowing(Boolean(response.data?.following)); showToast(response.data?.following ? 'Đã theo dõi nghệ sĩ.' : 'Đã bỏ theo dõi.', 'success'); }
    catch { showToast('Không thể cập nhật theo dõi.', 'error'); }
    finally { setUpdating(false); }
  };
  return <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8"><header className="flex flex-wrap items-center gap-5 rounded-3xl border border-white/5 bg-slate-950/70 p-5"><div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-slate-800">{person.avatarUrl ? <Image src={person.avatarUrl} alt={person.name} fill sizes="96px" className="object-cover" /> : <div className="grid h-full place-items-center text-3xl font-black text-slate-500">{person.name.charAt(0)}</div>}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">{role}</p><h1 className="mt-1 text-3xl font-black text-white">{person.name}</h1><p className="mt-1 text-xs text-slate-500">{person.movies.length} phim trên CINE3D</p></div><button type="button" disabled={updating} onClick={() => void toggleFollow()} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition disabled:opacity-50 ${following ? 'border border-red-400/30 bg-red-400/10 text-red-300' : 'bg-white text-black hover:bg-red-500 hover:text-white'}`}>{following ? <BellRing className="h-4 w-4" /> : <BellPlus className="h-4 w-4" />}{following ? 'Đang theo dõi' : 'Theo dõi'}</button></header><section className="mt-8"><h2 className="mb-4 text-lg font-black">Phim đã tham gia</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{person.movies.map((movie) => <Link key={movie.id} href={`/movies/${movie.slug}`} className="group min-w-0"><div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-900"><Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width:640px) 50vw, 16vw" className="object-cover transition duration-500 group-hover:scale-105" /></div><h3 className="mt-2 truncate text-sm font-bold group-hover:text-red-400">{movie.title}</h3><p className="text-[10px] text-slate-600">{movie.releaseYear}</p></Link>)}</div></section></main>;
}
