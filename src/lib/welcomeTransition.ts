/**
 * welcomeTransition — shared signaling for the route-level welcome layer.
 *
 * Why this exists:
 *   The post-login redirect was implemented via window.location.href, which
 *   unmounts React and produces a long white flash + cold restart. We now use
 *   client-side navigation (navigate(..., { replace: true })). Because React
 *   never unmounts, a single <WelcomeTransition /> mounted above <Routes/>
 *   can survive the navigation and bridge the visual gap until the
 *   destination route is identity-ready.
 *
 * Flow:
 *   1) Auth entry (AuthFormCard / AuthStartModal) calls markWelcomePending()
 *      with the user's display name and the resolved target kind, then
 *      navigates client-side.
 *   2) <WelcomeTransition /> reads the flag, shows the overlay (avatar +
 *      "Welcome back, {name}" + "Signing you in..."), and waits for BOTH
 *        (a) a minimum visible duration, and
 *        (b) an identity-ready signal for that target kind.
 *   3) Once both are satisfied, it clears the flag and fades out.
 *
 * Internal-only target paths use SPA navigation. External absolute URLs
 * still use window.location.href (rare; only if the resolver returns one).
 *
 * 12-language safe: this module owns no visible strings.
 */

export type WelcomeTargetKind = 'student' | 'staff' | 'institution' | 'generic';

export interface WelcomePendingPayload {
  name: string | null;
  target: WelcomeTargetKind;
  /** ms epoch — used as min-duration anchor */
  startedAt: number;
}

const KEY = 'welcome_pending_v1';

/** True if the URL is a real external absolute URL (http/https + different origin). */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function markWelcomePending(
  name: string | null | undefined,
  target: WelcomeTargetKind,
): void {
  try {
    const payload: WelcomePendingPayload = {
      name: (name && name.trim()) || null,
      target,
      startedAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
    // Also block the App.tsx auth listener from issuing a parallel redirect
    // for the same login event — see App.tsx auth listener guard.
    sessionStorage.setItem('welcome_routed_once', '1');
  } catch {
    // ignore — overlay simply won't show
  }
}

export function readWelcomePending(): WelcomePendingPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WelcomePendingPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWelcomePending(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** True if a sibling entry (AuthFormCard/AuthStartModal) already started a welcome flow. */
export function welcomeAlreadyRouted(): boolean {
  try {
    return sessionStorage.getItem('welcome_routed_once') === '1';
  } catch {
    return false;
  }
}

export function clearWelcomeRouted(): void {
  try {
    sessionStorage.removeItem('welcome_routed_once');
  } catch {
    /* noop */
  }
}
