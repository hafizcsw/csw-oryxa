/**
 * ✅ EXEC ORDER: Program Reference Contract
 * Ensures program identity is never lost (prevents "برنامج غير معروف")
 */

export interface ProgramRef {
  source: 'portal_catalog';
  id: string;
  version?: string;
  snapshot: {
    program_name: string | null;
    program_name_ar?: string | null;
    university_name: string | null;
    university_name_ar?: string | null;
    country_code: string | null;
    country_name?: string | null;
    city?: string | null;
    degree?: string | null;
    degree_slug?: string | null;
    lang?: string | null;
    tuition?: number | null;
    duration?: number | null;
    portal_url?: string | null;
    university_logo?: string | null;
  };
}

/**
 * Build a program_ref from available program data
 * This ensures we always have a snapshot even if CRM can't resolve the ID
 */
export function buildProgramRef(program: {
  program_id?: string;
  id?: string;
  program_name?: string;
  program_name_ar?: string;
  name?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
  country_code?: string;
  country_name?: string;
  country_slug?: string;
  city?: string;
  degree_name?: string;
  degree_slug?: string;
  language?: string;
  languages?: string[];
  fees_yearly?: number;
  tuition_usd_min?: number;
  duration_months?: number;
  program_slug?: string;
  slug?: string;
}): ProgramRef {
  const programId = program.program_id || program.id || '';
  const programName = program.program_name || program.name || null;
  const slug = program.program_slug || program.slug;
  
  // Build portal URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://lavista-launchpad.lovable.app';
  const portalUrl = slug ? `${baseUrl}/programs/${slug}` : null;
  
  return {
    source: 'portal_catalog',
    id: programId,
    snapshot: {
      program_name: programName,
      program_name_ar: program.program_name_ar || null,
      university_name: program.university_name || null,
      university_name_ar: program.university_name_ar || null,
      country_code: program.country_code || program.country_slug || null,
      country_name: program.country_name || null,
      city: program.city || null,
      degree: program.degree_name || null,
      degree_slug: program.degree_slug || null,
      lang: program.language || (program.languages?.[0]) || null,
      tuition: program.fees_yearly || program.tuition_usd_min || null,
      duration: program.duration_months || null,
      portal_url: portalUrl,
      university_logo: program.university_logo || null,
    },
  };
}

/**
 * Validate that a program_ref has minimum required data
 */
export function isValidProgramRef(ref: ProgramRef | null | undefined): boolean {
  if (!ref?.id || !ref?.snapshot) return false;
  
  const s = ref.snapshot;
  // Must have at least one name
  const hasName = !!(s.program_name || s.program_name_ar);
  // Must have at least one university name
  const hasUni = !!(s.university_name || s.university_name_ar);
  
  return hasName && hasUni;
}

/**
 * Get display name from program_ref (Arabic preferred)
 */
export function getProgramRefDisplayName(ref: ProgramRef): string {
  return ref.snapshot.program_name_ar || ref.snapshot.program_name || 'برنامج غير معروف';
}

/**
 * Get university display name from program_ref (Arabic preferred)
 */
export function getProgramRefUniversityName(ref: ProgramRef): string {
  return ref.snapshot.university_name_ar || ref.snapshot.university_name || 'جامعة غير معروفة';
}
