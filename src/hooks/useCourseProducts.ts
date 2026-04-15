import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";

export interface CourseProduct {
  id: string;
  language_key: string;
  course_type: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_usd: number;
  duration_months: number | null;
  features: string[];
  display_order: number;
  display_name: string;
  display_description: string | null;
}

export interface CourseCohort {
  id: string;
  product_id: string | null;
  language_key: string;
  start_date: string;
  capacity: number;
  min_to_start: number;
  status: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  language_key: string;
  product_id: string | null;
  cohort_id: string | null;
  course_type: string;
  price_usd: number;
  payment_method: string;
  proof_url: string | null;
  proof_uploaded_at: string | null;
  request_status: string;
  payment_proof_status: string;
  admin_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  activation_status: string;
  created_at: string;
}

const COURSE_TYPE_KEY_MAP: Record<string, string> = {
  regular: 'regular',
  pro: 'pro',
  intensive_exam: 'intensive',
};

function resolveProductDisplayName(product: Pick<CourseProduct, 'course_type' | 'name_en' | 'name_ar'>) {
  const typeKey = COURSE_TYPE_KEY_MAP[product.course_type] ?? product.course_type;
  const translated = i18n.t(`languages.enrollment.${typeKey}.name`);
  if (translated && translated !== `languages.enrollment.${typeKey}.name`) return translated;
  return product.name_en || product.name_ar || translateLanguageCourseValue(i18n.t.bind(i18n), `languages.enrollment.${typeKey}.name`, typeKey);
}

function resolveProductDescription(product: Pick<CourseProduct, 'course_type' | 'description_en' | 'description_ar'>) {
  const typeKey = COURSE_TYPE_KEY_MAP[product.course_type] ?? product.course_type;
  const translated = i18n.t(`languages.enrollment.${typeKey}.desc`);
  if (translated && translated !== `languages.enrollment.${typeKey}.desc`) return translated;
  return product.description_en || product.description_ar || null;
}

export function useCourseProducts(languageKey = "russian") {
  const [products, setProducts] = useState<CourseProduct[]>([]);
  const [cohorts, setCohorts] = useState<CourseCohort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [prodRes, cohortRes] = await Promise.all([
        supabase
          .from("language_course_products")
          .select("*")
          .eq("language_key", languageKey)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("language_course_cohorts")
          .select("*")
          .eq("language_key", languageKey)
          .eq("status", "registration_open")
          .order("start_date"),
      ]);

      setProducts((prodRes.data as any[] || []).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
        display_name: resolveProductDisplayName(p),
        display_description: resolveProductDescription(p),
      })));
      setCohorts(cohortRes.data as any[] || []);
      setLoading(false);
    };
    fetch();
  }, [languageKey]);

  return { products, cohorts, loading };
}

export function useMyEnrollment(languageKey = "russian") {
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setEnrollment(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("language_course_enrollments")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("language_key", languageKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setEnrollment(data as any || null);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [languageKey]);

  return { enrollment, loading, refresh };
}
