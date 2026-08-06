'use client';

import Image from '@/components/ui/ResilientImage';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const cinemaDust = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 37 + 9) % 100}%`,
  size: `${2 + (index % 3)}px`,
  delay: `${(index % 7) * 0.11}s`,
}));

const CINEMA_SPLASH_SEEN_KEY = 'cine3d-cinema-splash-seen';

export default function CinemaSplash() {
  const [phase, setPhase] = useState<'welcome' | 'loading' | 'leave' | 'hidden'>('hidden');

  const enterCinema = useCallback(() => {
    setPhase('loading');
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CINEMA_SPLASH_SEEN_KEY)) return;
      sessionStorage.setItem(CINEMA_SPLASH_SEEN_KEY, 'true');
    } catch {
      // Still show the splash when browser storage is unavailable.
    }
    const showTimer = window.setTimeout(() => setPhase('welcome'), 0);
    return () => window.clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  useEffect(() => {
    const locked = phase === 'welcome' || phase === 'loading';
    document.body.style.overflow = locked ? 'hidden' : '';
    document.documentElement.style.overflow = locked ? 'hidden' : '';
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const leaveTimer = window.setTimeout(() => setPhase('leave'), 1650);
    const hideTimer = window.setTimeout(() => setPhase('hidden'), 2250);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [phase]);

  if (phase === 'hidden') return null;

  if (phase === 'loading' || phase === 'leave') {
    return (
      <div
        className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#020205] transition duration-500 ${phase === 'leave' ? 'pointer-events-none scale-105 opacity-0' : 'opacity-100'}`}
        role="status"
        aria-label="Đang mở CINE3D"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.18),transparent_42%)]" />
        <div className="splash-beam absolute left-1/2 top-1/2 h-[140vh] w-20 -translate-x-1/2 -translate-y-1/2 rotate-[28deg] bg-gradient-to-r from-transparent via-red-500/15 to-transparent blur-2xl" />
        <div className="absolute inset-0" aria-hidden>
          {cinemaDust.map((particle, index) => (
            <span
              key={index}
              className="splash-dust absolute -bottom-3 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
              style={{ left: particle.left, width: particle.size, height: particle.size, animationDelay: particle.delay }}
            />
          ))}
        </div>
        <div className="relative flex flex-col items-center px-6">
          <div className="splash-logo relative">
            <div className="absolute inset-3 rounded-full bg-red-500/20 blur-3xl" />
            <Image src="/cine3d-logo-v2.webp" alt="CINE3D" width={260} height={53} priority unoptimized className="relative h-auto w-[210px] drop-shadow-[0_0_28px_rgba(239,68,68,0.28)] sm:w-[260px]" />
          </div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.48em] text-slate-500 sm:text-[10px]">Không gian điện ảnh của bạn</p>
          <div className="mt-8 h-[2px] w-44 overflow-hidden rounded-full bg-white/10">
            <div className="splash-progress h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-purple-500" />
          </div>
        </div>
        <style jsx>{`
          .splash-logo { animation: splash-logo 1.15s cubic-bezier(.2,.8,.2,1) both; }
          .splash-progress { animation: splash-progress 1.55s cubic-bezier(.4,0,.2,1) both; }
          .splash-beam { animation: splash-beam 1.6s ease-in-out both; }
          .splash-dust { animation: splash-dust 1.4s linear both; }
          @keyframes splash-logo { from { opacity: 0; transform: scale(.82); filter: blur(10px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
          @keyframes splash-progress { from { width: 0; } to { width: 100%; } }
          @keyframes splash-beam { from { opacity: 0; transform: translate(-50%,-50%) rotate(12deg); } 50% { opacity: 1; } to { opacity: .45; transform: translate(-50%,-50%) rotate(34deg); } }
          @keyframes splash-dust { 0% { opacity: 0; transform: translate3d(0,0,0) scale(.5); } 25% { opacity: .9; } 100% { opacity: 0; transform: translate3d(18px,-85vh,0) scale(1.4); } }
          @media (prefers-reduced-motion: reduce) { .splash-logo, .splash-progress, .splash-beam, .splash-dust { animation: none; } .splash-dust { display: none; } }
        `}</style>
      </div>
    );
  }

  return (
    <section
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#030303] text-white opacity-100"
      aria-label="Chào mừng đến CINE3D"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(153,27,27,0.17),transparent_42%),radial-gradient(circle_at_18%_70%,rgba(8,145,178,0.09),transparent_35%)]" />
      <div className="relative mx-auto grid h-full max-w-[1500px] items-center gap-8 px-6 py-10 lg:grid-cols-[0.82fr_1.18fr] lg:px-14 xl:px-20">
        <div className="welcome-copy relative z-20 flex max-w-xl flex-col items-start">
          <Image src="/cine3d-logo-v2.webp" alt="CINE3D" width={210} height={43} priority unoptimized className="mb-9 h-auto w-40 opacity-95 sm:w-48" />
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Phim không giới hạn,<br />chuyện hay không ngừng.
          </h1>
          <p className="mt-6 text-base text-slate-300 sm:text-xl">Xem mọi lúc, trên mọi thiết bị.</p>
          <button
            type="button"
            onClick={enterCinema}
            className="group mt-9 inline-flex min-h-12 items-center gap-3 rounded-xl bg-gradient-to-r from-red-700 to-rose-600 px-7 py-3.5 text-base font-bold shadow-[0_0_28px_rgba(225,29,72,0.38)] transition hover:-translate-y-0.5 hover:from-red-600 hover:to-rose-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
          >
            <Play className="h-5 w-5 fill-current transition group-hover:scale-110" />
            Bắt đầu xem
          </button>
        </div>

        <div className="welcome-screen relative z-10 mx-auto w-full max-w-[760px] perspective-[1200px]">
          <div className="relative aspect-[16/10] rotate-y-[-7deg] overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#111] p-2 shadow-[0_35px_100px_rgba(0,0,0,0.9),0_0_60px_rgba(185,28,28,0.12)] sm:p-3">
            <div className="relative h-full overflow-hidden rounded-[1.1rem] bg-black">
              <Image
                src="/cine3d-welcome-banner.png"
                alt="Không gian phim điện ảnh CINE3D"
                fill
                priority
                sizes="(max-width: 1024px) 88vw, 760px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/10" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10" />
          </div>
          <div className="mx-auto h-5 w-[48%] bg-gradient-to-b from-zinc-300 to-zinc-700 [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
          <div className="mx-auto h-2 w-[63%] rounded-[50%] bg-zinc-500 shadow-[0_10px_22px_rgba(0,0,0,0.9)]" />
        </div>
      </div>

      <style jsx>{`
        .welcome-copy { animation: welcome-copy 850ms cubic-bezier(.2,.8,.2,1) both; }
        .welcome-screen { animation: welcome-screen 1100ms 120ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes welcome-copy { from { opacity: 0; transform: translate3d(-34px,0,0); } to { opacity: 1; transform: none; } }
        @keyframes welcome-screen { from { opacity: 0; transform: translate3d(55px,12px,0) scale(.92); filter: blur(9px); } to { opacity: 1; transform: none; filter: none; } }
        @media (max-width: 1023px) {
          .welcome-screen { position: absolute; inset: auto -22% 5% 34%; width: 88%; opacity: .48; }
          .welcome-copy { text-shadow: 0 2px 22px #000; }
        }
        @media (prefers-reduced-motion: reduce) { .welcome-copy, .welcome-screen { animation: none; } }
      `}</style>
    </section>
  );
}
