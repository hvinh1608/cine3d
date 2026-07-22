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
  actionLabel?: string;
};

type KnowledgeArticle = { patterns: RegExp[]; text: string; href?: string; label?: string };

const starterPrompts = ['Phim kinh dị mới', 'Anime hay', 'VIP có gì?', 'Cách xem chung', 'Tải app Android', 'Lịch phim ở đâu?'];
const fillerWords = new Set(['cho', 'toi', 'minh', 'tim', 'kiem', 'goi', 'y', 'xem', 'muon', 'mot', 'vai', 'bo', 'phim', 'nao', 'co', 'hay', 'nhat', 've']);
const genreAliases: Record<string, string> = {
  'kinh di': 'kinh-di', 'tinh cam': 'tinh-cam', 'hanh dong': 'hanh-dong', 'hai huoc': 'hai-huoc',
  'vui': 'hai-huoc', 'cuoi': 'hai-huoc', 'lang man': 'tinh-cam',
  'yeu duong': 'tinh-cam', 'so': 'kinh-di', 'ma': 'kinh-di', 'gay can': 'hanh-dong',
  'danh nhau': 'hanh-dong', 'anime': 'hoat-hinh', 'hoat hinh': 'hoat-hinh',
};
const countryAliases: Record<string, string> = { 'han': 'han-quoc', 'han quoc': 'han-quoc', 'trung quoc': 'trung-quoc', 'nhat': 'nhat-ban', 'nhat ban': 'nhat-ban', 'thai': 'thai-lan', 'thai lan': 'thai-lan', 'viet nam': 'viet-nam', 'my': 'au-my' };

const knowledgeBase: KnowledgeArticle[] = [
  {
    patterns: [/^(xin chao|chao|hello|hi|hey)( ban| tro ly)?[ ]*$/],
    text: 'Chào bạn! Mình là trợ lý CINE3D. Bạn có thể nói tên phim, mô tả thể loại hoặc hỏi mình cách dùng bất kỳ chức năng nào trên web.',
  },
  {
    patterns: [/^(cam on|thanks|thank you|ok cam on|tot qua)[ ]*$/],
    text: 'Không có gì! Khi cần tìm phim hoặc cần hướng dẫn sử dụng CINE3D, bạn cứ nhắn mình nhé.',
  },
  {
    patterns: [/\b(vip la gi|vip co gi|quyen loi vip|mua vip|nang cap vip|dang ky vip|thanh toan vip|gia vip|goi vip)\b/],
    text: 'VIP mở khóa nguồn phát Premium, nội dung độc quyền, Picture-in-Picture và tải trực tiếp khi phim có nguồn MP4. Bạn có thể xem các gói, tạo đơn và theo dõi trạng thái kích hoạt tại trang VIP.',
    href: '/vip', label: 'Xem gói VIP',
  },
  {
    patterns: [/\b(xem chung|xem cung|phong xem|tao phong|tham gia phong|ma phong|dong bo video)\b/],
    text: 'Xem Chung cho phép nhiều thành viên xem đồng bộ, trò chuyện và thả cảm xúc trong cùng một phòng. Bạn cần đăng nhập; thành viên VIP có thể tạo phòng riêng bằng mật khẩu.',
    href: '/watch-together/rooms', label: 'Mở danh sách phòng',
  },
  {
    patterns: [/\b(tai app|tai ung dung|ung dung android|app android|file apk|cai apk|cai ung dung|ch play)\b/],
    text: 'CINE3D có ứng dụng Android dạng APK. App chưa phát hành trên CH Play; hãy tải từ trang chính thức, cho phép cài ứng dụng không rõ nguồn khi Android yêu cầu, rồi đăng nhập cùng tài khoản web để đồng bộ VIP.',
    href: '/download', label: 'Tải ứng dụng Android',
  },
  {
    patterns: [/\b(lich chieu|lich phim|lich phat hanh|tap moi khi nao|khi nao co tap|sap chieu)\b/],
    text: 'Trang Lịch chiếu hiển thị tập dự kiến phát trong 30 ngày tới và các tập vừa phát hành. Khi đến giờ, tập được chuyển sang trạng thái có thể xem; người theo dõi phim sẽ nhận thông báo.',
    href: '/schedule', label: 'Xem lịch phát hành',
  },
  {
    patterns: [/\b(dang nhap|dang ky|tai khoan|quen mat khau|doi mat khau|email|anh dai dien|ho so)\b/],
    text: 'Bạn có thể đăng nhập, đăng ký, khôi phục mật khẩu và quản lý hồ sơ tại trang Tài khoản. Đây cũng là nơi quản lý ảnh đại diện, thiết lập trải nghiệm và trạng thái VIP.',
    href: '/account', label: 'Mở tài khoản',
  },
  {
    patterns: [/\b(yeu thich|xem sau|danh sach cua toi|lich su xem|phim da xem|xoa lich su)\b/],
    text: 'Phim yêu thích, danh sách Xem sau và Lịch sử xem đều nằm trong trang Tài khoản. Khi đăng nhập, tiến độ xem được lưu để bạn tiếp tục đúng tập đang xem.',
    href: '/account', label: 'Mở thư viện của tôi',
  },
  {
    patterns: [/\b(theo doi phim|nhan thong bao|thong bao tap moi|bo theo doi)\b/],
    text: 'Tại trang chi tiết phim, hãy bấm Theo dõi để nhận thông báo khi có tập mới. Chuông trên thanh điều hướng hiển thị thông báo của tài khoản và cho phép đánh dấu đã đọc.',
    href: '/search', label: 'Tìm phim để theo dõi',
  },
  {
    patterns: [/\b(binh luan|danh gia phim|cham diem|rating|review)\b/],
    text: 'Trang chi tiết phim có khu vực bình luận cộng đồng và chấm điểm. Bạn cần đăng nhập để gửi nội dung; hãy chọn phim rồi kéo xuống phần tương tác.',
    href: '/search', label: 'Chọn một bộ phim',
  },
  {
    patterns: [/\b(phu de|subtitle|toc do phat|chat luong video|toan man hinh|tat den|che do rap|cast|truyen len tv|picture in picture|pip|tai phim)\b/],
    text: 'Trong trình phát, nút Cài đặt cho phép đổi nguồn phát, tốc độ và phụ đề; bạn cũng có thể tua ±10 giây, toàn màn hình, Tắt đèn, chế độ rạp và truyền lên TV. Picture-in-Picture và tải MP4 là quyền lợi VIP.',
    href: '/search', label: 'Chọn phim để xem',
  },
  {
    patterns: [/\b(tim phim o dau|loc phim|bo loc|tim theo the loai|tim theo quoc gia|tim theo nam|kham pha phim)\b/],
    text: 'Trang Khám phá cho phép tìm theo tên và lọc theo thể loại, quốc gia, năm, phim bộ/phim lẻ, trạng thái, VIP hoặc thuyết minh; kết quả còn có thể sắp xếp theo lượt xem và đánh giá.',
    href: '/search', label: 'Mở trang khám phá',
  },
  {
    patterns: [/\b(gop y|bao loi|loi web|ho tro|lien he|phan hoi|feedback)\b/],
    text: 'Nếu gặp lỗi hoặc muốn đề xuất tính năng, bạn hãy gửi nội dung tại trang Góp ý & hỗ trợ để quản trị viên tiếp nhận đúng thông tin.',
    href: '/feedback', label: 'Gửi góp ý & hỗ trợ',
  },
  {
    patterns: [/\b(quyen rieng tu|du lieu ca nhan|xoa du lieu|chinh sach rieng tu)\b/],
    text: 'Bạn có thể xem cách CINE3D xử lý dữ liệu tại trang Quyền riêng tư. Yêu cầu xóa dữ liệu tài khoản có hướng dẫn riêng trên website.',
    href: '/privacy', label: 'Xem quyền riêng tư',
  },
  {
    patterns: [/\b(cine3d la gi|web co gi|chuc nang cua web|ban lam duoc gi|giup duoc gi|huong dan su dung)\b/],
    text: 'Mình là trợ lý CINE3D. Mình có thể tìm và gợi ý phim trong kho thật, hướng dẫn tài khoản, VIP, Xem Chung, lịch phát hành, ứng dụng Android, thư viện cá nhân và các chức năng của trình phát.',
    href: '/search', label: 'Khám phá kho phim',
  },
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractTitleQuery(input: string) {
  const quoted = input.match(/["“”']([^"“”']{2,})["“”']/)?.[1]?.trim();
  if (quoted) return quoted;
  if (/\b(goi y|the loai|tam trang|phim nao|phim gi)\b/.test(normalize(input))) return '';
  const explicit = input.match(/(?:tìm|kiếm|mở|xem|coi)\s+(?:(?:giúp|hộ)\s+(?:tôi|mình)\s+)?(?:bộ\s+)?phim\s+(.+)/iu)?.[1]?.trim()
    || input.match(/^(?:bộ\s+)?phim\s+(.+)/iu)?.[1]?.trim();
  const candidate = explicit || (/^[\p{L}\p{N}\s:.-]{2,60}$/u.test(input.trim()) ? input.trim() : '');
  if (!candidate) return '';
  const normalizedCandidate = normalize(candidate).replace(/\b(cho toi|cho minh|giup toi|giup minh|voi|nhe)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const descriptorWords = new Set(['moi', 'hay', 'hot', 'nhat', '2024', '2025', '2026', 'vip', 'thuyet', 'minh', 'long', 'tieng', 'bo', 'le', 'series', 'movie']);
  const hasGenre = Object.keys(genreAliases).some((alias) => normalizedCandidate.includes(alias));
  const hasCountry = Object.keys(countryAliases).some((alias) => normalizedCandidate.includes(alias));
  const remaining = normalizedCandidate.split(' ').filter((word) => !descriptorWords.has(word));
  if ((hasGenre || hasCountry || /anime|hoat hinh|xem nhieu|danh gia cao/.test(normalizedCandidate)) && remaining.length <= 3) return '';
  return candidate.replace(/\s+(?:giúp|hộ)?\s*(?:tôi|mình)?\s*(?:với|nhé)[.!?]*$/iu, '').trim();
}

function titleScore(movie: Movie, query: string) {
  const target = normalize(query);
  const titles = [movie.title, movie.englishTitle || ''].map(normalize).filter(Boolean);
  let score = 0;
  for (const title of titles) {
    if (title === target) score = Math.max(score, 1000);
    else if (title.startsWith(target)) score = Math.max(score, 850);
    else if (title.includes(target)) score = Math.max(score, 750);
    else if (target.includes(title)) score = Math.max(score, 650);
    else {
      const queryWords = target.split(' ');
      const titleWords = new Set(title.split(' '));
      const coverage = queryWords.filter((word) => titleWords.has(word)).length / Math.max(1, queryWords.length);
      score = Math.max(score, Math.round(coverage * 500));
    }
  }
  return score;
}

function buildRequest(input: string, genres: MetaItem[], countries: MetaItem[], titleQuery = '') {
  const normalized = normalize(input);
  const params = new URLSearchParams({ limit: titleQuery ? '12' : '6' });
  if (titleQuery) {
    params.set('search', titleQuery);
    return params;
  }
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
  if (/phim vip|noi dung vip/.test(normalized)) params.set('vip', 'true');
  if (/thuyet minh|long tieng/.test(normalized)) params.set('dubbed', 'true');

  const removable = [matchedGenre?.name, matchedCountry?.name, year].filter(Boolean).map((value) => normalize(String(value)));
  let search = normalized;
  for (const phrase of removable) search = search.replace(phrase, ' ');
  for (const alias of Object.keys(genreAliases)) search = search.replace(alias, ' ');
  for (const intentPhrase of ['duoc xem nhieu', 'xem nhieu', 'pho bien', 'thinh hanh', 'danh gia cao', 'diem cao', 'phim bo', 'nhieu tap', 'phim le', 'thuyet minh', 'long tieng', 'phim vip', 'noi dung vip']) search = search.replace(intentPhrase, ' ');
  search = search.split(/\s+/).filter((word) => word && !fillerWords.has(word) && !['moi', 'anime', 'series', 'movie', 'hot', 'thinh', 'hanh'].includes(word)).join(' ');
  if (search) params.set('search', search);
  return params;
}

function findKnowledgeAnswer(input: string) {
  const normalized = normalize(input);
  return knowledgeBase.find((article) => article.patterns.some((pattern) => pattern.test(normalized)));
}

export default function MovieAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<{ genres: MetaItem[]; countries: MetaItem[] }>({ genres: [], countries: [] });
  const [messages, setMessages] = useState<AssistantMessage[]>([{ id: 1, role: 'assistant', text: 'Chào bạn! Mình có thể tìm phim theo sở thích và hướng dẫn mọi chức năng trên CINE3D. Bạn muốn xem gì hoặc cần mình hỗ trợ điều gì?' }]);
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
    const knowledge = findKnowledgeAnswer(cleanQuestion);
    if (knowledge) {
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: knowledge.text, searchUrl: knowledge.href, actionLabel: knowledge.label }]);
      return;
    }
    setLoading(true);
    try {
      const titleQuery = extractTitleQuery(cleanQuestion);
      const params = buildRequest(cleanQuestion, metadata.genres, metadata.countries, titleQuery);
      const { data } = await api.get('/movies', { params: Object.fromEntries(params) });
      const candidates = (Array.isArray(data.movies) ? data.movies : []) as Movie[];
      const rankedMovies = titleQuery ? candidates.toSorted((first, second) => titleScore(second, titleQuery) - titleScore(first, titleQuery)) : candidates;
      const exactMatch = Boolean(titleQuery && rankedMovies[0] && titleScore(rankedMovies[0], titleQuery) >= 750);
      const movies = rankedMovies.slice(0, exactMatch ? 1 : 6);
      const searchParams = new URLSearchParams(params);
      searchParams.delete('limit');
      if (searchParams.has('search')) { searchParams.set('q', searchParams.get('search') || ''); searchParams.delete('search'); }
      setMessages((current) => [...current, {
        id: nextId.current++, role: 'assistant',
        text: movies.length
          ? exactMatch
            ? `Đây là phim “${movies[0].title}” khớp nhất với tên bạn yêu cầu:`
            : titleQuery
              ? `Mình chưa thấy tên khớp hoàn toàn, đây là ${movies.length} kết quả gần nhất với “${titleQuery}”:`
              : `Mình tìm thấy ${movies.length} phim phù hợp nhất trong kho CINE3D:`
          : `Mình chưa tìm thấy phim “${titleQuery || cleanQuestion}” trong kho CINE3D. Bạn thử kiểm tra lại tên tiếng Việt, tên tiếng Anh hoặc nhập một phần tên phim nhé.`,
        movies,
        searchUrl: movies.length ? `/search?${searchParams}` : undefined,
        actionLabel: 'Xem tất cả kết quả',
      }]);
    } catch {
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: 'Mình chưa kết nối được kho phim. Bạn thử lại sau một chút nhé.' }]);
    } finally { setLoading(false); }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void ask(input); };

  return <>
    {open && <section aria-label="Trợ lý CINE3D" className="fixed bottom-36 left-3 z-[70] flex h-[min(650px,calc(100dvh-11rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#171820]/[.98] text-white shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-xl md:bottom-24 md:left-6 md:h-[min(650px,calc(100dvh-7rem))]">
      <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-amber-300/15 to-violet-500/10 px-4 py-3.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 text-black"><Bot className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-black">Trợ lý CINE3D</h2><p className="text-[10px] text-emerald-300">● Đang sẵn sàng</p></div><button onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></header>
      <div className="movie-assistant-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">{messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-10' : 'mr-5'}><div className={`w-fit rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'ml-auto rounded-br-md bg-amber-300 font-semibold text-black' : 'rounded-bl-md bg-[#272936] text-slate-200'}`}>{message.text}</div>{message.movies && message.movies.length > 0 && <div className="mt-2 space-y-2">{message.movies.map((movie) => <Link key={movie.id} href={`/movies/${movie.slug}`} onClick={() => setOpen(false)} className="group flex gap-3 rounded-2xl border border-white/[.06] bg-white/[.035] p-2 transition hover:border-amber-300/30 hover:bg-white/[.07]"><span className="relative h-[76px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-slate-800"><Image src={movie.posterUrl} alt={movie.title} fill sizes="52px" className="object-cover" /></span><span className="min-w-0 flex-1 py-1"><b className="line-clamp-2 text-xs group-hover:text-amber-300">{movie.title}</b><span className="mt-2 block text-[10px] text-slate-500">{movie.releaseYear} · {movie.isSeries ? 'Phim bộ' : 'Phim lẻ'} · {movie.quality || 'HD'}</span><span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-300"><Film className="h-3 w-3" /> Xem chi tiết</span></span></Link>)}</div>}{message.searchUrl && <Link href={message.searchUrl} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"><Search className="h-3.5 w-3.5" /> {message.actionLabel || 'Mở trang'}</Link>}</div>)}
        {!hasConversation && <div className="flex flex-wrap gap-2">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)} className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/10">{prompt}</button>)}</div>}
        {loading && <div className="mr-5 flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-[#272936] px-3.5 py-2.5 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-amber-300" /> Đang tìm trong kho phim...</div>}<div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-white/10 p-3"><div className="flex items-center gap-2 rounded-2xl bg-[#242631] p-1.5 pl-3"><Sparkles className="h-4 w-4 shrink-0 text-amber-300" /><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={120} autoFocus placeholder="Ví dụ: phim Hàn tình cảm..." className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none placeholder:text-slate-600" /><button type="submit" disabled={!input.trim() || loading} aria-label="Gửi câu hỏi" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300 text-black disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button></div><p className="mt-2 text-center text-[9px] text-slate-600">Kết quả được lấy trực tiếp từ kho phim CINE3D</p></form>
    </section>}
    <button onClick={() => setOpen((current) => !current)} aria-label={open ? 'Đóng trợ lý tìm phim' : 'Mở trợ lý tìm phim'} aria-expanded={open} className="fixed bottom-20 left-4 z-[71] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-black shadow-[0_12px_35px_rgba(251,191,36,.3)] transition hover:scale-105 active:scale-95 md:bottom-6 md:left-6">{open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6 fill-current" />}</button>
  </>;
}
