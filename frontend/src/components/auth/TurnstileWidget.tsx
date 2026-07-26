'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme?: 'light' | 'dark' | 'auto';
    retry?: 'auto' | 'never';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': (errorCode: string) => boolean;
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [scriptReady, setScriptReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile || !containerRef.current || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      retry: 'never',
      callback: (token) => {
        setErrorMessage('');
        onToken(token);
      },
      'expired-callback': () => onToken(''),
      'error-callback': (errorCode) => {
        onToken('');
        setErrorMessage(errorCode === '110200'
          ? 'Xác minh bảo mật chưa được cấp phép cho tên miền này. Vui lòng liên hệ quản trị viên.'
          : 'Không thể tải xác minh bảo mật. Vui lòng tải lại trang và thử lại.');
        return true;
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [onToken, scriptReady]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="flex justify-center" />
      {errorMessage && <p role="alert" className="mt-2 text-center text-xs leading-5 text-red-300">{errorMessage}</p>}
    </>
  );
}
