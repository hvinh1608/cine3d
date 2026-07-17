'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { BadgeCheck, Check, Clock3, Copy, Crown, Download, MonitorPlay, ReceiptText, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

type VipPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
};

type VipOrder = {
  id: string;
  orderCode: string;
  amount: number;
  durationDays: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  provider: 'MANUAL' | 'PAYOS';
  checkoutUrl: string | null;
  paymentQrCode: string | null;
  plan: { id: string; code: string; name: string };
};

type PayOSCheckoutEvent = { status?: string };
type PayOSCheckoutInstance = { open: () => void; exit: () => void };

declare global {
  interface Window {
    PayOSCheckout?: {
      usePayOS: (config: {
        RETURN_URL: string;
        ELEMENT_ID: string;
        CHECKOUT_URL: string;
        embedded: boolean;
        onSuccess?: (event: PayOSCheckoutEvent) => void;
        onCancel?: (event: PayOSCheckoutEvent) => void;
        onExit?: (event: PayOSCheckoutEvent) => void;
      }) => PayOSCheckoutInstance;
    };
  }
}

const statusLabels: Record<VipOrder['status'], string> = {
  PENDING: 'Đang chờ thanh toán',
  PAID: 'Đã kích hoạt',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

const VIP_BANK = {
  id: 'MBBank',
  name: 'MB Bank',
  accountNumber: '56700112233',
  accountName: 'TRAN NGO HONG VINH',
};

export default function VipPage() {
  const { user, hasHydrated, authReady, setUser, showToast } = useStore();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [orders, setOrders] = useState<VipOrder[]>([]);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [payosReady, setPayosReady] = useState(false);
  const payosCheckoutRef = useRef<PayOSCheckoutInstance | null>(null);
  const userId = user?.id;
  const userIsVip = user?.isVip;
  const userVipExpiresAt = user?.vipExpiresAt;

  const pendingOrder = useMemo(() => orders.find((order) => order.status === 'PENDING'), [orders]);
  const transferContent = pendingOrder?.orderCode || '';
  const paymentQrUrl = pendingOrder
    && pendingOrder.provider !== 'PAYOS'
    ? `https://img.vietqr.io/image/${VIP_BANK.id}-${VIP_BANK.accountNumber}-compact2.png?amount=${pendingOrder.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(VIP_BANK.accountName)}`
    : '';

  const copyPaymentValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`Đã sao chép ${label}.`, 'success');
    } catch {
      showToast(`Không thể sao chép ${label}.`, 'error');
    }
  };

  const loadOrders = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setVipExpiresAt(null);
      return;
    }
    const { data } = await api.get('/vip/orders/me');
    setOrders(Array.isArray(data.orders) ? data.orders : []);
    setVipExpiresAt(data.vip?.expiresAt || null);
    if (Boolean(data.vip?.active) !== Boolean(userIsVip) || data.vip?.expiresAt !== userVipExpiresAt) {
      const profile = await api.get('/auth/me');
      setUser(profile.data.user);
    }
  }, [setUser, userId, userIsVip, userVipExpiresAt]);

  useEffect(() => {
    if (!hasHydrated || !authReady) return;
    let active = true;
    const ordersRequest = userId ? Promise.resolve().then(loadOrders) : Promise.resolve();
    Promise.all([
      api.get('/vip/plans'),
      ordersRequest,
    ])
      .then(([plansResponse]) => {
        if (active) setPlans(Array.isArray(plansResponse.data.plans) ? plansResponse.data.plans : []);
      })
      .catch(() => {
        if (active) showToast('Không tải được thông tin VIP.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [authReady, hasHydrated, loadOrders, showToast, userId]);

  useEffect(() => {
    if (!pendingOrder) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadOrders().catch(() => undefined);
    };
    const interval = window.setInterval(refreshWhenVisible, 30000);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [loadOrders, pendingOrder]);

  useEffect(() => {
    if (!payosReady || pendingOrder?.provider !== 'PAYOS' || !pendingOrder.checkoutUrl || !window.PayOSCheckout) return;
    const checkout = window.PayOSCheckout.usePayOS({
      RETURN_URL: `${window.location.origin}/vip?payment=success`,
      ELEMENT_ID: 'payos-embedded-checkout',
      CHECKOUT_URL: pendingOrder.checkoutUrl,
      embedded: false,
      onSuccess: () => {
        showToast('Thanh toán thành công. Đang kích hoạt VIP...', 'success');
        window.setTimeout(() => void loadOrders().catch(() => undefined), 1200);
      },
      onCancel: () => {
        showToast('Bạn đã hủy thanh toán PayOS.', 'error');
        void api.post(`/vip/orders/${pendingOrder.id}/cancel`)
          .catch(() => undefined)
          .finally(() => void loadOrders().catch(() => undefined));
      },
    });
    payosCheckoutRef.current = checkout;
    checkout.open();
    return () => {
      payosCheckoutRef.current = null;
      checkout.exit();
    };
  }, [loadOrders, payosReady, pendingOrder?.checkoutUrl, pendingOrder?.id, pendingOrder?.provider, showToast]);

  const createOrder = async (planId: string) => {
    if (!user) return;
    setSubmittingPlanId(planId);
    try {
      const { data } = await api.post('/vip/orders', { planId });
      setOrders((current) => [data.order, ...current]);
      showToast(data.message, 'success');
    } catch (error) {
      const requestError = error as AxiosError<{ message?: string; order?: VipOrder }>;
      const existing = requestError.response?.data?.order;
      if (existing) setOrders((current) => [existing, ...current.filter((order) => order.id !== existing.id)]);
      showToast(requestError.response?.data?.message || 'Không thể tạo đơn VIP.', 'error');
    } finally {
      setSubmittingPlanId(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const { data } = await api.post(`/vip/orders/${orderId}/cancel`);
      showToast(data.message, 'success');
      await loadOrders();
    } catch (error) {
      const requestError = error as AxiosError<{ message?: string }>;
      showToast(requestError.response?.data?.message || 'Không thể hủy đơn.', 'error');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-16">
      <Script
        src="https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js"
        strategy="afterInteractive"
        onReady={() => setPayosReady(true)}
        onError={() => showToast('Không tải được giao diện PayOS. Bạn vẫn có thể mở trang thanh toán dự phòng.', 'error')}
      />
      <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98)_55%,rgba(76,29,149,0.35))] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:p-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative z-10 grid items-center gap-10 text-center lg:grid-cols-[1.25fr_.75fr] lg:text-left">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
              <Crown className="h-4 w-4" /> CINE3D Premium
            </div>
            <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">Xem phim không giới hạn.<br /><span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent">Trọn vẹn từng khoảnh khắc.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Mở khóa kho nội dung độc quyền, chất lượng hình ảnh cao nhất và trải nghiệm xem phim liền mạch trên mọi thiết bị.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.055] p-6 text-left backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Quyền lợi Premium</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-400/15 p-2.5 text-amber-300"><MonitorPlay className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">Nội dung VIP độc quyền</p><p className="text-xs text-slate-500">Mở khóa toàn bộ nguồn phát Premium</p></div></div>
              <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-400/15 p-2.5 text-cyan-300"><Download className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">Tải phim khi có MP4</p><p className="text-xs text-slate-500">Nút tải trực tiếp dành riêng cho tài khoản VIP</p></div></div>
              <div className="flex items-center gap-3"><span className="rounded-xl bg-purple-400/15 p-2.5 text-purple-300"><Zap className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">Kích hoạt nhanh chóng</p><p className="text-xs text-slate-500">Thời hạn tự động cộng dồn sau xác nhận</p></div></div>
              <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-400/15 p-2.5 text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">Quản lý minh bạch</p><p className="text-xs text-slate-500">Theo dõi đơn và hạn dùng ngay trên tài khoản</p></div></div>
            </div>
          </div>
        </div>
        {user?.isVip && (
          <div className="relative z-10 mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            VIP đang hoạt động{vipExpiresAt ? ` đến ${new Date(vipExpiresAt).toLocaleDateString('vi-VN')}` : ' vĩnh viễn'}
          </div>
        )}
      </section>

      {pendingOrder && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 via-slate-950/80 to-slate-950/80 shadow-xl">
          <div className="border-b border-white/5 px-6 py-4"><div className="flex items-center gap-2 text-sm font-black text-amber-300"><Clock3 className="h-4 w-4 animate-pulse" /> Đang xác nhận giao dịch</div></div>
          <div className={`grid gap-7 p-6 lg:items-start ${pendingOrder.provider === 'PAYOS' ? '' : 'lg:grid-cols-[minmax(0,1fr)_320px]'}`}>
            <div className="min-w-0">
              <p className="text-xl font-black text-white">{pendingOrder.plan.name} <span className="text-amber-300">· {formatMoney(pendingOrder.amount)}</span></p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Mã giao dịch <span className="rounded bg-white/5 px-2 py-1 font-mono font-bold text-white">{pendingOrder.orderCode}</span> · hiệu lực đến {new Date(pendingOrder.expiresAt).toLocaleString('vi-VN')}</p>
              {pendingOrder.provider === 'PAYOS' && pendingOrder.checkoutUrl ? (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                  <p className="text-sm font-bold text-emerald-300">Thanh toán trong cửa sổ bảo mật PayOS ngay trên CINE3D. VIP sẽ tự động kích hoạt khi ngân hàng xác nhận.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" disabled={!payosReady} onClick={() => payosCheckoutRef.current?.open()} className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-50">
                      <Zap className="h-4 w-4" /> {payosReady ? 'Mở cửa sổ thanh toán' : 'Đang tải PayOS...'}
                    </button>
                    <a href={pendingOrder.checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 underline decoration-slate-700 underline-offset-4 hover:text-white">
                      Mở trang dự phòng
                    </a>
                  </div>
                </div>
              ) : <><div className="mt-6 grid gap-3 sm:grid-cols-2">
                <PaymentDetail label="Ngân hàng" value={VIP_BANK.name} />
                <PaymentDetail label="Chủ tài khoản" value={VIP_BANK.accountName} />
                <PaymentDetail label="Số tài khoản" value={VIP_BANK.accountNumber} onCopy={() => copyPaymentValue(VIP_BANK.accountNumber, 'số tài khoản')} />
                <PaymentDetail label="Nội dung chuyển khoản" value={transferContent} emphasize onCopy={() => copyPaymentValue(transferContent, 'nội dung chuyển khoản')} />
              </div>
              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100/75">
                Chuyển đúng <strong className="text-amber-300">{formatMoney(pendingOrder.amount)}</strong> và giữ nguyên nội dung <strong className="font-mono text-white">{transferContent}</strong> để admin xác nhận chính xác đơn của bạn.
              </div></>}
              <div className="mt-5 flex max-w-xl items-center text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400"><BadgeCheck className="h-4 w-4" /> Tạo đơn</span><span className="mx-3 h-px flex-1 bg-emerald-400/30" /><span className="flex items-center gap-1 text-amber-300"><Clock3 className="h-4 w-4" /> Xác nhận</span><span className="mx-3 h-px flex-1 bg-white/10" /><span>Kích hoạt VIP</span>
              </div>
              <button onClick={() => cancelOrder(pendingOrder.id)} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10">
                <X className="h-4 w-4" /> Hủy giao dịch
              </button>
            </div>
            {pendingOrder.provider === 'PAYOS' ? <div id="payos-embedded-checkout" className="hidden" /> : paymentQrUrl ? <div className="mx-auto w-full max-w-[320px] rounded-3xl border border-white/10 bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <Image src={paymentQrUrl} alt={`Mã QR thanh toán đơn ${pendingOrder.orderCode}`} width={600} height={760} className="h-auto w-full rounded-2xl" priority />
              <p className="px-2 pb-1 pt-3 text-center text-xs font-black text-slate-900">Quét bằng ứng dụng ngân hàng</p>
              <p className="px-2 pb-2 text-center text-[10px] text-slate-500">QR đã gồm số tiền và mã đơn</p>
            </div> : null}
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-3xl bg-white/5" />) : plans.map((plan, index) => (
          <article key={plan.id} className={`group relative flex flex-col rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 ${index === 1 ? 'border-amber-400/40 bg-gradient-to-b from-amber-400/15 to-slate-950/75 shadow-[0_20px_60px_rgba(245,158,11,0.1)]' : 'border-white/10 bg-slate-950/60 hover:border-white/20'}`}>
            {index === 1 && <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase text-black">Phổ biến</span>}
            <Sparkles className="mb-5 h-8 w-8 text-amber-400" />
            <h2 className="text-xl font-black text-white">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p>
            <p className="mt-6 text-3xl font-black text-amber-400">{formatMoney(plan.price)} <span className="text-xs font-semibold text-slate-500">/ gói</span></p>
            <ul className="my-6 space-y-3 text-sm text-slate-300">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> {plan.durationDays} ngày xem nội dung VIP</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Cộng dồn nếu đang còn hạn</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Theo dõi trạng thái giao dịch tức thời</li>
            </ul>
            {!user ? (
              <Link href="/account" className="mt-auto rounded-full bg-white px-5 py-3 text-center text-sm font-black text-black hover:bg-amber-400">Đăng nhập để đăng ký</Link>
            ) : (
              <button
                disabled={Boolean(pendingOrder) || submittingPlanId !== null}
                onClick={() => createOrder(plan.id)}
                className="mt-auto rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 px-5 py-3 text-sm font-black text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submittingPlanId === plan.id ? 'Đang khởi tạo...' : 'Chọn gói này'}
              </button>
            )}
          </article>
        ))}
      </section>

      {user && orders.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><ReceiptText className="h-5 w-5 text-amber-400" /> Lịch sử đơn VIP</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col gap-2 border-b border-white/5 p-4 last:border-0 md:flex-row md:items-center md:justify-between">
                <div><p className="font-bold text-white">{order.plan.name}</p><p className="text-xs text-slate-500">{order.orderCode} · {new Date(order.createdAt).toLocaleString('vi-VN')}</p></div>
                <div className="md:text-right"><p className="font-bold text-slate-200">{formatMoney(order.amount)}</p><p className={`text-xs font-bold ${order.status === 'PAID' ? 'text-emerald-400' : order.status === 'PENDING' ? 'text-amber-400' : 'text-slate-500'}`}>{statusLabels[order.status]}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PaymentDetail({ label, value, emphasize = false, onCopy }: { label: string; value: string; emphasize?: boolean; onCopy?: () => void }) {
  return <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
    <div className="mt-1.5 flex items-center justify-between gap-3">
      <p className={`truncate text-sm font-black ${emphasize ? 'font-mono text-amber-300' : 'text-white'}`}>{value}</p>
      {onCopy && <button type="button" onClick={onCopy} title={`Sao chép ${label}`} className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-amber-300/30 hover:text-amber-300"><Copy className="h-3.5 w-3.5" /></button>}
    </div>
  </div>;
}
