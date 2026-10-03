'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '../../hooks/useStore';

const SCRIPT_SRC =
  'https://pl31563507.profitableratecpmnetwork.com/31f5332a77ce27c799df661daf72b1e2/invoke.js';
const CONTAINER_ID = 'container-31f5332a77ce27c799df661daf72b1e2';
const SCRIPT_MARK = 'data-adsterra-native';

/** Never show ads on playback / admin. */
const HIDDEN_PREFIXES = ['/watch', '/admin', '/qr-login', '/account', '/vip'];

/** Pages that render their own mid-content ad slot. */
function hasDedicatedSlot(pathname: string) {
  return pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/movies/');
}

function isVipActive(user: { isVip?: boolean; vipExpiresAt?: string | null } | null) {
  if (!user?.isVip) return false;
  if (!user.vipExpiresAt) return true;
  return new Date(user.vipExpiresAt).getTime() > Date.now();
}

type Props = {
  className?: string;
  /** `inline` = page-owned slot. `fallback` = layout slot for other pages only. */
  variant?: 'inline' | 'fallback';
};

/**
 * One Adsterra Native unit = one fixed container id per page.
 * Place mid-content (after first rows / before comments) for better view + CTR.
 * VIP accounts never see ads.
 */
export default function AdsterraNativeBanner({ className = '', variant = 'inline' }: Props) {
  const pathname = usePathname() || '';
  const user = useStore((state) => state.user);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const rootRef = useRef<HTMLElement | null>(null);
  const vipFree = hasHydrated && isVipActive(user);
  const hidden =
    vipFree
    || HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || (variant === 'fallback' && hasDedicatedSlot(pathname));

  useEffect(() => {
    if (hidden) return;
    const root = rootRef.current;
    if (!root) return;

    let injected: HTMLScriptElement | null = null;
    let cancelled = false;

    const inject = () => {
      if (cancelled || injected) return;
      document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((node) => node.remove());
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.setAttribute(SCRIPT_MARK, '1');
      document.body.appendChild(script);
      injected = script;
    };

    // Load when near viewport so impression is more likely "viewable".
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          inject();
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );
    observer.observe(root);

    // Fallback if IntersectionObserver never fires (rare).
    const timer = window.setTimeout(inject, 4_000);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      injected?.remove();
    };
  }, [hidden, pathname, variant]);

  if (hidden) return null;

  return (
    <aside
      ref={rootRef}
      className={`relative z-10 mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 ${className}`}
      aria-label="Quảng cáo"
      data-ad-slot={variant}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
          Có thể bạn quan tâm
        </p>
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Ad</span>
      </div>
      <div
        id={CONTAINER_ID}
        className="min-h-[120px] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1 shadow-[0_12px_40px_rgba(0,0,0,.25)]"
      />
    </aside>
  );
}
