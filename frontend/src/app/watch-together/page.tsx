'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, MessageCircle, Send, Users } from 'lucide-react';
import axios from '../../lib/api';
import { useStore } from '../../hooks/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
type RoomState = { playing: boolean; currentTime: number; updatedAt: number };
type RoomUser = { id: string; name: string };
type ChatMessage = { name: string; message: string };

export default function WatchTogetherPage() {
  const query = useSearchParams(); const requestedRoom = query.get('room') || ''; const slug = query.get('slug') || ''; const episode = Number(query.get('ep') || 1);
  const { user } = useStore(); const [name, setName] = useState(user?.username || ''); const [roomId, setRoomId] = useState(requestedRoom); const [movie, setMovie] = useState<any>(null);
  const [state, setState] = useState<RoomState>({ playing: false, currentTime: 0, updatedAt: Date.now() }); const [users, setUsers] = useState<RoomUser[]>([]); const [hostId, setHostId] = useState(''); const [messages, setMessages] = useState<ChatMessage[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [started, setStarted] = useState(Boolean(requestedRoom)); const [connected, setConnected] = useState(false); const [soundEnabled, setSoundEnabled] = useState(false);
  const socketRef = useRef<Socket | null>(null); const videoRef = useRef<HTMLVideoElement>(null); const hlsRef = useRef<Hls | null>(null); const remoteUpdate = useRef(false);
  const source = movie?.episodes?.find((item: any) => item.episodeOrder === episode)?.videoSources?.[0]; const isHost = hostId ? hostId === socketRef.current?.id : users[0]?.id === socketRef.current?.id;

  useEffect(() => { if (slug) axios.get(`${API_URL}/movies/${slug}`).then((res) => setMovie(res.data)).catch(() => setError('Không tải được phim.')); }, [slug]);
  useEffect(() => { if (!started || !source || !videoRef.current) return; const video = videoRef.current; hlsRef.current?.destroy(); if (source.type === 'hls' && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(source.url); hls.attachMedia(video); hlsRef.current = hls; } else if (source.type === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) video.src = source.url; else video.src = source.url; return () => { hlsRef.current?.destroy(); hlsRef.current = null; }; }, [started, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source || video.readyState < 1) return;
    remoteUpdate.current = true;
    video.currentTime = state.currentTime;
    const playback = state.playing ? video.play() : Promise.resolve(video.pause());
    playback.catch(() => undefined).finally(() => { remoteUpdate.current = false; });
  }, [source, state]);
  useEffect(() => {
    if (!started) return; const socket = io(SOCKET_URL, { withCredentials: true }); socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); const event = requestedRoom ? 'room:join' : 'room:create'; socket.emit(event, { roomId: requestedRoom, slug, episode, name: name || user?.username }, (result: any) => { if (result?.error) { setError(result.error); setStarted(false); return; } setRoomId(result.roomId); setState(result.state); setUsers(result.users || []); setHostId(result.hostId || (!requestedRoom ? socket.id : '')); window.history.replaceState({}, '', `/watch-together?room=${result.roomId}&slug=${encodeURIComponent(result.slug)}&ep=${result.episode}`); }); });
    socket.on('room:state', (next: RoomState) => setState(next));
    socket.on('room:users', (snapshot: { users: RoomUser[]; hostId: string } | RoomUser[]) => { const nextUsers = Array.isArray(snapshot) ? snapshot : snapshot.users || []; setUsers(nextUsers); setHostId(Array.isArray(snapshot) ? '' : snapshot.hostId || ''); }); socket.on('room:message', (next: ChatMessage) => setMessages((current) => [...current.slice(-49), next])); socket.on('connect_error', () => setError('Không kết nối được máy chủ xem chung.'));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [started, requestedRoom, slug, episode, name, user?.username]);

  const control = (type: 'play' | 'pause' | 'seek') => { const currentTime = videoRef.current?.currentTime || 0; setState({ playing: type === 'play', currentTime, updatedAt: Date.now() }); socketRef.current?.emit('room:control', { type, currentTime }); };
  const submitMessage = (event: FormEvent) => { event.preventDefault(); if (!message.trim()) return; socketRef.current?.emit('room:message', message); setMessage(''); };

  if (!started) return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12"><div className="glass-panel w-full space-y-5 rounded-3xl p-7 text-center"><Users className="mx-auto h-12 w-12 text-red-400" /><h1 className="text-2xl font-black text-white">Xem phim cùng nhau</h1><p className="text-sm text-slate-400">Tạo phòng rồi gửi đường dẫn cho bạn bè để cùng xem.</p><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" />{!slug && <p className="text-xs text-amber-300">Hãy mở tính năng này từ trang xem phim.</p>}{error && <p className="text-sm text-red-400">{error}</p>}<button disabled={!slug} onClick={() => setStarted(true)} className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{requestedRoom ? 'Tham gia phòng' : 'Tạo phòng xem chung'}</button><Link href={slug ? `/watch/${slug}?ep=${episode}` : '/'} className="block text-sm text-slate-400 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" /> Quay lại</Link></div></main>;

  const displayedHostId = hostId || users[0]?.id;
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-white md:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><Link href={movie ? `/watch/${movie.slug}?ep=${episode}` : '/'} className="text-sm text-slate-400 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" /> Thoát phòng</Link><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">{connected ? 'Đã kết nối' : 'Đang kết nối...'}</span></div><div><h1 className="text-2xl font-black">{movie?.title || 'Phòng xem chung'}</h1><p className="text-sm text-slate-400">Mã phòng: <b className="text-red-300">{roomId}</b> · Gửi link trên thanh địa chỉ cho bạn bè</p></div><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"><video ref={videoRef} controls={isHost} muted={!isHost && !soundEnabled} className="aspect-video w-full" onLoadedMetadata={() => { if (videoRef.current) { videoRef.current.currentTime = state.currentTime; if (state.playing) videoRef.current.play().catch(() => undefined); } }} onPlay={() => !remoteUpdate.current && isHost && control('play')} onPause={() => !remoteUpdate.current && isHost && control('pause')} onSeeked={() => !remoteUpdate.current && isHost && control('seek')} />{!isHost && <button onClick={() => { setSoundEnabled(true); if (state.playing) videoRef.current?.play().catch(() => undefined); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold shadow-lg">{state.playing ? 'Bật tiếng' : 'Chờ chủ phòng phát'}</button>}</section><aside className="glass-panel space-y-4 rounded-2xl p-4"><div><h2 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-red-400" /> Đang xem ({users.length})</h2><div className="mt-2 space-y-1 text-sm text-slate-300">{users.map((item) => <div key={item.id}>• {item.name}{item.id === displayedHostId ? ' (chủ phòng)' : ''}</div>)}</div></div><div><h2 className="flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4 text-red-400" /> Chat</h2><div className="mt-2 h-48 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-2 text-xs">{messages.map((item, index) => <p key={index}><b className="text-red-300">{item.name}:</b> {item.message}</p>)}</div><form onSubmit={submitMessage} className="mt-2 flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nhắn tin..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" /><button className="rounded-lg bg-red-600 px-3"><Send className="h-4 w-4" /></button></form></div></aside></div>{!isHost && <p className="text-xs text-slate-500">Chủ phòng điều khiển phát, dừng và tua phim. Bạn chỉ cần bấm “Bật tiếng” một lần.</p>}</main>;
}
