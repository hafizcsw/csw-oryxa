// Canonical domain configuration for Portal
// Prevents lovable domains from appearing in any user-facing context

export const CANONICAL_HOST = 
  (import.meta.env.VITE_CANONICAL_HOST as string) || "cswworld.com";

export const PORTAL_BASE_URL = 
  (import.meta.env.VITE_PORTAL_BASE_URL as string) || "https://cswworld.com";

/**
 * Generate a canonical URL for the portal
 * Always uses the canonical domain, never window.location.origin
 */
export function portalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${PORTAL_BASE_URL}${clean}`;
}

// Pre-defined canonical URLs
export const STUDENT_PORTAL_URL = portalUrl("/account");
export const HOME_URL = portalUrl("/");
