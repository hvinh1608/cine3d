'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, Lock, Mail, Camera, Heart, History, Play, Bookmark, Trash2, LogOut, Check, Save } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80',
];

export default function AccountPage() {
  const { user, setUser, accessToken, setSession, hasHydrated, favorites, setFavorites, watchHistory, setWatchHistory, watchlist, setWatchlist, logout } = useStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'favorites' | 'watchlist' | 'history'>('profile');

  // Form States
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Profile Edit States
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync edit fields when user logs in
  useEffect(() => {
    if (user) {
      setEditUsername(user.username);
      setEditAvatar(user.avatar || '');
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!accessToken) return;
    try {
      const [favsRes, historyRes, watchlistRes] = await Promise.all([
        axios.get(`${API_URL}/user/favorites`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/user/history`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/user/watchlist`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setFavorites(favsRes.data);
      setWatchHistory(historyRes.data);
      setWatchlist(watchlistRes.data);
    } catch (e) {
      console.warn('Không tải được favorites/history/watchlist.', e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isLogin) {
        // Login Request
        const res = await axios.post(`${API_URL}/auth/login`, { email, password });
        setSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      } else {
        // Register Request
        await axios.post(`${API_URL}/auth/register`, { email, username, password });
        // Auto login on successful register
        const res = await axios.post(`${API_URL}/auth/login`, { email, password });
        setSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await axios.put(`${API_URL}/user/profile`, {
        username: editUsername,
        avatar: editAvatar
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUser(res.data.user);
      setSuccessMsg('Cập nhật thông tin thành công!');
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.');
    }
  };

  const handleRemoveFavorite = async (movieId: string) => {
    if (!accessToken) return;
    try {
      await axios.post(`${API_URL}/user/favorites/${movieId}`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setFavorites(favorites.filter((f) => f.id !== movieId));
    } catch {
      setFavorites(favorites.filter((f) => f.id !== movieId));
    }
  };

  const handleRemoveWatchlist = async (movieId: string) => {
    if (!accessToken) return;
    try {
      await axios.post(`${API_URL}/user/watchlist/${movieId}`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setWatchlist(watchlist.filter((w) => w.id !== movieId));
    } catch {
      setWatchlist(watchlist.filter((w) => w.id !== movieId));
    }
  };

  const handleRemoveHistory = async (historyId: string) => {
    if (!accessToken) return;
    try {
      await axios.delete(`${API_URL}/user/history/${historyId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setWatchHistory(watchHistory.filter((h) => h.id !== historyId));
    } catch {
      setWatchHistory(watchHistory.filter((h) => h.id !== historyId));
    }
  };

  if (!hasHydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-red-600" />
      </div>
    );
  }

  // Render Login/Signup forms if guest
  if (!user) {
    return (
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-16 flex flex-col justify-center">
        <div className="glass-panel p-8 rounded-3xl text-left space-y-6 shadow-2xl relative">
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black tracking-wide bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent uppercase">
              {isLogin ? 'Đăng Nhập CINE3D' : 'Đăng Ký Tài Khoản'}
            </h2>
            <p className="text-xs text-slate-500">Trải nghiệm rạp chiếu phim 3D không gian ảo.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-950/45 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Địa chỉ Email"
                className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl pl-10 pr-4 py-3 text-xs md:text-sm outline-none text-white"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            </div>

            {!isLogin && (
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên tài khoản"
                  className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl pl-10 pr-4 py-3 text-xs md:text-sm outline-none text-white"
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              </div>
            )}

            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl pl-10 pr-4 py-3 text-xs md:text-sm outline-none text-white"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white text-xs md:text-sm font-black py-3.5 rounded-xl transition-all shadow-lg active:scale-98"
            >
              {isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg('');
              }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-10 text-slate-100 select-none bg-transparent">
      
      {/* Profile Header Card */}
      <div className="glass-panel p-6 rounded-3xl mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 shrink-0">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
              alt={user.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-left space-y-1">
            <h2 className="text-xl font-black text-white">{user.username}</h2>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-red-600/20 text-red-500 font-black px-2 py-0.5 rounded border border-red-500/20 uppercase">
                {user.role}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{user.email}</span>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border border-white/10 hover:border-red-500/30 bg-slate-900/60 hover:bg-red-600 hover:text-white transition-all text-slate-300 text-xs font-bold active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng Xuất</span>
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-col space-y-6">
        
        {/* Tab Headers */}
        <div className="flex flex-wrap border-b border-white/10 gap-x-6 gap-y-2 text-xs md:text-sm font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 flex items-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'profile' ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Hồ Sơ Cá Nhân</span>
          </button>
          
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-3 flex items-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'favorites' ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
            <span>Phim Yêu Thích ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`pb-3 flex items-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'watchlist' ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Xem Sau ({watchlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 flex items-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'history' ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Lịch Sử Xem ({watchHistory.length})</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="flex-grow min-w-0">
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form editing */}
              <div className="lg:col-span-2 glass-panel p-6 rounded-3xl text-left space-y-6 shadow-2xl">
                <h3 className="text-base font-black uppercase text-white tracking-wide">Cập nhật tài khoản</h3>
                {successMsg && <div className="bg-green-950/45 border border-green-500/30 text-green-400 text-xs px-4 py-2.5 rounded-lg">{successMsg}</div>}
                {errorMsg && <div className="bg-red-950/45 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">{errorMsg}</div>}
                
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tên hiển thị:</span>
                    <input
                      type="text"
                      required
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-xs md:text-sm text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Đường dẫn ảnh đại diện (URL):</span>
                    <input
                      type="text"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-xs md:text-sm text-white outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-white text-black text-xs md:text-sm font-black py-3 rounded-xl transition-all hover:bg-slate-200 active:scale-95 shadow-md flex items-center justify-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Lưu Thay Đổi</span>
                  </button>
                </form>
              </div>

              {/* Avatar quick select */}
              <div className="lg:col-span-1 glass-panel p-6 rounded-3xl text-left space-y-4 shadow-2xl">
                <h3 className="text-base font-black uppercase text-white tracking-wide">Avatar gợi ý</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Chọn nhanh ảnh đại diện yêu thích của bạn từ kho hình ảnh chất lượng cao:</p>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {PRESET_AVATARS.map((avatarUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEditAvatar(avatarUrl)}
                      className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all active:scale-90 cursor-pointer ${
                        editAvatar === avatarUrl ? 'border-red-500 scale-105 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img src={avatarUrl} alt="Preset Avatar" className="w-full h-full object-cover" />
                      {editAvatar === avatarUrl && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {favorites.map((movie) => (
                <div key={movie.id} className="relative aspect-[2/3] rounded-2xl overflow-hidden group shadow-lg border border-white/5 bg-slate-950">
                  <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                  
                  {/* Remove favorite button */}
                  <button
                    onClick={() => handleRemoveFavorite(movie.id)}
                    className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                    title="Xóa yêu thích"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-white mb-2 line-clamp-2 text-left">{movie.title}</span>
                    <Link
                      href={`/movies/${movie.slug}`}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-full text-center text-xs flex items-center justify-center active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current mr-1" /> Chi Tiết
                    </Link>
                  </div>
                </div>
              ))}
              {favorites.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 text-xs font-semibold">
                  Danh sách phim yêu thích trống.
                </div>
              )}
            </div>
          )}

          {activeTab === 'watchlist' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {watchlist.map((movie) => (
                <div key={movie.id} className="relative aspect-[2/3] rounded-2xl overflow-hidden group shadow-lg border border-white/5 bg-slate-950">
                  <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                  
                  {/* Remove watchlist button */}
                  <button
                    onClick={() => handleRemoveWatchlist(movie.id)}
                    className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                    title="Xóa khỏi danh sách xem sau"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-white mb-2 line-clamp-2 text-left">{movie.title}</span>
                    <Link
                      href={`/movies/${movie.slug}`}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-full text-center text-xs flex items-center justify-center active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current mr-1" /> Chi Tiết
                    </Link>
                  </div>
                </div>
              ))}
              {watchlist.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 text-xs font-semibold">
                  Danh sách xem sau trống.
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {watchHistory.map((item) => {
                const percent = Math.min(100, Math.floor((item.watchedTime / (item.duration || 1)) * 100));
                return (
                  <div
                    key={item.id}
                    className="glass-panel p-4 rounded-2xl flex items-center gap-4 hover:border-purple-500/20 transition-all shadow-md group relative text-left"
                  >
                    {/* Hover remove history button */}
                    <button
                      onClick={() => handleRemoveHistory(item.id)}
                      className="absolute top-3 right-3 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                      title="Xóa lịch sử xem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <img
                      src={item.movie?.posterUrl}
                      alt={item.movie?.title}
                      className="w-14 aspect-[2/3] rounded-lg object-cover border border-white/10 shrink-0"
                    />

                    <div className="flex-grow space-y-1.5 w-full min-w-0 pr-8">
                      <h4 className="text-sm font-bold text-white leading-tight truncate">{item.movie?.title}</h4>
                      <p className="text-[10px] text-slate-400">
                        {(() => {
                          const matchedEp = item.movie?.episodes?.find((e: any) => e.id === item.episodeId);
                          return matchedEp ? `${matchedEp.title} • ` : '';
                        })()}
                        Đã xem {percent}% ({Math.floor(item.watchedTime / 60)} phút)
                      </p>
                      
                      {/* Playback progress bar */}
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="h-full bg-purple-600 rounded-full"
                        />
                      </div>
                    </div>

                    <Link
                      href={`/watch/${item.movie?.slug}?ep=${(() => {
                        const matchedEp = item.movie?.episodes?.find((e: any) => e.id === item.episodeId);
                        return matchedEp?.episodeOrder || 1;
                      })()}`}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full text-xs flex items-center justify-center shrink-0 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </Link>
                  </div>
                );
              })}
              {watchHistory.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 text-xs font-semibold">
                  Chưa có lịch sử phát phim.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
