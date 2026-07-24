'use client';

import { ScanLine } from 'lucide-react';
import BrandedQrCode from '@/components/ui/BrandedQrCode';

type AndroidDownloadQrProps = {
  url: string;
};

export default function AndroidDownloadQr({ url }: AndroidDownloadQrProps) {
  return (
    <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent" />
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-red-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-red-300">
        <ScanLine className="h-3.5 w-3.5" />
        Quét để tải
      </div>

      <a
        href={url}
        aria-label="Quét hoặc nhấn để tải CINE3D APK"
        className="mx-auto mt-4 block w-fit rounded-2xl bg-white p-3 shadow-[0_0_35px_rgba(239,68,68,0.18)] transition hover:scale-[1.02]"
      >
        <BrandedQrCode
          value={url}
          size={184}
          title="Mã QR tải ứng dụng CINE3D cho Android"
        />
      </a>

      <p className="mt-4 text-sm font-bold text-white">Mở camera điện thoại để quét</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Mã QR dẫn thẳng tới file APK chính thức trên GitHub.</p>
    </aside>
  );
}
