/**
 * Program Snapshot - البيانات المطلوبة من Portal KB لـ CRM
 * يجب أن تأتي من UI مباشرة (لا enrichment لاحق)
 * 
 * ✅ Contract V3 - مطابق لـ CRM View expectations:
 * - country_name_en/ar + country_code (بدل country)
 * - tuition_usd_min/max (بدل tuition_year)
 * - portal_url (مطلوب - للموظف)
 */
export interface ProgramSnapshot {
  program_ref_id: string;         // Portal KB UUID
  program_slug?: string | null;   // For URL building
  snapshot: {
    // Program
    program_name_en?: string | null;
    program_name_ar?: string | null;
    
    // University
    university_name_en?: string | null;
    university_name_ar?: string | null;
    university_logo?: string | null;
    
    // Country - CRM expects all three
    country_name_en?: string | null;
    country_name_ar?: string | null;
    country_code?: string | null;
    
    // Degree
    degree_level?: string | null;
    language?: string | null;
    duration_months?: number | null;
    
    // Tuition - CRM expects min/max in USD
    tuition_usd_min?: number | null;
    tuition_usd_max?: number | null;
    
    // Portal URL - REQUIRED for CRM staff to open in Portal
    portal_url: string;
    
    // City (optional)
    city?: string | null;
    
    // Flag for rejected items
    missing_in_catalog?: boolean;
  };
}

/**
 * Shortlist Sync Request - ما يرسله Portal للـ Edge Function
 */
export interface ShortlistSyncRequest {
  items: ProgramSnapshot[];
  source: string;
}

/**
 * Shortlist Sync Response - ما يرجعه Edge Function
 */
export interface ShortlistSyncResponse {
  ok: boolean;
  synced_to_crm: boolean;
  stored_count: number;
  rejected_items?: {
    program_ref_id: string;
    reason: string;
  }[];
  request_id?: string;
  error?: string;
  error_code?: string;
}

/**
 * Helper: Get Portal base URL for building portal_url
 */
function getPortalBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://portal.example.com'; // Fallback for SSR
}

/**
 * Helper: Build snapshot from program data in UI
 * 
 * @param program - Program data from UI (vw_program_search or ProgramCard)
 * @returns ProgramSnapshot with CRM-compatible field names
 */
export function buildProgramSnapshot(program: {
  program_id: string;
  program_name?: string;
  program_name_ar?: string;
  program_slug?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
  country_name?: string;
  country_name_ar?: string;
  country_code?: string;
  country_slug?: string;
  degree_name?: string;
  degree_slug?: string;
  language?: string;
  duration_months?: number | null;
  fees_yearly?: number | null;
  tuition_usd_min?: number | null;
  tuition_usd_max?: number | null;
  city?: string | null;
}): ProgramSnapshot {
  // Build portal_url from program slug or ID
  const baseUrl = getPortalBaseUrl();
  const programPath = program.program_slug || program.program_id;
  const portal_url = `${baseUrl}/program/${programPath}`;
  
  // Derive tuition values
  const tuitionMin = program.tuition_usd_min ?? program.fees_yearly ?? null;
  const tuitionMax = program.tuition_usd_max ?? program.fees_yearly ?? null;
  
  return {
    program_ref_id: program.program_id,
    program_slug: program.program_slug ?? null,
    snapshot: {
      // Program names - EN required, AR optional
      program_name_en: program.program_name || null,
      program_name_ar: program.program_name_ar || program.program_name || null,
      
      // University names
      university_name_en: program.university_name || null,
      university_name_ar: program.university_name_ar || program.university_name || null,
      university_logo: program.university_logo ?? null,
      
      // Country - all three for CRM
      country_name_en: program.country_name || null,
      country_name_ar: program.country_name_ar || program.country_name || null,
      country_code: program.country_code || program.country_slug?.toUpperCase() || null,
      
      // Degree & Language
      degree_level: program.degree_name ?? null,
      language: program.language ?? null,
      duration_months: program.duration_months ?? null,
      
      // Tuition - min/max in USD
      tuition_usd_min: tuitionMin,
      tuition_usd_max: tuitionMax,
      
      // Portal URL - REQUIRED
      portal_url,
      
      // City
      city: program.city ?? null,
    }
  };
}
