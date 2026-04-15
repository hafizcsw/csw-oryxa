import { useEffect } from "react";
import { CANONICAL_HOST } from "@/config/urls";

/**
 * Automatically redirects users from non-canonical domains (e.g., lovableproject.com)
 * to the canonical domain (cswworld.com)
 * 
 * This prevents old links, QR codes, or cached URLs from showing lovable domains
 */
export function CanonicalRedirect() {
  useEffect(() => {
    try {
      const host = window.location.host;
      
      // Skip redirect for localhost (development)
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return;
      }
      
      // Skip redirect for preview/staging hosts (Lovable, Vercel, Netlify, etc.)
      const isPreviewHost = 
        host.includes('lovable.app') ||
        host.includes('lovableproject.com') ||
        host.includes('vercel.app') ||
        host.includes('netlify.app') ||
        host.includes('preview') ||
        host.includes('staging');
      
      if (isPreviewHost) {
        console.log('[CanonicalRedirect] Skipping redirect for preview host:', host);
        return;
      }
      
      // Redirect if not on canonical host
      if (host && host !== CANONICAL_HOST && host !== `www.${CANONICAL_HOST}`) {
        console.log('[CanonicalRedirect] Redirecting from', host, 'to', CANONICAL_HOST);
        const url = new URL(window.location.href);
        url.host = CANONICAL_HOST;
        url.protocol = "https:";
        window.location.replace(url.toString());
      }
    } catch (e) {
      console.error('[CanonicalRedirect] Error:', e);
    }
  }, []);

  return null;
}
