'use client';

import Image from '@/components/ui/ResilientImage';

const cinemaDust = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 37 + 9) % 100}%`,
  size: `${2 + (index % 3)}px`,
  delay: `${(index % 7) * 0.11}s`,
}));

export default function CinemaLoadingOverlay({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-[#020205]/92 backdrop-blur-sm transition duration-500 ${leaving ? 'pointer-events-none scale-105 opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Đang tải"
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
        <p className="mt-5 text-[9px] font-black uppercase tracking-[0.48em] text-slate-500 sm:text-[10px]">Đang tải</p>
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
