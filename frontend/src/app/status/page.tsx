'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Database, Film, RefreshCw, Server, XCircle } from 'lucide-react';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
type Check = { label: string; detail: string; ok: boolean | null; icon: typeof Server };

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'Backend API', detail: 'Đang kiểm tra', ok: null, icon: Server },
    { label: 'PostgreSQL', detail: 'Đang kiểm tra', ok: null, icon: Database },
    { label: 'Redis cache', detail: 'Đang kiểm tra', ok: null, icon: Activity },
    { label: 'Danh mục phim', detail: 'Đang kiểm tra', ok: null, icon: Film },
  ]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [healthResult, catalogResult] = await Promise.allSettled([
      fetch(`${API_ROOT}/health`, { cache: 'no-store' }).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }),
      fetch(`${API_ROOT}/api/movies?limit=1`, { cache: 'no-store' }).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }),
    ]);
    const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
    setChecks([
      { label: 'Backend API', detail: health ? 'Hoạt động bình thường' : 'Không thể kết nối', ok: Boolean(health), icon: Server },
      { label: 'PostgreSQL', detail: health?.database === 'connected' ? 'Đã kết nối' : 'Không khả dụng', ok: health?.database === 'connected', icon: Database },
      { label: 'Redis cache', detail: health?.redis === 'connected' ? 'Đã kết nối' : health?.redis === 'fallback' ? 'Đang dùng bộ nhớ dự phòng' : 'Chưa cấu hình (không bắt buộc)', ok: health?.redis === 'connected' ? true : null, icon: Activity },
      { label: 'Danh mục phim', detail: catalogResult.status === 'fulfilled' ? 'Tải dữ liệu bình thường' : 'Nguồn phim đang gián đoạn', ok: catalogResult.status === 'fulfilled', icon: Film },
    ]);
    setUpdatedAt(new Date()); setLoading(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);
  const allOperational = checks.every((check) => check.ok !== false);

  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-8"><section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl md:p-9">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-400">System status</p><h1 className="mt-2 text-3xl font-black text-white">Trạng thái CINE3D</h1><p className="mt-2 text-sm text-slate-400">Tự động kiểm tra lại mỗi 30 giây.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Kiểm tra lại</button></div>
    <div className={`mt-7 rounded-2xl border p-4 ${allOperational ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300' : 'border-red-400/20 bg-red-400/[.06] text-red-300'}`}><p className="flex items-center gap-2 font-black">{allOperational ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{allOperational ? 'Các dịch vụ chính đang hoạt động' : 'Một số dịch vụ đang gặp sự cố'}</p></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{checks.map((check) => <article key={check.label} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center justify-between"><check.icon className="h-5 w-5 text-slate-400" />{check.ok === true ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : check.ok === false ? <XCircle className="h-5 w-5 text-red-400" /> : <Activity className="h-5 w-5 text-amber-400" />}</div><h2 className="mt-4 font-black text-white">{check.label}</h2><p className="mt-1 text-xs text-slate-500">{check.detail}</p></article>)}</div>
    {updatedAt && <p className="mt-5 text-center text-[11px] text-slate-600">Cập nhật lúc {updatedAt.toLocaleTimeString('vi-VN')}</p>}
  </section></main>;
}
