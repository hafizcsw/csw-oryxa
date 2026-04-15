/**
 * PageOperatorShell — Minimal chrome for institution page operators.
 * Replaces the full Layout (GlobalTopBar + Header + Footer) with a
 * slim Facebook-style bar: logo, theme/language toggles, user avatar.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { OperatorHeaderAuth } from '@/components/institution/OperatorHeaderAuth';
import { useTranslation } from 'react-i18next';
import { HeaderMessenger } from '@/components/layout/HeaderMessenger';

interface Props {
  children: ReactNode;
  universityName?: string;
  logoUrl?: string;
  onMessagesClick?: () => void;
}

export function PageOperatorShell({ children, universityName, logoUrl, onMessagesClick }: Props) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Minimal top bar ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/95 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          {/* Left: logo link home */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/logo.svg"
              alt={t('nav.home')}
              className="h-7 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </Link>

          {/* Right: toggles + avatar */}
          <div className="flex items-center gap-1.5">
            <HeaderMessenger onMessagesClick={onMessagesClick} />
            <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/40 px-1.5 py-0.5">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <OperatorHeaderAuth universityName={universityName} logoUrl={logoUrl} />
          </div>
        </div>
      </header>

      {/* ── Page content (toolbar + sidebar + main all render here) ── */}
      {children}
    </div>
  );
}
