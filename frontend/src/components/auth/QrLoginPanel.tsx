'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Smartphone, X } from 'lucide-react';
import axios from '../../lib/api';
import { useStore } from '../../hooks/useStore';

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

export default function QrLoginPanel() {
  const setSession = useStore((state) => state.setSession);
  const showToast = useStore((state) => state.showToast);
  const [payload, setPayload] = useState<QrCreateResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading');
  const [error, setError] = useState('');
  const tokenRef = useRef('');
  const claimingRef = useRef(false);

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
        }
      } catch {
        // keep polling through transient network blips
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [createSession, payload?.token, setSession, showToast, status]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center">
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
        <Smartphone className="h-3.5 w-3.5 text-red-400" />
        Đăng nhập bằng app
      </div>

      {status === 'loading' && (
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-white/5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-red-500" />
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3 py-6">
          <p className="text-xs text-red-400">{error}</p>
          <button type="button" onClick={() => void createSession()} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15">
            Thử lại
          </button>
        </div>
      )}

      {status === 'pending' && payload && (
        <>
          <div className="mx-auto inline-flex rounded-2xl bg-white p-3 shadow-lg">
            <QRCodeSVG value={payload.deepLink} size={168} level="M" bgColor="#ffffff" fgColor="#09090b" />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Mở app CINE3D đã đăng nhập trên điện thoại, rồi quét mã này bằng camera điện thoại để xác nhận đăng nhập web.
          </p>
          <p className="mt-2 text-[11px] font-bold text-amber-300">
            Mã còn hiệu lực {secondsLeft}s
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void createSession()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới mã
            </button>
            <button
              type="button"
              onClick={() => void cancelCurrent().then(() => createSession())}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" /> Hủy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
