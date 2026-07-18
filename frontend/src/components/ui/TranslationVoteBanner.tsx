'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, X, Film } from 'lucide-react';

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
      className={`fixed right-4 md:right-6 top-[55%] -translate-y-1/2 z-40 transition-all duration-700 ease-out select-none ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-96 opacity-0'
      }`}
    >
      {/* Nút Đóng (X) màu đỏ bên ngoài góc trên bên phải */}
      <button
        onClick={handleClose}
        className="absolute -top-3 -right-2.5 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-all hover:bg-red-500 hover:scale-110 active:scale-95 cursor-pointer"
        aria-label="Đóng banner"
      >
        <X className="h-4 w-4 stroke-[3px]" />
      </button>

      {/* Cấu trúc mechanical cyberpunk frame */}
      <div className="relative p-[1.5px] bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.35)] rounded-lg overflow-hidden w-[180px] md:w-[210px] animate-pulse-glow"
           style={{
             clipPath: 'polygon(12px 0px, 100% 0px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0px 100%, 0px 12px)',
           }}>
        
        {/* Lớp nền trong với hoạ tiết sci-fi */}
        <div 
          className="relative px-4 py-5 bg-[#0a0a0d] flex flex-col items-center justify-center text-center overflow-hidden"
          style={{
            clipPath: 'polygon(11.5px 0px, 100% 0px, 100% calc(100% - 11.5px), calc(100% - 11.5px) 100%, 0px 100%, 0px 11.5px)',
          }}
        >
          {/* Grid pattern phụ */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />

          {/* Dải sọc màu đỏ nhỏ ở góc */}
          <div className="absolute top-0 left-0 w-8 h-[2px] bg-red-500" />
          <div className="absolute bottom-0 right-0 w-8 h-[2px] bg-red-500" />

          {/* Tiêu đề 1: TÌM KHÔNG THẤY */}
          <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-slate-400 tracking-wider">
            <span className="text-red-500/70">⫷</span>
            <span>TÌM KHÔNG THẤY</span>
            <span className="text-red-500/70">⫸</span>
          </div>

          {/* Tiêu đề 2: VIỆT HÓA (Đặc biệt phát sáng lớn) */}
          <h4 className="mt-1 text-xl md:text-2xl font-black text-red-500 tracking-tight font-sans drop-shadow-[0_0_8px_rgba(239,68,68,0.75)] animate-pulse">
            VIỆT HÓA
          </h4>

          {/* Tiêu đề 3: BẠN CẦN? */}
          <div className="mt-0.5 text-[11px] md:text-[13px] font-black text-slate-200 tracking-widest">
            BẠN CẦN?
          </div>

          {/* Dải Icon Giao diện (Film, X, C A, Star) */}
          <div className="mt-3.5 mb-4 flex items-center justify-center gap-1.5 text-red-500/90">
            <Film className="w-3.5 h-3.5 text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]" />
            
            {/* Box X */}
            <span className="flex items-center justify-center w-3 h-3 border border-red-500/60 rounded-[2px] text-[7px] font-black bg-red-500/10 leading-none select-none">
              ✕
            </span>

            {/* Box C */}
            <span className="flex items-center justify-center w-3 h-3 border border-red-500/60 rounded-[2px] text-[7px] font-black bg-red-500/10 leading-none select-none">
              C
            </span>

            {/* Box A */}
            <span className="flex items-center justify-center w-3 h-3 border border-red-500/60 rounded-[2px] text-[7px] font-black bg-red-500/10 leading-none select-none">
              A
            </span>

            {/* Star */}
            <Star className="w-3.5 h-3.5 fill-red-500 text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]" />
          </div>

          {/* Nút bấm VOTE DỊCH LIỀN » */}
          <button
            onClick={handleVoteClick}
            className="w-full py-2 px-3 rounded bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] md:text-[12px] tracking-wider uppercase flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_20px_rgba(220,38,38,0.8)] transition-all duration-300 hover:scale-[1.03] active:scale-95 group cursor-pointer"
            style={{
              clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
            }}
          >
            <span>VOTE DỊCH LIỀN</span>
            <span className="text-[12px] md:text-[13px] font-normal transition-transform duration-300 group-hover:translate-x-1">
              »
            </span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-glow-anim {
          0%, 100% {
            box-shadow: 0 0 15px rgba(220, 38, 38, 0.3);
            border-color: rgba(220, 38, 38, 0.9);
          }
          50% {
            box-shadow: 0 0 25px rgba(220, 38, 38, 0.65);
            border-color: rgba(220, 38, 38, 1);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow-anim 2.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
