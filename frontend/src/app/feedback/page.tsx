'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Lightbulb, MessageSquareText, Send, ShieldAlert } from 'lucide-react';
import type { AxiosError } from 'axios';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

type Feedback = { id: string; category: string; subject: string; content: string; status: string; adminReply?: string | null; createdAt: string };
const categories = [['GENERAL', 'Góp ý chung'], ['MOVIE_REQUEST', 'Yêu cầu phim'], ['FEATURE', 'Đề xuất tính năng'], ['WEBSITE_ERROR', 'Lỗi website'], ['VIP_SUPPORT', 'Hỗ trợ VIP'], ['COPYRIGHT', 'Bản quyền & nội dung']] as const;
const categoryLabel = Object.fromEntries(categories);
const statusLabel: Record<string, string> = { PENDING: 'Đã tiếp nhận', REVIEWING: 'Đang xem xét', RESOLVED: 'Đã xử lý', REJECTED: 'Đã đóng' };

export default function FeedbackPage() {
  const { user, hasHydrated, authReady, showToast } = useStore();
  const [items, setItems] = useState<Feedback[]>([]);
  const [category, setCategory] = useState('GENERAL');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authReady || !user) return;
    api.get('/feedback/me').then(({ data }) => setItems(Array.isArray(data) ? data : [])).catch(() => showToast('Không tải được lịch sử góp ý.', 'error')).finally(() => setLoading(false));
  }, [authReady, showToast, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try {
      const { data } = await api.post('/feedback', { category, subject, content });
      setItems((current) => [data.feedback, ...current]); setSubject(''); setContent(''); showToast(data.message, 'success');
    } catch (error) { showToast((error as AxiosError<{ message?: string }>).response?.data?.message || 'Không thể gửi góp ý.', 'error'); }
    finally { setSubmitting(false); }
  };

  if (!hasHydrated || !authReady) return <div className="grid min-h-[65vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-amber-400" /></div>;
  if (!user) return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-4 text-center"><div className="rounded-3xl border border-white/10 bg-slate-950/70 p-9"><ShieldAlert className="mx-auto h-12 w-12 text-amber-400" /><h1 className="mt-4 text-2xl font-black text-white">Đăng nhập để gửi góp ý</h1><p className="mt-3 text-sm leading-6 text-slate-400">Đăng nhập giúp chúng mình phản hồi đúng tài khoản và hạn chế nội dung spam.</p><Link href="/account" className="mt-6 inline-flex rounded-full bg-amber-400 px-6 py-3 text-sm font-black text-black">Đăng nhập ngay</Link></div></main>;
  if (loading) return <div className="grid min-h-[65vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-amber-400" /></div>;

  return <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
    <header className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-black"><Lightbulb className="h-7 w-7" /></div><h1 className="mt-5 text-3xl font-black text-white md:text-5xl">Góp ý & hỗ trợ CINE3D</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Mọi ý kiến đều giúp chúng mình cải thiện trải nghiệm xem phim. Bạn có thể theo dõi trạng thái và phản hồi ngay tại đây.</p></header>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
      <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-slate-950/65 p-6 shadow-2xl md:p-8"><h2 className="flex items-center gap-2 text-lg font-black text-white"><MessageSquareText className="h-5 w-5 text-amber-400" /> Gửi góp ý mới</h2>
        <label className="mt-6 block text-xs font-bold text-slate-400">Danh mục<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="mt-4 block text-xs font-bold text-slate-400">Tiêu đề<input required minLength={5} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Tóm tắt điều bạn muốn góp ý" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400" /></label>
        <label className="mt-4 block text-xs font-bold text-slate-400">Nội dung<textarea required minLength={10} maxLength={3000} rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mô tả chi tiết để chúng mình hỗ trợ tốt hơn..." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-amber-400" /><span className="mt-1 block text-right text-[10px] text-slate-600">{content.length}/3000</span></label>
        <button disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-black text-black disabled:opacity-50"><Send className="h-4 w-4" /> {submitting ? 'Đang gửi...' : 'Gửi góp ý'}</button>
      </form>
      <section><h2 className="text-lg font-black text-white">Lịch sử của bạn</h2><div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-1">{items.map((item) => <article key={item.id} className="rounded-2xl border border-white/8 bg-slate-950/60 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-purple-300">{categoryLabel[item.category] || item.category}</span><span className={`flex items-center gap-1 text-[10px] font-bold ${item.status === 'RESOLVED' ? 'text-emerald-400' : 'text-amber-400'}`}>{item.status === 'RESOLVED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{statusLabel[item.status] || item.status}</span></div><h3 className="mt-3 font-black text-white">{item.subject}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{item.content}</p>{item.adminReply && <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4"><p className="text-[10px] font-black uppercase text-emerald-400">Phản hồi từ CINE3D</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{item.adminReply}</p></div>}<p className="mt-3 text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleString('vi-VN')}</p></article>)}{!items.length && <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-xs text-slate-500">Bạn chưa gửi góp ý nào.</div>}</div></section>
    </div>
  </main>;
}
