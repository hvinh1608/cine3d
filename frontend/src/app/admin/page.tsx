'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Film, ListVideo, AlertTriangle, Users, BarChart3, Plus, Trash2, Edit, X, Lock, Unlock, RefreshCw, Tv, Subtitles, Star, ReceiptText, CheckCircle2 } from 'lucide-react';
import type { AxiosError } from 'axios';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const formatVnd = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
type AdminVideoSource = { id?: string; server: string; quality: string; url: string; type: string; isPremium: boolean };
type AdminSubtitle = { id?: string; language: string; url: string };
type AdminEpisode = { id: string; title: string; episodeOrder: number; videoSources: AdminVideoSource[]; subtitles: AdminSubtitle[] };
type AdminMovie = {
  id: string; title: string; englishTitle?: string | null; slug: string; description: string; posterUrl: string; backdropUrl: string;
  trailerUrl?: string | null; releaseYear: number; duration: number; countryId: string; quality: string; isSeries: boolean; status: string;
  isFeatured: boolean; isTrending: boolean; isProposed: boolean; isVip: boolean; vipEarlyAccessUntil?: string | null; episodeCount: number;
  episodes: AdminEpisode[]; movieGenres: { genreId: string }[];
};
type AdminUser = { id: string; email: string; username: string; isLocked: boolean; isVip: boolean; vipExpiresAt?: string | null; role?: { name: string } };
type AdminReport = { id: string; type: string; content: string; status: string; createdAt: string; user?: { username: string }; movie?: { title: string } | null };
type AdminVipOrder = { id: string; orderCode: string; status: string; amount: number; durationDays: number; createdAt: string; paidAt?: string | null; user?: { username: string; email: string }; plan?: { name: string } };
type MetaEntity = { id: string; name: string; slug: string };
type AdminStats = { totalUsers: number; totalMovies: number; totalEpisodes: number; totalViews: number; pendingReports: number; topMovies: { id: string; title: string; views: number; ratingAvg: number }[]; recentReports: AdminReport[] };

const isUserVipActive = (user: AdminUser) => Boolean(user.isVip || (user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now()));
const requestMessage = (error: unknown, fallback: string) => (error as AxiosError<{ message?: string }>).response?.data?.message || fallback;

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken, showToast } = useStore();

  // Route security
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, router]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'stats' | 'movies' | 'episodes' | 'users' | 'vip' | 'reports'>('stats');

  // Stats States
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalMovies: 0,
    totalEpisodes: 0,
    totalViews: 0,
    pendingReports: 0,
    topMovies: [],
    recentReports: [],
  });

  // Entities List States
  const [movies, setMovies] = useState<AdminMovie[]>([]);
  const [movieSearch, setMovieSearch] = useState('');
  const [moviePage, setMoviePage] = useState(1);
  const [movieTotal, setMovieTotal] = useState(0);
  const [movieTotalPages, setMovieTotalPages] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [vipOrders, setVipOrders] = useState<AdminVipOrder[]>([]);
  const [countries, setCountries] = useState<MetaEntity[]>([]);
  const [genres, setGenres] = useState<MetaEntity[]>([]);
  
  // Movie Form States (Create & Edit)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [movieTitle, setMovieTitle] = useState('');
  const [movieEnglishTitle, setMovieEnglishTitle] = useState('');
  const [movieSlug, setMovieSlug] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [moviePoster, setMoviePoster] = useState('');
  const [movieBackdrop, setMovieBackdrop] = useState('');
  const [movieTrailerUrl, setMovieTrailerUrl] = useState('');
  const [movieYear, setMovieYear] = useState('2026');
  const [movieDuration, setMovieDuration] = useState('120');
  const [movieCountry, setMovieCountry] = useState('');
  const [movieQuality, setMovieQuality] = useState('FHD');
  const [movieIsSeries, setMovieIsSeries] = useState(false);
  const [movieStatus, setMovieStatus] = useState('Completed');
  const [movieIsFeatured, setMovieIsFeatured] = useState(false);
  const [movieIsTrending, setMovieIsTrending] = useState(false);
  const [movieIsProposed, setMovieIsProposed] = useState(false);
  const [movieIsVip, setMovieIsVip] = useState(false);
  const [movieVipEarlyAccessUntil, setMovieVipEarlyAccessUntil] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Episode Add Form States
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [epTitle, setEpTitle] = useState('');
  const [epOrder, setEpOrder] = useState('1');
  const [videoSources, setVideoSources] = useState<AdminVideoSource[]>([{ server: 'Main Server', quality: '1080p', url: '', type: 'hls', isPremium: false }]);
  const [subtitles, setSubtitles] = useState<AdminSubtitle[]>([{ language: 'Vietnamese', url: '' }]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const movieSearchReadyRef = useRef(false);

  // Fetch Dashboard data
  const loadAdminData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [statsRes, moviesRes, usersRes, reportsRes, countriesRes, genresRes, vipOrdersRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/movies`, { params: { page: 1, limit: 20 }, headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/reports`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/countries`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/genres`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/vip-orders`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      setStats(statsRes.data);
      setMovies(moviesRes.data?.movies || []);
      setMovieTotal(moviesRes.data?.total || 0);
      setMoviePage(moviesRes.data?.page || 1);
      setMovieTotalPages(moviesRes.data?.totalPages || 1);
      setUsers(usersRes.data || []);
      setReports(reportsRes.data || []);
      setCountries(countriesRes.data || []);
      setGenres(genresRes.data || []);
      setVipOrders(vipOrdersRes.data || []);

      if (!movieCountry && countriesRes.data?.[0]?.id) {
        setMovieCountry(countriesRes.data[0].id);
      }
    } catch (e) {
      console.warn('Failed to fetch admin data.', e);
      setStats({
        totalUsers: 0,
        totalMovies: 0,
        totalEpisodes: 0,
        totalViews: 0,
        pendingReports: 0,
        topMovies: [],
        recentReports: [],
      });
      setMovies([]);
      setUsers([]);
      setReports([]);
      setVipOrders([]);
      showToast('Không tải được dữ liệu quản trị.', 'error');
    } finally {
      setLoading(false);
    }
  }, [accessToken, movieCountry, showToast]);

  useEffect(() => {
    queueMicrotask(() => void loadAdminData());
  }, [loadAdminData]);

  const loadMoviesPage = useCallback(async (page: number, search = movieSearch) => {
    if (!accessToken) return;
    try {
      const response = await axios.get(`${API_URL}/admin/movies`, {
        params: { page, limit: 20, search: search.trim() || undefined },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setMovies(response.data?.movies || []);
      setMovieTotal(response.data?.total || 0);
      setMoviePage(response.data?.page || page);
      setMovieTotalPages(response.data?.totalPages || 1);
      setSelectedMovieId((current) => response.data?.movies?.some((movie: AdminMovie) => movie.id === current) ? current : '');
    } catch {
      showToast('Không tải được danh sách phim.', 'error');
    }
  }, [accessToken, movieSearch, showToast]);

  useEffect(() => {
    if (!movieSearchReadyRef.current) {
      movieSearchReadyRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => void loadMoviesPage(1, movieSearch), 350);
    return () => window.clearTimeout(timer);
  }, [loadMoviesPage, movieSearch]);

  // Handle auto-calculating episode order and title
  useEffect(() => {
    if (selectedMovieId) {
      const movie = movies.find(m => m.id === selectedMovieId);
      const eps = movie?.episodes || [];
      const nextOrder = eps.length > 0 ? Math.max(...eps.map((episode) => episode.episodeOrder || 0)) + 1 : 1;
      queueMicrotask(() => {
        setEpOrder(String(nextOrder));
        setEpTitle(movie?.isSeries ? `Tập ${nextOrder}` : 'Full Movie');
      });
    } else {
      queueMicrotask(() => {
        setEpOrder('1');
        setEpTitle('');
      });
    }
  }, [selectedMovieId, movies]);

  // Auth Guard check
  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  // Movie CRUD Form Handling
  const handleStartEditMovie = (movie: AdminMovie) => {
    setEditingMovieId(movie.id);
    setMovieTitle(movie.title);
    setMovieEnglishTitle(movie.englishTitle || '');
    setMovieSlug(movie.slug);
    setMovieDesc(movie.description || '');
    setMoviePoster(movie.posterUrl || '');
    setMovieBackdrop(movie.backdropUrl || '');
    setMovieTrailerUrl(movie.trailerUrl || '');
    setMovieYear(String(movie.releaseYear || 2026));
    setMovieDuration(String(movie.duration || 120));
    setMovieCountry(movie.countryId);
    setMovieQuality(movie.quality || 'FHD');
    setMovieIsSeries(movie.isSeries || false);
    setMovieStatus(movie.status || 'Completed');
    setMovieIsFeatured(movie.isFeatured || false);
    setMovieIsTrending(movie.isTrending || false);
    setMovieIsProposed(movie.isProposed || false);
    setMovieIsVip(movie.isVip || false);
    setMovieVipEarlyAccessUntil(movie.vipEarlyAccessUntil ? new Date(movie.vipEarlyAccessUntil).toISOString().slice(0, 16) : '');
    
    // Set checked genres
    const gIds = movie.movieGenres?.map((movieGenre) => movieGenre.genreId) || [];
    setSelectedGenres(gIds);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditMovie = () => {
    setEditingMovieId(null);
    setMovieTitle('');
    setMovieEnglishTitle('');
    setMovieSlug('');
    setMovieDesc('');
    setMoviePoster('');
    setMovieBackdrop('');
    setMovieTrailerUrl('');
    setMovieYear('2026');
    setMovieDuration('120');
    setMovieCountry(countries[0]?.id || '');
    setMovieQuality('FHD');
    setMovieIsSeries(false);
    setMovieStatus('Completed');
    setMovieIsFeatured(false);
    setMovieIsTrending(false);
    setMovieIsProposed(false);
    setMovieIsVip(false);
    setMovieVipEarlyAccessUntil('');
    setSelectedGenres([]);
  };

  const handleCreateOrUpdateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieCountry) {
      showToast('Vui lòng chọn quốc gia.', 'info');
      return;
    }
    setActionLoading(true);

    const payload = {
      title: movieTitle,
      englishTitle: movieEnglishTitle,
      slug: movieSlug,
      description: movieDesc,
      posterUrl: moviePoster,
      backdropUrl: movieBackdrop,
      trailerUrl: movieTrailerUrl,
      releaseYear: parseInt(movieYear, 10),
      duration: parseInt(movieDuration, 10),
      quality: movieQuality,
      isSeries: movieIsSeries,
      status: movieStatus,
      countryId: movieCountry,
      isFeatured: movieIsFeatured,
      isTrending: movieIsTrending,
      isProposed: movieIsProposed,
      isVip: movieIsVip,
      vipEarlyAccessUntil: movieVipEarlyAccessUntil || null,
      genreIds: selectedGenres,
    };

    try {
      if (editingMovieId) {
        await axios.put(`${API_URL}/admin/movies/${editingMovieId}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        showToast('Cập nhật phim thành công!', 'success');
      } else {
        await axios.post(`${API_URL}/admin/movies`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        showToast('Tạo phim mới thành công!', 'success');
      }
      
      handleCancelEditMovie();
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Thao tác phim thất bại.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMovieDelete = async (movieId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phim này?')) return;
    try {
      await axios.delete(`${API_URL}/admin/movies/${movieId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast('Xóa phim thành công!', 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Xóa phim thất bại.'), 'error');
    }
  };

  // Video Sources Array actions
  const handleAddSource = () => {
    setVideoSources([...videoSources, { server: `Backup Server ${videoSources.length + 1}`, quality: '1080p', url: '', type: 'hls', isPremium: false }]);
  };

  const handleRemoveSource = (index: number) => {
    setVideoSources(videoSources.filter((_, i) => i !== index));
  };

  const handleSourceChange = (index: number, field: keyof AdminVideoSource, value: string | boolean) => {
    setVideoSources((current) => current.map((source, sourceIndex) => sourceIndex === index ? { ...source, [field]: value } : source));
  };

  // Subtitles Array actions
  const handleAddSubtitle = () => {
    setSubtitles([...subtitles, { language: 'English', url: '' }]);
  };

  const handleRemoveSubtitle = (index: number) => {
    setSubtitles(subtitles.filter((_, i) => i !== index));
  };

  const handleSubtitleChange = (index: number, field: keyof AdminSubtitle, value: string) => {
    setSubtitles((current) => current.map((subtitle, subtitleIndex) => subtitleIndex === index ? { ...subtitle, [field]: value } : subtitle));
  };

  // Episode creation and deletion
  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovieId) {
      showToast('Vui lòng chọn phim liên kết.', 'info');
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/admin/episodes`, {
        movieId: selectedMovieId,
        title: epTitle,
        episodeOrder: epOrder,
        videoSources,
        subtitles: subtitles.filter(sub => sub.url.trim() !== ''),
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      showToast('Thêm tập phim thành công!', 'success');
      loadAdminData();
      
      // Reset forms
      setEpTitle('');
      setVideoSources([{ server: 'Main Server', quality: '1080p', url: '', type: 'hls', isPremium: false }]);
      setSubtitles([{ language: 'Vietnamese', url: '' }]);
    } catch (error) {
      showToast(requestMessage(error, 'Lỗi thêm tập.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEpisodeDelete = async (episodeId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tập phim này?')) return;
    try {
      await axios.delete(`${API_URL}/admin/episodes/${episodeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast('Xóa tập phim thành công!', 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Lỗi xóa tập.'), 'error');
    }
  };

  // User Actions
  const handleToggleLock = async (userId: string) => {
    try {
      const res = await axios.put(`${API_URL}/admin/users/${userId}/lock`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast(res.data.message, 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Không thể thay đổi trạng thái tài khoản.'), 'error');
    }
  };

  const handleToggleVip = async (userId: string) => {
    try {
      const res = await axios.put(`${API_URL}/admin/users/${userId}/vip`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast(res.data.message, 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Không thể thay đổi trạng thái VIP.'), 'error');
    }
  };

  const handleConfirmVipOrder = async (orderId: string) => {
    try {
      const res = await axios.post(`${API_URL}/admin/vip-orders/${orderId}/confirm`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast(res.data.message, 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Không thể xác nhận đơn VIP.'), 'error');
    }
  };

  const handleCancelVipOrder = async (orderId: string) => {
    try {
      const res = await axios.post(`${API_URL}/admin/vip-orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast(res.data.message, 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Không thể hủy đơn VIP.'), 'error');
    }
  };

  // Report Actions
  const handleResolveReport = async (reportId: string) => {
    try {
      await axios.put(`${API_URL}/admin/reports/${reportId}/resolve`, { status: 'Resolved' }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast('Báo cáo đã được xử lý!', 'success');
      loadAdminData();
    } catch (error) {
      showToast(requestMessage(error, 'Không thể cập nhật báo cáo.'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center h-[70vh]">
        <div className="w-10 h-10 border-4 border-t-purple-600 border-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row gap-8 text-slate-100 select-none text-left">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 flex flex-col space-y-2">
        <div className="flex items-center space-x-2 px-3 py-4 border-b border-white/5">
          <Shield className="w-6 h-6 text-purple-400" />
          <span className="font-black text-sm uppercase tracking-wider text-purple-400">Admin Dashboard</span>
        </div>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Thống Kê Tổng Quan</span>
        </button>

        <button
          onClick={() => setActiveTab('movies')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'movies' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Quản Lý Phim</span>
        </button>

        <button
          onClick={() => setActiveTab('episodes')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'episodes' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <ListVideo className="w-4 h-4" />
          <span>Quản Lý Tập Phim</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'users' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản Lý Thành Viên</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'reports' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Báo Cáo Lỗi</span>
          {stats.pendingReports > 0 && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
              {stats.pendingReports}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('vip')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'vip' ? 'bg-amber-500 text-black' : 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>Đơn thanh toán VIP</span>
          {vipOrders.filter((order) => order.status === 'PENDING').length > 0 && (
            <span className="absolute right-4 top-1/2 flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white">
              {vipOrders.filter((order) => order.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={loadAdminData}
          className="flex items-center space-x-2.5 px-4 py-3 text-xs md:text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors mt-4 text-left cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tải Lại Dữ Liệu</span>
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-grow glass-panel p-5 md:p-8 rounded-3xl shadow-2xl overflow-hidden min-w-0">
        
        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide flex items-center text-purple-400">
              <BarChart3 className="w-5 h-5 mr-2" /> Thống kê hệ thống
            </h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl relative group overflow-hidden shadow-lg hover:border-purple-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Thành viên</span>
                <span className="text-2xl font-black text-white flex items-baseline">
                  {stats.totalUsers} <span className="text-[10px] text-slate-500 font-bold ml-1">user</span>
                </span>
              </div>

              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl relative group overflow-hidden shadow-lg hover:border-cyan-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-600/5 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Số lượng phim</span>
                <span className="text-2xl font-black text-white flex items-baseline">
                  {stats.totalMovies} <span className="text-[10px] text-slate-500 font-bold ml-1">phim</span>
                </span>
              </div>

              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl relative group overflow-hidden shadow-lg hover:border-amber-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Tổng lượt xem</span>
                <span className="text-2xl font-black text-cyan-400">{stats.totalViews.toLocaleString()}</span>
              </div>

              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl relative group overflow-hidden shadow-lg hover:border-red-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Báo cáo chưa xử lý</span>
                <span className={`text-2xl font-black ${stats.pendingReports > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                  {stats.pendingReports}
                </span>
              </div>
            </div>

            {/* List of top movies with progress bars */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold uppercase text-slate-300 tracking-wider flex items-center">
                <Film className="w-4 h-4 text-cyan-400 mr-2" /> Top 5 Phim Có Lượt Xem Cao Nhất
              </h3>
              <div className="space-y-4 text-xs md:text-sm">
                {stats.topMovies.map((movie, idx) => {
                  const maxViews = stats.topMovies[0]?.views || 1;
                  const pct = Math.min(100, Math.floor((movie.views / maxViews) * 100));
                  return (
                    <div key={movie.id} className="space-y-1.5 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{idx + 1}. {movie.title}</span>
                        <span className="text-slate-400 font-semibold">{movie.views.toLocaleString()} lượt xem</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MOVIES TAB */}
        {activeTab === 'movies' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide flex items-center text-purple-400">
              <Film className="w-5 h-5 mr-2" /> {editingMovieId ? 'Chỉnh sửa phim' : 'Thêm phim mới'}
            </h2>

            {/* Create & Edit Movie Form */}
            <form onSubmit={handleCreateOrUpdateMovie} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center">
                  <Plus className="w-4 h-4 mr-1" /> {editingMovieId ? `Đang sửa: ${movieTitle}` : 'Nhập thông tin phim'}
                </span>
                {editingMovieId && (
                  <button
                    type="button"
                    onClick={handleCancelEditMovie}
                    className="text-[10px] font-black bg-red-600/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                  >
                    Hủy sửa
                  </button>
                )}
              </h3>

              <input
                type="text"
                required
                value={movieTitle}
                onChange={(e) => setMovieTitle(e.target.value)}
                placeholder="Tên phim (Tiếng Việt)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                value={movieEnglishTitle}
                onChange={(e) => setMovieEnglishTitle(e.target.value)}
                placeholder="Tên Tiếng Anh (không bắt buộc)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                required
                value={movieSlug}
                onChange={(e) => setMovieSlug(e.target.value)}
                placeholder="Slug phim (e.g. ma-tran-hoi-sinh)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                required
                value={moviePoster}
                onChange={(e) => setMoviePoster(e.target.value)}
                placeholder="URL hình Poster (Khung tỷ lệ dọc 2:3)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                required
                value={movieBackdrop}
                onChange={(e) => setMovieBackdrop(e.target.value)}
                placeholder="URL hình nền Backdrop (Tỷ lệ ngang 16:9)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                value={movieTrailerUrl}
                onChange={(e) => setMovieTrailerUrl(e.target.value)}
                placeholder="URL Video Trailer (Youtube link)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <textarea
                required
                value={movieDesc}
                onChange={(e) => setMovieDesc(e.target.value)}
                placeholder="Mô tả tóm tắt nội dung phim..."
                className="col-span-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none h-24"
              />

              {/* Country Selection */}
              <div className="flex flex-col space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Quốc gia:</span>
                <select
                  value={movieCountry}
                  onChange={(e) => setMovieCountry(e.target.value)}
                  required
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white"
                >
                  <option value="">-- Chọn quốc gia --</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="flex flex-col space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Trạng thái phát hành:</span>
                <select
                  value={movieStatus}
                  onChange={(e) => setMovieStatus(e.target.value)}
                  required
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white"
                >
                  <option value="Completed">Hoàn thành (Completed)</option>
                  <option value="Ongoing">Đang phát sóng (Ongoing)</option>
                  <option value="Upcoming">Sắp ra mắt (Upcoming)</option>
                </select>
              </div>

              {/* Year, Duration, Quality */}
              <div className="flex flex-col space-y-1 col-span-full">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Năm sản xuất / Thời lượng (phút) / Chất lượng:</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    required
                    value={movieYear}
                    onChange={(e) => setMovieYear(e.target.value)}
                    placeholder="Năm"
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none"
                  />
                  <input
                    type="number"
                    required
                    value={movieDuration}
                    onChange={(e) => setMovieDuration(e.target.value)}
                    placeholder="Phút"
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none"
                  />
                  <select
                    value={movieQuality}
                    onChange={(e) => setMovieQuality(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white"
                  >
                    <option value="HD">HD</option>
                    <option value="FHD">FHD</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </div>

              {/* Genre Checklist (NEW Multi-select Grid) */}
              <div className="flex flex-col space-y-1.5 col-span-full">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Thể loại phim:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-slate-950 p-4 rounded-xl border border-white/5 max-h-36 overflow-y-auto">
                  {genres.map((g) => (
                    <label key={g.id} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGenres([...selectedGenres, g.id]);
                          } else {
                            setSelectedGenres(selectedGenres.filter(id => id !== g.id));
                          }
                        }}
                        className="rounded border-white/10 text-purple-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="truncate">{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Series and Banner Flags */}
              <div className="col-span-full flex flex-wrap gap-x-6 gap-y-2 bg-slate-950/45 p-4 rounded-xl border border-white/5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieIsSeries}
                    onChange={(e) => setMovieIsSeries(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  Đây là phim bộ (Series)
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieIsFeatured}
                    onChange={(e) => setMovieIsFeatured(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  Ghim Trang Chủ (Featured)
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieIsTrending}
                    onChange={(e) => setMovieIsTrending(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  Phim Xu Hướng (Trending)
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieIsProposed}
                    onChange={(e) => setMovieIsProposed(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  Đề xuất cao (Proposed)
                </label>

                <label className="flex items-center gap-2 text-xs text-amber-400 font-extrabold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieIsVip}
                    onChange={(e) => setMovieIsVip(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  Phim VIP (isVip)
                </label>
                <label className="flex min-w-[220px] flex-col gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  VIP xem sớm đến
                  <input
                    type="datetime-local"
                    value={movieVipEarlyAccessUntil}
                    onChange={(e) => setMovieVipEarlyAccessUntil(e.target.value)}
                    className="rounded-lg border border-amber-400/20 bg-slate-950 px-3 py-2 text-xs font-medium normal-case text-white outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="col-span-full bg-purple-600 hover:bg-purple-700 text-white text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg cursor-pointer"
              >
                {actionLoading ? 'Đang lưu dữ liệu...' : editingMovieId ? 'Cập Nhật Thông Tin Phim' : 'Thêm Phim Vào Cơ Sở Dữ Liệu'}
              </button>
            </form>

            {/* Movies List Table */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-bold uppercase text-slate-300 tracking-wider">Phim trong cơ sở dữ liệu ({movieTotal})</h3>
                <div className="relative sm:w-72">
                  <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Tìm tên phim, tên gốc hoặc slug..." className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 pr-9 text-xs text-white outline-none focus:border-purple-500" />
                  {movieSearch && <button type="button" onClick={() => setMovieSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>}
                </div>
              </div>
              <div className="overflow-x-auto text-xs md:text-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-500">
                      <th className="py-2.5">Tên phim</th>
                      <th className="py-2.5">Kiểu</th>
                      <th className="py-2.5">Năm</th>
                      <th className="py-2.5">Chất lượng</th>
                      <th className="py-2.5">Số tập</th>
                      <th className="py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movies.map((m) => (
                      <tr key={m.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 font-bold text-slate-100">
                          {m.title}
                          {m.isVip && (
                            <span className="ml-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                              VIP
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${m.isSeries ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {m.isSeries ? 'Bộ' : 'Lẻ'}
                          </span>
                        </td>
                        <td className="py-3">{m.releaseYear}</td>
                        <td className="py-3">{m.quality}</td>
                        <td className="py-3 font-semibold text-cyan-400">{m.episodes?.length || m.episodeCount || 0} tập</td>
                        <td className="py-3 text-right">
                          <div className="inline-flex space-x-1.5">
                            <button
                              onClick={() => {
                                setSelectedMovieId(m.id);
                                setActiveTab('episodes');
                              }}
                              className="p-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Xem danh sách tập"
                            >
                              <ListVideo className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStartEditMovie(m)}
                              className="p-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Sửa thông tin phim"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMovieDelete(m.id)}
                              className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Xóa phim"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-500">
                <span>Trang {moviePage}/{movieTotalPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={moviePage <= 1} onClick={() => void loadMoviesPage(moviePage - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5">Trang trước</button>
                  <button type="button" disabled={moviePage >= movieTotalPages} onClick={() => void loadMoviesPage(moviePage + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5">Trang sau</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EPISODES TAB */}
        {activeTab === 'episodes' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide flex items-center text-purple-400">
              <ListVideo className="w-5 h-5 mr-2" /> Quản lý tập phim
            </h2>

            {/* Select Movie Selector */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-4">
              <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Tìm phim cần quản lý tập..." className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-purple-500" />
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Chọn phim để quản lý tập:</span>
                <select
                  value={selectedMovieId}
                  onChange={(e) => setSelectedMovieId(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white w-full outline-none focus:border-purple-500"
                >
                  <option value="">-- Click chọn bộ phim --</option>
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.isSeries ? 'Phim bộ' : 'Phim lẻ'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-600">Đang hiển thị {movies.length}/{movieTotal} phim · dùng ô tìm kiếm để mở phim khác.</span>
              </div>

              {/* Render Existing Episodes of Selected Movie */}
              {selectedMovieId && (() => {
                const selectedMovie = movies.find(m => m.id === selectedMovieId);
                const episodes = selectedMovie?.episodes || [];
                return (
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                        Danh sách tập của: <span className="text-cyan-400">{selectedMovie?.title}</span>
                      </h4>
                      <span className="bg-purple-600/10 text-purple-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                        {episodes.length} tập
                      </span>
                    </div>

                    <div className="overflow-x-auto text-xs md:text-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-500">
                            <th className="py-2">Thứ tự</th>
                            <th className="py-2">Tên tập</th>
                            <th className="py-2">Nguồn phát</th>
                            <th className="py-2 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {episodes.map((ep) => (
                            <tr key={ep.id} className="border-b border-white/5 text-slate-300">
                              <td className="py-2.5 font-bold">#{ep.episodeOrder}</td>
                              <td className="py-2.5">{ep.title}</td>
                              <td className="py-2.5 text-[10px] text-slate-400 truncate max-w-[250px]">
                                {ep.videoSources?.map((source) => `${source.server} (${source.quality}${source.isPremium ? ' · Premium' : ''})`).join(', ') || 'HLS URL'}
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  onClick={() => handleEpisodeDelete(ep.id)}
                                  className="p-1 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Xóa tập"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {episodes.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-slate-500 text-xs">
                                Phim này chưa có tập nào trong cơ sở dữ liệu.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Create Episode Form (Only visible when a movie is selected) */}
            {selectedMovieId && (
              <form onSubmit={handleCreateEpisode} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <h3 className="col-span-full text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center">
                  <Plus className="w-4 h-4 mr-1" /> Thêm tập phim mới vào phim đã chọn
                </h3>

                <div className="flex flex-col space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Thứ tự tập (order):</span>
                  <input
                    type="number"
                    required
                    value={epOrder}
                    onChange={(e) => setEpOrder(e.target.value)}
                    placeholder="Số tập (e.g. 1, 2, 3)"
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Tên tập phim:</span>
                  <input
                    type="text"
                    required
                    value={epTitle}
                    onChange={(e) => setEpTitle(e.target.value)}
                    placeholder="Tiêu đề tập (e.g. Tập 1, Tập đặc biệt, Full Movie)"
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
                  />
                </div>

                {/* Multiple Video Sources Sub-form (NEW array editor) */}
                <div className="col-span-full space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
                      <Tv className="w-4 h-4 mr-1.5 text-cyan-400" /> Nguồn Video Phát (Video Sources):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSource}
                      className="flex items-center text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-lg hover:bg-cyan-500 hover:text-white transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-0.5" /> Thêm nguồn phát
                    </button>
                  </div>
                  
                  {videoSources.map((src, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-950 p-4 rounded-xl border border-white/5 relative">
                      <div className="flex flex-col space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Tên Server</span>
                        <input
                          type="text"
                          required
                          value={src.server}
                          onChange={(e) => handleSourceChange(index, 'server', e.target.value)}
                          placeholder="e.g. Server VIP, HLS 1"
                          className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Độ phân giải</span>
                        <input
                          type="text"
                          required
                          value={src.quality}
                          onChange={(e) => handleSourceChange(index, 'quality', e.target.value)}
                          placeholder="e.g. 1080p, 720p"
                          className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col space-y-1 sm:col-span-2 pr-8">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Đường dẫn nguồn phim (.m3u8 hoặc .mp4)</span>
                        <input
                          type="text"
                          required
                          value={src.url}
                          onChange={(e) => handleSourceChange(index, 'url', e.target.value)}
                          placeholder="Link url phát video..."
                          className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none w-full"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-400 sm:col-span-4">
                        <input
                          type="checkbox"
                          checked={!!src.isPremium}
                          onChange={(e) => handleSourceChange(index, 'isPremium', e.target.checked)}
                          className="rounded text-amber-500 focus:ring-0"
                        />
                        Nguồn Premium — chỉ VIP được xem và được ưu tiên phát trước
                      </label>
                      
                      {videoSources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(index)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Xóa nguồn này"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Subtitles dynamic array list (NEW sub-form) */}
                <div className="col-span-full space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
                      <Subtitles className="w-4 h-4 mr-1.5 text-green-400" /> Phụ đề đính kèm (Subtitles - không bắt buộc):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSubtitle}
                      className="flex items-center text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-lg hover:bg-green-500 hover:text-white transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-0.5" /> Thêm phụ đề
                    </button>
                  </div>
                  
                  {subtitles.map((sub, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-4 rounded-xl border border-white/5 relative">
                      <div className="flex flex-col space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Ngôn ngữ</span>
                        <input
                          type="text"
                          value={sub.language}
                          onChange={(e) => handleSubtitleChange(index, 'language', e.target.value)}
                          placeholder="e.g. Vietnamese, English"
                          className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col space-y-1 pr-8">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Đường dẫn tệp phụ đề (.vtt)</span>
                        <input
                          type="text"
                          value={sub.url}
                          onChange={(e) => handleSubtitleChange(index, 'url', e.target.value)}
                          placeholder="Link url phụ đề (.vtt)..."
                          className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none w-full"
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtitle(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 cursor-pointer"
                        title="Xóa phụ đề này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="col-span-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg cursor-pointer"
                >
                  {actionLoading ? 'Đang thêm tập...' : 'Tạo Tập Phim Vào Cơ Sở Dữ Liệu'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide flex items-center text-purple-400">
              <Users className="w-5 h-5 mr-2" /> Quản lý thành viên
            </h2>
            
            <div className="overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="py-2.5">Tên tài khoản</th>
                    <th className="py-2.5">Email</th>
                    <th className="py-2.5">Quyền</th>
                    <th className="py-2.5">Loại tài khoản</th>
                    <th className="py-2.5 text-right">Trạng thái khóa</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-bold text-slate-100">{u.username}</td>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.role?.name === 'ADMIN' ? 'bg-red-600/10 text-red-500 border border-red-500/20' : 'bg-slate-800 text-slate-400'}`}>
                          {u.role?.name}
                        </span>
                      </td>
                      <td className="py-3">
                        {u.role?.name !== 'ADMIN' ? (
                          <>
                            <button
                              onClick={() => handleToggleVip(u.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                                isUserVipActive(u)
                                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white'
                                  : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-amber-500/20 hover:text-amber-400'
                              }`}
                            >
                              <Star className="w-3 h-3 inline mr-1" />
                              {isUserVipActive(u) ? 'VIP' : 'Thường'}
                            </button>
                            {u.vipExpiresAt && <span className="ml-2 text-[9px] text-slate-500">đến {new Date(u.vipExpiresAt).toLocaleDateString('vi-VN')}</span>}
                          </>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-extrabold uppercase flex items-center">
                            <Star className="w-3 h-3 mr-1" /> Premium Admin
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {u.role?.name !== 'ADMIN' ? (
                          <button
                            onClick={() => handleToggleLock(u.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              u.isLocked
                                ? 'bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white'
                                : 'bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white'
                            }`}
                          >
                            {u.isLocked ? (
                              <>
                                <Lock className="w-3.5 h-3.5 inline mr-1" />
                                Đã Khóa
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 inline mr-1" />
                                Hoạt Động
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic font-medium">Bảo vệ hệ thống</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIP PAYMENT ORDERS TAB */}
        {activeTab === 'vip' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="flex items-center text-xl font-black uppercase tracking-wide text-amber-400">
                <ReceiptText className="mr-2 h-5 w-5" /> Đơn thanh toán VIP
              </h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">Kiểm tra thông tin giao dịch trước khi xác nhận. Thời hạn VIP sẽ được cộng tự động và không thể cộng trùng cùng một đơn.</p>
            </div>

            <div className="space-y-3">
              {vipOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 md:flex md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-amber-400">{order.orderCode}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${order.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' : order.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="font-bold text-white">{order.user?.username} <span className="font-normal text-slate-500">· {order.user?.email}</span></p>
                    <p className="text-xs text-slate-400">{order.plan?.name} · {order.durationDays} ngày · <strong className="text-slate-200">{formatVnd(order.amount)}</strong></p>
                    <p className="text-[10px] text-slate-600">Tạo lúc {new Date(order.createdAt).toLocaleString('vi-VN')}{order.paidAt ? ` · xác nhận ${new Date(order.paidAt).toLocaleString('vi-VN')}` : ''}</p>
                  </div>

                  {order.status === 'PENDING' && (
                    <div className="mt-4 flex shrink-0 gap-2 md:ml-4 md:mt-0">
                      <button onClick={() => handleCancelVipOrder(order.id)} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10">
                        Hủy
                      </button>
                      <button onClick={() => handleConfirmVipOrder(order.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black hover:bg-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Xác nhận thanh toán
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {vipOrders.length === 0 && <p className="py-10 text-center text-xs text-slate-500">Chưa có đơn VIP nào.</p>}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide flex items-center text-purple-400">
              <AlertTriangle className="w-5 h-5 mr-2" /> Báo cáo lỗi từ thành viên
            </h2>
            
            <div className="space-y-4">
              {reports.map((r) => (
                <div key={r.id} className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-red-500/10 transition-colors shadow">
                  <div className="space-y-2 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-red-600/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider">
                        {r.type}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">Người gửi: {r.user?.username}</span>
                      {r.movie && (
                        <span className="text-xs text-slate-500 font-bold flex items-center">
                          <Film className="w-3.5 h-3.5 text-cyan-400 mr-1" /> {r.movie.title}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 text-xs md:text-sm">{r.content}</p>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Gửi ngày: {new Date(r.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <button
                    onClick={() => handleResolveReport(r.id)}
                    disabled={r.status === 'Resolved'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ml-4 ${
                      r.status === 'Resolved'
                        ? 'bg-green-600/20 text-green-500 border border-green-500/20 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-slate-200 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {r.status === 'Resolved' ? 'Đã Xử Lý' : 'Giải Quyết'}
                  </button>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-slate-500 text-xs py-8 text-center">Chưa nhận được báo cáo nào.</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
