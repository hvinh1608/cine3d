'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import {
  BellRing, ChevronDown, Clapperboard, Clock3, Film, Heart, ListPlus,
  MessageCircle, Play, Share2, Star, Users, X,
} from 'lucide-react';
import api from '@/lib/api';
import { toggleFavorite } from '@/lib/user-library';
import { useStore } from '@/hooks/useStore';
import MovieComments from '@/components/community/MovieComments';
import type { Movie } from '@/types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type MovieDetail = Movie & {
  country?: { name: string };
  movieGenres?: { genre: { name: string; slug: string } }[];
  movieActors?: { actor: { name: string; slug?: string; avatarUrl?: string | null } }[];
  movieDirectors?: { director: { name: string; slug?: string; avatarUrl?: string | null } }[];
};

function ActionButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`group flex min-w-16 flex-col items-center gap-1.5 text-[11px] font-semibold transition ${active ? 'text-amber-300' : 'text-slate-300 hover:text-white'}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-full transition group-hover:bg-white/10 ${active ? 'bg-amber-300/15' : ''}`}>{icon}</span>
      {label}
    </button>
  );
}

export default function MovieDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, favoriteIds, showToast } = useStore();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [related, setRelated] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'gallery' | 'cast' | 'related'>('episodes');

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api.get(`${API_URL}/movies/${slug}`).then(async ({ data }) => {
      if (!alive) return;
      const detail = data as MovieDetail;
      setMovie(detail);
      void api.post(`${API_URL}/movies/${detail.id}/view`).catch(() => undefined);
      const genre = detail.movieGenres?.[0]?.genre.slug;
      try {
        const response = await api.get(`${API_URL}/movies`, { params: { genre, limit: 10 } });
        if (alive) setRelated((response.data.movies || []).filter((item: Movie) => item.id !== detail.id).slice(0, 6));
      } catch { if (alive) setRelated([]); }
    }).catch(() => alive && setError('Không tải được thông tin phim.')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (!movie?.id || !user) return;
    Promise.allSettled([api.get(`/user/follows/${movie.id}`), api.get(`${API_URL}/movies/${movie.id}/ratings/me`)]).then(([followResult, ratingResult]) => {
      if (followResult.status === 'fulfilled') setFollowing(Boolean(followResult.value.data.following));
      if (ratingResult.status === 'fulfilled') setRating(ratingResult.value.data.score);
    });
  }, [movie?.id, user]);

  const seasons = useMemo(() => {
    const groups = new Map<number, NonNullable<Movie['episodes']>>();
    for (const episode of movie?.episodes || []) {
      const season = episode.seasonNumber || 1;
      groups.set(season, [...(groups.get(season) || []), episode]);
    }
    return [...groups.entries()];
  }, [movie?.episodes]);

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-[#171820]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-300" /></div>;
  if (!movie) return <div className="grid min-h-[70vh] place-items-center bg-[#171820] text-slate-400">{error || 'Không tìm thấy phim.'}</div>;

  const isFavorite = favoriteIds.includes(movie.id);
  const firstEpisode = movie.episodes?.[0];
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: movie.title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); showToast('Đã sao chép liên kết phim.', 'success'); }
    } catch { /* User cancelled share. */ }
  };
  const toggleFollow = async () => {
    if (!user) return showToast('Vui lòng đăng nhập để theo dõi phim.', 'info');
    try { const { data } = await api.post(`/user/follows/${movie.id}`); setFollowing(data.following); showToast(data.message, 'success'); }
    catch { showToast('Không thể cập nhật theo dõi.', 'error'); }
  };
  const rate = async (score: number) => {
    if (!user) return showToast('Vui lòng đăng nhập để đánh giá.', 'info');
    setRating(score);
    try { const { data } = await api.post(`${API_URL}/movies/${movie.id}/ratings`, { score }); setMovie((current) => current ? { ...current, ratingAvg: data.ratingAvg } : current); }
    catch { showToast('Không thể gửi đánh giá.', 'error'); }
  };

  return (
    <main className="movie-detail-page min-h-screen bg-[#171820] pb-20 text-white">
      <section className="relative min-h-[440px] overflow-hidden md:min-h-[520px]">
        <Image src={movie.backdropUrl || movie.posterUrl} alt={movie.title} fill priority sizes="100vw" className="object-cover object-top opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,24,32,.95)_0%,rgba(23,24,32,.25)_43%,rgba(23,24,32,.7)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,24,32,.18)_0%,rgba(23,24,32,.04)_45%,#171820_100%)]" />
        <div className="relative mx-auto flex min-h-[440px] max-w-[1440px] items-end px-4 pb-7 pt-28 md:min-h-[520px] md:px-8 lg:px-12">
          <div className="max-w-xl pb-5 drop-shadow-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.3em] text-amber-300">CINE3D giới thiệu</p>
            <h1 className="text-4xl font-black leading-none md:text-6xl">{movie.title}</h1>
            {movie.englishTitle && <p className="mt-3 text-base text-slate-300 md:text-lg">{movie.englishTitle}</p>}
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-5 max-w-[1440px] px-4 md:px-8 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside>
            <div className="relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-lg shadow-[0_24px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10 lg:w-full">
              <Image src={movie.posterUrl} alt={movie.title} fill sizes="250px" className="object-cover" />
            </div>
            <h2 className="mt-5 text-xl font-bold">{movie.title}</h2>
            {movie.englishTitle && <p className="mt-1 text-sm text-amber-300">{movie.englishTitle}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded bg-amber-300 px-2 py-1 text-black">IMDb {movie.ratingAvg?.toFixed(1) || 'N/A'}</span>
              <span className="rounded border border-white/20 px-2 py-1">{movie.quality || 'HD'}</span>
              <span className="rounded border border-white/20 px-2 py-1">{movie.releaseYear}</span>
              <span className="rounded border border-white/20 px-2 py-1">{movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{movie.movieGenres?.map(({ genre }) => <Link key={genre.slug} href={`/the-loai/${genre.slug}`} className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-slate-300 hover:bg-white/10">{genre.name}</Link>)}</div>
            <div className="mt-6 space-y-5 text-sm leading-6 text-slate-400">
              <div><h3 className="mb-2 font-bold text-white">Giới thiệu:</h3><p className="line-clamp-[9]">{movie.description || 'Thông tin phim đang được cập nhật.'}</p></div>
              <p><b className="text-slate-200">Thời lượng:</b> {movie.duration ? `${movie.duration} phút` : 'Đang cập nhật'}</p>
              <p><b className="text-slate-200">Quốc gia:</b> {movie.country?.name || 'Đang cập nhật'}</p>
              <p><b className="text-slate-200">Đạo diễn:</b> {movie.movieDirectors?.map((item) => item.director.name).join(', ') || 'Đang cập nhật'}</p>
            </div>
            {!!movie.movieActors?.length && <div className="mt-8"><h3 className="mb-4 text-lg font-bold">Diễn viên</h3><div className="flex flex-wrap gap-4">{movie.movieActors.slice(0, 6).map(({ actor }) => <Link href={actor.slug ? `/actors/${actor.slug}` : '#'} key={actor.name} className="w-16 text-center"><span className="relative mx-auto block h-12 w-12 overflow-hidden rounded-full bg-[#292b38]">{actor.avatarUrl ? <Image src={actor.avatarUrl} alt={actor.name} fill sizes="48px" className="object-cover" /> : <Users className="m-3 text-slate-600" />}</span><span className="mt-2 block truncate text-[10px] text-slate-300">{actor.name}</span></Link>)}</div></div>}
          </aside>

          <section className="min-w-0">
            <div className="flex flex-col gap-6 border-b border-white/5 pb-6 xl:flex-row xl:items-center">
              <Link href={`/watch/${movie.slug}${firstEpisode ? `?ep=${firstEpisode.episodeOrder}` : ''}`} className="inline-flex w-fit items-center gap-3 rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 px-7 py-4 text-sm font-black text-slate-950 shadow-[0_8px_30px_rgba(251,191,36,.24)] transition hover:scale-[1.02]"><Play className="h-5 w-5 fill-current" /> Xem ngay</Link>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton label={isFavorite ? 'Đã thích' : 'Yêu thích'} active={isFavorite} onClick={() => void toggleFavorite(movie.id, movie)} icon={<Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />} />
                <ActionButton label="Theo dõi" active={following} onClick={() => void toggleFollow()} icon={<BellRing className={`h-5 w-5 ${following ? 'fill-current' : ''}`} />} />
                <ActionButton label="Thêm vào" icon={<ListPlus className="h-5 w-5" />} onClick={() => showToast('Bạn có thể quản lý playlist trong trang tài khoản.', 'info')} />
                <ActionButton label="Chia sẻ" icon={<Share2 className="h-5 w-5" />} onClick={() => void share()} />
                <ActionButton label="Bình luận" icon={<MessageCircle className="h-5 w-5" />} onClick={() => document.getElementById('movie-comments')?.scrollIntoView({ behavior: 'smooth' })} />
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-full bg-[#252735] px-3 py-2"><Star className="h-4 w-4 fill-amber-300 text-amber-300" /><b className="text-sm">{movie.ratingAvg?.toFixed(1) || '0.0'}</b><span className="text-[10px] text-slate-500">/10</span></div>
            </div>

            <nav className="flex gap-7 overflow-x-auto border-b border-white/5 pt-2 text-sm font-bold text-slate-400">
              {([['episodes', 'Tập phim'], ['gallery', 'Thông tin'], ['cast', 'Diễn viên'], ['related', 'Đề xuất']] as const).map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`whitespace-nowrap border-b-2 px-1 py-5 transition ${activeTab === key ? 'border-amber-300 text-amber-300' : 'border-transparent hover:text-white'}`}>{label}</button>)}
            </nav>

            <div className="min-h-52 py-7">
              {activeTab === 'episodes' && <div>{seasons.length ? seasons.map(([season, episodes]) => <div key={season} className="mb-7"><h3 className="mb-4 flex items-center gap-2 text-lg font-bold"><Clapperboard className="h-5 w-5 text-amber-300" /> Phần {season} <ChevronDown className="h-4 w-4 text-slate-500" /></h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{episodes.map((episode) => <Link key={episode.id} href={`/watch/${movie.slug}?ep=${episode.episodeOrder}`} className="flex items-center justify-center gap-2 rounded-md bg-[#282a38] px-3 py-3 text-xs font-semibold text-slate-300 transition hover:bg-amber-300 hover:text-black"><Play className="h-3 w-3 fill-current" /> {episode.title || `Tập ${episode.episodeOrder}`}</Link>)}</div></div>) : <p className="text-sm text-slate-500">Danh sách tập đang được cập nhật.</p>}</div>}
              {activeTab === 'gallery' && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-[#20222d] p-5"><Clock3 className="mb-3 text-amber-300" /><b>Thời lượng</b><p className="mt-1 text-sm text-slate-400">{movie.duration ? `${movie.duration} phút` : 'Đang cập nhật'}</p></div><div className="rounded-xl bg-[#20222d] p-5"><Film className="mb-3 text-amber-300" /><b>Trạng thái</b><p className="mt-1 text-sm text-slate-400">{movie.status || 'Đang cập nhật'}</p></div>{movie.trailerUrl && <button onClick={() => setShowTrailer(true)} className="col-span-full flex items-center justify-center gap-2 rounded-xl border border-white/10 p-4 font-bold hover:bg-white/5"><Play className="h-4 w-4" /> Xem trailer</button>}</div>}
              {activeTab === 'cast' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{movie.movieActors?.map(({ actor }) => <Link key={actor.name} href={actor.slug ? `/actors/${actor.slug}` : '#'} className="rounded-xl bg-[#20222d] p-4 text-sm font-semibold hover:bg-[#282a38]">{actor.name}</Link>) || <p className="text-slate-500">Đang cập nhật.</p>}</div>}
              {activeTab === 'related' && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">{related.map((item) => <Link href={`/movies/${item.slug}`} key={item.id} className="group"><span className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-[#252735]"><Image src={item.posterUrl} alt={item.title} fill sizes="180px" className="object-cover transition duration-500 group-hover:scale-105" /></span><b className="mt-2 block truncate text-xs group-hover:text-amber-300">{item.title}</b></Link>)}</div>}
            </div>

            <div className="mb-8 rounded-xl border border-white/5 bg-[#20222d] p-5">
              <div className="flex flex-wrap items-center gap-3"><span className="mr-2 text-sm font-bold">Đánh giá phim</span>{[1,2,3,4,5,6,7,8,9,10].map((score) => <button key={score} onClick={() => void rate(score)} className="transition hover:scale-125" aria-label={`Đánh giá ${score} điểm`}><Star className={`h-5 w-5 ${rating && score <= rating ? 'fill-amber-300 text-amber-300' : 'text-slate-600'}`} /></button>)}{rating && <span className="text-xs font-bold text-amber-300">{rating}/10</span>}</div>
            </div>

            <div id="movie-comments"><MovieComments movieId={movie.id} /></div>
          </section>
        </div>
      </div>

      {showTrailer && movie.trailerUrl && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur"><div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-black"><button onClick={() => setShowTrailer(false)} className="absolute right-3 top-3 z-10 rounded-full bg-black/70 p-2"><X /></button><iframe className="h-full w-full" src={movie.trailerUrl.replace('watch?v=', 'embed/')} title={`Trailer ${movie.title}`} allowFullScreen /></div></div>}
    </main>
  );
}
