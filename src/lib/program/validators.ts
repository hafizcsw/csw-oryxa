/**
 * Unified Program Validation & Adapter
 * 
 * Single source of truth for:
 * 1. Mapping program_id → id (API compatibility)
 * 2. Validating program data completeness
 * 
 * Used by: SearchResultsPanel, ChatSuggestedProgramsSection, and all program panels
 */

import { University } from '@/types/chat';
import { COUNTRY_NAMES } from '@/data/countryTranslations';
import { resolveCountrySlugByName } from '@/lib/country/resolveCountrySlugByName';

// NOTE: For security, we intentionally do NOT expose backend URLs in user-facing UI.
// We instead show a stable short signature that allows environment parity checks.
function stableHash8(input: string): string {
  // djb2
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  // unsigned hex
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}


function toEnglishCountryName(name?: string | null, code?: string | null): string | null {
  if (!name) return null;
  const slug = (code || resolveCountrySlugByName(name) || '').toLowerCase();
  return (slug && COUNTRY_NAMES[slug]?.en) || name;
}
/**
 * Extract the canonical program identifier
 * Priority: program_id > program_ref_id > id
 * 
 * ⚠️ CRITICAL: `id` may be university_id in some contexts, so prioritize program_id
 */
export function getProgramId(item: University | Record<string, any>): string {
  return item.program_id || item.program_ref_id || item.id || '';
}

/**
 * Extract university ID (separate from program ID)
 */
export function getUniversityId(item: University | Record<string, any>): string {
  return item.university_id || item.id || '';
}

/**
 * Validate if a program item has required data for display
 * 
 * Requirements:
 * 1. Has a valid program_id OR id
 * 2. Has at least one name field (program or university)
 */
export function isValidProgram(item: University | Record<string, any> | null | undefined): boolean {
  if (!item) return false;
  
  // Must have an identifier
  const hasId = !!(item.program_id || item.program_ref_id || item.id);
  if (!hasId) return false;
  
  // Must have at least one displayable name
  const hasName = !!(
    item.program_name_ar || 
    item.program_name_en || 
    item.program_name ||
    item.university_name_ar || 
    item.university_name_en || 
    item.university_name
  );
  
  return hasName;
}

/**
 * Filter and validate an array of programs
 * Returns only valid programs with proper identifiers
 */
export function filterValidPrograms<T extends University | Record<string, any>>(
  items: T[] | null | undefined
): T[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter(isValidProgram);
}

/**
 * Normalize program data by ensuring `id` field exists
 * Maps program_id → id for components expecting `id`
 */
export function normalizeProgram<T extends University | Record<string, any>>(item: T): T & { id: string; program_id: string } {
  const programId = getProgramId(item);
  return {
    ...item,
    id: programId,
    program_id: programId, // Ensure both exist
  } as T & { id: string; program_id: string };
}

/**
 * Normalize an array of programs
 */
export function normalizePrograms<T extends University | Record<string, any>>(
  items: T[] | null | undefined
): (T & { id: string; program_id: string })[] {
  return filterValidPrograms(items).map(normalizeProgram);
}

/**
 * Build display-ready program info from raw data
 */
export function getProgramDisplayInfo(item: University | Record<string, any>) {
  const i = item as Record<string, any>;
  return {
    programId: getProgramId(i),
    universityId: getUniversityId(i),
    programName: i.program_name_en || i.program_name || i.program_name_ar || 'Unknown program',
    universityName: i.university_name_en || i.university_name || i.university_name_ar || 'Unknown university',
    countryName: i.country_name_en || toEnglishCountryName(i.country_name || i.country_name_ar || i.country, i.country_code) || 'Unknown',
    countryNameAr: i.country_name_ar || i.country_name || i.country_name_en || i.country || 'غير محدد',
    countryNameEn: i.country_name_en || toEnglishCountryName(i.country_name || i.country_name_ar || i.country, i.country_code) || 'Unknown',
    countryCode: i.country_code || '',
    fees: i.tuition_max || i.tuition_min || i.tuition_usd || 0,
    duration: i.duration_months || 0,
    language: i.language || 'English',
    logoUrl: i.logo_url || i.university_logo || '',
    degreeLevel: i.degree_level || i.degree || '',
    currencyCode: i.currency_code || i.currency || null,
  };
}

// Build ID for environment verification
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 
  `dev_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

export const DEPLOY_TARGET = import.meta.env.VITE_DEPLOY_TARGET || 'preview';

// UX mode for “Golden UX” verification (override per environment)
export const UX_MODE = (import.meta.env.VITE_UX_MODE as string) || 'ORYXA_CHAT_V1';

const RAW_FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';

// Expose only a signature to avoid leaking backend URL.
export const FUNCTIONS_BASE = RAW_FUNCTIONS_BASE
  ? `/functions/v1#${stableHash8(RAW_FUNCTIONS_BASE)}`
  : 'unknown';
