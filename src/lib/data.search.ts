import { supabase } from "@/integrations/supabase/client";

export type Taxonomies = {
  countries: { id: string; name: string; slug: string }[];
  degrees: { id: string; name: string; slug: string }[];
  certificates: { id: string; name: string; slug: string }[];
};

export type ProgramRow = {
  program_id: string;
  title: string;
  degree_slug: string | null;
  university_id: string;
  university_name: string;
  country_slug: string | null;
  city: string | null;
  annual_fees: number | null;
  monthly_living: number | null;
  languages: string[] | null;
  next_intake: string | null;
  ranking: number | null;
};

export async function getTaxonomies(): Promise<Taxonomies> {
  const [countries, degrees, certificates] = await Promise.all([
    supabase.from("countries").select("id,name,slug").order("name"),
    supabase.from("degrees").select("id,name,slug").order("name"),
    supabase.from("certificate_types").select("id,name,slug").order("name"),
  ]);
  return {
    countries: (countries.data ?? []) as any,
    degrees: (degrees.data ?? []) as any,
    certificates: (certificates.data ?? []) as any,
  };
}

export type SearchParams = {
  q?: string;
  fees_max?: number;
  living_max?: number;
  country?: string;
  degree?: string;
  certificate?: string;
  subject?: string;
  language?: string;
  sort?: "smart" | "popularity" | "name" | "fees" | "ranking";
  page?: number;
  page_size?: number;
};

export async function searchPrograms(p: SearchParams) {
  const page = Math.max(1, Number(p.page || 1));
  const size = Math.min(48, Math.max(1, Number(p.page_size || 24)));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let query = supabase
    .from("programs_view")
    .select("*", { count: "exact" })
    .range(from, to);

  if (p.q && p.q.trim()) {
    const term = `%${p.q.trim()}%`;
    query = query.or(`title.ilike.${term},university_name.ilike.${term}`);
  }
  if (p.subject && p.subject.trim()) {
    const term = `%${p.subject.trim()}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }
  if (p.country) query = query.eq("country_slug", p.country);
  if (p.degree) query = query.eq("degree_slug", p.degree);
  if (p.certificate) query = query.contains("accepted_certificates", [p.certificate]);
  if (p.language) query = query.contains("languages", [p.language]);
  if (p.fees_max) query = query.lte("annual_fees", p.fees_max);
  if (p.living_max) query = query.lte("monthly_living", p.living_max);

  const sort = p.sort || "smart";
  if (sort === "smart") {
    // Smart sort: popularity score (from rollup) + ranking + fees
    query = query
      .order("world_rank", { ascending: true, nullsFirst: false })
      .order("annual_fees", { ascending: true, nullsFirst: false });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true });
  } else if (sort === "fees") {
    query = query.order("annual_fees", { ascending: true, nullsFirst: false });
  } else if (sort === "ranking") {
    query = query.order("world_rank", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("world_rank", { ascending: false, nullsFirst: true });
  }

  const { data, count, error } = await query;
  if (error) {
    console.warn("[searchPrograms] error:", error);
    return { results: [] as ProgramRow[], total: 0, page, page_size: size };
  }
  return { results: (data ?? []) as unknown as ProgramRow[], total: count ?? 0, page, page_size: size };
}
