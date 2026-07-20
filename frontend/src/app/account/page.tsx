'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { User, Lock, Mail, Heart, History, Play, Bookmark, Trash2, LogOut, Check, Save, Crown, Upload, SlidersHorizontal, Trophy, Clock3, Flame } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import FacebookSignInButton from '../../components/auth/FacebookSignInButton';
import TurnstileWidget from '../../components/auth/TurnstileWidget';
import ExperienceCenter from '../../components/account/ExperienceCenter';
import { localizeApiMessage } from '../../lib/api-errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const requestMessage = (error: unknown, fallback: string) =>
  localizeApiMessage((error as AxiosError<{ message?: string }>).response?.data?.message || fallback, fallback);
const requestCode = (error: unknown) => (error as AxiosError<{ code?: string }>).response?.data?.code;
const normalizeEmail = (value: string) => {
  const trimmed = value.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}@gmail.com`;
};

const PRESET_AVATARS = [
  'https://cine3d.id.vn/avatars/1.jpg',
  'https://cine3d.id.vn/avatars/2.jpg',
  'https://cine3d.id.vn/avatars/3.jpg',
  'https://cine3d.id.vn/avatars/4.jpg',
  'https://cine3d.id.vn/avatars/5.jpg',
  'https://cine3d.id.vn/avatars/6.jpg',
];

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, accessToken, setSession, hasHydrated, authReady, favorites, setFavorites, watchHistory, setWatchHistory, watchlist, setWatchlist, logout, showToast, selectedProfileId, setProfiles } = useStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'experience' | 'insights' | 'favorites' | 'watchlist' | 'history'>('profile');
  const [viewingInsights, setViewingInsights] = useState<{ totalHours: number; moviesStarted: number; completedMovies: number; streakDays: number; favoriteGenres: { name: string; count: number }[]; badges: { id: string; name: string; description: string; unlocked: boolean }[] } | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'watching' | 'completed'>('all');
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(() => new Set());

  // Form States
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState<'none' | 'forgot' | 'reset'>('none');
  const [resetToken, setResetToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    const verified = params.get('verified');
    queueMicrotask(() => {
      if (token) {
        setResetToken(token);
        setRecoveryMode('reset');
      } else if (verified === 'success') {
        setAuthNotice('Email đã được xác nhận. Bạn có thể đăng nhập ngay.');
        window.history.replaceState({}, '', '/account');
      } else if (verified) {
        setErrorMsg('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.');
        window.history.replaceState({}, '', '/account');
      }
    });
  }, []);

  // Profile Edit States
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync edit fields when user logs in
  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      setEditUsername(user.username);
      setEditAvatar(user.avatar || '');
    });
    if (!accessToken) return;

    let active = true;
    Promise.all([
      axios.get(`${API_URL}/user/favorites`),
      axios.get(`${API_URL}/user/history`),
      axios.get(`${API_URL}/user/watchlist`),
      axios.get(`${API_URL}/user/viewing-insights`),
    ]).then(([favsRes, historyRes, watchlistRes, insightsRes]) => {
      if (!active) return;
      setFavorites(favsRes.data);
      setWatchHistory(historyRes.data);
      setWatchlist(watchlistRes.data);
      setViewingInsights(insightsRes.data);
    }).catch((error) => {
      console.warn('Không tải được favorites/history/watchlist.', error);
    });

    return () => { active = false; };
  }, [user, accessToken, selectedProfileId, setFavorites, setWatchHistory, setWatchlist]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setAuthNotice('');

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg('Vui lòng hoàn tất xác minh Cloudflare trước khi tiếp tục.');
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const normalizedEmail = normalizeEmail(email);
      const payload = isLogin
        ? { email: normalizedEmail, password, turnstileToken }
        : { email: normalizedEmail, username: username.trim(), password, turnstileToken };
      const res = await axios.post(endpoint, payload);
      if (res.data.requiresVerification) {
        setIsLogin(true);
        setPassword('');
        setAuthNotice(res.data.message || 'Hãy kiểm tra email để xác nhận tài khoản.');
        return;
      }
      setSession(res.data.user, res.data.accessToken);
      const profilesResponse = await axios.get('/user/profiles').catch(() => null);
      if (profilesResponse) setProfiles(profilesResponse.data);
      showToast(isLogin ? 'Đăng nhập thành công!' : 'Đăng ký tài khoản thành công!', 'success');
      router.replace('/');
    } catch (error) {
      if (!isLogin && requestCode(error) === 'ACCOUNT_EXISTS') {
        setIsLogin(true);
        setPassword('');
        setAuthNotice('Tài khoản đã tồn tại. Hãy đăng nhập bằng email và mật khẩu của bạn.');
        return;
      }
      setErrorMsg(requestMessage(error, 'Có lỗi xảy ra, vui lòng thử lại.'));
    } finally {
      setTurnstileToken('');
      setTurnstileKey((value) => value + 1);
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    if (submittingRef.current) return;
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg('Vui lòng hoàn tất xác minh Cloudflare trước khi đăng nhập.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setAuthNotice('');

    try {
      const response = await axios.post('/auth/google', { credential, turnstileToken });
      setSession(response.data.user, response.data.accessToken);
      const profilesResponse = await axios.get('/user/profiles').catch(() => null);
      if (profilesResponse) setProfiles(profilesResponse.data);
      showToast('Đăng nhập Google thành công!', 'success');
      router.replace('/');
    } catch (error) {
      setErrorMsg(requestMessage(error, 'Không thể đăng nhập bằng Google. Vui lòng thử lại.'));
    } finally {
      setTurnstileToken('');
      setTurnstileKey((value) => value + 1);
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleFacebookAccessToken = async (facebookAccessToken: string) => {
    if (submittingRef.current) return;
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg('Vui lòng hoàn tất xác minh Cloudflare trước khi đăng nhập.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setAuthNotice('');
    try {
      const response = await axios.post('/auth/facebook', { accessToken: facebookAccessToken, turnstileToken });
      setSession(response.data.user, response.data.accessToken);
      const profilesResponse = await axios.get('/user/profiles').catch(() => null);
      if (profilesResponse) setProfiles(profilesResponse.data);
      showToast('Đăng nhập Facebook thành công!', 'success');
      router.replace('/');
    } catch (error) {
      setErrorMsg(requestMessage(error, 'Không thể đăng nhập bằng Facebook. Vui lòng thử lại.'));
    } finally {
      setTurnstileToken('');
      setTurnstileKey((value) => value + 1);
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setAuthNotice('');

    if (recoveryMode === 'forgot' && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg('Vui lòng hoàn tất xác minh Cloudflare trước khi gửi yêu cầu.');
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      if (recoveryMode === 'reset') {
        await axios.post('/auth/reset-password', { token: resetToken, newPassword });
        setRecoveryMode('none');
        setResetToken('');
        setNewPassword('');
        window.history.replaceState({}, '', '/account');
        setAuthNotice('Đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.');
      } else {
        const response = await axios.post('/auth/forgot-password', { email: normalizeEmail(email), turnstileToken });
        setAuthNotice(response.data.message || 'Nếu email tồn tại, hướng dẫn khôi phục đã được gửi.');
      }
    } catch (error) {
      setErrorMsg(requestMessage(error, 'Không thể xử lý yêu cầu. Vui lòng thử lại.'));
    } finally {
      if (recoveryMode === 'forgot') {
        setTurnstileToken('');
        setTurnstileKey((value) => value + 1);
      }
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Ảnh đại diện không được vượt quá 2MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(`${API_URL}/user/profile/avatar-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setEditAvatar(res.data.avatar);
      setUser(res.data.user);
      setSuccessMsg('Tải lên ảnh đại diện thành công!');
    } catch (error) {
      setErrorMsg(requestMessage(error, 'Lỗi tải ảnh đại diện lên.'));
    } finally {
      setIsUploading(false);
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
    } catch (error) {
      setErrorMsg(requestMessage(error, 'Không thể cập nhật hồ sơ. Vui lòng thử lại.'));
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

  const handleBulkHistoryDelete = async (clearAll = false) => {
    if (!clearAll && !selectedHistory.size) return;
    if (!window.confirm(clearAll ? 'Xóa toàn bộ lịch sử xem?' : `Xóa ${selectedHistory.size} mục đã chọn?`)) return;
    try {
      await axios.post(`${API_URL}/user/history/bulk-delete`, { all: clearAll, ids: [...selectedHistory] }, { headers: { Authorization: `Bearer ${accessToken}` } });
      setWatchHistory(clearAll ? [] : watchHistory.filter((item) => !selectedHistory.has(item.id)));
      setSelectedHistory(new Set());
      showToast('Đã cập nhật lịch sử xem.', 'success');
    } catch (error) { showToast(requestMessage(error, 'Không thể xóa lịch sử xem.'), 'error'); }
  };

  const filteredHistory = watchHistory.filter((item) => {
    const percent = Math.min(100, Math.floor((item.watchedTime / (item.duration || 1)) * 100));
    const matchesSearch = item.movie.title.toLocaleLowerCase('vi').includes(historySearch.trim().toLocaleLowerCase('vi'));
    return matchesSearch && (historyFilter === 'all' || (historyFilter === 'completed' ? percent >= 90 : percent < 90));
  });

  if (!hasHydrated || !authReady) {
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
              {recoveryMode === 'forgot' ? 'Quên Mật Khẩu' : recoveryMode === 'reset' ? 'Đặt Lại Mật Khẩu' : isLogin ? 'Đăng Nhập CINE3D' : 'Đăng Ký Tài Khoản'}
            </h2>
            <p className="text-xs text-slate-500">Trải nghiệm rạp chiếu phim 3D không gian ảo.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-950/45 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">
              {errorMsg}
            </div>
          )}
          {authNotice && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-xs leading-relaxed text-emerald-300">
              {authNotice}
            </div>
          )}

          {recoveryMode === 'none' && (
            <>
              <GoogleSignInButton onCredential={handleGoogleCredential} />
              <FacebookSignInButton onAccessToken={handleFacebookAccessToken} />
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                <span className="h-px flex-1 bg-white/10" />
                Hoặc dùng email
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          {recoveryMode !== 'none' ? (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              {recoveryMode === 'forgot' ? (
                <div className="relative">
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="hvinh.job"
                    className={`w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 text-sm text-white outline-none focus:border-red-500 ${email.includes('@') ? 'pr-4' : 'pr-28'}`}
                  />
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  {!email.includes('@') && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">@gmail.com</span>}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-red-500"
                  />
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              )}
              {recoveryMode === 'forgot' && <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />}
              <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-gradient-to-r from-red-600 to-purple-600 py-3.5 text-sm font-black text-white disabled:opacity-60">
                {isSubmitting ? 'Đang xử lý...' : recoveryMode === 'forgot' ? 'Gửi email khôi phục' : 'Lưu mật khẩu mới'}
              </button>
              <button type="button" onClick={() => { setRecoveryMode('none'); setErrorMsg(''); setAuthNotice(''); setTurnstileToken(''); setTurnstileKey((value) => value + 1); }} className="w-full text-xs text-slate-400 transition hover:text-white">
                Quay lại đăng nhập
              </button>
            </form>
          ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hvinh.job"
                className={`w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 text-xs text-white outline-none focus:border-red-500 md:text-sm ${email.includes('@') ? 'pr-4' : 'pr-28'}`}
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              {!email.includes('@') && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 md:text-sm">@gmail.com</span>}
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl pl-10 pr-4 py-3 text-xs md:text-sm outline-none text-white"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            </div>

            <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60 text-white text-xs md:text-sm font-black py-3.5 rounded-xl transition-all shadow-lg active:scale-98"
            >
              {isSubmitting ? 'Đang xử lý...' : isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
            </button>
          </form>
          )}

          {recoveryMode === 'none' && <div className="space-y-3 text-center pt-2">
            {isLogin && (
              <button type="button" onClick={() => { setRecoveryMode('forgot'); setErrorMsg(''); setAuthNotice(''); setTurnstileToken(''); setTurnstileKey((value) => value + 1); }} className="block w-full text-xs text-slate-500 transition hover:text-yellow-400">
                Quên mật khẩu?
              </button>
            )}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg('');
                setTurnstileToken('');
                setTurnstileKey((value) => value + 1);
              }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>}

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
            <Image
              src={user.avatar || 'https://cine3d.id.vn/avatars/1.jpg'}
              alt={user.username}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div className="text-left space-y-1">
            <h2 className="text-xl font-black text-white">{user.username}</h2>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-red-600/20 text-red-500 font-black px-2 py-0.5 rounded border border-red-500/20 uppercase">
                {user.role}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{user.email}</span>
              {user.isVip && (
                <span className="inline-flex items-center rounded border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-400">
                  <Crown className="mr-1 h-3 w-3" /> VIP
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/vip" className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-black transition hover:bg-amber-300">
            <Crown className="h-4 w-4" /> {user.isVip ? 'Quản lý VIP' : 'Nâng cấp VIP'}
          </Link>
          <button
            onClick={logout}
            className="flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border border-white/10 hover:border-red-500/30 bg-slate-900/60 hover:bg-red-600 hover:text-white transition-all text-slate-300 text-xs font-bold active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng Xuất</span>
          </button>
        </div>
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
            onClick={() => setActiveTab('experience')}
            className={`pb-3 flex items-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'experience' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Trung Tâm Trải Nghiệm</span>
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

          <button onClick={() => setActiveTab('insights')} className={`flex items-center space-x-1.5 border-b-2 pb-3 transition-colors ${activeTab === 'insights' ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}><Trophy className="h-4 w-4" /><span>Thành Tích</span></button>

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
          {activeTab === 'experience' && <ExperienceCenter />}

          {activeTab === 'insights' && (
            <section className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[Clock3, 'Giờ đã xem', viewingInsights?.totalHours || 0, 'text-cyan-400'], [Play, 'Phim đã bắt đầu', viewingInsights?.moviesStarted || 0, 'text-purple-400'], [Check, 'Đã hoàn thành', viewingInsights?.completedMovies || 0, 'text-emerald-400'], [Flame, 'Chuỗi ngày', viewingInsights?.streakDays || 0, 'text-orange-400']].map(([Icon, label, value, color]) => { const StatIcon = Icon as typeof Clock3; return <div key={String(label)} className="rounded-2xl border border-white/5 bg-slate-950/60 p-5"><StatIcon className={`h-5 w-5 ${color}`} /><p className="mt-3 text-2xl font-black">{String(value)}</p><p className="mt-1 text-[10px] font-bold uppercase text-slate-500">{String(label)}</p></div>; })}</div>
              <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]"><div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5"><h3 className="text-sm font-black">Thể loại yêu thích</h3><div className="mt-4 space-y-3">{(viewingInsights?.favoriteGenres || []).map((genre, index) => <div key={genre.name}><div className="flex justify-between text-xs"><span>{genre.name}</span><span className="text-slate-500">{genre.count} phim</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-purple-500" style={{ width: `${Math.max(12, 100 - index * 18)}%` }} /></div></div>)}{!viewingInsights?.favoriteGenres.length && <p className="py-8 text-center text-xs text-slate-600">Xem thêm phim để có thống kê thể loại.</p>}</div></div><div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5"><h3 className="flex items-center gap-2 text-sm font-black"><Trophy className="h-4 w-4 text-amber-400" /> Huy hiệu</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{(viewingInsights?.badges || []).map((badge) => <div key={badge.id} className={`rounded-xl border p-3 ${badge.unlocked ? 'border-amber-400/20 bg-amber-400/5' : 'border-white/5 bg-black/20 opacity-45'}`}><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-full ${badge.unlocked ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-600'}`}><Trophy className="h-4 w-4" /></span><div><p className="text-xs font-black">{badge.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{badge.description}</p></div></div></div>)}</div></div></div>
            </section>
          )}

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
                  {user?.isVip ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Đường dẫn ảnh đại diện (URL):</span>
                        <input
                          type="text"
                          value={editAvatar}
                          onChange={(e) => setEditAvatar(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-xs md:text-sm text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Hoặc tải ảnh lên từ thiết bị:</span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-slate-900 border border-dashed border-white/20 hover:border-amber-400/50 text-slate-300 hover:text-amber-400 text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          {isUploading ? (
                            <span className="animate-pulse">Đang tải lên...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>Chọn ảnh từ thiết bị</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-4 py-3 rounded-xl flex items-start space-x-2 leading-relaxed">
                      <Crown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>Nâng cấp tài khoản lên <strong>VIP</strong> để tải ảnh đại diện từ thiết bị hoặc sử dụng URL tùy thích.</span>
                    </div>
                  )}
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
                      <Image src={avatarUrl} alt="Avatar gợi ý" fill sizes="80px" className="object-cover" />
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
                  <Link href={`/movies/${movie.slug}`} className="absolute inset-0 z-0">
                    <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover" />
                  </Link>
                  
                  {/* Remove favorite button */}
                  <button
                    onClick={() => handleRemoveFavorite(movie.id)}
                    className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                    title="Xóa yêu thích"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-xs font-bold text-white mb-2 line-clamp-2 text-left">{movie.title}</span>
                    <Link
                      href={`/movies/${movie.slug}`}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-full text-center text-xs flex items-center justify-center active:scale-95 pointer-events-auto"
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
                  <Link href={`/movies/${movie.slug}`} className="absolute inset-0 z-0">
                    <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover" />
                  </Link>
                  
                  {/* Remove watchlist button */}
                  <button
                    onClick={() => handleRemoveWatchlist(movie.id)}
                    className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                    title="Xóa khỏi danh sách xem sau"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-xs font-bold text-white mb-2 line-clamp-2 text-left">{movie.title}</span>
                    <Link
                      href={`/movies/${movie.slug}`}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-full text-center text-xs flex items-center justify-center active:scale-95 pointer-events-auto"
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
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2"><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Tìm trong lịch sử..." className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs outline-none focus:border-purple-400" /><select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs outline-none"><option value="all">Tất cả</option><option value="watching">Đang xem</option><option value="completed">Đã hoàn thành</option></select>{selectedHistory.size > 0 && <button type="button" onClick={() => void handleBulkHistoryDelete()} className="rounded-xl bg-red-500/15 px-3 py-2.5 text-xs font-bold text-red-400">Xóa {selectedHistory.size} mục</button>}{watchHistory.length > 0 && <button type="button" onClick={() => void handleBulkHistoryDelete(true)} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-slate-400 hover:text-red-400">Xóa tất cả</button>}</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredHistory.map((item) => {
                const percent = Math.min(100, Math.floor((item.watchedTime / (item.duration || 1)) * 100));
                return (
                  <div
                    key={item.id}
                    className={`glass-panel group relative flex items-center gap-4 rounded-2xl p-4 text-left shadow-md transition-all hover:border-purple-500/20 ${selectedHistory.has(item.id) ? 'border-purple-400/40 bg-purple-400/5' : ''}`}
                  >
                    <input type="checkbox" checked={selectedHistory.has(item.id)} onChange={(event) => setSelectedHistory((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} aria-label={`Chọn ${item.movie.title}`} className="absolute bottom-3 left-3 z-20 accent-purple-500" />
                    {/* Hover remove history button */}
                    <button
                      onClick={() => handleRemoveHistory(item.id)}
                      className="absolute top-3 right-3 z-30 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                      title="Xóa lịch sử xem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="relative h-[84px] w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      <Image src={item.movie.posterUrl} alt={item.movie.title} fill sizes="56px" className="object-cover" />
                    </span>

                    <div className="flex-grow space-y-1.5 w-full min-w-0 pr-8">
                      <h4 className="text-sm font-bold text-white leading-tight truncate">{item.movie?.title}</h4>
                      <p className="text-[10px] text-slate-400">
                        {(() => {
                          const matchedEp = item.movie?.episodes?.find((episode) => episode.id === item.episodeId);
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
                        const matchedEp = item.movie?.episodes?.find((episode) => episode.id === item.episodeId);
                        return matchedEp?.episodeOrder || 1;
                      })()}`}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full text-xs flex items-center justify-center shrink-0 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </Link>
                  </div>
                );
              })}
              {filteredHistory.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 text-xs font-semibold">
                  {watchHistory.length ? 'Không tìm thấy mục lịch sử phù hợp.' : 'Chưa có lịch sử phát phim.'}
                </div>
              )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
