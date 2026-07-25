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
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((element) => {
        if (observed.has(element) || element.closest('[data-scroll-reveal="off"]')) return;
        observed.add(element);

        const bounds = element.getBoundingClientRect();
        if (bounds.top < viewportHeight * 0.92) {
          return;
        }

        const siblings = element.parentElement
          ? Array.from(element.parentElement.children).filter((child) => child.matches('article'))
          : [];
        const siblingIndex = siblings.indexOf(element);
        const delayStep = siblingIndex >= 0 ? siblingIndex % 6 : 0;
        element.style.setProperty('--scroll-reveal-delay', `${delayStep * 55}ms`);
        element.classList.add(READY_CLASS);
        observer.observe(element);
      });
    };

    register();
    let parallaxFrame = 0;
    const updateParallax = () => {
      parallaxFrame = 0;
      document.querySelectorAll<HTMLElement>('[data-hero-parallax]').forEach((hero) => {
        const bounds = hero.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
        const offset = Math.max(-90, Math.min(90, -bounds.top * 0.14));
        hero.style.setProperty('--hero-parallax-offset', `${offset}px`);
      });
    };
    const requestParallaxUpdate = () => {
      if (parallaxFrame) return;
      parallaxFrame = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
    window.addEventListener('resize', requestParallaxUpdate);

    const mutationObserver = new MutationObserver(register);
    const contentRoot = document.querySelector('body > main') || document.body;
    mutationObserver.observe(contentRoot, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
      window.removeEventListener('scroll', requestParallaxUpdate);
      window.removeEventListener('resize', requestParallaxUpdate);
      if (parallaxFrame) window.cancelAnimationFrame(parallaxFrame);
      cleanupTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
