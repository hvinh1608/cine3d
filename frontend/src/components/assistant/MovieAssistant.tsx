'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Film, LoaderCircle, MessageCircle, Search, Send, Sparkles, X } from 'lucide-react';
import Image from '@/components/ui/ResilientImage';
import api from '@/lib/api';
import type { MetaItem, Movie } from '@/types/movie';

type AssistantMessage = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  movies?: Movie[];
  searchUrl?: string;
};

const starterPrompts = ['Phim kinh dị mới', 'Anime hay', 'Phim Hàn tình cảm', 'Phim được xem nhiều'];
const fillerWords = new Set(['cho', 'toi', 'minh', 'tim', 'kiem', 'goi', 'y', 'xem', 'muon', 'mot', 'vai', 'bo', 'phim', 'nao', 'co', 'hay', 'nhat', 've']);
const genreAliases: Record<string, string> = {
  'kinh di': 'kinh-di', 'tinh cam': 'tinh-cam', 'hanh dong': 'hanh-dong', 'hai huoc': 'hai-huoc',
  'vui': 'hai-huoc', 'cuoi': 'hai-huoc', 'lang man': 'tinh-cam',
  'yeu duong': 'tinh-cam', 'so': 'kinh-di', 'ma': 'kinh-di', 'gay can': 'hanh-dong',
  'danh nhau': 'hanh-dong', 'anime': 'hoat-hinh', 'hoat hinh': 'hoat-hinh',
};
const countryAliases: Record<string, string> = { 'han': 'han-quoc', 'han quoc': 'han-quoc', 'trung quoc': 'trung-quoc', 'nhat': 'nhat-ban', 'nhat ban': 'nhat-ban', 'thai': 'thai-lan', 'thai lan': 'thai-lan', 'viet nam': 'viet-nam', 'my': 'au-my' };

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildRequest(input: string, genres: MetaItem[], countries: MetaItem[]) {
  const normalized = normalize(input);
  const params = new URLSearchParams({ limit: '6' });
  const genreAlias = Object.entries(genreAliases).find(([alias]) => normalized.includes(alias));
  const countryAlias = Object.entries(countryAliases).sort(([first], [second]) => second.length - first.length).find(([alias]) => normalized.includes(alias));
  const matchedGenre = genres.find((item) => normalized.includes(normalize(item.name))) || (genreAlias ? { name: genreAlias[0], slug: genreAlias[1] } : undefined);
  const matchedCountry = countries.find((item) => normalized.includes(normalize(item.name))) || (countryAlias ? { name: countryAlias[0], slug: countryAlias[1] } : undefined);
  const year = normalized.match(/\b(19|20)\d{2}\b/)?.[0];

  if (matchedGenre) params.set('genre', matchedGenre.slug);
  if (matchedCountry) params.set('country', matchedCountry.slug);
  if (year) params.set('year', year);
  if (/anime|hoat hinh/.test(normalized)) params.set('type', 'hoathinh');
  else if (/phim bo|nhieu tap|series/.test(normalized)) params.set('type', 'series');
  else if (/phim le|movie/.test(normalized)) params.set('type', 'movie');
  if (/xem nhieu|pho bien|hot|thinh hanh/.test(normalized)) params.set('sortBy', 'views');
  else if (/danh gia|diem cao/.test(normalized)) params.set('sortBy', 'ratingAvg');

  const removable = [matchedGenre?.name, matchedCountry?.name, year].filter(Boolean).map((value) => normalize(String(value)));
  let search = normalized;
  for (const phrase of removable) search = search.replace(phrase, ' ');
  for (const alias of Object.keys(genreAliases)) search = search.replace(alias, ' ');
  search = search.split(/\s+/).filter((word) => word && !fillerWords.has(word) && !['moi', 'anime', 'series', 'movie', 'hot', 'thinh', 'hanh'].includes(word)).join(' ');
  if (search) params.set('search', search);
  return params;
}

export default function MovieAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<{ genres: MetaItem[]; countries: MetaItem[] }>({ genres: [], countries: [] });
  const [messages, setMessages] = useState<AssistantMessage[]>([{ id: 1, role: 'assistant', text: 'Chào bạn! Mình có thể tìm phim theo tên, thể loại, quốc gia, năm hoặc tâm trạng. Hôm nay bạn muốn xem gì?' }]);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    if (!open || metadata.genres.length) return;
    Promise.all([api.get('/genres'), api.get('/countries')]).then(([genreResponse, countryResponse]) => {
      setMetadata({ genres: genreResponse.data || [], countries: countryResponse.data || [] });
    }).catch(() => undefined);
  }, [metadata.genres.length, open]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, open]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  const hasConversation = useMemo(() => messages.some((message) => message.role === 'user'), [messages]);

  const ask = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;
    setInput('');
    setMessages((current) => [...current, { id: nextId.current++, role: 'user', text: cleanQuestion }]);
    setLoading(true);
    try {
      const params = buildRequest(cleanQuestion, metadata.genres, metadata.countries);
      const { data } = await api.get('/movies', { params: Object.fromEntries(params) });
      const movies = (Array.isArray(data.movies) ? data.movies : []).slice(0, 6) as Movie[];
      const searchParams = new URLSearchParams(params);
      searchParams.delete('limit');
      if (searchParams.has('search')) { searchParams.set('q', searchParams.get('search') || ''); searchParams.delete('search'); }
      setMessages((current) => [...current, {
        id: nextId.current++, role: 'assistant',
        text: movies.length ? `Mình tìm thấy ${movies.length} phim phù hợp nhất trong kho CINE3D:` : 'Mình chưa tìm thấy phim phù hợp. Bạn thử mô tả ngắn hơn hoặc chọn thể loại khác nhé.',
        movies,
        searchUrl: movies.length ? `/search?${searchParams}` : undefined,
      }]);
    } catch {
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: 'Mình chưa kết nối được kho phim. Bạn thử lại sau một chút nhé.' }]);
    } finally { setLoading(false); }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void ask(input); };

  return <>
    {open && <section aria-label="Trợ lý tìm phim" className="fixed bottom-36 right-3 z-[70] flex h-[min(650px,calc(100dvh-11rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#171820]/[.98] text-white shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-xl md:bottom-24 md:right-6 md:h-[min(650px,calc(100dvh-7rem))]">
      <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-amber-300/15 to-violet-500/10 px-4 py-3.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 text-black"><Bot className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-black">Trợ lý tìm phim</h2><p className="text-[10px] text-emerald-300">● Đang sẵn sàng</p></div><button onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></header>
      <div className="movie-assistant-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">{messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-10' : 'mr-5'}><div className={`w-fit rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'ml-auto rounded-br-md bg-amber-300 font-semibold text-black' : 'rounded-bl-md bg-[#272936] text-slate-200'}`}>{message.text}</div>{message.movies && message.movies.length > 0 && <div className="mt-2 space-y-2">{message.movies.map((movie) => <Link key={movie.id} href={`/movies/${movie.slug}`} onClick={() => setOpen(false)} className="group flex gap-3 rounded-2xl border border-white/[.06] bg-white/[.035] p-2 transition hover:border-amber-300/30 hover:bg-white/[.07]"><span className="relative h-[76px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-slate-800"><Image src={movie.posterUrl} alt={movie.title} fill sizes="52px" className="object-cover" /></span><span className="min-w-0 flex-1 py-1"><b className="line-clamp-2 text-xs group-hover:text-amber-300">{movie.title}</b><span className="mt-2 block text-[10px] text-slate-500">{movie.releaseYear} · {movie.isSeries ? 'Phim bộ' : 'Phim lẻ'} · {movie.quality || 'HD'}</span><span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-300"><Film className="h-3 w-3" /> Xem chi tiết</span></span></Link>)}</div>}{message.searchUrl && <Link href={message.searchUrl} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"><Search className="h-3.5 w-3.5" /> Xem tất cả kết quả</Link>}</div>)}
        {!hasConversation && <div className="flex flex-wrap gap-2">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)} className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/10">{prompt}</button>)}</div>}
        {loading && <div className="mr-5 flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-[#272936] px-3.5 py-2.5 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-amber-300" /> Đang tìm trong kho phim...</div>}<div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-white/10 p-3"><div className="flex items-center gap-2 rounded-2xl bg-[#242631] p-1.5 pl-3"><Sparkles className="h-4 w-4 shrink-0 text-amber-300" /><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={120} autoFocus placeholder="Ví dụ: phim Hàn tình cảm..." className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none placeholder:text-slate-600" /><button type="submit" disabled={!input.trim() || loading} aria-label="Gửi câu hỏi" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300 text-black disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button></div><p className="mt-2 text-center text-[9px] text-slate-600">Kết quả được lấy trực tiếp từ kho phim CINE3D</p></form>
    </section>}
    <button onClick={() => setOpen((current) => !current)} aria-label={open ? 'Đóng trợ lý tìm phim' : 'Mở trợ lý tìm phim'} aria-expanded={open} className="fixed bottom-20 right-4 z-[71] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-black shadow-[0_12px_35px_rgba(251,191,36,.3)] transition hover:scale-105 active:scale-95 md:bottom-6 md:right-20">{open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6 fill-current" />}</button>
  </>;
}
