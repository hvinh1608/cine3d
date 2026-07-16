import Image from 'next/image';
import Link from 'next/link';
import type { Movie } from '../../types/movie';

export type PersonData = { name: string; avatarUrl?: string | null; movies: Movie[] };

export default function PersonPage({ person, role }: { person: PersonData; role: 'Diễn viên' | 'Đạo diễn' }) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8"><header className="flex items-center gap-5 rounded-3xl border border-white/5 bg-slate-950/70 p-5"><div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-slate-800">{person.avatarUrl ? <Image src={person.avatarUrl} alt={person.name} fill sizes="96px" className="object-cover" /> : <div className="grid h-full place-items-center text-3xl font-black text-slate-500">{person.name.charAt(0)}</div>}</div><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">{role}</p><h1 className="mt-1 text-3xl font-black text-white">{person.name}</h1><p className="mt-1 text-xs text-slate-500">{person.movies.length} phim trên CINE3D</p></div></header><section className="mt-8"><h2 className="mb-4 text-lg font-black">Phim đã tham gia</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{person.movies.map((movie) => <Link key={movie.id} href={`/movies/${movie.slug}`} className="group min-w-0"><div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-900"><Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width:640px) 50vw, 16vw" className="object-cover transition duration-500 group-hover:scale-105" /></div><h3 className="mt-2 truncate text-sm font-bold group-hover:text-red-400">{movie.title}</h3><p className="text-[10px] text-slate-600">{movie.releaseYear}</p></Link>)}</div></section></main>;
}
