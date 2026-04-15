/**
 * Golden regression test definitions for official-site crawl lanes.
 * Each entry defines a university that passed QA and the minimum
 * fact-group counts + completeness that must hold after any code change.
 *
 * Usage: import and run `validateGoldenTests()` from a test harness
 * or edge-function healthcheck endpoint.
 */

export interface GoldenTestCase {
  id: string;
  university: string;
  university_id: string;
  row_id: string;
  job_id: string;
  class: string;
  /** Minimum completeness score (0-100) */
  min_completeness: number;
  /** Minimum fact count per group — 0 means "may be empty" */
  min_facts: Record<string, number>;
  /** Parser version that established the baseline */
  baseline_parser: string;
  /** Date the golden case was accepted */
  accepted_at: string;
}

export const GOLDEN_TESTS: GoldenTestCase[] = [
  {
    id: "golden-itmo-multidomain",
    university: "ITMO University",
    university_id: "055a0d4b-f0a2-404a-a064-2c0f4e40e302",
    row_id: "dce649b5-d05d-43ff-b94d-999a4fa61508",
    job_id: "b0f3bc6c-8ff2-4d20-838d-fe463b83e5eb",
    class: "multi-domain-official-family",
    min_completeness: 90,
    min_facts: {
      identity: 5,
      contact_location: 5,
      admissions: 3,
      deadlines_intakes: 1,
      tuition_fees: 1,
      scholarships: 1,
      language_requirements: 1,
      programs: 3,
      housing: 1,
      student_life: 1,
      media_brochures: 3,
      cta_links: 2,
    },
    baseline_parser: "osc-hard-v2.2",
    accepted_at: "2026-03-19",
  },
];

export interface GoldenResult {
  id: string;
  university: string;
  pass: boolean;
  completeness: number;
  min_completeness: number;
  failures: string[];
  fact_counts: Record<string, number>;
}

/**
 * Validate golden tests against current observation data.
 * Requires a Supabase admin client.
 */
export async function validateGoldenTests(
  db: any,
  opts: { parser_version?: string } = {}
): Promise<GoldenResult[]> {
  const results: GoldenResult[] = [];

  for (const tc of GOLDEN_TESTS) {
    const failures: string[] = [];

    // Get current row completeness
    const { data: row } = await db
      .from("official_site_crawl_rows")
      .select("completeness_score, crawl_status")
      .eq("id", tc.row_id)
      .single();

    const completeness = row?.completeness_score ?? 0;
    if (completeness < tc.min_completeness) {
      failures.push(`completeness ${completeness} < ${tc.min_completeness}`);
    }

    // Count facts per group from observations
    let query = db
      .from("official_site_observations")
      .select("fact_group")
      .eq("row_id", tc.row_id);

    if (opts.parser_version) {
      query = query.eq("parser_version", opts.parser_version);
    }

    const { data: obs } = await query;
    const counts: Record<string, number> = {};
    for (const o of obs || []) {
      counts[o.fact_group] = (counts[o.fact_group] || 0) + 1;
    }

    for (const [group, min] of Object.entries(tc.min_facts)) {
      const actual = counts[group] || 0;
      if (actual < min) {
        failures.push(`${group}: ${actual} < ${min}`);
      }
    }

    results.push({
      id: tc.id,
      university: tc.university,
      pass: failures.length === 0,
      completeness,
      min_completeness: tc.min_completeness,
      failures,
      fact_counts: counts,
    });
  }

  return results;
}
