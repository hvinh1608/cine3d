'use client';

import { useEffect } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useStore } from '../../hooks/useStore';

export default function ToastViewport() {
  const toast = useStore((state) => state.toast);
  const clearToast = useStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 3500);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
  const tone = toast.tone === 'success'
    ? 'border-emerald-500/40 text-emerald-200'
    : toast.tone === 'error'
      ? 'border-red-500/40 text-red-200'
      : 'border-cyan-500/40 text-cyan-100';

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] w-[min(92vw,420px)] -translate-x-1/2" role="status" aria-live="polite">
      <div className={`flex items-center gap-3 rounded-2xl border bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl ${tone}`}>
        <Icon className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-semibold">{toast.message}</p>
        <button type="button" onClick={clearToast} aria-label="Đóng thông báo" className="rounded-full p-1 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
