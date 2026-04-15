// URL utilities for domain normalization and comparison

/**
 * Normalize a UniRanks profile URL to the canonical format:
 *   https://www.uniranks.com/universities/<slug>
 *
 * Handles known bad formats:
 *   /en/university/<slug>  →  /universities/<slug>
 *   /ar/university/<slug>  →  /universities/<slug>
 *   /university/<slug>     →  /universities/<slug>
 *
 * Returns the original URL if it doesn't match any known bad pattern.
 */
export function normalizeUniranksProfileUrl(url: string): string {
  if (!url) return url;
  // Match /en/university/, /ar/university/, or just /university/ (without 's')
  const rewritten = url.replace(
    /\/(?:[a-z]{2}\/)?university\//i,
    '/universities/'
  );
  return rewritten;
}

/**
 * Extract eTLD+1 (effective top-level domain + 1)
 * Examples:
 *   www.lse.ac.uk -> lse.ac.uk
 *   subdomain.example.com -> example.com
 *   www.example.co.uk -> example.co.uk
 */
export function extractETLD1(urlOrHostname: string): string {
  try {
    let hostname: string;
    
    // Try to parse as URL first
    if (urlOrHostname.includes('://')) {
      hostname = new URL(urlOrHostname).hostname;
    } else {
      hostname = urlOrHostname;
    }
    
    // Remove www. prefix
    hostname = hostname.replace(/^www\./i, '');
    
    // Split by dots
    const parts = hostname.split('.');
    
    // Handle two-part TLDs (co.uk, ac.uk, edu.au, etc.)
    const twoPartTLDs = [
      'ac.uk', 'co.uk', 'org.uk', 'gov.uk',
      'edu.au', 'gov.au', 'org.au', 'com.au',
      'co.za', 'org.za', 'gov.za',
      'co.jp', 'or.jp', 'ac.jp'
    ];
    
    if (parts.length >= 3) {
      const lastTwo = parts.slice(-2).join('.');
      if (twoPartTLDs.includes(lastTwo)) {
        // Return domain + two-part TLD
        return parts.slice(-3).join('.');
      }
    }
    
    // Return domain + TLD
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    
    return hostname;
  } catch (e) {
    console.error('[url-utils] Error extracting eTLD+1:', e);
    return urlOrHostname;
  }
}

/**
 * Check if two URLs are on the same site (same eTLD+1)
 */
export function sameSite(url1: string, url2: string): boolean {
  return extractETLD1(url1) === extractETLD1(url2);
}

/**
 * Normalize URL for comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slashes
    u.pathname = u.pathname.replace(/\/+$/, '');
    // Sort query params
    u.search = '';
    // Remove fragment
    u.hash = '';
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Check if URL matches any of the patterns
 */
export function urlMatchesAny(url: string, patterns: (string | RegExp)[]): boolean {
  const lowerUrl = url.toLowerCase();
  
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return lowerUrl.includes(pattern.toLowerCase());
    }
    return pattern.test(url);
  });
}
