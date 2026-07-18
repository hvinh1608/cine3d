'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, X, Film, Play } from 'lucide-react';

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
      {/* Khung bọc ngoài xử lý hiệu ứng lắc lư tự động và rung khi hover */}
      <div className="relative animate-wiggle-shake hover-shake">
        
        {/* Nút Đóng (X) màu vàng/đen đồng bộ tông màu tối của web */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-2.5 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border border-amber-500/50 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all hover:bg-slate-900 hover:text-amber-300 hover:scale-110 active:scale-95 cursor-pointer"
          aria-label="Đóng banner"
        >
          <X className="h-3.5 w-3.5 stroke-[3px]" />
        </button>

        {/* Cấu trúc mechanical cyberpunk frame - viền Vàng Amber phát sáng */}
        <div className="relative p-[1.5px] bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.25)] rounded-lg overflow-hidden w-[180px] md:w-[210px] animate-pulse-glow"
             style={{
               clipPath: 'polygon(12px 0px, 100% 0px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0px 100%, 0px 12px)',
             }}>
          
          {/* Lớp nền trong với hoạ tiết sci-fi, tông màu cực tối phù hợp Cine3D */}
          <div 
            className="relative px-4 py-5 bg-[#05050a]/95 flex flex-col items-center justify-center text-center overflow-hidden"
            style={{
              clipPath: 'polygon(11.5px 0px, 100% 0px, 100% calc(100% - 11.5px), calc(100% - 11.5px) 100%, 0px 100%, 0px 11.5px)',
            }}
          >
            {/* Grid pattern phụ của rạp phim */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />

            {/* Dải chỉ màu vàng nhỏ ở góc */}
            <div className="absolute top-0 left-0 w-8 h-[2px] bg-amber-500" />
            <div className="absolute bottom-0 right-0 w-8 h-[2px] bg-amber-500" />

            {/* Tiêu đề 1: TÌM KHÔNG THẤY */}
            <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-slate-400 tracking-wider">
              <span className="text-amber-500/70">⫷</span>
              <span>TÌM KHÔNG THẤY</span>
              <span className="text-amber-500/70">⫸</span>
            </div>

            {/* Tiêu đề 2: VIETSUB / TM (Hợp ngữ cảnh web phim) */}
            <h4 className="mt-1 text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 tracking-tight font-sans drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
              VIETSUB / TM
            </h4>

            {/* Tiêu đề 3: BẠN CẦN? */}
            <div className="mt-0.5 text-[11px] md:text-[13px] font-black text-slate-300 tracking-widest">
              BẠN CẦN?
            </div>

            {/* Dải Icon Giao diện Điện ảnh (Film, Play, Star...) */}
            <div className="mt-3.5 mb-4 flex items-center justify-center gap-1.5 text-amber-500/90">
              <Film className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_3px_rgba(245,158,11,0.4)]" />
              
              {/* Box X */}
              <span className="flex items-center justify-center w-3 h-3 border border-amber-500/60 rounded-[2px] text-[7px] font-black bg-amber-500/10 leading-none select-none">
                ✕
              </span>

              {/* Box C */}
              <span className="flex items-center justify-center w-3 h-3 border border-amber-500/60 rounded-[2px] text-[7px] font-black bg-amber-500/10 leading-none select-none">
                C
              </span>

              {/* Box A */}
              <span className="flex items-center justify-center w-3 h-3 border border-amber-500/60 rounded-[2px] text-[7px] font-black bg-amber-500/10 leading-none select-none">
                3
              </span>

              {/* Icon Play thay vì Star để đồng bộ theme phim */}
              <Play className="w-3 h-3 fill-amber-500 text-amber-500 drop-shadow-[0_0_3px_rgba(245,158,11,0.4)]" />
            </div>

            {/* Nút bấm VOTE PHIM / DỊCH » màu gradient vàng-cam cực đẹp */}
            <button
              onClick={handleVoteClick}
              className="w-full py-2 px-3 rounded bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-[11px] md:text-[12px] tracking-wider uppercase flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.35)] hover:shadow-[0_0_20px_rgba(245,158,11,0.65)] transition-all duration-300 hover:scale-[1.03] active:scale-95 group cursor-pointer"
              style={{
                clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
              }}
            >
              <span>VOTE PHIM LIỀN</span>
              <span className="text-[12px] md:text-[13px] font-extrabold transition-transform duration-300 group-hover:translate-x-1">
                »
              </span>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Hiệu ứng phát sáng viền và đổ bóng */
        @keyframes pulse-glow-anim {
          0%, 100% {
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
            border-color: rgba(245, 158, 11, 0.8);
          }
          50% {
            box-shadow: 0 0 25px rgba(245, 158, 11, 0.55);
            border-color: rgba(245, 158, 11, 1);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow-anim 2.5s infinite ease-in-out;
        }

        /* Lắc lư tự động theo chu kỳ để gây sự chú ý */
        @keyframes wiggle-shake-anim {
          0%, 80%, 100% {
            transform: rotate(0deg) scale(1);
          }
          82% {
            transform: rotate(-3deg) scale(1.02);
          }
          84% {
            transform: rotate(3deg) scale(1.02);
          }
          86% {
            transform: rotate(-2deg) scale(1.02);
          }
          88% {
            transform: rotate(2deg) scale(1.02);
          }
          90% {
            transform: rotate(0deg) scale(1.02);
          }
        }
        .animate-wiggle-shake {
          animation: wiggle-shake-anim 6s infinite ease-in-out;
        }
        /* Tạm dừng lắc tự động khi di chuột để ưu tiên rung liên tục */
        .hover-shake:hover {
          animation: none;
        }

        /* Hiệu ứng rung liên tục khi hover */
        @keyframes hover-shake-anim {
          0%, 100% {
            transform: rotate(0deg) scale(1.04);
          }
          20% {
            transform: rotate(-2deg) scale(1.04);
          }
          40% {
            transform: rotate(2deg) scale(1.04);
          }
          60% {
            transform: rotate(-1.5deg) scale(1.04);
          }
          80% {
            transform: rotate(1.5deg) scale(1.04);
          }
        }
        .hover-shake:hover {
          animation: hover-shake-anim 0.3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
