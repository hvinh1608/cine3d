'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

type FacebookLoginResponse = { authResponse?: { accessToken?: string }; status?: string };
type FacebookSdk = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string; return_scopes: boolean }) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

export default function FacebookSignInButton({ onAccessToken }: { onAccessToken: (token: string) => void }) {
  const enabled = process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED === 'true';
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const apiVersion = process.env.NEXT_PUBLIC_FACEBOOK_API_VERSION || 'v24.0';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const initialize = () => {
    if (!appId || !window.FB) return;
    window.FB.init({ appId, cookie: true, xfbml: false, version: apiVersion });
    setReady(true);
  };

  useEffect(() => {
    if (window.FB) queueMicrotask(initialize);
  // Initialization must also run from the SDK script callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, apiVersion]);

  if (!enabled || !appId) return null;

  return (
    <div className="space-y-2">
      <Script src="https://connect.facebook.net/vi_VN/sdk.js" strategy="afterInteractive" onLoad={initialize} onError={() => setFailed(true)} />
      <button
        type="button"
        disabled={!ready}
        onClick={() => window.FB?.login((response) => {
          const token = response.authResponse?.accessToken;
          if (token) onAccessToken(token);
        }, { scope: 'public_profile,email', return_scopes: true })}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-[#1877f2] px-5 text-sm font-bold text-white transition hover:bg-[#166fe5] disabled:cursor-wait disabled:opacity-60"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-lg font-black leading-none text-[#1877f2]">f</span>
        Tiếp tục với Facebook
      </button>
      {failed && <p className="text-center text-xs text-red-400">Không tải được Facebook SDK. Hãy kiểm tra trình chặn quảng cáo rồi thử lại.</p>}
    </div>
  );
}
