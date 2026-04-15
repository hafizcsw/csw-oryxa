/**
 * ============= Program to Shortlist Snapshot =============
 * SINGLE SOURCE OF TRUTH for building shortlist snapshots.
 * 
 * This function must be used EVERYWHERE when adding a program to shortlist:
 * - ProgramCard
 * - Universities search results
 * - Any other program listing
 * 
 * Contract: Snapshot must include all fields needed for:
 * 1. Displaying in shortlist UI
 * 2. CRM sync
 * 3. Application flow
 */

export interface ShortlistProgramSnapshot {
  // Required identifiers
  program_id: string;
  program_ref_id?: string; // For CRM compatibility
  
  // Program info (localized)
  program_name: string;
  program_name_ar?: string;
  program_name_en?: string;
  
  // University info
  university_id?: string;
  university_name: string;
  university_name_ar?: string;
  university_name_en?: string;
  university_logo?: string;
  
  // Location
  country_code?: string;
  country_slug?: string;
  country_name?: string;
  country_name_ar?: string;
  country_name_en?: string;
  city?: string;
  
  // Academic info
  degree_slug?: string;
  degree_name?: string;
  degree_name_ar?: string;
  degree_name_en?: string;
  discipline_slug?: string;
  discipline_name?: string;
  discipline_name_ar?: string;
  discipline_name_en?: string;
  
  // Tuition
  tuition_usd_year_min?: number;
  tuition_usd_year_max?: number;
  fees_yearly?: number; // Legacy alias
  tuition_is_free?: boolean;
  currency_code?: string;
  
  // Duration & language
  duration_months?: number;
  instruction_languages?: string[];
  language?: string; // Single language fallback
  
  // URLs
  portal_url?: string;
}

/**
 * Normalize any program object to a consistent shortlist snapshot.
 * Handles various field naming conventions from different sources.
 */
export function programToShortlistSnapshot(program: Record<string, any>): ShortlistProgramSnapshot {
  const programId = program.program_id || program.id;
  
  // Extract program name (prioritize explicit localized fields)
  const programName = program.program_name 
    || program.program_name_ar 
    || program.program_name_en 
    || program.title 
    || program.name 
    || '';

  // Extract university name
  const universityName = program.university_name 
    || program.university_name_ar 
    || program.university_name_en 
    || '';

  // Extract country name
  const countryName = program.country_name 
    || program.country_name_ar 
    || program.country_name_en 
    || program.country 
    || '';

  // Extract degree name
  const degreeName = program.degree_name 
    || program.degree_name_ar 
    || program.degree_name_en 
    || program.degree_slug 
    || program.degree_level
    || '';

  // Extract tuition (normalize various field names)
  const tuitionYearMin = program.tuition_usd_year_min 
    || program.tuition_usd_min 
    || program.fees_yearly 
    || program.annual_fees 
    || program.tuition_yearly
    || program.tuition_usd
    || null;

  const tuitionYearMax = program.tuition_usd_year_max 
    || program.tuition_usd_max 
    || tuitionYearMin;

  // Extract instruction languages
  let instructionLanguages: string[] = [];
  if (Array.isArray(program.instruction_languages)) {
    instructionLanguages = program.instruction_languages;
  } else if (Array.isArray(program.languages)) {
    instructionLanguages = program.languages;
  } else if (program.language) {
    instructionLanguages = [program.language];
  }

  return {
    // Identifiers
    program_id: programId,
    program_ref_id: programId,
    
    // Program info
    program_name: programName,
    program_name_ar: program.program_name_ar,
    program_name_en: program.program_name_en || programName,
    
    // University info
    university_id: program.university_id,
    university_name: universityName,
    university_name_ar: program.university_name_ar,
    university_name_en: program.university_name_en || universityName,
    university_logo: program.university_logo || program.logo_url || program.university_logo_url,
    
    // Location
    country_code: program.country_code || program.country_slug,
    country_slug: program.country_slug || program.country_code,
    country_name: countryName,
    country_name_ar: program.country_name_ar,
    country_name_en: program.country_name_en || countryName,
    city: program.city,
    
    // Academic
    degree_slug: program.degree_slug || program.degree_level || program.degree_id,
    degree_name: degreeName,
    degree_name_ar: program.degree_name_ar,
    degree_name_en: program.degree_name_en || degreeName,
    discipline_slug: program.discipline_slug || program.subject_slug,
    discipline_name: program.discipline_name || program.discipline_name_ar || program.discipline_name_en,
    discipline_name_ar: program.discipline_name_ar,
    discipline_name_en: program.discipline_name_en,
    
    // Tuition
    tuition_usd_year_min: tuitionYearMin,
    tuition_usd_year_max: tuitionYearMax,
    fees_yearly: tuitionYearMin, // Legacy alias
    tuition_is_free: program.tuition_is_free || tuitionYearMin === 0,
    currency_code: program.currency_code || 'USD',
    
    // Duration & language
    duration_months: program.duration_months,
    instruction_languages: instructionLanguages,
    language: instructionLanguages[0] || program.language,
    
    // URLs
    portal_url: program.portal_url || `/program/${programId}`,
  };
}

/**
 * Get display-friendly data from a snapshot for UI rendering.
 */
export function getSnapshotDisplayData(snapshot: ShortlistProgramSnapshot, locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';
  
  return {
    programName: isArabic 
      ? (snapshot.program_name_ar || snapshot.program_name_en || snapshot.program_name)
      : (snapshot.program_name_en || snapshot.program_name_ar || snapshot.program_name),
    
    universityName: isArabic
      ? (snapshot.university_name_ar || snapshot.university_name_en || snapshot.university_name)
      : (snapshot.university_name_en || snapshot.university_name_ar || snapshot.university_name),
    
    countryName: isArabic
      ? (snapshot.country_name_ar || snapshot.country_name_en || snapshot.country_name)
      : (snapshot.country_name_en || snapshot.country_name_ar || snapshot.country_name),
    
    degreeName: isArabic
      ? (snapshot.degree_name_ar || snapshot.degree_name_en || snapshot.degree_name)
      : (snapshot.degree_name_en || snapshot.degree_name_ar || snapshot.degree_name),
    
    tuitionDisplay: snapshot.tuition_is_free 
      ? (isArabic ? 'مجاني' : 'Free')
      : snapshot.tuition_usd_year_min 
        ? `$${snapshot.tuition_usd_year_min.toLocaleString()}/year`
        : null,
    
    languagesDisplay: snapshot.instruction_languages?.join(' • ') || snapshot.language || null,
    
    durationDisplay: snapshot.duration_months 
      ? `${Math.round(snapshot.duration_months / 12 * 10) / 10} ${isArabic ? 'سنة' : 'years'}`
      : null,
  };
}
