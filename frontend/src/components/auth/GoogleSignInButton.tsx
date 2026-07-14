'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    context?: 'signin' | 'signup' | 'use';
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'filled_black';
      size: 'large';
      shape: 'pill';
      text: 'continue_with';
      width: number;
      logo_alignment: 'left';
    }
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

export default function GoogleSignInButton({
  onCredential,
}: {
  onCredential: (credential: string) => void;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !scriptReady || !buttonRef.current || !window.google) return;

    const parent = buttonRef.current;
    parent.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      context: 'use',
      callback: ({ credential }) => {
        if (credential) callbackRef.current(credential);
      },
    });
    window.google.accounts.id.renderButton(parent, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: Math.min(parent.clientWidth || 320, 360),
      logo_alignment: 'left',
    });
  }, [clientId, scriptReady]);

  if (!clientId) {
    return (
      <p className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-center text-xs text-amber-300">
        Đăng nhập Google đang chờ cấu hình Client ID.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setScriptFailed(true)}
      />
      <div ref={buttonRef} className="flex min-h-11 w-full items-center justify-center overflow-hidden rounded-full" />
      {scriptFailed && (
        <p className="text-center text-xs text-red-400">Không tải được Google. Hãy tắt chặn quảng cáo và thử lại.</p>
      )}
    </div>
  );
}
