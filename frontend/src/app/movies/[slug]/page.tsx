'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Play, Star, Plus, Check, Calendar, Clock, Globe, Film, Send, Trash2, Heart, Video, X } from 'lucide-react';
import { useStore } from '../../../hooks/useStore';
import MovieCardLandscape from '../../../components/ui/MovieCardLandscape';
import axios from '../../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function MovieDetail() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { user, favorites, setFavorites, accessToken, showToast } = useStore();
  const [movie, setMovie] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Replying states
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyCommentText, setReplyCommentText] = useState('');

  // Trailer state
  const [showTrailer, setShowTrailer] = useState(false);

  // Fetch movie data and comments
  useEffect(() => {
    const fetchMovieData = async () => {
      setLoadError('');
      try {
        const movieRes = await axios.get(`${API_URL}/movies/${slug}`);
        setMovie(movieRes.data);

        // Determine movie formats and query type to find accurate recommendations
        const genres = movieRes.data.movieGenres || [];
        const isAnime = genres.some((mg: any) => mg.genre?.slug === 'hoat-hinh');
        
        // Use first genre that isn't 'hoat-hinh' as subcategory filter, fallback to first genre
        const filterGenreObj = genres.find((mg: any) => mg.genre?.slug !== 'hoat-hinh') || genres[0];
        const firstGenreSlug = filterGenreObj?.genre?.slug;
        
        const queryType = isAnime 
          ? 'hoathinh' 
          : movieRes.data.isSeries 
            ? 'series' 
            : 'movie';

        if (firstGenreSlug) {
          try {
            const relatedRes = await axios.get(`${API_URL}/movies`, {
              params: { genre: firstGenreSlug, type: queryType, limit: 7 }
            });
            const filtered = (relatedRes.data.movies || []).filter((m: any) => m.id !== movieRes.data.id);
            setRelatedMovies(filtered.slice(0, 6));
          } catch {
            setRelatedMovies([]);
          }
        } else {
          setRelatedMovies([]);
        }

        // Comments API expects movie UUID
        try {
          const commentsRes = await axios.get(`${API_URL}/movies/${movieRes.data.id}/comments`, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          });
          setComments(commentsRes.data);
        } catch {
          setComments([]);
        }

        // Increment view count
        axios.post(`${API_URL}/movies/${movieRes.data.id}/view`).catch(() => {});

        // Fetch user rating if logged in
        if (user && accessToken) {
          try {
            const ratingRes = await axios.get(`${API_URL}/movies/${movieRes.data.id}/ratings/me`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            setUserRating(ratingRes.data.score);
          } catch {
            setUserRating(null);
          }
        }
      } catch (error) {
        console.warn('Failed to load movie detail.', error);
        setMovie(null);
        setComments([]);
        setRelatedMovies([]);
        setLoadError('Không tải được thông tin phim.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchMovieData();
    }
  }, [slug, user, accessToken]);

  const handleToggleFavorite = async () => {
    if (!movie) return;
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện!', 'info');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/user/favorites/${movie.id}`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const currentFavs = [...favorites];
      if (res.data.favorited) {
        setFavorites([...currentFavs, {
          id: movie.id,
          title: movie.title,
          slug: movie.slug,
          posterUrl: movie.posterUrl,
          releaseYear: movie.releaseYear,
          quality: movie.quality,
          ratingAvg: movie.ratingAvg,
        }]);
      } else {
        setFavorites(currentFavs.filter(f => f.id !== movie.id));
      }
    } catch (e) {
      const isAlready = favorites.some(f => f.id === movie.id);
      if (isAlready) {
        setFavorites(favorites.filter(f => f.id !== movie.id));
      } else {
        setFavorites([...favorites, {
          id: movie.id,
          title: movie.title,
          slug: movie.slug,
          posterUrl: movie.posterUrl,
          releaseYear: movie.releaseYear,
          quality: movie.quality,
          ratingAvg: movie.ratingAvg,
        }]);
      }
    }
  };

  const handleSocialShare = (platform: 'facebook' | 'zalo' | 'copy') => {
    if (typeof window === 'undefined') return;
    const shareUrl = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(movie?.title || '');

    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank');
    } else if (platform === 'zalo') {
      window.open(`https://sp.zalo.me/share_to_zalo?url=${shareUrl}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Đã sao chép liên kết phim!', 'success');
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accessToken) {
      showToast('Vui lòng đăng nhập để bình luận!', 'info');
      return;
    }
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`${API_URL}/movies/${movie.id}/comments`, {
        content: newComment.trim()
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      setComments([{
        ...res.data,
        likesCount: 0,
        isLiked: false,
        replies: []
      }, ...comments]);
      setNewComment('');
    } catch (error) {
      // Offline fallback push
      const newCommentMock = {
        id: Math.random().toString(),
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        user: { username: user.username, avatar: user.avatar },
        likesCount: 0,
        isLiked: false,
        replies: []
      };
      setComments([newCommentMock, ...comments]);
      setNewComment('');
    }
  };

  const handlePostReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!user || !accessToken) {
      showToast('Vui lòng đăng nhập để phản hồi!', 'info');
      return;
    }
    if (!replyCommentText.trim()) return;

    try {
      const res = await axios.post(`${API_URL}/movies/${movie.id}/comments`, {
        content: replyCommentText.trim(),
        parentId
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      setComments(prevComments =>
        prevComments.map(c => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [
                ...(c.replies || []),
                {
                  ...res.data,
                  likesCount: 0,
                  isLiked: false
                }
              ]
            };
          }
          return c;
        })
      );
      setReplyCommentText('');
      setReplyingToId(null);
    } catch (error) {
      const mockReply = {
        id: Math.random().toString(),
        content: replyCommentText.trim(),
        createdAt: new Date().toISOString(),
        user: { username: user.username, avatar: user.avatar },
        likesCount: 0,
        isLiked: false,
        parentId
      };
      setComments(prevComments =>
        prevComments.map(c => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [...(c.replies || []), mockReply]
            };
          }
          return c;
        })
      );
      setReplyCommentText('');
      setReplyingToId(null);
    }
  };

  const handleToggleLikeComment = async (commentId: string) => {
    if (!user || !accessToken) {
      showToast('Vui lòng đăng nhập để thích bình luận!', 'info');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/comments/${commentId}/like`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const liked = res.data.liked;
      
      setComments(prevComments =>
        prevComments.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              isLiked: liked,
              likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1))
            };
          }
          if (c.replies && c.replies.length > 0) {
            const updatedReplies = c.replies.map((r: any) => {
              if (r.id === commentId) {
                return {
                  ...r,
                  isLiked: liked,
                  likesCount: Math.max(0, r.likesCount + (liked ? 1 : -1))
                };
              }
              return r;
            });
            return { ...c, replies: updatedReplies };
          }
          return c;
        })
      );
    } catch {
      // Toggle locally on offline/error fallback
      setComments(prevComments =>
        prevComments.map(c => {
          if (c.id === commentId) {
            const liked = !c.isLiked;
            return {
              ...c,
              isLiked: liked,
              likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1))
            };
          }
          if (c.replies && c.replies.length > 0) {
            const updatedReplies = c.replies.map((r: any) => {
              if (r.id === commentId) {
                const liked = !r.isLiked;
                return {
                  ...r,
                  isLiked: liked,
                  likesCount: Math.max(0, r.likesCount + (liked ? 1 : -1))
                };
              }
              return r;
            });
            return { ...c, replies: updatedReplies };
          }
          return c;
        })
      );
    }
  };

  const handleRate = async (score: number) => {
    if (!user || !accessToken) {
      showToast('Vui lòng đăng nhập để đánh giá phim!', 'info');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/movies/${movie.id}/ratings`, { score }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUserRating(score);
      setMovie({ ...movie, ratingAvg: res.data.ratingAvg });
    } catch (e) {
      setUserRating(score);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    try {
      await axios.delete(`${API_URL}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setComments(prev =>
        prev
          .filter(c => c.id !== commentId)
          .map(c => ({
            ...c,
            replies: c.replies ? c.replies.filter((r: any) => r.id !== commentId) : []
          }))
      );
    } catch (e) {
      setComments(prev =>
        prev
          .filter(c => c.id !== commentId)
          .map(c => ({
            ...c,
            replies: c.replies ? c.replies.filter((r: any) => r.id !== commentId) : []
          }))
      );
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      const parts = url.split('v=');
      videoId = parts[1]?.split('&')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (url.includes('youtube.com/embed/')) {
      return url;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[70vh]">
        <div className="w-10 h-10 border-4 border-t-red-600 border-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="flex-1 flex items-center justify-center h-[70vh]">
        <p className="text-lg text-slate-400">{loadError || 'Không tìm thấy thông tin phim.'}</p>
      </div>
    );
  }

  const isFavorited = favorites.some((f) => f.id === movie.id);

  return (
    <div className="flex-1 w-full pb-20 relative select-none">
      
      {/* Blurred Backdrop Background */}
      <div className="absolute top-0 left-0 w-full h-[60vh] -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#020205]/10 via-[#020205]/70 to-[#020205]" />
        <img
          src={movie.backdropUrl}
          alt={movie.title}
          className="w-full h-full object-cover blur-md scale-105 opacity-40"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 flex flex-col lg:flex-row gap-10">
        
        {/* LEFT COLUMN: Floating 3D Poster */}
        <div className="w-full lg:w-1/3 flex flex-col items-center">
          <div
            className="w-[280px] md:w-[320px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.8)] border border-white/10 relative transition-transform duration-500 hover:scale-[1.03] group"
            style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
          >
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
              <span className="self-start bg-red-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mb-2">
                {movie.quality}
              </span>
            </div>
          </div>

          <div className="flex flex-col space-y-3 w-[280px] md:w-[320px] mt-6">
            <div className="flex space-x-3 w-full">
              <Link
                href={`/watch/${movie.slug}`}
                className="flex-grow flex items-center justify-center bg-red-600 text-white font-black py-3 rounded-full hover:bg-red-700 transition-all active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.3)] text-sm"
              >
                <Play className="w-4 h-4 fill-current mr-2" /> Xem Phim
              </Link>

              <button
                onClick={handleToggleFavorite}
                className="flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-slate-950/40 hover:bg-white/10 text-white transition-all active:scale-90 cursor-pointer"
              >
                {isFavorited ? <Heart className="w-5 h-5 text-red-500 fill-current" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>

            {/* Watch trailer button */}
            {movie.trailerUrl && (
              <button
                onClick={() => setShowTrailer(true)}
                className="w-full flex items-center justify-center bg-slate-900 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white font-bold py-2.5 rounded-full transition-all active:scale-95 text-xs md:text-sm cursor-pointer"
              >
                <Video className="w-4.5 h-4.5 mr-2 text-red-500" /> Xem Trailer
              </button>
            )}

            {/* Share buttons */}
            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Chia sẻ:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSocialShare('facebook')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-[10px] font-bold text-blue-400 hover:text-white transition-all cursor-pointer"
                  title="Chia sẻ lên Facebook"
                >
                  Facebook
                </button>
                <button
                  onClick={() => handleSocialShare('zalo')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/10 hover:bg-cyan-600 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 hover:text-white transition-all cursor-pointer"
                  title="Chia sẻ lên Zalo"
                >
                  Zalo
                </button>
                <button
                  onClick={() => handleSocialShare('copy')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-white hover:text-black border border-white/5 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
                  title="Sao chép liên kết"
                >
                  Sao chép
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Layered Info UI */}
        <div className="flex-1 min-w-0 flex flex-col space-y-8">
          
          {/* Main Info Glass Panel */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 text-left shadow-2xl">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">{movie.title}</h1>
              {movie.englishTitle && <p className="text-slate-400 text-lg font-medium">{movie.englishTitle}</p>}
            </div>

            {/* Micro Metadata Row */}
            <div className="flex flex-wrap gap-4 text-xs md:text-sm font-semibold text-slate-300">
              <span className="flex items-center text-yellow-400">
                <Star className="w-4 h-4 fill-current mr-1" /> {movie.ratingAvg?.toFixed(1) || '8.5'} Đánh giá
              </span>
              <span className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-slate-400" /> {movie.releaseYear}</span>
              <span className="flex items-center"><Clock className="w-4 h-4 mr-1 text-slate-400" /> {movie.duration} phút</span>
              <span className="flex items-center"><Globe className="w-4 h-4 mr-1 text-slate-400" /> {movie.country?.name || 'Mỹ'}</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-xs">{movie.status}</span>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">{movie.description}</p>

            {/* Staff / Cast List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5 text-xs md:text-sm">
              <div className="space-y-1">
                <span className="text-slate-500 block">Đạo diễn:</span>
                <span className="font-bold text-slate-200">
                  {movie.movieDirectors?.map((d: any) => d.director.name).join(', ') || 'Đang cập nhật'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Diễn viên:</span>
                <span className="font-bold text-slate-200 text-glow">
                  {movie.movieActors?.map((a: any) => a.actor.name).join(', ') || 'Đang cập nhật'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Thể loại:</span>
                <span className="font-bold text-red-400">
                  {movie.movieGenres?.map((g: any) => g.genre.name).join(', ') || 'Đang cập nhật'}
                </span>
              </div>
            </div>

            {/* Rate Movie Box */}
            <div className="flex flex-col space-y-2 pt-4 border-t border-white/5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đánh giá của bạn:</span>
              <div className="flex flex-wrap gap-1 md:gap-1.5 items-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    className="hover:scale-125 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        userRating && userRating >= star
                          ? 'text-yellow-400 fill-current'
                          : 'text-slate-600 hover:text-yellow-400'
                      }`}
                    />
                  </button>
                ))}
                {userRating && <span className="text-xs text-yellow-400 font-bold ml-2">({userRating}/10)</span>}
              </div>
            </div>
          </div>

          {/* Episode Selector Panel */}
          <div className="glass-panel p-6 rounded-3xl text-left shadow-2xl">
            <h3 className="text-lg font-black tracking-wide uppercase mb-4 flex items-center">
              <Film className="w-5 h-5 text-red-500 mr-2" /> Chọn Tập Phim
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {movie.episodes?.map((ep: any) => (
                <Link
                  key={ep.id}
                  href={`/watch/${movie.slug}?ep=${ep.episodeOrder}`}
                  className="bg-slate-900/60 border border-white/10 hover:border-red-500 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all text-center min-w-[70px] active:scale-95"
                >
                  {ep.title}
                </Link>
              )) || <p className="text-slate-500 text-xs">Đang cập nhật danh sách tập.</p>}
            </div>
          </div>

          {/* Related Movies Carousel */}
          {relatedMovies.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl text-left shadow-2xl space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-5 bg-yellow-500 rounded-full" />
                <h3 className="text-lg font-black tracking-wide uppercase flex items-center text-white">
                  Phim Tương Tự
                </h3>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                {relatedMovies.map((m: any) => (
                  <div key={m.id} className="w-[180px] sm:w-[220px] shrink-0">
                    <MovieCardLandscape
                      movie={m}
                      onToggleFavorite={async () => {
                        if (!user) {
                          showToast('Vui lòng đăng nhập để lưu phim yêu thích!', 'info');
                          return;
                        }
                        try {
                          const res = await axios.post(`${API_URL}/user/favorites/${m.id}`, {}, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                          });
                          const currentFavs = [...favorites];
                          if (res.data.favorited) {
                            setFavorites([...currentFavs, m]);
                          } else {
                            setFavorites(currentFavs.filter(f => f.id !== m.id));
                          }
                        } catch {
                          const isAlready = favorites.some(f => f.id === m.id);
                          if (isAlready) {
                            setFavorites(favorites.filter(f => f.id !== m.id));
                          } else {
                            setFavorites([...favorites, m]);
                          }
                        }
                      }}
                      isFavorited={favorites.some((f) => f.id === m.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment & Interactive Reviews Segment */}
          <div className="glass-panel p-6 rounded-3xl text-left shadow-2xl space-y-6">
            <h3 className="text-lg font-black tracking-wide uppercase flex items-center">
              Bình Luận ({comments.length})
            </h3>

            {/* Comment Form */}
            {user ? (
              <form onSubmit={handlePostComment} className="flex gap-3">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                  alt={user.username}
                  className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Viết đánh giá hoặc chia sẻ ý kiến của bạn..."
                    className="w-full bg-slate-900/60 border border-white/10 focus:border-red-500 rounded-full pl-5 pr-12 py-2 text-xs md:text-sm outline-none text-white backdrop-blur-sm"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 cursor-pointer">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-slate-400 text-xs md:text-sm">
                  Bạn phải{' '}
                  <Link href="/account" className="text-red-500 hover:underline font-bold">
                    đăng nhập
                  </Link>{' '}
                  để viết bình luận.
                </p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex flex-col border-b border-white/5 pb-5 last:border-b-0 last:pb-0">
                  
                  {/* Parent Comment */}
                  <div className="flex gap-3">
                    <img
                      src={comment.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                      alt={comment.user?.username}
                      className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs md:text-sm text-slate-200">{comment.user?.username}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs md:text-sm leading-relaxed">{comment.content}</p>

                      {/* Parent Actions */}
                      <div className="flex items-center space-x-4 pt-1 text-[10px] text-slate-500 font-bold">
                        <button
                          onClick={() => handleToggleLikeComment(comment.id)}
                          className={`cursor-pointer hover:text-red-400 transition-colors ${comment.isLiked ? 'text-red-500' : ''}`}
                        >
                          Thích ({comment.likesCount || 0})
                        </button>
                        <button
                          onClick={() => {
                            if (replyingToId === comment.id) {
                              setReplyingToId(null);
                            } else {
                              setReplyingToId(comment.id);
                              setReplyCommentText('');
                            }
                          }}
                          className="cursor-pointer hover:text-red-400 transition-colors"
                        >
                          Phản hồi
                        </button>
                        {user && (user.id === comment.userId || user.role === 'ADMIN') && (
                          <button
                            onClick={() => handleCommentDelete(comment.id)}
                            className="text-red-500 hover:text-red-400 flex items-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-0.5" /> Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reply Input Form under this parent comment */}
                  {replyingToId === comment.id && user && (
                    <form onSubmit={(e) => handlePostReply(e, comment.id)} className="flex gap-3 pl-12 mt-3 w-full">
                      <img
                        src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=30&q=80'}
                        alt={user.username}
                        className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          required
                          value={replyCommentText}
                          onChange={(e) => setReplyCommentText(e.target.value)}
                          placeholder={`Phản hồi @${comment.user?.username || 'user'}...`}
                          className="w-full bg-slate-950 border border-white/10 focus:border-red-500 rounded-full pl-4 pr-10 py-1.5 text-xs outline-none text-white"
                        />
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 cursor-pointer">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Render Replies (Nested list) */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-10 md:pl-12 mt-3 space-y-4 border-l border-white/5 relative">
                      {comment.replies.map((reply: any) => (
                        <div key={reply.id} className="flex gap-3 relative pb-1">
                          {/* L-shaped line indicator */}
                          <div className="absolute -left-[41px] top-4 w-5 h-3.5 border-l border-b border-white/10 rounded-bl-lg" />
                          
                          <img
                            src={reply.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                            alt={reply.user?.username}
                            className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-300">{reply.user?.username}</span>
                              <span className="text-[9px] text-slate-500">
                                {new Date(reply.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">{reply.content}</p>

                            <div className="flex items-center space-x-3 pt-0.5 text-[9px] text-slate-500 font-bold">
                              <button
                                onClick={() => handleToggleLikeComment(reply.id)}
                                className={`cursor-pointer hover:text-red-400 transition-colors ${reply.isLiked ? 'text-red-500' : ''}`}
                              >
                                Thích ({reply.likesCount || 0})
                              </button>
                              {user && (user.id === reply.userId || user.role === 'ADMIN') && (
                                <button
                                  onClick={() => handleCommentDelete(reply.id)}
                                  className="text-red-500 hover:text-red-400 flex items-center cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 mr-0.5" /> Xóa
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-4">Chưa có bình luận nào cho phim này.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal Pop-up */}
      {showTrailer && movie.trailerUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex flex-col">
            
            {/* Close Button */}
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute top-4 right-4 z-40 bg-black/60 hover:bg-red-600 text-white rounded-full p-2.5 transition-colors cursor-pointer border border-white/10"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            {movie.trailerUrl.includes('youtube.com') || movie.trailerUrl.includes('youtu.be') ? (
              <iframe
                src={getEmbedUrl(movie.trailerUrl)}
                title={`Trailer ${movie.title}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={movie.trailerUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
