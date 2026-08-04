'use client';

import Image from '@/components/ui/ResilientImage';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const tiles = Array.from({ length: 12 }, (_, index) => index);

export default function CinemaSplash() {
  const [phase, setPhase] = useState<'show' | 'leave' | 'hidden'>('show');

  const enterCinema = useCallback(() => {
    setPhase('leave');
    window.setTimeout(() => setPhase('hidden'), 650);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const autoEnter = window.setTimeout(enterCinema, 6500);
    return () => {
      window.clearTimeout(autoEnter);
      document.body.style.overflow = previousOverflow;
    };
  }, [enterCinema]);

  useEffect(() => {
    if (phase === 'hidden') document.body.style.overflow = '';
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <section
      className={`fixed inset-0 z-[9999] overflow-hidden bg-[#030303] text-white transition-[opacity,transform,filter] duration-700 ${phase === 'leave' ? 'pointer-events-none scale-[1.025] opacity-0 blur-md' : 'opacity-100'}`}
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
          <p className="mt-4 text-xs text-slate-600">Tự động mở sau vài giây</p>
        </div>

        <div className="welcome-screen relative z-10 mx-auto w-full max-w-[760px] perspective-[1200px]">
          <div className="relative aspect-[16/10] rotate-y-[-7deg] overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#111] p-2 shadow-[0_35px_100px_rgba(0,0,0,0.9),0_0_60px_rgba(185,28,28,0.12)] sm:p-3">
            <div className="grid h-full grid-cols-4 grid-rows-3 gap-1.5 overflow-hidden rounded-[1.1rem] bg-black sm:gap-2">
              {tiles.map((tile) => (
                <div key={tile} className="relative overflow-hidden bg-slate-900">
                  <Image
                    src="/invincible-atom-eve-poster.jpg"
                    alt=""
                    fill
                    priority={tile < 4}
                    sizes="(max-width: 768px) 25vw, 180px"
                    className="scale-[1.65] object-cover transition duration-700"
                    style={{ objectPosition: `${20 + (tile % 4) * 20}% ${16 + Math.floor(tile / 4) * 34}%`, filter: `hue-rotate(${tile * 23}deg) saturate(${0.85 + (tile % 3) * 0.2}) brightness(${0.72 + (tile % 4) * 0.08})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                </div>
              ))}
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
