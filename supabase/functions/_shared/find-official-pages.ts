// Find official fee and admissions pages for any country

import {
  collectLinksFromSitemapAndAnchors,
  sameSite,
  pageHasNumbersCurrency,
  pageMentionsAdmission,
  buildMatchers
} from "./extract-utils.ts";
import type { CountryProfile } from "./country-profiles.ts";

export interface OfficialPagesResult {
  feeUrl: string | null;
  admissionsUrl: string | null;
  reason?: string;
  evidence?: {
    feePages: string[];
    admPages: string[];
    sitemap: boolean;
    anchorsCount: number;
  };
}

/**
 * Find official pages for fees and admissions
 * Uses sitemap + anchor crawling + content verification
 */
export async function findOfficialPages(
  homeUrl: string,
  profile: CountryProfile
): Promise<OfficialPagesResult> {
  console.log(`[find-official] Starting for ${homeUrl} (${profile.name})`);
  
  try {
    // Collect all candidate links
    const links = await collectLinksFromSitemapAndAnchors(homeUrl);
    console.log(`[find-official] Found ${links.length} candidate links`);
    
    const M = buildMatchers({
      fee_terms: profile.feeTerms,
      admission_terms: profile.admissionTerms,
      scholarship_terms: profile.scholarshipTerms
    });
    
    // Filter to same-site links only
    const sameStieLinks = links.filter(u => sameSite(u, homeUrl));
    console.log(`[find-official] ${sameStieLinks.length} same-site links`);
    
    // Use country-specific URL hints if available, otherwise fallback to generic patterns
    const feeUrlPattern = profile.urlHintsFee?.length 
      ? new RegExp(profile.urlHintsFee.join("|"), "i")
      : /fee|tuition|funding|cost|finance/i;
    const admUrlPattern = profile.urlHintsAdm?.length
      ? new RegExp(profile.urlHintsAdm.join("|"), "i")
      : /admi|entry\-requirements|apply|application/i;
    
    const feeCandidates = sameStieLinks.filter(u => feeUrlPattern.test(u) || M.fee.test(u));
    const admCandidates = sameStieLinks.filter(u => admUrlPattern.test(u) || M.adm.test(u));
    
    console.log(`[find-official] Fee candidates: ${feeCandidates.length}, Adm candidates: ${admCandidates.length}`);
    
    // Find best fee page (verify with content)
    let feeUrl: string | null = null;
    for (const candidate of feeCandidates.slice(0, 5)) {
      const hasContent = await pageHasNumbersCurrency(candidate, profile.currency, {
        renderIfTiny: true
      });
      
      if (hasContent) {
        feeUrl = candidate;
        console.log(`[find-official] ✓ Found fee page: ${feeUrl}`);
        break;
      }
    }
    
    // Find best admission page (verify with content)
    let admUrl: string | null = null;
    for (const candidate of admCandidates.slice(0, 5)) {
      const hasContent = await pageMentionsAdmission(candidate, M, {
        renderIfTiny: true
      });
      
      if (hasContent) {
        admUrl = candidate;
        console.log(`[find-official] ✓ Found admissions page: ${admUrl}`);
        break;
      }
    }
    
    // Determine reason if not found
    let reason: string | undefined;
    if (!feeUrl && !admUrl) {
      reason = sameStieLinks.length === 0 ? "no_same_site_links" : "no_verified_pages";
    } else if (!feeUrl) {
      reason = "no_fee_page";
    } else if (!admUrl) {
      reason = "no_admissions_page";
    }
    
    return {
      feeUrl,
      admissionsUrl: admUrl,
      reason,
      evidence: {
        feePages: feeCandidates.slice(0, 3),
        admPages: admCandidates.slice(0, 3),
        sitemap: links.length > sameStieLinks.length,
        anchorsCount: sameStieLinks.length
      }
    };
  } catch (error) {
    console.error(`[find-official] Error for ${homeUrl}:`, error);
    return {
      feeUrl: null,
      admissionsUrl: null,
      reason: `error: ${String(error).slice(0, 100)}`
    };
  }
}
