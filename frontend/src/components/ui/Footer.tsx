'use client';

import React from 'react';
import Link from 'next/link';
import { Film, Heart, Shield, Laptop, HelpCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#030307] border-t border-white/5 py-12 px-4 md:px-8 mt-auto backdrop-blur-md relative z-10 text-slate-400 text-xs md:text-sm">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 text-left">
        
        {/* Brand Info */}
        <div className="md:col-span-2 space-y-4">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-yellow-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <Film className="w-4.5 h-4.5 text-black" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">
              CINE<span className="text-yellow-500">3D</span>
            </span>
          </Link>
          <p className="text-slate-500 max-w-sm leading-relaxed text-xs">
            CINE3D là nền tảng xem phim trực tuyến độ nét cao với giao diện lấy cảm hứng điện ảnh 3D không gian chiều sâu. Thư viện phim đa dạng, cập nhật liên tục mỗi ngày hoàn toàn miễn phí.
          </p>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <h4 className="text-white font-bold text-xs uppercase tracking-widest flex items-center">
            <Laptop className="w-4 h-4 mr-1.5 text-yellow-500" /> Đường dẫn nhanh
          </h4>
          <ul className="space-y-2 text-xs font-medium text-slate-500">
            <li>
              <Link href="/" className="hover:text-white transition-colors">Trang Chủ</Link>
            </li>
            <li>
              <Link href="/search?type=series" className="hover:text-white transition-colors">Phim Bộ Mới</Link>
            </li>
            <li>
              <Link href="/search?type=movie" className="hover:text-white transition-colors">Phim Lẻ Mới</Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-white transition-colors">Thông Tin Cá Nhân</Link>
            </li>
          </ul>
        </div>

        {/* Support & Policies */}
        <div className="space-y-3">
          <h4 className="text-white font-bold text-xs uppercase tracking-widest flex items-center">
            <Shield className="w-4 h-4 mr-1.5 text-yellow-500" /> Quy định & Trợ giúp
          </h4>
          <ul className="space-y-2 text-xs font-medium text-slate-500">
            <li>
              <Link href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</Link>
            </li>
            <li>
              <Link href="#" className="hover:text-white transition-colors">Chính sách bảo mật</Link>
            </li>
            <li>
              <Link href="#" className="hover:text-white transition-colors">Khiếu nại bản quyền</Link>
            </li>
            <li>
              <Link href="/feedback" className="hover:text-white transition-colors flex items-center">
                <HelpCircle className="w-3.5 h-3.5 mr-1" /> Góp ý & hỗ trợ
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Copyright */}
        <p className="text-slate-600 text-xs text-center md:text-left">
          © 2026 CINE3D. Phát triển bằng Next.js & Three.js. 100% không quảng cáo độc hại.
        </p>

        {/* Made with Love */}
        <p className="flex items-center text-slate-600 text-xs">
          Trải nghiệm xem phim cao cấp được tối ưu với <Heart className="w-3 h-3 text-red-500 mx-1 fill-current animate-pulse" />
        </p>
      </div>
    </footer>
  );
}
