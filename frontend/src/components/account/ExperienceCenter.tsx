'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { BellRing, Check, Copy, ListPlus, LockKeyhole, MonitorSmartphone, Pencil, Plus, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import api from '../../lib/api';
import { useStore, type ViewerProfile } from '../../hooks/useStore';
import type { AxiosError } from 'axios';

type Playlist = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  _count: { items: number };
  items: { id: string; movie: { id: string; title: string; slug: string; posterUrl: string } }[];
};

type DeviceSession = {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const errorMessage = (error: unknown, fallback: string) => (error as AxiosError<{ message?: string }>).response?.data?.message || fallback;

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export default function ExperienceCenter() {
  const { profiles, setProfiles, selectedProfileId, selectProfile, showToast, logout } = useStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePin, setProfilePin] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [profileResponse, playlistResponse, sessionResponse] = await Promise.all([
        api.get('/user/profiles'),
        api.get('/user/playlists'),
        api.get('/auth/sessions'),
      ]);
      setProfiles(profileResponse.data);
      setPlaylists(playlistResponse.data);
      setSessions(sessionResponse.data);
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        setPushEnabled(Boolean(await registration.pushManager.getSubscription()));
      }
    } catch {
      showToast('Không thể tải toàn bộ cài đặt trải nghiệm.', 'error');
    } finally {
      setLoading(false);
    }
  }, [setProfiles, showToast]);

  useEffect(() => { queueMicrotask(() => void loadData()); }, [loadData]);

  const chooseProfile = async (profile: ViewerProfile) => {
    if (profile.hasPin) {
      const pin = window.prompt(`Nhập PIN 4 số cho hồ sơ ${profile.name}`);
      if (!pin) return;
      try {
        await api.post(`/user/profiles/${profile.id}/verify-pin`, { pin });
      } catch {
        showToast('Mã PIN không đúng.', 'error');
        return;
      }
    }
    selectProfile(profile.id);
    showToast(`Đã chuyển sang hồ sơ ${profile.name}.`, 'success');
  };

  const createProfile = async () => {
    if (!profileName.trim()) return;
    try {
      await api.post('/user/profiles', { name: profileName.trim(), pin: profilePin || undefined });
      setProfileName(''); setProfilePin('');
      await loadData();
      showToast('Đã tạo hồ sơ người xem.', 'success');
    } catch (error: unknown) {
      showToast(errorMessage(error, 'Không thể tạo hồ sơ.'), 'error');
    }
  };

  const removeProfile = async (profile: ViewerProfile) => {
    if (!window.confirm(`Xóa hồ sơ ${profile.name} và toàn bộ lịch sử riêng?`)) return;
    try {
      await api.delete(`/user/profiles/${profile.id}`);
      await loadData();
      showToast('Đã xóa hồ sơ.', 'success');
    } catch (error: unknown) {
      showToast(errorMessage(error, 'Không thể xóa hồ sơ.'), 'error');
    }
  };

  const createPlaylist = async () => {
    if (!playlistName.trim()) return;
    try {
      await api.post('/user/playlists', { name: playlistName.trim() });
      setPlaylistName('');
      await loadData();
      showToast('Đã tạo playlist.', 'success');
    } catch (error: unknown) {
      showToast(errorMessage(error, 'Không thể tạo playlist.'), 'error');
    }
  };

  const togglePlaylistVisibility = async (playlist: Playlist) => {
    try {
      await api.put(`/user/playlists/${playlist.id}`, { isPublic: !playlist.isPublic });
      setPlaylists((current) => current.map((item) => item.id === playlist.id ? { ...item, isPublic: !item.isPublic } : item));
    } catch { showToast('Không thể đổi quyền riêng tư.', 'error'); }
  };

  const removePlaylist = async (playlist: Playlist) => {
    if (!window.confirm(`Xóa playlist “${playlist.name}”?`)) return;
    await api.delete(`/user/playlists/${playlist.id}`);
    setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
  };

  const editPlaylist = async (playlist: Playlist) => {
    const name = window.prompt('Tên playlist:', playlist.name)?.trim();
    if (!name) return;
    const description = window.prompt('Mô tả playlist:', playlist.description || '')?.trim() || '';
    try {
      const response = await api.put(`/user/playlists/${playlist.id}`, { name, description });
      setPlaylists((current) => current.map((item) => item.id === playlist.id ? { ...item, ...response.data } : item));
      showToast('Đã cập nhật playlist.', 'success');
    } catch (error) { showToast(errorMessage(error, 'Không thể cập nhật playlist.'), 'error'); }
  };

  const removePlaylistMovie = async (playlistId: string, movieId: string) => {
    try {
      await api.delete(`/user/playlists/${playlistId}/movies/${movieId}`);
      setPlaylists((current) => current.map((playlist) => playlist.id === playlistId ? { ...playlist, items: playlist.items.filter((item) => item.movie.id !== movieId), _count: { items: Math.max(0, playlist._count.items - 1) } } : playlist));
      showToast('Đã xóa phim khỏi playlist.', 'success');
    } catch (error) { showToast(errorMessage(error, 'Không thể xóa phim khỏi playlist.'), 'error'); }
  };

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Trình duyệt này không hỗ trợ thông báo đẩy.', 'error'); return;
    }
    try {
      if (pushEnabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } });
          await subscription.unsubscribe();
        }
        setPushEnabled(false); showToast('Đã tắt thông báo trên thiết bị này.', 'success'); return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('permission');
      const keyResponse = await api.get('/push/public-key');
      if (!keyResponse.data.publicKey) {
        showToast('Máy chủ chưa cấu hình VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY.', 'info'); return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyResponse.data.publicKey),
      });
      await api.post('/push/subscribe', subscription.toJSON());
      setPushEnabled(true); showToast('Đã bật thông báo tập phim mới.', 'success');
    } catch {
      showToast('Không thể bật thông báo. Hãy kiểm tra quyền của trình duyệt.', 'error');
    }
  };

  const revokeSession = async (session: DeviceSession) => {
    await api.delete(`/auth/sessions/${session.id}`);
    setSessions((current) => current.filter((item) => item.id !== session.id));
    showToast('Đã đăng xuất thiết bị.', 'success');
    if (session.current) logout();
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') showToast('CINE3D đã được thêm vào thiết bị.', 'success');
    setInstallPrompt(null);
  };

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Đang tải trung tâm trải nghiệm…</div>;

  return <div className="grid gap-6 lg:grid-cols-2 text-left">
    <section className="glass-panel rounded-3xl p-5 md:p-6">
      <h3 className="flex items-center gap-2 text-base font-black"><UsersRound className="h-5 w-5 text-purple-400" /> Hồ sơ người xem</h3>
      <p className="mt-1 text-xs text-slate-500">Mỗi hồ sơ có lịch sử, yêu thích và danh sách xem sau riêng.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {profiles.map((profile) => <div key={profile.id} className={`relative rounded-2xl border p-3 ${selectedProfileId === profile.id ? 'border-purple-400 bg-purple-500/10' : 'border-white/10 bg-slate-950/50'}`}>
          <button onClick={() => void chooseProfile(profile)} className="w-full text-left">
            <div className="relative mb-2 h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-red-500 to-purple-600">
              {profile.avatar ? <Image src={profile.avatar} alt={profile.name} fill sizes="48px" className="object-cover" /> : <UserRound className="m-3 h-6 w-6 text-white" />}
            </div>
            <div className="truncate text-sm font-black">{profile.name}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">{profile.hasPin && <LockKeyhole className="h-3 w-3" />}{profile.isKids ? 'Trẻ em' : 'Tiêu chuẩn'}{selectedProfileId === profile.id && <Check className="ml-auto h-3 w-3 text-emerald-400" />}</div>
          </button>
          {profiles.length > 1 && <button onClick={() => void removeProfile(profile)} className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-slate-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>}
        </div>)}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
        <input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={30} placeholder="Tên hồ sơ mới" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs outline-none focus:border-purple-400" />
        <input value={profilePin} onChange={(event) => setProfilePin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="PIN (tùy chọn)" inputMode="numeric" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs outline-none" />
        <button onClick={() => void createProfile()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-black"><Plus className="h-4 w-4" /> Tạo</button>
      </div>
    </section>

    <section className="glass-panel rounded-3xl p-5 md:p-6">
      <h3 className="flex items-center gap-2 text-base font-black"><ListPlus className="h-5 w-5 text-red-400" /> Playlist cá nhân</h3>
      <p className="mt-1 text-xs text-slate-500">Tạo bộ sưu tập rồi thêm phim ngay tại trang chi tiết.</p>
      <div className="mt-4 flex gap-2"><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} maxLength={60} placeholder="Ví dụ: Phim cuối tuần" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs outline-none focus:border-red-400" /><button onClick={() => void createPlaylist()} className="rounded-xl bg-red-600 px-4 text-xs font-black">Tạo mới</button></div>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {playlists.map((playlist) => <div key={playlist.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 grid-cols-2 overflow-hidden rounded-lg bg-slate-900">{playlist.items.slice(0, 4).map((item) => <div key={item.id} className="relative"><Image src={item.movie.posterUrl} alt="" fill sizes="24px" className="object-cover" /></div>)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{playlist.name}</div><div className="text-[10px] text-slate-500">{playlist._count.items} phim · {playlist.isPublic ? 'Công khai' : 'Riêng tư'}</div>{playlist.description && <div className="mt-1 truncate text-[9px] text-slate-600">{playlist.description}</div>}</div><button onClick={() => void editPlaylist(playlist)} title="Sửa playlist"><Pencil className="h-4 w-4 text-slate-500 hover:text-white" /></button>{playlist.isPublic && <button onClick={() => { void navigator.clipboard.writeText(`${location.origin}/playlists/${playlist.id}`); showToast('Đã sao chép liên kết playlist.', 'success'); }} title="Sao chép liên kết"><Copy className="h-4 w-4 text-slate-400" /></button>}<button onClick={() => void togglePlaylistVisibility(playlist)} className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">{playlist.isPublic ? 'Ẩn' : 'Chia sẻ'}</button><button onClick={() => void removePlaylist(playlist)}><Trash2 className="h-4 w-4 text-slate-500 hover:text-red-400" /></button></div>{playlist.items.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto border-t border-white/5 pt-3">{playlist.items.map((item) => <div key={item.id} className="flex shrink-0 items-center gap-2 rounded-lg bg-white/5 py-1 pl-1 pr-2"><Image src={item.movie.posterUrl} alt="" width={24} height={34} className="h-8 w-6 rounded object-cover" /><span className="max-w-28 truncate text-[10px]">{item.movie.title}</span><button type="button" onClick={() => void removePlaylistMovie(playlist.id, item.movie.id)} title="Xóa khỏi playlist"><X className="h-3 w-3 text-slate-600 hover:text-red-400" /></button></div>)}</div>}</div>)}
        {!playlists.length && <p className="py-8 text-center text-xs text-slate-600">Chưa có playlist.</p>}
      </div>
    </section>

    <section className="glass-panel rounded-3xl p-5 md:p-6">
      <h3 className="flex items-center gap-2 text-base font-black"><MonitorSmartphone className="h-5 w-5 text-cyan-400" /> Thiết bị đăng nhập</h3>
      <div className="mt-4 space-y-2">{sessions.map((session) => <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"><MonitorSmartphone className="h-5 w-5 text-slate-500" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{session.deviceName || 'Thiết bị không xác định'} {session.current && <span className="text-emerald-400">(hiện tại)</span>}</div><div className="text-[10px] text-slate-600">{session.ipAddress || 'Ẩn IP'} · {new Date(session.lastUsedAt).toLocaleString('vi-VN')}</div></div><button onClick={() => void revokeSession(session)} className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] font-bold text-red-400">Đăng xuất</button></div>)}</div>
    </section>

    <section className="glass-panel rounded-3xl p-5 md:p-6">
      <h3 className="flex items-center gap-2 text-base font-black"><BellRing className="h-5 w-5 text-amber-400" /> Thông báo tập mới</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">Theo dõi phim tại trang chi tiết và nhận thông báo ngay cả khi không mở CINE3D.</p>
      <button onClick={() => void enablePush()} className={`mt-5 w-full rounded-xl py-3 text-xs font-black ${pushEnabled ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'bg-amber-400 text-black'}`}>{pushEnabled ? 'Đang bật · Nhấn để tắt' : 'Bật thông báo trên thiết bị này'}</button>
      {installPrompt && <button onClick={() => void installApp()} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-black text-white hover:bg-white/10">Cài CINE3D lên màn hình chính</button>}
    </section>
  </div>;
}
