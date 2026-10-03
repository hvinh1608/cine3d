'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const MAX_OVERLAY_MS = 8_000;
const HINT_AFTER_MS = 180;

export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [active, setActive] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pendingRef = useRef(false);
  const startedAtRef = useRef(0);
  const hintTimerRef = useRef<number | null>(null);

  const clearHintTimer = () => {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  };

  const startNavigation = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    startedAtRef.current = Date.now();
    setActive(true);
    setShowHint(false);
    clearHintTimer();
    // Chỉ hiện overlay rõ khi mạng chậm — tránh nháy trên mạng nhanh
    hintTimerRef.current = window.setTimeout(() => setShowHint(true), HINT_AFTER_MS);
  };

  const stopNavigation = () => {
    pendingRef.current = false;
    clearHintTimer();
    setShowHint(false);
    setActive(false);
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      // Đang chuyển trang: chặn click tiếp (tránh spam khi mạng chậm)
      if (pendingRef.current) {
        const link = (event.target as HTMLElement | null)?.closest('a[href]');
        if (link instanceof HTMLAnchorElement) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      const link = (event.target as HTMLElement | null)?.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      if (link.dataset.navIgnore === 'true') return;

      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const nextPath = url.pathname;
      const currentQuery = window.location.search.replace(/^\?/, '');
      const nextQuery = url.search.replace(/^\?/, '');
      if (nextPath === window.location.pathname && nextQuery === currentQuery) return;

      // Mark clicked card if possible (poster/grid feedback)
      const card = link.closest('[data-movie-card], .group');
      document.querySelectorAll('[data-nav-pending="true"]').forEach((el) => {
        el.removeAttribute('data-nav-pending');
      });
      if (card instanceof HTMLElement) {
        card.setAttribute('data-nav-pending', 'true');
      }

      startNavigation();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Route changed → tắt loader
  useEffect(() => {
    if (!pendingRef.current) return;
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, 200 - elapsed);
    const hideTimer = window.setTimeout(() => {
      document.querySelectorAll('[data-nav-pending="true"]').forEach((el) => {
        el.removeAttribute('data-nav-pending');
      });
      stopNavigation();
    }, wait);
    return () => window.clearTimeout(hideTimer);
  }, [routeKey]);

  // Safety timeout
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      document.querySelectorAll('[data-nav-pending="true"]').forEach((el) => {
        el.removeAttribute('data-nav-pending');
      });
      stopNavigation();
    }, MAX_OVERLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => () => clearHintTimer(), []);

  if (!active) return null;

  return (
    <>
      {/* Thanh trên: dày hơn + glow để dễ thấy trên mobile */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[220]"
        role="status"
        aria-live="polite"
        aria-label="Đang tải trang"
      >
        <div className="h-1 w-full overflow-hidden bg-black/40 shadow-[0_0_12px_rgba(251,191,36,.35)] sm:h-[3px]">
          <div className="nav-progress h-full rounded-full bg-gradient-to-r from-red-500 via-amber-300 to-red-500" />
        </div>
      </div>

      {/* Overlay chặn ấn liên tục + hint khi mạng chậm */}
      {showHint && (
        <div
          className="fixed inset-0 z-[215] flex items-end justify-center bg-black/35 px-4 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-white/15 bg-[#171820]/95 px-4 py-3 shadow-2xl">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-300" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Đang mở phim…</p>
              <p className="text-[11px] text-slate-400">Mạng hơi chậm — vui lòng đợi, đừng ấn lại.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .nav-progress {
          width: 34%;
          animation: cine-nav-progress 1s cubic-bezier(.4, 0, .2, 1) infinite;
        }
        @keyframes cine-nav-progress {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(380%); }
        }
        [data-nav-pending='true'] {
          outline: 2px solid rgba(251, 191, 36, 0.85);
          outline-offset: 2px;
          filter: brightness(1.08);
          pointer-events: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-progress {
            animation: none;
            width: 100%;
            opacity: 0.85;
          }
        }
      `}</style>
    </>
  );
}
