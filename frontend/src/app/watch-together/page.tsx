'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Copy, Crown, ListVideo, LockKeyhole, MessageCircle, Send, UserMinus, Users, XCircle } from 'lucide-react';
import axios from '../../lib/api';
import { useStore } from '../../hooks/useStore';
import type { Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
type RoomState = { playing: boolean; currentTime: number; updatedAt: number };
type RoomUser = { id: string; name: string };
type ChatMessage = { name: string; message: string };
type RoomSnapshot = { users: RoomUser[]; hostId: string; episode?: number; isPrivate?: boolean };
type RoomResult = RoomSnapshot & { error?: string; passwordRequired?: boolean; roomId: string; slug: string; episode: number; state: RoomState };

export default function WatchTogetherPage() {
  const query = useSearchParams();
  const requestedRoom = query.get('room') || '';
  const slug = query.get('slug') || '';
  const episode = Math.max(1, Number(query.get('ep') || 1));
  const [initialRoomId] = useState(requestedRoom);
  const { user, accessToken, showToast } = useStore();

  const [name, setName] = useState(user?.username || '');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [state, setState] = useState<RoomState>({ playing: false, currentTime: 0, updatedAt: 0 });
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [hostId, setHostId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [started, setStarted] = useState(Boolean(initialRoomId));
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [roomEpisode, setRoomEpisode] = useState(episode);
  const [privateRoom, setPrivateRoom] = useState(false);
  const [password, setPassword] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef(initialRoomId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pendingSeekHandler = useRef<(() => void) | null>(null);
  const source = useMemo(
    () => movie?.episodes?.find((item) => item.episodeOrder === roomEpisode)?.videoSources?.[0],
    [roomEpisode, movie]
  );
  const isHost = Boolean(hostId && hostId === socketId);

  useEffect(() => {
    if (!slug) return;
    axios.get(`${API_URL}/movies/${slug}`)
      .then((response) => setMovie(response.data as Movie))
      .catch(() => setError('Không tải được phim.'));
  }, [slug]);

  useEffect(() => {
    if (!started || !source || !videoRef.current) return;
    const video = videoRef.current;
    setPlayerError('');
    hlsRef.current?.destroy();

    if (source.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setPlayerError('Nguồn phim không thể phát trên thiết bị này.');
      });
      hlsRef.current = hls;
    } else {
      video.src = source.url;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [source, started]);

  const applyGuestPlayback = useCallback((next: RoomState) => {
    const video = videoRef.current;
    if (!video || !source || video.readyState < 1) return;

    if (pendingSeekHandler.current) {
      video.removeEventListener('seeked', pendingSeekHandler.current);
      pendingSeekHandler.current = null;
    }

    const elapsed = next.playing ? Math.min(5, Math.max(0, (Date.now() - next.updatedAt) / 1000)) : 0;
    const targetTime = next.currentTime + elapsed;
    const drift = targetTime - video.currentTime;

    const applyPlaying = () => {
      pendingSeekHandler.current = null;
      video.muted = !soundEnabled;
      if (!next.playing) {
        video.playbackRate = 1;
        video.pause();
        setPlaybackBlocked(false);
        return;
      }

      video.playbackRate = Math.abs(drift) < 2 && Math.abs(drift) > 0.35
        ? (drift > 0 ? 1.05 : 0.95)
        : 1;
      void video.play()
        .then(() => setPlaybackBlocked(false))
        .catch(() => setPlaybackBlocked(true));
    };

    if (Math.abs(drift) > 2) {
      pendingSeekHandler.current = applyPlaying;
      video.addEventListener('seeked', applyPlaying, { once: true });
      video.currentTime = Math.max(0, targetTime);
      if (!video.seeking) {
        video.removeEventListener('seeked', applyPlaying);
        applyPlaying();
      }
      return;
    }
    applyPlaying();
  }, [soundEnabled, source]);

  useEffect(() => {
    if (!isHost) applyGuestPlayback(state);
  }, [applyGuestPlayback, isHost, state]);

  useEffect(() => {
    if (!isHost || !connected) return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !socketRef.current) return;
      socketRef.current.emit('room:control', {
        type: video.paused ? 'pause' : 'play',
        currentTime: video.currentTime,
      });
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [connected, isHost]);

  useEffect(() => {
    if (!started || !accessToken) return;
    const socket = io(SOCKET_URL, { auth: { token: accessToken }, withCredentials: true, reconnection: true, reconnectionAttempts: 10 });
    socketRef.current = socket;

    const enterRoom = () => {
      setConnected(false);
      setSocketId(socket.id || '');
      const reconnectRoomId = activeRoomIdRef.current;
      const event = reconnectRoomId ? 'room:join' : 'room:create';
      socket.emit(event, {
        roomId: reconnectRoomId,
        slug,
        episode,
        name: name || 'Khách',
        privateRoom,
        password,
      }, (result: RoomResult) => {
        if (result?.error) {
          setError(result.error);
          setStarted(false);
          return;
        }
        activeRoomIdRef.current = result.roomId;
        setRoomId(result.roomId);
        setState(result.state);
        setUsers(result.users || []);
        setHostId(result.hostId || '');
        setRoomEpisode(result.episode || episode);
        setConnected(true);
        window.history.replaceState({}, '', `/watch-together?room=${result.roomId}&slug=${encodeURIComponent(result.slug)}&ep=${result.episode}`);
        void axios.post('/analytics/events', { name: reconnectRoomId ? 'watch_room_join' : 'watch_room_create', path: '/watch-together', movieId: result.slug }).catch(() => undefined);
      });
    };

    socket.on('connect', enterRoom);
    socket.on('disconnect', () => { setConnected(false); setSocketId(''); });
    socket.on('room:state', (next: RoomState) => setState(next));
    socket.on('room:users', (snapshot: RoomSnapshot) => {
      setUsers(snapshot.users || []);
      setHostId(snapshot.hostId || '');
    });
    socket.on('room:message', (next: ChatMessage) => setMessages((current) => [...current.slice(-49), next]));
    socket.on('room:episode', ({ episode: nextEpisode, state: nextState }: { episode: number; state: RoomState }) => {
      setRoomEpisode(nextEpisode);
      setState(nextState);
      window.history.replaceState({}, '', `/watch-together?room=${activeRoomIdRef.current}&slug=${encodeURIComponent(slug)}&ep=${nextEpisode}`);
    });
    socket.on('room:kicked', ({ message: reason }: { message?: string }) => {
      activeRoomIdRef.current = '';
      setError(reason || 'Bạn đã rời phòng.');
      setStarted(false);
      setConnected(false);
    });
    socket.on('room:closed', ({ message: reason }: { message?: string }) => {
      activeRoomIdRef.current = '';
      setError(reason || 'Phòng đã đóng.');
      setStarted(false);
      setConnected(false);
    });
    socket.on('connect_error', () => {
      setConnected(false);
      setError('Đang thử kết nối lại máy chủ xem chung...');
    });

    return () => {
      socket.emit('room:leave');
      socket.disconnect();
      socketRef.current = null;
      setSocketId('');
    };
  }, [accessToken, episode, name, password, privateRoom, slug, started]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video && pendingSeekHandler.current) video.removeEventListener('seeked', pendingSeekHandler.current);
  }, []);

  const control = (type: 'play' | 'pause' | 'seek') => {
    const video = videoRef.current;
    if (!video || !isHost) return;
    const playing = type === 'seek' ? !video.paused : type === 'play';
    setState({ playing, currentTime: video.currentTime, updatedAt: Date.now() });
    socketRef.current?.emit('room:control', { type, currentTime: video.currentTime });
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    socketRef.current?.emit('room:message', message);
    setMessage('');
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Đã sao chép link phòng!', 'success');
    } catch {
      showToast('Không thể sao chép link. Hãy sao chép trên thanh địa chỉ.', 'error');
    }
  };

  const closeRoom = () => {
    socketRef.current?.emit('room:close', (result: { ok?: boolean; error?: string }) => {
      if (result?.error) showToast(result.error, 'error');
    });
  };

  const changeEpisode = (nextEpisode: number) => {
    if (!isHost) return;
    socketRef.current?.emit('room:episode', nextEpisode, (result: { ok?: boolean; error?: string }) => {
      if (result?.error) showToast(result.error, 'error');
    });
  };

  const kickUser = (target: RoomUser) => {
    if (!window.confirm(`Mời ${target.name} ra khỏi phòng?`)) return;
    socketRef.current?.emit('room:kick', target.id, (result: { ok?: boolean; error?: string }) => {
      if (result?.error) showToast(result.error, 'error');
    });
  };

  if (!user) {
    return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12"><div className="glass-panel w-full rounded-3xl p-8 text-center"><Users className="mx-auto h-12 w-12 text-red-400" /><h1 className="mt-4 text-2xl font-black">Đăng nhập để xem chung</h1><p className="mt-2 text-sm text-slate-400">Phòng xem chung, trò chuyện và đồng bộ video chỉ dành cho thành viên.</p><Link href="/account" className="mt-6 block rounded-xl bg-red-600 py-3 text-sm font-black text-white">Đăng nhập / Đăng ký</Link></div></main>;
  }

  if (!started) {
    return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
      <div className="glass-panel w-full space-y-5 rounded-3xl p-7 text-center">
        <Users className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="text-2xl font-black text-white">Xem phim cùng nhau</h1>
        <p className="text-sm text-slate-400">Tạo phòng rồi gửi đường dẫn cho bạn bè để cùng xem.</p>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên hiển thị" maxLength={30} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" />
        {initialRoomId ? (
          <div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Mật khẩu nếu là phòng riêng" maxLength={50} className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white" /></div>
        ) : <>
          <label className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${user.isVip ? 'border-amber-400/20 bg-amber-400/5 text-amber-200' : 'border-white/10 bg-slate-900 text-slate-500'}`}><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Phòng riêng tư <Crown className="h-3.5 w-3.5 text-amber-400" /></span><input type="checkbox" disabled={!user.isVip} checked={privateRoom} onChange={(event) => setPrivateRoom(event.target.checked)} className="h-4 w-4 accent-amber-400 disabled:opacity-40" /></label>
          {!user.isVip && <Link href="/vip" className="text-xs font-bold text-amber-400 hover:text-amber-300">Nâng cấp VIP để tạo phòng có mật khẩu</Link>}
          {privateRoom && <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={4} maxLength={50} placeholder="Đặt mật khẩu phòng (ít nhất 4 ký tự)" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" />}
        </>}
        {!slug && <p className="text-xs text-amber-300">Hãy mở tính năng này từ trang xem phim.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={!slug || (!initialRoomId && privateRoom && password.length < 4)} onClick={() => { setError(''); setStarted(true); }} className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">
          {initialRoomId ? 'Tham gia lại phòng' : 'Tạo phòng xem chung'}
        </button>
        <Link href={slug ? `/watch/${slug}?ep=${episode}` : '/'} className="block text-sm text-slate-400 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" /> Quay lại</Link>
      </div>
    </main>;
  }

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-white md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link onClick={() => socketRef.current?.emit('room:leave')} href={movie ? `/watch/${movie.slug}?ep=${roomEpisode}` : '/'} className="text-sm text-slate-400 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" /> Thoát phòng</Link>
      <span className={`rounded-full px-3 py-1 text-xs ${connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{connected ? 'Đã kết nối' : 'Đang kết nối lại...'}</span>
    </div>

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black">{movie?.title || 'Phòng xem chung'}</h1><p className="text-sm text-slate-400">Mã phòng: <b className="text-red-300">{roomId}</b></p></div>
      <div className="flex gap-2">
        <button onClick={copyInvite} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"><Copy className="h-3.5 w-3.5" /> Sao chép link</button>
        {isHost && <button onClick={closeRoom} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10"><XCircle className="h-3.5 w-3.5" /> Đóng phòng</button>}
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <video ref={videoRef} controls={isHost} muted={!isHost && !soundEnabled} playsInline preload="auto" className="aspect-video w-full" onLoadedMetadata={() => { if (!isHost) applyGuestPlayback(state); }} onCanPlay={() => { if (!isHost) applyGuestPlayback(state); }} onError={() => setPlayerError('Không thể tải nguồn video.')} onPlay={() => isHost && control('play')} onPause={() => isHost && control('pause')} onSeeked={() => isHost && control('seek')} />
        {playerError && <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-red-950/90 px-4 py-2 text-xs text-red-200">{playerError}</div>}
        {!isHost && (!soundEnabled || playbackBlocked || !state.playing) && <button onClick={() => { const video = videoRef.current; setSoundEnabled(true); setPlaybackBlocked(false); if (video) { video.muted = false; if (state.playing) void video.play().catch(() => setPlaybackBlocked(true)); } }} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold shadow-lg">
          {state.playing ? (playbackBlocked ? 'Bấm để phát đồng bộ' : 'Bật tiếng & xem') : 'Chờ chủ phòng phát'}
        </button>}
      </section>

      <aside className="glass-panel space-y-4 rounded-2xl p-4">
        {isHost && movie?.episodes && movie.episodes.length > 1 && <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-bold"><ListVideo className="h-4 w-4 text-purple-400" /> Tập đang chiếu</span><select value={roomEpisode} onChange={(event) => changeEpisode(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs outline-none">{movie.episodes.map((item) => <option key={item.id} value={item.episodeOrder}>{item.title}</option>)}</select></label>}
        <div><h2 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-red-400" /> Đang xem ({users.length})</h2><div className="mt-2 space-y-1 text-sm text-slate-300">{users.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5"><span>• {item.name}{item.id === hostId ? ' (chủ phòng)' : ''}</span>{isHost && item.id !== socketId && <button onClick={() => kickUser(item)} title="Mời khỏi phòng" className="text-slate-600 hover:text-red-400"><UserMinus className="h-3.5 w-3.5" /></button>}</div>)}</div></div>
        <div><h2 className="flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4 text-red-400" /> Chat</h2><div className="mt-2 h-48 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-2 text-xs">{messages.map((item, index) => <p key={`${item.name}-${index}`}><b className="text-red-300">{item.name}:</b> {item.message}</p>)}</div><form onSubmit={submitMessage} className="mt-2 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={300} placeholder="Nhắn tin..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" /><button className="rounded-lg bg-red-600 px-3" aria-label="Gửi tin nhắn"><Send className="h-4 w-4" /></button></form></div>
      </aside>
    </div>
    {!isHost && <p className="text-xs text-slate-500">Video tự đồng bộ theo chủ phòng. Nếu trình duyệt chặn tự phát, hãy bấm nút trên video một lần.</p>}
  </main>;
}
