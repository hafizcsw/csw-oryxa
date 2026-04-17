// ═══════════════════════════════════════════════════════════════
// WelcomeTransition — Route-level post-login bridge.
//
// Mounted ONCE above <Routes/> in App.tsx. Survives client-side
// navigation (we no longer use window.location.href for internal
// post-login paths), so it can cover the brief mounting time of
// the destination route without any white flash.
//
// Hide condition (BOTH must be true):
//   • minimum visible duration elapsed (prevents flash-in/flash-out)
//   • identity-ready signal for the welcome target kind:
//       - student     : supabase session is present
//       - staff       : staff_authority_persistent_v3 cache populated
//       - institution : on /institution/* OR /university/* path
//       - generic     : session present
//
// 12-language safe. No hardcoded visible strings.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { WelcomeOverlay } from './WelcomeOverlay';
import {
  readWelcomePending,
  clearWelcomePending,
  clearWelcomeRouted,
  type WelcomePendingPayload,
} from '@/lib/welcomeTransition';

const MIN_VISIBLE_MS = 600;
const MAX_VISIBLE_MS = 6000; // hard ceiling so we never stick

function isStaffReady(): boolean {
  try {
    const raw = localStorage.getItem('staff_authority_persistent_v3');
    if (!raw) return false;
    const cached = JSON.parse(raw);
    return Boolean(cached?.role);
  } catch {
    return false;
  }
}

function isInstitutionReady(pathname: string): boolean {
  return (
    pathname.startsWith('/institution/') ||
    pathname.startsWith('/university/')
  );
}

export function WelcomeTransition() {
  const { pathname } = useLocation();
  const [pending, setPending] = useState<WelcomePendingPayload | null>(() =>
    readWelcomePending(),
  );
  const [sessionReady, setSessionReady] = useState<boolean>(false);
  const [staffReady, setStaffReady] = useState<boolean>(() => isStaffReady());
  const startedAtRef = useRef<number>(pending?.startedAt ?? Date.now());

  // Track Supabase session readiness (student / generic identity-ready signal).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSessionReady(Boolean(session));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionReady(Boolean(session));
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Poll the staff persistent cache every 250ms while waiting (cheap, sync read).
  useEffect(() => {
    if (!pending || pending.target !== 'staff') return;
    if (staffReady) return;
    const id = window.setInterval(() => {
      if (isStaffReady()) {
        setStaffReady(true);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [pending, staffReady]);

  // Decide when to hide.
  useEffect(() => {
    if (!pending) return;

    const evaluate = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const minMet = elapsed >= MIN_VISIBLE_MS;

      let identityReady = false;
      switch (pending.target) {
        case 'staff':
          identityReady = sessionReady && (staffReady || isStaffReady());
          break;
        case 'institution':
          identityReady = sessionReady && isInstitutionReady(pathname);
          break;
        case 'student':
        case 'generic':
        default:
          identityReady = sessionReady;
          break;
      }

      // Hard ceiling escape hatch.
      const overCeiling = elapsed >= MAX_VISIBLE_MS;

      if ((minMet && identityReady) || overCeiling) {
        clearWelcomePending();
        clearWelcomeRouted();
        setPending(null);
      }
    };

    evaluate();
    const id = window.setInterval(evaluate, 100);
    return () => window.clearInterval(id);
  }, [pending, sessionReady, staffReady, pathname]);

  return (
    <AnimatePresence>
      {pending && (
        <WelcomeOverlay key="welcome" name={pending.name} />
      )}
    </AnimatePresence>
  );
}
