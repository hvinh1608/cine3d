import { Suspense } from 'react';
import QrLoginBridgePage from './QrLoginBridgeClient';

export const metadata = {
  title: 'Đăng nhập QR | CINE3D',
  description: 'Xác nhận đăng nhập web CINE3D bằng ứng dụng điện thoại.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<main className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Đang mở…</main>}>
      <QrLoginBridgePage />
    </Suspense>
  );
}
