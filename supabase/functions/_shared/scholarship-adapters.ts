// Adapters للمنح الدراسية من 5 مصادر عالمية
import { computeHash } from "./tuition-extractor.ts";

export interface ScholarshipQuery {
  country_code?: string;
  study_level?: string;
  field?: string;
  limit?: number;
}

export interface ScholarshipData {
  source_name: string;
  title: string;
  provider: string;
  country_code?: string;
  university_id?: string;
  study_level?: string;
  coverage: any;
  amount_type?: string;
  amount_value?: number;
  currency?: string;
  deadline_date?: string;
  link: string;
  eligibility?: any;
  academic_year?: string;
}

/**
 * Chevening Scholarships (UK)
 * https://www.chevening.org/
 */
export async function harvestChevening(
  query: ScholarshipQuery
): Promise<ScholarshipData[]> {
  console.log("[chevening] Harvesting...");

  // في التنفيذ الفعلي: scrape أو API
  // للتبسيط نرجع مثال واحد
  const results: ScholarshipData[] = [];

  // مثال توضيحي
  if (!query.country_code || query.country_code === "GB") {
    results.push({
      source_name: "chevening",
      title: "Chevening Scholarships 2025/26",
      provider: "UK Foreign, Commonwealth & Development Office",
      country_code: "GB",
      study_level: "pg",
      coverage: {
        tuition: true,
        stipend: true,
        travel: true,
        visa: true
      },
      amount_type: "full",
      link: "https://www.chevening.org/scholarships/",
      eligibility: {
        nationalities: ["all_except_uk"],
        work_experience_years: 2,
        degree_required: "bachelor"
      },
      academic_year: "2025/26"
    });
  }

  return results;
}

/**
 * DAAD Scholarships (Germany)
 * https://www.daad.de/
 */
export async function harvestDAAD(
  query: ScholarshipQuery
): Promise<ScholarshipData[]> {
  console.log("[daad] Harvesting...");

  const results: ScholarshipData[]  = [];

  // مثال توضيحي
  if (!query.country_code || query.country_code === "DE") {
    results.push({
      source_name: "daad",
      title: "DAAD Study Scholarships for Foreign Graduates",
      provider: "German Academic Exchange Service (DAAD)",
      country_code: "DE",
      study_level: "pg",
      coverage: {
        tuition: false,
        stipend: true,
        travel: true,
        health_insurance: true
      },
      amount_type: "monthly",
      amount_value: 934,
      currency: "EUR",
      link: "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
      eligibility: {
        degree_required: "bachelor",
        german_proficiency: "optional"
      },
      academic_year: "2025"
    });
  }

  return results;
}

/**
 * Erasmus+ Joint Master Degrees
 * https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en
 */
export async function harvestErasmus(
  query: ScholarshipQuery
): Promise<ScholarshipData[]> {
  console.log("[erasmus] Harvesting...");

  const results: ScholarshipData[] = [];

  // مثال توضيحي
  results.push({
    source_name: "erasmus",
    title: "Erasmus Mundus Joint Master Degrees",
    provider: "European Commission",
    study_level: "pg",
    coverage: {
      tuition: true,
      stipend: true,
      travel: true,
      installation: true
    },
    amount_type: "full",
    amount_value: 1400,
    currency: "EUR",
    link: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
    eligibility: {
      nationalities: ["all"],
      degree_required: "bachelor"
    },
    academic_year: "2025/26"
  });

  return results;
}

/**
 * Fulbright Program (USA)
 * https://foreign.fulbrightonline.org/
 */
export async function harvestFulbright(
  query: ScholarshipQuery
): Promise<ScholarshipData[]> {
  console.log("[fulbright] Harvesting...");

  const results: ScholarshipData[] = [];

  // مثال توضيحي
  if (!query.country_code || query.country_code === "US") {
    results.push({
      source_name: "fulbright",
      title: "Fulbright Foreign Student Program",
      provider: "US Department of State",
      country_code: "US",
      study_level: "pg",
      coverage: {
        tuition: true,
        stipend: true,
        travel: true,
        health_insurance: true,
        book_allowance: true
      },
      amount_type: "full",
      link: "https://foreign.fulbrightonline.org/",
      eligibility: {
        nationalities: ["varies_by_country"],
        degree_required: "bachelor"
      },
      academic_year: "2025/26"
    });
  }

  return results;
}

/**
 * Commonwealth Scholarships (UK/Commonwealth)
 * https://cscuk.fcdo.gov.uk/
 */
export async function harvestCommonwealth(
  query: ScholarshipQuery
): Promise<ScholarshipData[]> {
  console.log("[commonwealth] Harvesting...");

  const results: ScholarshipData[] = [];

  // مثال توضيحي
  if (!query.country_code || query.country_code === "GB") {
    results.push({
      source_name: "commonwealth",
      title: "Commonwealth Master's Scholarships",
      provider: "Commonwealth Scholarship Commission",
      country_code: "GB",
      study_level: "pg",
      coverage: {
        tuition: true,
        stipend: true,
        travel: true,
        thesis_grant: true
      },
      amount_type: "full",
      link: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/",
      eligibility: {
        nationalities: ["commonwealth_countries"],
        degree_required: "bachelor",
        development_focus: true
      },
      academic_year: "2025/26"
    });
  }

  return results;
}
