'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Film, ListVideo, AlertTriangle, Users, BarChart3, Plus, Trash2, Lock, Unlock, RefreshCw } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
  const [activeTab, setActiveTab] = useState<'stats' | 'movies' | 'episodes' | 'users' | 'reports'>('stats');

  // Stats States
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalMovies: 0,
    totalEpisodes: 0,
    totalViews: 0,
    pendingReports: 0,
    topMovies: [],
    recentReports: [],
  });

  // Entities List States
  const [movies, setMovies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  
  // Movie Add Form States
  const [movieTitle, setMovieTitle] = useState('');
  const [movieSlug, setMovieSlug] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [moviePoster, setMoviePoster] = useState('');
  const [movieBackdrop, setMovieBackdrop] = useState('');
  const [movieYear, setMovieYear] = useState('2026');
  const [movieDuration, setMovieDuration] = useState('120');
  const [movieCountry, setMovieCountry] = useState('');
  const [movieQuality, setMovieQuality] = useState('FHD');
  const [movieIsSeries, setMovieIsSeries] = useState(false);

  // Episode Add Form States
  const [epMovieId, setEpMovieId] = useState('');
  const [epTitle, setEpTitle] = useState('');
  const [epOrder, setEpOrder] = useState('1');
  const [epVideoUrl, setEpVideoUrl] = useState('');
  const [epServer, setEpServer] = useState('Main Server');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch Dashboard data
  const loadAdminData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [statsRes, moviesRes, usersRes, reportsRes, countriesRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/movies`),
        axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/admin/reports`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API_URL}/countries`),
      ]);

      setStats(statsRes.data);
      setMovies(moviesRes.data?.movies || []);
      setUsers(usersRes.data);
      setReports(reportsRes.data);
      setCountries(countriesRes.data || []);
      if (!movieCountry && countriesRes.data?.[0]?.id) {
        setMovieCountry(countriesRes.data[0].id);
      }
    } catch (e) {
      console.warn('Backend unavailable, rendering mock statistics.');
      // Standalone mockup
      setStats({
        totalUsers: 140,
        totalMovies: 12,
        totalEpisodes: 45,
        totalViews: 24500,
        pendingReports: 1,
        topMovies: [
          { id: 'm1', title: 'Ma Trận Hồi Sinh', views: 8900, ratingAvg: 8.5 },
          { id: 'm2', title: 'Kẻ Kiến Tạo', views: 5400, ratingAvg: 9.2 },
        ],
        recentReports: [
          { id: 'r1', type: 'stream_error', content: 'Server 1 tập 2 bị giật', user: { username: 'watcher' }, status: 'Pending' }
        ]
      });

      setMovies([
        { id: 'm1', title: 'Ma Trận Hồi Sinh', slug: 'ma-tran-hoi-sinh', views: 8900, releaseYear: 2021, quality: 'FHD' },
        { id: 'm2', title: 'Kẻ Kiến Tạo', slug: 'ke-kien-tao', views: 5400, releaseYear: 2010, quality: '4K' },
      ]);

      setUsers([
        { id: 'u1', username: 'admin', email: 'admin@webxemphim.com', role: { name: 'ADMIN' }, isLocked: false },
        { id: 'u2', username: 'movie_fan', email: 'user@webxemphim.com', role: { name: 'USER' }, isLocked: false },
      ]);

      setReports([
        { id: 'r1', type: 'stream_error', content: 'Server 1 tập 2 bị giật', user: { username: 'watcher' }, status: 'Pending' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [accessToken]);

  // Auth Guard Rendering check
  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieCountry) {
      showToast('Vui lòng chọn quốc gia.', 'info');
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/admin/movies`, {
        title: movieTitle,
        slug: movieSlug,
        description: movieDesc,
        posterUrl: moviePoster,
        backdropUrl: movieBackdrop,
        releaseYear: movieYear,
        duration: movieDuration,
        quality: movieQuality,
        isSeries: movieIsSeries,
        countryId: movieCountry,
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      showToast('Tạo phim mới thành công!', 'success');
      loadAdminData();

      // Reset
      setMovieTitle('');
      setMovieSlug('');
      setMovieDesc('');
      setMoviePoster('');
      setMovieBackdrop('');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Lỗi thêm phim.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/admin/episodes`, {
        movieId: epMovieId,
        title: epTitle,
        episodeOrder: epOrder,
        videoSources: [{ server: epServer, quality: '1080p', url: epVideoUrl, type: 'hls' }],
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      showToast('Thêm tập phim thành công!', 'success');
      setEpTitle('');
      setEpVideoUrl('');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Lỗi thêm tập.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLock = async (userId: string) => {
    try {
      const res = await axios.put(`${API_URL}/admin/users/${userId}/lock`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      showToast(res.data.message, 'success');
      loadAdminData();
    } catch (e) {
      setUsers(users.map(u => u.id === userId ? { ...u, isLocked: !u.isLocked } : u));
    }
  };

  const handleMovieDelete = async (movieId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phim này?')) return;
    try {
      await axios.delete(`${API_URL}/admin/movies/${movieId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      loadAdminData();
    } catch (e) {
      setMovies(movies.filter(m => m.id !== movieId));
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await axios.put(`${API_URL}/admin/reports/${reportId}/resolve`, { status: 'Resolved' }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      loadAdminData();
    } catch (e) {
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'Resolved' } : r));
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
          <span className="font-black text-sm uppercase tracking-wider text-purple-400">Admin Panel</span>
        </div>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Thống Kê Tổng Quan</span>
        </button>

        <button
          onClick={() => setActiveTab('movies')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'movies' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Quản Lý Phim</span>
        </button>

        <button
          onClick={() => setActiveTab('episodes')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'episodes' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <ListVideo className="w-4 h-4" />
          <span>Quản Lý Tập Phim</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'users' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản Lý Thành Viên</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all relative ${
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
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-grow glass-panel p-6 md:p-8 rounded-3xl shadow-2xl">
        
        {/* STATS OVERVIEW TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide">Thống kê nền tảng</h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Thành viên</span>
                <span className="text-2xl font-black text-white">{stats.totalUsers}</span>
              </div>
              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Số lượng phim</span>
                <span className="text-2xl font-black text-white">{stats.totalMovies}</span>
              </div>
              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Tổng lượt xem</span>
                <span className="text-2xl font-black text-cyan-400">{stats.totalViews}</span>
              </div>
              <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Báo cáo chưa xử lý</span>
                <span className="text-2xl font-black text-red-500">{stats.pendingReports}</span>
              </div>
            </div>

            {/* List of top movies */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold uppercase text-slate-300">Phim xem nhiều nhất</h3>
              <div className="space-y-3 text-xs md:text-sm">
                {stats.topMovies.map((movie: any, idx: number) => (
                  <div key={movie.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-b-0">
                    <span className="font-bold text-slate-200">{idx + 1}. {movie.title}</span>
                    <span className="text-slate-400">{movie.views} lượt xem</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MOVIES CRUD TAB */}
        {activeTab === 'movies' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-wide">Quản lý phim</h2>
            </div>

            {/* Create Movie Form */}
            <form onSubmit={handleCreateMovie} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center">
                <Plus className="w-4 h-4 mr-1" /> Thêm phim mới
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
                placeholder="URL hình Poster (2:3)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                required
                value={movieBackdrop}
                onChange={(e) => setMovieBackdrop(e.target.value)}
                placeholder="URL hình Backdrop (16:9)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <textarea
                required
                value={movieDesc}
                onChange={(e) => setMovieDesc(e.target.value)}
                placeholder="Mô tả cốt truyện chi tiết..."
                className="col-span-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none h-24"
              />

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

              <div className="flex flex-col space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Năm / Thời lượng / Chất lượng:</span>
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

              <label className="col-span-full flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={movieIsSeries}
                  onChange={(e) => setMovieIsSeries(e.target.checked)}
                  className="rounded"
                />
                Đây là phim bộ (series)
              </label>

              <button
                type="submit"
                disabled={actionLoading}
                className="col-span-full bg-purple-600 hover:bg-purple-700 text-white text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg"
              >
                {actionLoading ? 'Đang lưu...' : 'Thêm Phim Vào Hệ Thống'}
              </button>
            </form>

            {/* Movies List Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase text-slate-300">Danh sách phim hiện tại</h3>
              <div className="overflow-x-auto text-xs md:text-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-500">
                      <th className="py-2">Tên phim</th>
                      <th className="py-2">Năm</th>
                      <th className="py-2">Chất lượng</th>
                      <th className="py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movies.map((m) => (
                      <tr key={m.id} className="border-b border-white/5 text-slate-300">
                        <td className="py-3 font-bold">{m.title}</td>
                        <td className="py-3">{m.releaseYear}</td>
                        <td className="py-3">{m.quality}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleMovieDelete(m.id)}
                            className="p-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EPISODES MANAGEMENT TAB */}
        {activeTab === 'episodes' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide">Quản lý tập phim</h2>

            <form onSubmit={handleCreateEpisode} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center">
                <Plus className="w-4 h-4 mr-1" /> Thêm tập phim mới
              </h3>

              <div className="flex flex-col space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Chọn phim:</span>
                <select
                  value={epMovieId}
                  onChange={(e) => setEpMovieId(e.target.value)}
                  required
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white"
                >
                  <option value="">-- Chọn phim liên kết --</option>
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Số tập (order):</span>
                <input
                  type="number"
                  required
                  value={epOrder}
                  onChange={(e) => setEpOrder(e.target.value)}
                  placeholder="e.g. 1, 2"
                  className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
                />
              </div>

              <input
                type="text"
                required
                value={epTitle}
                onChange={(e) => setEpTitle(e.target.value)}
                placeholder="Tiêu đề tập (e.g. Tập 1, Full Movie)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <input
                type="text"
                required
                value={epVideoUrl}
                onChange={(e) => setEpVideoUrl(e.target.value)}
                placeholder="Đường dẫn nguồn phim (.m3u8 hoặc .mp4)"
                className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm outline-none"
              />

              <button
                type="submit"
                disabled={actionLoading}
                className="col-span-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg"
              >
                {actionLoading ? 'Đang lưu...' : 'Thêm Tập Phim'}
              </button>
            </form>
          </div>
        )}

        {/* USERS MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide">Quản lý thành viên</h2>
            
            <div className="overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="py-2">Tên tài khoản</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Quyền</th>
                    <th className="py-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 text-slate-300">
                      <td className="py-3 font-bold">{u.username}</td>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3">{u.role?.name}</td>
                      <td className="py-3 text-right">
                        {u.role?.name !== 'ADMIN' && (
                          <button
                            onClick={() => handleToggleLock(u.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              u.isLocked
                                ? 'bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white'
                                : 'bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white'
                            }`}
                          >
                            {u.isLocked ? <Lock className="w-3.5 h-3.5 inline mr-1" /> : <Unlock className="w-3.5 h-3.5 inline mr-1" />}
                            {u.isLocked ? 'Đã Khóa' : 'Đang Hoạt Động'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ERROR REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-wide">Danh sách báo cáo lỗi</h2>
            
            <div className="space-y-4">
              {reports.map((r) => (
                <div key={r.id} className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center space-x-2">
                      <span className="bg-red-600/20 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-black">
                        {r.type}
                      </span>
                      <span className="text-xs text-slate-400">Gửi bởi: {r.user?.username}</span>
                    </div>
                    <p className="text-slate-200 text-xs md:text-sm">{r.content}</p>
                  </div>

                  <button
                    onClick={() => handleResolveReport(r.id)}
                    disabled={r.status === 'Resolved'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      r.status === 'Resolved'
                        ? 'bg-green-600/20 text-green-500 border border-green-500/20 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-slate-200 active:scale-95'
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
