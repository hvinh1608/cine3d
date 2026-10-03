'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';
import api from '@/lib/api';
import { withUtm } from '@/lib/utm';

export default function SharePhimMoiButton({ siteUrl }: { siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = withUtm(`${siteUrl}/phim-moi`, {
      source: 'share',
      medium: 'user',
      campaign: 'phim_moi',
    });
    try {
      void api.post('/analytics/events', {
        name: 'share_click',
        path: '/phim-moi',
        metadata: { utm_source: 'share', utm_medium: 'user', utm_campaign: 'phim_moi' },
      }).catch(() => undefined);
      if (navigator.share) await navigator.share({ title: 'Phim mới trên CINE3D', url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/30 hover:text-amber-200"
    >
      <Share2 className="h-3.5 w-3.5" /> {copied ? 'Đã sao chép' : 'Chia sẻ'}
    </button>
  );
}
