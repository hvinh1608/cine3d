import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Smartphone, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';
import AndroidDownloadQr from '@/components/download/AndroidDownloadQr';
import { ANDROID_APK_URL } from '@/lib/android-app';

export const metadata: Metadata = {
  title: 'Tải ứng dụng Android | CINE3D',
  description: 'Tải APK CINE3D cho Android, cài đặt ngoài CH Play và xem phim trên điện thoại.',
};

const steps = [
  {
    title: 'Tải file APK',
    detail: 'Bấm nút Tải CINE3D APK bên dưới. Dùng trình duyệt trên điện thoại Android (Chrome/Samsung Internet).',
  },
  {
    title: 'Cho phép cài app ngoài CH Play',
    detail: 'Vào Cài đặt → Ứng dụng → Trình duyệt đang dùng → Cho phép từ nguồn này / Cài đặt ứng dụng không xác định.',
  },
  {
    title: 'Mở file vừa tải và cài',
    detail: 'Mở cine3d.apk trong thư mục Tải xuống, bấm Cài đặt, rồi Mở ứng dụng.',
  },
  {
    title: 'Đăng nhập cùng tài khoản web',
    detail: 'VIP mua trên website sẽ đồng bộ sang app. Mua VIP tại trang /vip trên web.',
  },
] as const;

export default function DownloadAppPage() {
  return (
    <main className="relative mx-auto w-full max-w-4xl px-5 py-12 text-slate-300 md:py-16">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-[#0b0b12] to-black p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_250px]">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-400">
              <Smartphone className="h-4 w-4" />
              Ứng dụng Android
            </div>
            <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">
              Tải CINE3D về điện thoại
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
              App chưa lên CH Play. Bạn tải APK trực tiếp từ CINE3D, cài ngoài cửa hàng, rồi đăng nhập bằng cùng tài khoản web để xem phim và dùng VIP.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={ANDROID_APK_URL}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-black text-white transition hover:bg-red-500"
              >
                <Download className="h-5 w-5" />
                Tải CINE3D APK
              </a>
              <Link
                href="/vip"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                Mua VIP trên website
              </Link>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              File: <span className="text-slate-300">cine3d.apk</span> · Android 7.0+ · Package <code className="text-amber-300">vn.cine3d.app</code>
            </p>
          </div>

          <AndroidDownloadQr url={ANDROID_APK_URL} />
        </div>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/20 text-sm font-black text-red-400">
                {index + 1}
              </span>
              <h2 className="text-base font-bold text-white">{step.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{step.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
        <div className="flex items-center gap-2 text-amber-300">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="text-base font-bold">Lưu ý khi cài ngoài CH Play</h2>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-slate-400">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> Android có thể hiện cảnh báo “nguồn không xác định” — chọn cài tiếp nếu bạn tải từ cine3d.id.vn.</li>
          <li className="flex gap-2"><RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /> Mỗi bản mới: tải APK mới và cài đè (giữ nguyên dữ liệu đăng nhập).</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> VIP mua trên web sẽ áp dụng trên app sau khi đăng nhập cùng tài khoản và làm mới trang VIP.</li>
        </ul>
      </section>

      <p className="mt-8 text-sm text-slate-500">
        Cần hỗ trợ? Gửi email{' '}
        <a className="text-red-400 hover:text-red-300" href="mailto:hvinh.job@gmail.com">hvinh.job@gmail.com</a>
        {' · '}
        <Link href="/account" className="text-red-400 hover:text-red-300">Đăng nhập</Link>
        {' · '}
        <Link href="/privacy" className="text-red-400 hover:text-red-300">Quyền riêng tư</Link>
      </p>
    </main>
  );
}
