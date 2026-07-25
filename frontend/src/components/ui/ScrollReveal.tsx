'use client';

import { useEffect } from 'react';

const REVEAL_SELECTOR = 'main section, main article';
const READY_CLASS = 'scroll-reveal-ready';
const VISIBLE_CLASS = 'scroll-reveal-visible';

export default function ScrollReveal() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    const observed = new WeakSet<Element>();
    const cleanupTimers = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(VISIBLE_CLASS);
        observer.unobserve(entry.target);
        const timer = window.setTimeout(() => {
          entry.target.classList.remove(READY_CLASS, VISIBLE_CLASS);
          (entry.target as HTMLElement).style.removeProperty('--scroll-reveal-delay');
          cleanupTimers.delete(timer);
        }, 850);
        cleanupTimers.add(timer);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08,
    });

    const register = () => {
      const viewportHeight = window.innerHeight;
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((element, index) => {
        if (observed.has(element) || element.closest('[data-scroll-reveal="off"]')) return;
        observed.add(element);

        const bounds = element.getBoundingClientRect();
        if (bounds.top < viewportHeight * 0.92) {
          return;
        }

        element.style.setProperty('--scroll-reveal-delay', `${Math.min(index % 4, 3) * 45}ms`);
        element.classList.add(READY_CLASS);
        observer.observe(element);
      });
    };

    register();
    const mutationObserver = new MutationObserver(register);
    const contentRoot = document.querySelector('body > main') || document.body;
    mutationObserver.observe(contentRoot, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
      cleanupTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
