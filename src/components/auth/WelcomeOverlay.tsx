// ═══════════════════════════════════════════════════════════════
// WelcomeOverlay — Fullscreen branded overlay shown during the
// post-login redirect window. Replaces the blank white "flash"
// that occurs when window.location.href causes a full reload.
//
// 12-language safe: uses translation keys only.
// ═══════════════════════════════════════════════════════════════

import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface WelcomeOverlayProps {
  /** Optional display name; if absent, generic welcome is shown. */
  name?: string | null;
}

export function WelcomeOverlay({ name }: WelcomeOverlayProps) {
  const { t } = useLanguage();

  const greeting = name
    ? t('auth.welcomeBackUser').replace('{name}', name)
    : t('auth.welcomeBack');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      {/* Soft branded gradient backdrop */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.15), hsl(var(--background)) 65%)',
        }}
      />

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
      >
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </span>
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
            {greeting}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('auth.signingIn')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
