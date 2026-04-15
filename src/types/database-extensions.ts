// Temporary type extensions until auto-generated types are updated
export interface CountryExtended {
  id: string;
  name_ar: string;
  name_en?: string | null;
  slug: string;
  image_url?: string;
  page_content?: string;
  hero_title?: string;
  hero_subtitle?: string;
  seo_title?: string;
  seo_description?: string;
  lastmod?: string;
  currency_code?: string | null;
  country_code?: string | null;
  education_rank_global?: number | null;
  international_students?: number | null;
  country_facts?: {
    cost_of_living?: string;
    visa_type?: string;
    work_hours?: string;
    post_study_work?: string;
  };
}

export interface CountryTopUniversity {
  university_id: string;
  university_name: string;
  country_slug: string;
  ranking?: number;
  annual_fees?: number;
  monthly_living?: number;
  logo_url?: string;
  city?: string;
}

export interface ScholarshipExtended {
  id: string;
  title: string;
  country_id?: string;
  university_id?: string;
  degree_id?: string;
  amount?: number;
  currency?: string;
  deadline?: string;
  url?: string;
  source?: string;
  confidence?: number;
  status?: string;
  created_at?: string;
}

export interface PhoneIdentity {
  phone: string;
  visitor_id: string;
  created_at?: string;
}
