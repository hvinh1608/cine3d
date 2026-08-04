'use client';

import { Languages } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const next = locale === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={locale === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
      title={locale === 'vi' ? 'English' : 'Tiếng Việt'}
      className={`${compact ? 'h-9 px-2.5' : 'h-9 px-3'} inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/40 text-[11px] font-black text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-300`}
    >
      <Languages className="h-4 w-4" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
