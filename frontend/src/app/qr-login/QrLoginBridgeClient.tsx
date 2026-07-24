'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Smartphone } from 'lucide-react';

export default function QrLoginBridgePage() {
  const params = useSearchParams();
  const token = (params.get('t') || '').trim();
  const [opened, setOpened] = useState(false);
  const appLink = useMemo(() => (token ? `cine3d://qr-login?t=${encodeURIComponent(token)}` : ''), [token]);

  useEffect(() => {
    if (!appLink) return;
    const timer = window.setTimeout(() => {
      window.location.href = appLink;
      setOpened(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [appLink]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="glass-panel w-full space-y-4 rounded-3xl p-8">
        <Smartphone className="mx-auto h-10 w-10 text-red-400" />
        <h1 className="text-2xl font-black text-white">Xác nhận đăng nhập web</h1>
        {!token ? (
          <p className="text-sm text-slate-400">Thiếu mã QR. Hãy quét lại mã trên trang đăng nhập web.</p>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-400">
              {opened
                ? 'Nếu app chưa mở, hãy nhấn nút bên dưới hoặc mở CINE3D rồi vào mục “Đăng nhập web bằng QR”.'
                : 'Đang mở ứng dụng CINE3D để bạn xác nhận đăng nhập trên máy tính…'}
            </p>
            <a
              href={appLink}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500"
            >
              Mở app CINE3D
            </a>
          </>
        )}
        <Link href="/account" className="block text-sm text-slate-500 hover:text-white">
          Về trang đăng nhập web
        </Link>
        <Link href="/download" className="block text-xs text-amber-400 hover:text-amber-300">
          Chưa có app? Tải CINE3D APK
        </Link>
      </div>
    </main>
  );
}
