'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Film, Play } from 'lucide-react';
import { useStore } from '../../hooks/useStore';

export default function TranslationVoteBanner() {
  const router = useRouter();
  const { reduceMotion } = useStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const isClosed = sessionStorage.getItem('cine3d-vote-banner-closed');
    if (!isClosed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('cine3d-vote-banner-closed', 'true');
  };

  const handleVoteClick = () => {
    router.push('/feedback?category=MOVIE_REQUEST');
  };

  if (!isMounted || !isVisible) return null;

  return (
    <div
      className={`fixed right-3 md:right-6 top-[42%] z-40 w-[140px] md:w-[165px] transition-all duration-700 ease-out select-none ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-96 opacity-0'
      }`}
    >
      {/* Pivot từ đỉnh — swing kiểu treo biển TRT */}
      <div
        className={`relative origin-top ${reduceMotion ? '' : 'animate-hanging-swing'}`}
        style={{ transformOrigin: 'top center' }}
      >
        <div className="hanging-banner-card transition-[transform,filter] duration-[180ms] ease-out hover:scale-[1.06]">
          <button
            onClick={handleClose}
            className="absolute -top-6 -right-3.5 z-50 flex h-[26px] w-[26px] items-center justify-center bg-transparent text-[28px] font-black leading-none text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.35)] transition-colors hover:text-white cursor-pointer"
            aria-label="Đóng banner"
          >
            <X className="h-5 w-5 stroke-[3px]" />
          </button>

          <div
            className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-[1.2px] shadow-[0_18px_28px_rgba(0,0,0,0.45)]"
            style={{
              clipPath: 'polygon(10px 0px, 100% 0px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0px 100%, 0px 10px)',
            }}
          >
            <div
              className="relative flex flex-col items-center justify-center overflow-hidden bg-[#05050a]/95 px-3 py-4 text-center"
              style={{
                clipPath: 'polygon(9.5px 0px, 100% 0px, 100% calc(100% - 9.5px), calc(100% - 9.5px) 100%, 0px 100%, 0px 9.5px)',
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808003_1px,transparent_1px),linear-gradient(to_bottom,#80808003_1px,transparent_1px)] bg-[size:8px_8px]" />

              <div className="absolute left-0 top-0 h-[1.5px] w-6 bg-amber-500" />
              <div className="absolute bottom-0 right-0 h-[1.5px] w-6 bg-amber-500" />

              <div className="flex items-center gap-0.5 text-[7px] font-black tracking-wider text-slate-400 md:text-[8px]">
                <span className="text-amber-500/70">⫷</span>
                <span>TÌM KHÔNG THẤY</span>
                <span className="text-amber-500/70">⫸</span>
              </div>

              <h4 className="mt-0.5 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text font-sans text-[14px] font-black tracking-tight text-transparent drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] md:text-[17px]">
                VIETSUB / TM
              </h4>

              <div className="mt-0.5 text-[9px] font-black tracking-widest text-slate-300 md:text-[11px]">
                BẠN CẦN?
              </div>

              <div className="mb-3 mt-2.5 flex items-center justify-center gap-1.5 text-amber-500/90">
                <Film className="h-3 w-3 text-amber-400 drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]" />
                <span className="flex h-2.5 w-2.5 select-none items-center justify-center rounded-[2px] border border-amber-500/60 bg-amber-500/10 text-[6px] font-black leading-none">
                  ✕
                </span>
                <span className="flex h-2.5 w-2.5 select-none items-center justify-center rounded-[2px] border border-amber-500/60 bg-amber-500/10 text-[6px] font-black leading-none">
                  C
                </span>
                <span className="flex h-2.5 w-2.5 select-none items-center justify-center rounded-[2px] border border-amber-500/60 bg-amber-500/10 text-[6px] font-black leading-none">
                  3
                </span>
                <Play className="h-2.5 w-2.5 fill-amber-500 text-amber-500 drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]" />
              </div>

              <button
                onClick={handleVoteClick}
                className="group flex w-full cursor-pointer items-center justify-center gap-0.5 bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all duration-300 hover:from-amber-300 hover:to-orange-400 hover:shadow-[0_0_18px_rgba(245,158,11,0.6)] md:text-[10px]"
                style={{
                  clipPath: 'polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%)',
                }}
              >
                <span>VOTE PHIM LIỀN</span>
                <span className="text-[10px] font-extrabold transition-transform duration-300 group-hover:translate-x-0.5">
                  »
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes hangingSwing {
          0%, 100% {
            transform: rotate(-5deg) translateY(0);
          }
          50% {
            transform: rotate(5deg) translateY(-6px);
          }
        }
        .animate-hanging-swing {
          animation: hangingSwing 2.4s ease-in-out infinite;
        }
        .hanging-banner-card:hover {
          filter:
            drop-shadow(0 18px 28px rgba(0, 0, 0, 0.45))
            drop-shadow(0 0 18px rgba(245, 158, 11, 0.35));
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hanging-swing {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
