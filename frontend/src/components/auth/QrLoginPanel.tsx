'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Smartphone } from 'lucide-react';
import axios from '../../lib/api';
import { useStore } from '../../hooks/useStore';
import BrandedQrCode from '../ui/BrandedQrCode';

type QrCreateResponse = {
  sessionId: string;
  token: string;
  expiresAt: string;
  expiresInSeconds: number;
  deepLink: string;
  status: string;
};

type QrPollResponse = {
  status: 'PENDING' | 'APPROVED' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'MISSING';
  expiresAt?: string;
  expiresInSeconds?: number;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
    avatar?: string;
    isVip?: boolean;
    vipExpiresAt?: string | null;
  };
  message?: string;
};

export default function QrLoginPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const setSession = useStore((state) => state.setSession);
  const showToast = useStore((state) => state.showToast);
  const [payload, setPayload] = useState<QrCreateResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading');
  const [error, setError] = useState('');
  const tokenRef = useRef('');
  const claimingRef = useRef(false);
  const qrSize = compact ? 132 : 148;

  const cancelCurrent = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      await axios.post('/auth/qr/cancel', { token });
    } catch {
      // ignore cancel failures when rotating codes
    }
  }, []);

  const createSession = useCallback(async () => {
    setStatus('loading');
    setError('');
    claimingRef.current = false;
    await cancelCurrent();
    try {
      const { data } = await axios.post<QrCreateResponse>('/auth/qr/session');
      tokenRef.current = data.token;
      setPayload(data);
      setSecondsLeft(data.expiresInSeconds);
      setStatus('pending');
    } catch {
      setStatus('error');
      setError('Không tạo được mã QR. Thử lại sau.');
    }
  }, [cancelCurrent]);

  useEffect(() => {
    void createSession();
    return () => {
      void cancelCurrent();
    };
  }, [cancelCurrent, createSession]);

  useEffect(() => {
    if (status !== 'pending' || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void createSession();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [createSession, secondsLeft, status]);

  useEffect(() => {
    if (status !== 'pending' || !payload?.token) return;
    const timer = window.setInterval(async () => {
      if (claimingRef.current) return;
      try {
        const { data } = await axios.get<QrPollResponse>(`/auth/qr/session/${encodeURIComponent(payload.token)}`);
        if (data.status === 'PENDING') return;
        if (data.status === 'EXPIRED' || data.status === 'CANCELLED' || data.status === 'USED') {
          void createSession();
          return;
        }
        if (data.status === 'APPROVED' && data.accessToken && data.user) {
          claimingRef.current = true;
          tokenRef.current = '';
          setSession(data.user, data.accessToken);
          showToast('Đăng nhập bằng QR thành công!', 'success');
          router.replace('/');
        }
      } catch {
        // keep polling through transient network blips
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [createSession, payload?.token, router, setSession, showToast, status]);

  return (
    <div className={`h-full text-center ${compact ? 'flex flex-col justify-center' : ''}`}>
      <div className="mb-2.5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        <Smartphone className="h-3.5 w-3.5 text-red-400" />
        Quét app để vào
      </div>

      {status === 'loading' && (
        <div
          className="mx-auto flex items-center justify-center rounded-xl bg-white/5"
          style={{ width: qrSize + 16, height: qrSize + 16 }}
        >
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-red-500" />
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2 py-4">
          <p className="text-[11px] text-red-400">{error}</p>
          <button type="button" onClick={() => void createSession()} className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/15">
            Thử lại
          </button>
        </div>
      )}

      {status === 'pending' && payload && (
        <>
          <div className="mx-auto inline-flex rounded-xl bg-white p-2 shadow-lg">
            <BrandedQrCode value={payload.deepLink} size={qrSize} title="Mã QR đăng nhập web CINE3D" />
          </div>
          <p className="mt-2.5 text-[11px] leading-4 text-slate-500">
            Dùng camera điện thoại quét mã khi app đã đăng nhập.
          </p>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="text-[10px] font-bold tabular-nums text-amber-300">{secondsLeft}s</span>
            <button
              type="button"
              onClick={() => void createSession()}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
            >
              <RefreshCw className="h-3 w-3" /> Làm mới
            </button>
          </div>
        </>
      )}
    </div>
  );
}
