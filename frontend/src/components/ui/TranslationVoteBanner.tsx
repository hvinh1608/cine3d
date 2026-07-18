'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Film, Play } from 'lucide-react';

export default function TranslationVoteBanner() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Kiểm tra xem người dùng đã đóng banner này trong phiên làm việc hiện tại chưa
    const isClosed = sessionStorage.getItem('cine3d-vote-banner-closed');
    if (!isClosed) {
      // Đợi 2 giây sau khi trang tải xong rồi mới trượt banner vào
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
      className={`fixed right-3 md:right-5 top-[55%] -translate-y-1/2 z-40 transition-all duration-700 ease-out select-none ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-96 opacity-0'
      }`}
    >
      {/* 1. Lớp lắc lư liên tục từ từ mượt mà (Wiggle slow) */}
      <div className="relative animate-wiggle-slow">
        
        {/* 2. Lớp phản hồi di chuột (Scale nhẹ khi hover) */}
        <div className="transition-transform duration-300 hover:scale-105 active:scale-95">
          
          {/* Nút Đóng (X) màu vàng/đen đồng bộ */}
          <button
            onClick={handleClose}
            className="absolute -top-2.5 -right-2 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-amber-500/50 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all hover:bg-slate-900 hover:text-amber-300 hover:scale-110 cursor-pointer"
            aria-label="Đóng banner"
          >
            <X className="h-3 w-3 stroke-[3px]" />
          </button>

          {/* Cấu trúc mechanical cyberpunk frame - Kích thước thu nhỏ gọn gàng hơn */}
          <div className="relative p-[1.2px] bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] rounded-lg overflow-hidden w-[140px] md:w-[165px] animate-pulse-glow"
               style={{
                 clipPath: 'polygon(10px 0px, 100% 0px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0px 100%, 0px 10px)',
               }}>
            
            {/* Lớp nền trong với hoạ tiết sci-fi */}
            <div 
              className="relative px-3 py-4 bg-[#05050a]/95 flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                clipPath: 'polygon(9.5px 0px, 100% 0px, 100% calc(100% - 9.5px), calc(100% - 9.5px) 100%, 0px 100%, 0px 9.5px)',
              }}
            >
              {/* Grid pattern phụ của rạp phim */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808003_1px,transparent_1px),linear-gradient(to_bottom,#80808003_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />

              {/* Dải chỉ màu vàng nhỏ ở góc */}
              <div className="absolute top-0 left-0 w-6 h-[1.5px] bg-amber-500" />
              <div className="absolute bottom-0 right-0 w-6 h-[1.5px] bg-amber-500" />

              {/* Tiêu đề 1: TÌM KHÔNG THẤY */}
              <div className="flex items-center gap-0.5 text-[7px] md:text-[8px] font-black text-slate-400 tracking-wider">
                <span className="text-amber-500/70">⫷</span>
                <span>TÌM KHÔNG THẤY</span>
                <span className="text-amber-500/70">⫸</span>
              </div>

              {/* Tiêu đề 2: VIETSUB / TM */}
              <h4 className="mt-0.5 text-[14px] md:text-[17px] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 tracking-tight font-sans drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                VIETSUB / TM
              </h4>

              {/* Tiêu đề 3: BẠN CẦN? */}
              <div className="mt-0.5 text-[9px] md:text-[11px] font-black text-slate-300 tracking-widest">
                BẠN CẦN?
              </div>

              {/* Dải Icon Điện ảnh (nhỏ hơn) */}
              <div className="mt-2.5 mb-3 flex items-center justify-center gap-1.5 text-amber-500/90">
                <Film className="w-3 h-3 text-amber-400 drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]" />
                
                {/* Box X */}
                <span className="flex items-center justify-center w-2.5 h-2.5 border border-amber-500/60 rounded-[2px] text-[6px] font-black bg-amber-500/10 leading-none select-none">
                  ✕
                </span>

                {/* Box C */}
                <span className="flex items-center justify-center w-2.5 h-2.5 border border-amber-500/60 rounded-[2px] text-[6px] font-black bg-amber-500/10 leading-none select-none">
                  C
                </span>

                {/* Box A */}
                <span className="flex items-center justify-center w-2.5 h-2.5 border border-amber-500/60 rounded-[2px] text-[6px] font-black bg-amber-500/10 leading-none select-none">
                  3
                </span>

                {/* Icon Play */}
                <Play className="w-2.5 h-2.5 fill-amber-500 text-amber-500 drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]" />
              </div>

              {/* Nút bấm VOTE PHIM / DỊCH (nhỏ hơn, vừa vặn hơn) */}
              <button
                onClick={handleVoteClick}
                className="w-full py-1.5 px-2 rounded bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-[9px] md:text-[10px] tracking-wider uppercase flex items-center justify-center gap-0.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:shadow-[0_0_18px_rgba(245,158,11,0.6)] transition-all duration-300 group cursor-pointer"
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
        /* Hiệu ứng phát sáng viền và đổ bóng */
        @keyframes pulse-glow-anim {
          0%, 100% {
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);
            border-color: rgba(245, 158, 11, 0.8);
          }
          50% {
            box-shadow: 0 0 18px rgba(245, 158, 11, 0.45);
            border-color: rgba(245, 158, 11, 1);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow-anim 2.5s infinite ease-in-out;
        }

        /* Lắc lư qua lại liên tục từ từ mượt mà (Wiggle continuous) */
        @keyframes wiggle-slow-anim {
          0%, 100% {
            transform: rotate(-2.5deg);
          }
          50% {
            transform: rotate(2.5deg);
          }
        }
        .animate-wiggle-slow {
          animation: wiggle-slow-anim 4.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
