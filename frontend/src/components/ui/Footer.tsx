'use client';

import Image from '@/components/ui/ResilientImage';
import Link from 'next/link';
import { Download, Flag, HelpCircle, Mail, ScanLine, ShieldCheck, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ANDROID_APK_URL } from '../../lib/android-app';

const footerLinks = [
  { href: '/feedback', label: 'Hỏi đáp' },
  { href: '/privacy', label: 'Chính sách bảo mật' },
  { href: '/terms', label: 'Điều khoản sử dụng' },
  { href: '/data-deletion', label: 'Quản lý dữ liệu' },
  { href: 'mailto:hvinh.job@gmail.com', label: 'Liên hệ' },
] as const;

export default function Footer() {
  return (
    <footer className="relative z-10 mt-auto overflow-hidden border-t border-white/[0.07] bg-[#07070d] text-slate-400">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-amber-500/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-600/[0.04] blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-[1500px] gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(390px,0.85fr)] lg:gap-16 lg:px-10 lg:py-16">
        <section className="flex min-w-0 flex-col">
          <div className="mb-8 flex w-fit items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 sm:text-sm">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-red-600 text-yellow-300" aria-hidden>
              ★
            </span>
            Hoàng Sa và Trường Sa là của Việt Nam!
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-7">
            <Link href="/" aria-label="Về trang chủ CINE3D" className="group block">
              <Image
                src="/cine3d-logo-v2.png"
                alt="CINE3D"
                width={278}
                height={57}
                className="h-auto w-[210px] transition group-hover:brightness-110 sm:w-[250px]"
              />
            </Link>
            <div className="hidden h-12 w-px bg-white/10 sm:block" />
            <div className="flex gap-2">
              <Link
                href="/feedback"
                aria-label="Góp ý và hỗ trợ"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300"
              >
                <HelpCircle className="h-5 w-5" />
              </Link>
              <a
                href="mailto:hvinh.job@gmail.com"
                aria-label="Gửi email cho CINE3D"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <nav aria-label="Liên kết chân trang" className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-200">
            {footerLinks.map((item) => item.href.startsWith('mailto:') ? (
              <a key={item.href} href={item.href} className="transition hover:text-amber-300">{item.label}</a>
            ) : (
              <Link key={item.href} href={item.href} className="transition hover:text-amber-300">{item.label}</Link>
            ))}
          </nav>

          <div className="mt-7 max-w-3xl space-y-4 text-sm leading-7 text-slate-500 sm:text-[15px]">
            <p>
              <strong className="font-bold text-slate-300">CINE3D</strong> là không gian xem phim trực tuyến dành cho người yêu điện ảnh, với kho phim Vietsub và thuyết minh đa dạng, chất lượng hình ảnh sắc nét cùng trải nghiệm tối ưu trên web và Android.
            </p>
            <p>
              Nội dung được cập nhật thường xuyên với phim lẻ, phim bộ và nhiều thể loại từ Việt Nam, Hàn Quốc, Trung Quốc, Nhật Bản, Thái Lan, Âu Mỹ và nhiều quốc gia khác.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Kết nối bảo mật
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-2">
              <Flag className="h-4 w-4 text-red-400" /> Phát triển tại Việt Nam
            </span>
          </div>

          <p className="mt-10 text-xs text-slate-600">© 2026 CINE3D. Trải nghiệm điện ảnh theo cách của bạn.</p>
        </section>

        <section className="self-start rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.3)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-black shadow-[0_0_24px_rgba(245,158,11,0.2)]">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">CINE3D cho Android</p>
              <h2 className="mt-1 text-xl font-black leading-snug text-white sm:text-2xl">
                Xem phim mượt mà hơn trên điện thoại
              </h2>
            </div>
          </div>

          <div className="mt-6 grid items-center gap-5 sm:grid-cols-[1fr_170px]">
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-400">
                Cài ứng dụng CINE3D để xem phim toàn màn hình, quản lý lịch sử và sử dụng cùng tài khoản trên website.
              </p>
              <a
                href={ANDROID_APK_URL}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 px-5 py-3 font-black text-white shadow-[0_14px_35px_rgba(220,38,38,0.22)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Download className="h-5 w-5" />
                <span className="text-left leading-tight">
                  <small className="block text-[10px] font-bold uppercase tracking-wider text-white/70">Tải trực tiếp</small>
                  CINE3D APK 1.0.8
                </span>
              </a>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Android 7.0+ · Tải từ GitHub chính thức
              </div>
            </div>

            <a
              href={ANDROID_APK_URL}
              aria-label="Quét hoặc nhấn để tải CINE3D APK"
              className="mx-auto block rounded-2xl border border-white/15 bg-white p-2.5 shadow-[0_0_35px_rgba(245,158,11,0.1)] transition hover:scale-[1.02]"
            >
              <QRCodeSVG
                value={ANDROID_APK_URL}
                size={148}
                level="H"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#09090b"
                title="Mã QR tải CINE3D APK 1.0.8"
              />
            </a>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-4 text-xs text-slate-500">
            <ScanLine className="h-4 w-4 text-amber-400" /> Quét QR bằng camera điện thoại để tải nhanh
          </div>
        </section>
      </div>
    </footer>
  );
}
