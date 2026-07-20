'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Film, Play } from 'lucide-react';
import { useStore } from '../../hooks/useStore';

export default function TranslationVoteBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { reduceMotion } = useStore();
  const [isVisible, setIsVisible] = useState(false);
  const isAccountPage = pathname === '/account' || pathname.startsWith('/account/');

  useEffect(() => {
    if (isAccountPage) return;

    const isClosed = sessionStorage.getItem('cine3d-vote-banner-closed');
    if (!isClosed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAccountPage]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('cine3d-vote-banner-closed', 'true');
  };

  const handleVoteClick = () => {
    router.push('/feedback?category=MOVIE_REQUEST');
  };

  if (!isVisible || isAccountPage) return null;

  return (
    <div
      className={`fixed right-3 md:right-6 top-[42%] z-40 w-[128px] md:w-[148px] transition-all duration-700 ease-out select-none ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-96 opacity-0'
      }`}
    >
      <div
        className={`relative origin-top ${reduceMotion ? '' : 'animate-hanging-swing'}`}
        style={{ transformOrigin: 'top center' }}
      >
        <div className="hanging-banner-card relative transition-[transform,filter] duration-[180ms] ease-out hover:scale-[1.06]">
          <button
            onClick={handleClose}
            className="absolute -top-6 -right-3.5 z-50 flex h-[26px] w-[26px] items-center justify-center bg-transparent text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.35)] transition-colors hover:text-white cursor-pointer"
            aria-label="Đóng banner"
          >
            <X className="h-5 w-5 stroke-[3px]" />
          </button>

          {/* Vé xem phim — stub trên + stub dưới, lỗ đục hai bên */}
          <div className="cinema-ticket relative overflow-visible">
            {/* Viền gradient amber */}
            <div className="cinema-ticket-shell relative bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 p-[1.5px] shadow-[0_18px_28px_rgba(0,0,0,0.45)]">
              <div className="cinema-ticket-inner relative flex flex-col overflow-hidden bg-[#0a0a0f]">
                {/* Lỗ đục phim (sprocket) — cạnh trái */}
                <div className="pointer-events-none absolute inset-y-2 left-[5px] z-10 flex w-[7px] flex-col justify-between py-1" aria-hidden>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="mx-auto block h-[6px] w-[6px] rounded-[1px] bg-[#05050a] ring-1 ring-amber-500/25" />
                  ))}
                </div>

                {/* Phần stub trên */}
                <div className="relative z-[1] flex flex-col items-center px-3 pb-3 pl-4 pt-3.5 text-center">
                  <div className="mb-1.5 flex items-center gap-1 text-[7px] font-black uppercase tracking-[0.18em] text-amber-500/80">
                    <Film className="h-2.5 w-2.5" />
                    <span>Cine3D</span>
                  </div>

                  <div className="text-[7px] font-bold tracking-wider text-slate-500 md:text-[8px]">
                    TÌM KHÔNG THẤY
                  </div>
                  <h4 className="mt-0.5 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-[13px] font-black leading-tight tracking-tight text-transparent drop-shadow-[0_0_6px_rgba(245,158,11,0.45)] md:text-[15px]">
                    VIETSUB
                  </h4>
                  <div className="mt-0.5 text-[10px] font-black tracking-[0.2em] text-slate-200">
                    BẠN CẦN?
                  </div>
                </div>

                {/* Đường xé vé (lỗ bán nguyệt cắt bằng CSS mask) */}
                <div className="relative z-[2] mx-3 py-0.5">
                  <span className="block h-px w-full border-t border-dashed border-amber-500/45" />
                </div>

                {/* Phần stub dưới — CTA */}
                <div className="relative z-[1] flex flex-col items-center gap-2.5 px-3 pb-3.5 pl-4 pt-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-500/90">
                    <Play className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                    <span className="text-[8px] font-black tracking-widest text-slate-400">ADMIT ONE</span>
                    <Play className="h-2.5 w-2.5 rotate-180 fill-amber-500 text-amber-500" />
                  </div>

                  <button
                    onClick={handleVoteClick}
                    className="group flex w-full cursor-pointer items-center justify-center gap-0.5 rounded-sm bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all duration-300 hover:from-amber-300 hover:to-orange-400 hover:shadow-[0_0_18px_rgba(245,158,11,0.6)] md:text-[10px]"
                  >
                    <span>VOTE PHIM</span>
                    <span className="text-[10px] font-extrabold transition-transform duration-300 group-hover:translate-x-0.5">
                      »
                    </span>
                  </button>
                </div>
              </div>
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
        .cinema-ticket-shell,
        .cinema-ticket-inner {
          border-radius: 10px;
        }
        /* Lỗ đục bán nguyệt hai bên — hình vé xem phim */
        .cinema-ticket-shell {
          -webkit-mask-image:
            radial-gradient(circle 9px at 0% 56%, transparent 98%, #000 100%),
            radial-gradient(circle 9px at 100% 56%, transparent 98%, #000 100%);
          -webkit-mask-composite: source-in;
          mask-image:
            radial-gradient(circle 9px at 0% 56%, transparent 98%, #000 100%),
            radial-gradient(circle 9px at 100% 56%, transparent 98%, #000 100%);
          mask-composite: intersect;
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
