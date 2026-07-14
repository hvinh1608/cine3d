'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, Crown, ReceiptText, ShieldCheck, Sparkles, X } from 'lucide-react';
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
  plan: { id: string; code: string; name: string };
};

const statusLabels: Record<VipOrder['status'], string> = {
  PENDING: 'Chờ admin xác nhận',
  PAID: 'Đã kích hoạt',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

export default function VipPage() {
  const { user, hasHydrated, setUser, showToast } = useStore();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [orders, setOrders] = useState<VipOrder[]>([]);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const userId = user?.id;
  const userIsVip = user?.isVip;
  const userVipExpiresAt = user?.vipExpiresAt;

  const pendingOrder = useMemo(() => orders.find((order) => order.status === 'PENDING'), [orders]);

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
    if (!hasHydrated) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.get('/vip/plans'),
      userId ? loadOrders() : Promise.resolve(),
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
  }, [hasHydrated, loadOrders, showToast, userId]);

  useEffect(() => {
    if (!pendingOrder) return;
    const interval = window.setInterval(() => void loadOrders().catch(() => undefined), 8000);
    return () => window.clearInterval(interval);
  }, [loadOrders, pendingOrder]);

  const createOrder = async (planId: string) => {
    if (!user) return;
    setSubmittingPlanId(planId);
    try {
      const { data } = await api.post('/vip/orders', { planId });
      setOrders((current) => [data.order, ...current]);
      showToast(data.message, 'success');
    } catch (error: any) {
      const existing = error.response?.data?.order as VipOrder | undefined;
      if (existing) setOrders((current) => [existing, ...current.filter((order) => order.id !== existing.id)]);
      showToast(error.response?.data?.message || 'Không thể tạo đơn VIP.', 'error');
    } finally {
      setSubmittingPlanId(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const { data } = await api.post(`/vip/orders/${orderId}/cancel`);
      showToast(data.message, 'success');
      await loadOrders();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Không thể hủy đơn.', 'error');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 via-slate-950/85 to-purple-900/20 p-7 text-center shadow-[0_0_80px_rgba(245,158,11,0.08)] md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <Crown className="mx-auto mb-4 h-12 w-12 text-amber-400" />
        <p className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-amber-400">CINE3D Premium</p>
        <h1 className="text-3xl font-black text-white md:text-5xl">Mở khóa toàn bộ phim VIP</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
          Đây là môi trường thanh toán thử nghiệm. Không phát sinh tiền thật; đơn chỉ được kích hoạt sau khi admin xác nhận.
        </p>
        {user?.isVip && (
          <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            VIP đang hoạt động{vipExpiresAt ? ` đến ${new Date(vipExpiresAt).toLocaleDateString('vi-VN')}` : ' vĩnh viễn'}
          </div>
        )}
      </section>

      {pendingOrder && (
        <section className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 md:flex md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-amber-300"><Clock3 className="h-4 w-4" /> Đơn đang chờ xác nhận</div>
            <p className="mt-2 text-lg font-black text-white">{pendingOrder.plan.name} · {formatMoney(pendingOrder.amount)}</p>
            <p className="mt-1 text-xs text-slate-400">Mã đơn: <span className="font-mono font-bold text-white">{pendingOrder.orderCode}</span> · hết hạn {new Date(pendingOrder.expiresAt).toLocaleString('vi-VN')}</p>
          </div>
          <button onClick={() => cancelOrder(pendingOrder.id)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10 md:mt-0">
            <X className="h-4 w-4" /> Hủy đơn
          </button>
        </section>
      )}

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-3xl bg-white/5" />) : plans.map((plan, index) => (
          <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 ${index === 1 ? 'border-amber-400/40 bg-amber-400/10 shadow-[0_0_40px_rgba(245,158,11,0.08)]' : 'border-white/10 bg-slate-950/60'}`}>
            {index === 1 && <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase text-black">Phổ biến</span>}
            <Sparkles className="mb-5 h-8 w-8 text-amber-400" />
            <h2 className="text-xl font-black text-white">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p>
            <p className="mt-6 text-3xl font-black text-amber-400">{formatMoney(plan.price)}</p>
            <ul className="my-6 space-y-3 text-sm text-slate-300">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> {plan.durationDays} ngày xem nội dung VIP</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Cộng dồn nếu đang còn hạn</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Không phát sinh tiền trong chế độ test</li>
            </ul>
            {!user ? (
              <Link href="/account" className="mt-auto rounded-full bg-white px-5 py-3 text-center text-sm font-black text-black hover:bg-amber-400">Đăng nhập để đăng ký</Link>
            ) : (
              <button
                disabled={Boolean(pendingOrder) || submittingPlanId !== null}
                onClick={() => createOrder(plan.id)}
                className="mt-auto rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 px-5 py-3 text-sm font-black text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submittingPlanId === plan.id ? 'Đang tạo đơn...' : 'Tạo đơn thử nghiệm'}
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
