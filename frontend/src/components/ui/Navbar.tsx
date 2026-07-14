'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Film, User, LogOut, ShieldAlert, Sparkles, Menu, X, Bell, Crown } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';
import type { Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Navbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, hasHydrated } = useStore();

  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiOpen, setNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);

  // Monitor scrolling to alter glass background intensity
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-form]')) {
        setSuggestionsOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Update query state if search param changes
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  // Lightweight debounced typeahead search. It only starts after two characters.
  useEffect(() => {
    const keyword = searchQuery.trim();
    if (keyword.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await axios.get(`${API_URL}/movies`, {
          params: { search: keyword, page: 1, limit: 6 },
          signal: controller.signal,
        });
        setSuggestions(Array.isArray(response.data?.movies) ? response.data.movies : []);
        setSuggestionsOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  // Fetch notifications
  useEffect(() => {
    if (user && hasHydrated) {
      const fetchNotis = async () => {
        try {
          const res = await axios.get(`${API_URL}/user/notifications`, {
            headers: { Authorization: `Bearer ${useStore.getState().accessToken}` }
          });
          setNotifications(res.data);
          setUnreadCount(res.data.filter((n: any) => !n.isRead).length);
        } catch (e) {
          // ignore or mock
        }
      };
      fetchNotis();
      const interval = setInterval(fetchNotis, 30000);
      return () => clearInterval(interval);
    }
  }, [user, hasHydrated]);

  const handleMarkAsRead = async (id: string, url?: string | null) => {
    setNotiOpen(false);
    try {
      await axios.put(`${API_URL}/user/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${useStore.getState().accessToken}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (url) {
        router.push(url);
      }
    } catch {
      if (url) {
        router.push(url);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-black/75 backdrop-blur-md border-b border-white/5 py-3'
          : 'bg-gradient-to-b from-black/80 to-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-yellow-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all">
            <Film className="w-4.5 h-4.5 text-black" />
          </div>
          <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-white via-slate-100 to-yellow-500 bg-clip-text text-transparent">
            CINE<span className="text-yellow-500">3D</span>
          </span>
        </Link>

        {/* NAVIGATION LINKS - DESKTOP */}
        <div className="hidden lg:flex items-center space-x-6 text-sm font-semibold text-slate-300">
          <Link href="/" className="hover:text-yellow-500 transition-colors">Trang Chủ</Link>
          <Link href="/search?type=series" className="hover:text-yellow-500 transition-colors">Phim Bộ</Link>
          <Link href="/search?type=movie" className="hover:text-yellow-500 transition-colors">Phim Lẻ</Link>
          <Link href="/search" className="hover:text-yellow-500 transition-colors flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 mr-1 animate-pulse" /> Khám Phá
          </Link>
          <Link href="/vip" className="flex items-center text-amber-400 transition-colors hover:text-amber-300">
            <Crown className="mr-1 h-3.5 w-3.5" /> VIP
          </Link>
        </div>

        {/* SEARCH & USER ACTIONS - DESKTOP */}
        <div className="hidden md:flex items-center space-x-4">
          {/* Search Form */}
          <form ref={searchRef} data-search-form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm phim, diễn viên..."
              className="bg-slate-900/60 border border-white/10 hover:border-white/20 focus:border-yellow-500 text-white rounded-full pl-4 pr-10 py-1.5 text-xs w-48 focus:w-60 transition-all duration-300 outline-none backdrop-blur-sm"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer">
              <Search className="w-4 h-4" />
            </button>
            {suggestionsOpen && (suggestionsLoading || suggestions.length > 0) && (
              <div className="absolute left-0 top-full z-[60] mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 p-1 shadow-2xl backdrop-blur-xl">
                {suggestionsLoading ? <p className="px-3 py-4 text-center text-xs text-slate-400">Đang tìm...</p> : suggestions.map((movie) => (
                  <Link key={movie.id} href={`/movies/${movie.slug}`} onClick={() => setSuggestionsOpen(false)} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-white/10">
                    <img src={movie.posterUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                    <span className="min-w-0"><strong className="block truncate text-xs text-white">{movie.title}</strong><small className="text-[10px] text-slate-400">{movie.releaseYear} · {movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}</small></span>
                  </Link>
                ))}
              </div>
            )}
          </form>

          {/* User Section */}
          {!hasHydrated ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-white/5" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  title="Admin Dashboard"
                  className="p-2 rounded-full border border-purple-500/20 bg-purple-950/20 text-purple-400 hover:bg-purple-950/40 hover:text-white transition-all"
                >
                  <ShieldAlert className="w-4 h-4" />
                </Link>
              )}

              {/* Notifications Dropdown Bell */}
              <div className="relative" ref={notiRef}>
                <button
                  onClick={() => setNotiOpen(!notiOpen)}
                  className="relative p-2 rounded-full border border-white/10 bg-slate-950/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Thông báo"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-black">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notiOpen && (
                  <div className="absolute right-0 top-full mt-3 w-80 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="font-black uppercase tracking-wider text-slate-300 text-xs">Thông báo</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto mt-2 space-y-2.5 pr-0.5 scrollbar-thin">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id, n.url)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            n.isRead
                              ? 'bg-slate-900/20 border-white/5 text-slate-400 hover:bg-white/5'
                              : 'bg-yellow-500/5 border-yellow-500/20 text-slate-200 hover:bg-yellow-500/10'
                          }`}
                        >
                          <h4 className="font-bold text-xs leading-tight mb-0.5">{n.title}</h4>
                          <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">{n.message}</p>
                          <span className="text-[8px] text-slate-500 font-medium mt-1 block">
                            {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <p className="text-slate-500 text-xs text-center py-6">Chưa có thông báo nào.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Link */}
              <Link
                href="/account"
                className="flex items-center space-x-2 border border-white/10 bg-slate-950/40 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                  alt={user.username}
                  className="w-5 h-5 rounded-full object-cover border border-white/20"
                />
                <span className="text-xs font-bold text-white max-w-[80px] truncate">{user.username}</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  router.push('/account');
                }}
                title="Đăng xuất"
                className="p-2 rounded-full border border-white/10 hover:bg-red-600/20 hover:text-red-500 text-slate-400 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/account"
              className="bg-yellow-500 text-black text-xs font-black px-5 py-2 rounded-full hover:bg-white hover:text-black transition-all active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              Đăng Nhập
            </Link>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="flex md:hidden items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg border border-white/10 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-black/95 border-b border-white/10 p-5 flex flex-col space-y-4 animate-fade-in backdrop-blur-xl">
          {/* Mobile Search */}
          <form data-search-form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm phim, diễn viên..."
              className="bg-slate-900 border border-white/10 focus:border-yellow-500 text-white rounded-full pl-4 pr-10 py-2 text-sm w-full outline-none"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
              <Search className="w-5 h-5" />
            </button>
            {suggestionsOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 p-1 shadow-2xl backdrop-blur-xl">
                {suggestions.map((movie) => (
                  <Link key={movie.id} href={`/movies/${movie.slug}`} onClick={() => { setSuggestionsOpen(false); setMobileMenuOpen(false); }} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-white/10">
                    <img src={movie.posterUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                    <span className="min-w-0"><strong className="block truncate text-xs text-white">{movie.title}</strong><small className="text-[10px] text-slate-400">{movie.releaseYear} · {movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}</small></span>
                  </Link>
                ))}
              </div>
            )}
          </form>

          {/* Links */}
          <div className="flex flex-col space-y-3 font-semibold text-slate-300 text-center">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Trang Chủ</Link>
            <Link href="/search?type=series" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Phim Bộ</Link>
            <Link href="/search?type=movie" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Phim Lẻ</Link>
            <Link href="/search" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400 mr-1 animate-pulse" /> Khám Phá
            </Link>
            <Link href="/vip" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center border-b border-white/5 py-1 text-amber-400 hover:text-amber-300">
              <Crown className="mr-1 h-4 w-4" /> Nâng cấp VIP
            </Link>

            {!hasHydrated ? (
              <div className="mx-auto h-10 w-32 animate-pulse rounded-full bg-white/5" />
            ) : user ? (
              <>
                <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Tài Khoản</Link>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-purple-400 hover:text-purple-300 py-1 border-b border-white/5">Admin Dashboard</Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    router.push('/account');
                  }}
                  className="text-red-500 flex items-center justify-center space-x-1.5 py-2 cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" /> <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-yellow-500 text-black font-black py-2.5 rounded-full hover:bg-white transition-all text-center w-full block shadow cursor-pointer"
              >
                Đăng Nhập
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
