// ═══════════════════════════════════════════════════════════════
// WelcomeOverlay — Fullscreen branded overlay shown during the
// post-login redirect window. Replaces the blank white "flash"
// that occurs when window.location.href causes a full reload.
//
// 12-language safe: uses translation keys only.
// ═══════════════════════════════════════════════════════════════

import { Loader2, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface WelcomeOverlayProps {
  /** Optional display name; if absent, generic welcome is shown. */
  name?: string | null;
  /** Optional avatar URL — falls back to initials, then to icon. */
  avatarUrl?: string | null;
}

function initialsOf(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

export function WelcomeOverlay({ name, avatarUrl }: WelcomeOverlayProps) {
  const { t } = useLanguage();

  const greeting = name
    ? t('auth.welcomeBackUser').replace('{name}', name)
    : t('auth.welcomeBack');

  const initials = initialsOf(name);

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
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/20">
            {avatarUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : initials ? (
              <span className="text-2xl font-semibold text-primary">{initials}</span>
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </span>
          <span className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
