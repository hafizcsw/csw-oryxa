import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

/**
 * admin-crawl-purge — SAFE UNIVERSITY STAGING RESET
 *
 * Modes: list_eligible | preview | execute
 * Scope: single university OR global (unpublished staging only)
 *
 * CRITICAL SAFETY:
 * 1) NEVER deletes canonical truth tables (universities, programs, university_offices)
 * 2) NEVER deletes published states
 * 3) Deletes ONLY explicit resettable staging states
 * 4) Preserves lineage artifacts tied to protected published crawl rows/programs
 */

const PROTECTED_OBS_STATUSES = ["published", "promoted"] as const;
const PROTECTED_ROW_STATUSES = ["published", "published_partial"] as const;
const PROTECTED_DRAFT_STATUSES = ["published"] as const;

// Strict allowlist for reset (unknown/new statuses are preserved by default)
const RESETTABLE_OBS_STATUSES = ["new", "verified", "quarantined"] as const;
const RESETTABLE_ROW_STATUSES = ["queued", "special", "verifying", "failed", "extracting"] as const;
const RESETTABLE_DRAFT_STATUSES = ["extracted", "pending"] as const;

type Scope = "single" | "global";

type ArtifactRow = {
  id: string;
  university_id: string | null;
  row_id: string | null;
  program_id: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const check = await requireAdmin(req);
    if (!check.ok) {
      return new Response(JSON.stringify({ error: check.error }), {
        status: check.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const srv = check.srv;
    const body = await req.json();
    const mode: "preview" | "execute" | "list_eligible" = body.mode ?? "preview";
    const universityId: string | null = body.university_id ?? null;
    const scope: Scope = universityId ? "single" : (body.scope ?? "single");

    if (mode === "list_eligible") {
      const universities = await listEligible(srv);
      return json({ ok: true, mode: "list_eligible", universities });
    }

    if (scope === "single" && !universityId) {
      return json({ error: "university_id is required for single-university reset." }, 400);
    }

    if (mode === "preview") {
      const result = scope === "global" ? await getGlobalPreview(srv) : await getPreview(srv, universityId!);
      return json({ ok: true, mode: "preview", scope, ...(scope === "single" ? { university_id: universityId } : {}), ...result });
    }

    if (mode === "execute") {
      const result = scope === "global" ? await executeGlobalReset(srv) : await executeReset(srv, universityId!);
      return json({ ok: true, mode: "execute", scope, ...(scope === "single" ? { university_id: universityId } : {}), ...result });
    }

    return json({ error: "invalid mode, use 'preview', 'execute', or 'list_eligible'" }, 400);
  } catch (err: any) {
    console.error("admin-crawl-purge error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function assertNoError(error: any, label: string) {
  if (error) throw new Error(`${label}: ${error.message ?? "unknown error"}`);
}

function isArtifactProtected(
  artifact: Pick<ArtifactRow, "row_id" | "program_id">,
  protectedRowIds: Set<string>,
  protectedProgramIds: Set<string>,
): boolean {
  if (artifact.row_id && protectedRowIds.has(artifact.row_id)) return true;
  if (artifact.program_id && protectedProgramIds.has(artifact.program_id)) return true;
  return false;
}

async function getProtectedRowIds(srv: any, uniId?: string): Promise<Set<string>> {
  let q = srv.from("official_site_crawl_rows").select("id").in("crawl_status", PROTECTED_ROW_STATUSES);
  if (uniId) q = q.eq("university_id", uniId);
  const { data, error } = await q;
  assertNoError(error, "getProtectedRowIds");
  return new Set((data ?? []).map((r: any) => r.id));
}

async function getProtectedProgramIds(srv: any, uniId?: string): Promise<Set<string>> {
  let q = srv
    .from("program_draft")
    .select("published_program_id")
    .in("status", PROTECTED_DRAFT_STATUSES)
    .not("published_program_id", "is", null);
  if (uniId) q = q.eq("university_id", uniId);
  const { data, error } = await q;
  assertNoError(error, "getProtectedProgramIds");
  return new Set((data ?? []).map((r: any) => r.published_program_id).filter(Boolean));
}

async function getRemainingJobIdsAfterReset(srv: any, uniId?: string): Promise<Set<string>> {
  let q = srv.from("official_site_crawl_rows").select("job_id");
  if (uniId) q = q.eq("university_id", uniId);
  const { data, error } = await q;
  assertNoError(error, "getRemainingJobIdsAfterReset");
  return new Set((data ?? []).map((r: any) => r.job_id).filter(Boolean));
}

async function listEligible(srv: any) {
  const uniCounts: Record<string, { obs: number; rows: number; drafts: number; artifacts: number }> = {};
  const ensure = (id: string) => {
    if (!uniCounts[id]) uniCounts[id] = { obs: 0, rows: 0, drafts: 0, artifacts: 0 };
  };

  const { data: obsData, error: obsError } = await srv
    .from("official_site_observations")
    .select("university_id")
    .in("status", RESETTABLE_OBS_STATUSES);
  assertNoError(obsError, "listEligible.observations");
  for (const r of obsData ?? []) {
    if (!r.university_id) continue;
    ensure(r.university_id);
    uniCounts[r.university_id].obs++;
  }

  const { data: rowData, error: rowError } = await srv
    .from("official_site_crawl_rows")
    .select("university_id")
    .in("crawl_status", RESETTABLE_ROW_STATUSES);
  assertNoError(rowError, "listEligible.rows");
  for (const r of rowData ?? []) {
    if (!r.university_id) continue;
    ensure(r.university_id);
    uniCounts[r.university_id].rows++;
  }

  const { data: draftData, error: draftError } = await srv
    .from("program_draft")
    .select("university_id")
    .in("status", RESETTABLE_DRAFT_STATUSES);
  assertNoError(draftError, "listEligible.drafts");
  for (const r of draftData ?? []) {
    if (!r.university_id) continue;
    ensure(r.university_id);
    uniCounts[r.university_id].drafts++;
  }

  const protectedRowIds = await getProtectedRowIds(srv);
  const protectedProgramIds = await getProtectedProgramIds(srv);

  const { data: artifactData, error: artifactError } = await srv
    .from("crawl_file_artifacts")
    .select("university_id, row_id, program_id");
  assertNoError(artifactError, "listEligible.artifacts");
  for (const a of artifactData ?? []) {
    if (!a.university_id) continue;
    if (isArtifactProtected(a, protectedRowIds, protectedProgramIds)) continue;
    ensure(a.university_id);
    uniCounts[a.university_id].artifacts++;
  }

  const uniIds = Object.keys(uniCounts);
  if (uniIds.length === 0) return [];

  const metaMap: Record<string, {
    name: string | null;
    name_ar: string | null;
    name_en: string | null;
    website: string | null;
    country_code: string | null;
  }> = {};

  for (const idBatch of chunk(uniIds, 300)) {
    const { data: uniMetaBatch, error: uniMetaError } = await srv
      .from("universities")
      .select("id, name, name_ar, name_en, website, country_code")
      .in("id", idBatch);
    assertNoError(uniMetaError, "listEligible.universityMeta");

    for (const u of uniMetaBatch ?? []) {
      metaMap[u.id] = {
        name: u.name ?? null,
        name_ar: u.name_ar ?? null,
        name_en: u.name_en ?? null,
        website: u.website ?? null,
        country_code: u.country_code ?? null,
      };
    }
  }

  const missingIds = uniIds.filter((id) => {
    const meta = metaMap[id];
    return !meta || !(meta.name_ar || meta.name || meta.name_en);
  });

  const crawlMetaMap: Record<string, { university_name: string | null; website: string | null; country_code: string | null }> = {};
  if (missingIds.length > 0) {
    for (const idBatch of chunk(missingIds, 300)) {
      const { data: crawlMetaRows, error: crawlMetaError } = await srv
        .from("official_site_crawl_rows")
        .select("university_id, university_name, website, country_code, updated_at")
        .in("university_id", idBatch)
        .order("updated_at", { ascending: false })
        .limit(3000);
      assertNoError(crawlMetaError, "listEligible.crawlMeta");

      for (const row of crawlMetaRows ?? []) {
        if (!row.university_id) continue;
        if (!crawlMetaMap[row.university_id]) {
          crawlMetaMap[row.university_id] = {
            university_name: row.university_name ?? null,
            website: row.website ?? null,
            country_code: row.country_code ?? null,
          };
        }
      }
    }
  }

  return uniIds
    .map((id) => {
      const meta = metaMap[id];
      const crawl = crawlMetaMap[id];
      const displayName = meta?.name_ar || meta?.name || meta?.name_en || crawl?.university_name || "Unknown university";
      const website = meta?.website || crawl?.website || null;
      const countryCode = meta?.country_code || crawl?.country_code || null;
      const counts = uniCounts[id];

      return {
        id,
        university_id: id,
        display_name: displayName,
        name: displayName,
        name_ar: meta?.name_ar ?? null,
        name_en: meta?.name_en ?? null,
        website,
        country_code: countryCode,
        unpublished_counts: counts,
        total: counts.obs + counts.rows + counts.drafts + counts.artifacts,
      };
    })
    .sort((a, b) => b.total - a.total);
}

async function getPreview(srv: any, uniId: string) {
  const { count: obsToDelete, error: obsDeleteError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", RESETTABLE_OBS_STATUSES);
  assertNoError(obsDeleteError, "preview.single.obsToDelete");

  const { count: obsToKeep, error: obsKeepError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", PROTECTED_OBS_STATUSES);
  assertNoError(obsKeepError, "preview.single.obsToKeep");

  const { count: rowsToDelete, error: rowsDeleteError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("crawl_status", RESETTABLE_ROW_STATUSES);
  assertNoError(rowsDeleteError, "preview.single.rowsToDelete");

  const { count: rowsToKeep, error: rowsKeepError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("crawl_status", PROTECTED_ROW_STATUSES);
  assertNoError(rowsKeepError, "preview.single.rowsToKeep");

  const { count: draftsToDelete, error: draftsDeleteError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", RESETTABLE_DRAFT_STATUSES);
  assertNoError(draftsDeleteError, "preview.single.draftsToDelete");

  const { count: draftsToKeep, error: draftsKeepError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", PROTECTED_DRAFT_STATUSES);
  assertNoError(draftsKeepError, "preview.single.draftsToKeep");

  const protectedRowIds = await getProtectedRowIds(srv, uniId);
  const protectedProgramIds = await getProtectedProgramIds(srv, uniId);

  const { data: allArtifacts, error: artifactsError } = await srv
    .from("crawl_file_artifacts")
    .select("id, row_id, program_id")
    .eq("university_id", uniId);
  assertNoError(artifactsError, "preview.single.artifacts");

  let artifactsToDelete = 0;
  let artifactsToKeep = 0;
  for (const artifact of allArtifacts ?? []) {
    if (isArtifactProtected(artifact, protectedRowIds, protectedProgramIds)) artifactsToKeep++;
    else artifactsToDelete++;
  }

  // Jobs are global/shared and not safely deletable in single-university reset.
  // Keep single scope strictly limited to university-scoped staging tables.
  const jobsToDelete = 0;

  return {
    to_delete: {
      observations: obsToDelete ?? 0,
      crawl_rows: rowsToDelete ?? 0,
      crawl_jobs: jobsToDelete,
      program_drafts: draftsToDelete ?? 0,
      file_artifacts: artifactsToDelete,
    },
    to_preserve: {
      observations: obsToKeep ?? 0,
      crawl_rows: rowsToKeep ?? 0,
      program_drafts: draftsToKeep ?? 0,
      file_artifacts: artifactsToKeep,
      canonical_tables: "universities, programs, university_offices — NEVER touched",
    },
  };
}

async function getGlobalPreview(srv: any) {
  const { count: obsToDelete, error: obsDeleteError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .in("status", RESETTABLE_OBS_STATUSES);
  assertNoError(obsDeleteError, "preview.global.obsToDelete");

  const { count: obsToKeep, error: obsKeepError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .in("status", PROTECTED_OBS_STATUSES);
  assertNoError(obsKeepError, "preview.global.obsToKeep");

  const { count: rowsToDelete, error: rowsDeleteError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .in("crawl_status", RESETTABLE_ROW_STATUSES);
  assertNoError(rowsDeleteError, "preview.global.rowsToDelete");

  const { count: rowsToKeep, error: rowsKeepError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .in("crawl_status", PROTECTED_ROW_STATUSES);
  assertNoError(rowsKeepError, "preview.global.rowsToKeep");

  const { count: draftsToDelete, error: draftsDeleteError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .in("status", RESETTABLE_DRAFT_STATUSES);
  assertNoError(draftsDeleteError, "preview.global.draftsToDelete");

  const { count: draftsToKeep, error: draftsKeepError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .in("status", PROTECTED_DRAFT_STATUSES);
  assertNoError(draftsKeepError, "preview.global.draftsToKeep");

  const protectedRowIds = await getProtectedRowIds(srv);
  const protectedProgramIds = await getProtectedProgramIds(srv);

  const { data: allArtifacts, error: artifactsError } = await srv
    .from("crawl_file_artifacts")
    .select("id, row_id, program_id");
  assertNoError(artifactsError, "preview.global.artifacts");

  let artifactsToDelete = 0;
  let artifactsToKeep = 0;
  for (const artifact of allArtifacts ?? []) {
    if (isArtifactProtected(artifact, protectedRowIds, protectedProgramIds)) artifactsToKeep++;
    else artifactsToDelete++;
  }

  const { data: allJobs, error: allJobsError } = await srv
    .from("official_site_crawl_jobs")
    .select("id");
  assertNoError(allJobsError, "preview.global.jobs");

  const { data: allRows, error: allRowsError } = await srv
    .from("official_site_crawl_rows")
    .select("job_id, crawl_status");
  assertNoError(allRowsError, "preview.global.jobRows");

  const keepJobIds = new Set(
    (allRows ?? [])
      .filter((r: any) => !RESETTABLE_ROW_STATUSES.includes(r.crawl_status))
      .map((r: any) => r.job_id)
      .filter(Boolean),
  );

  const jobsToDelete = (allJobs ?? []).filter((j: any) => !keepJobIds.has(j.id)).length;
  const eligible = await listEligible(srv);

  return {
    universities_affected: eligible.length,
    to_delete: {
      observations: obsToDelete ?? 0,
      crawl_rows: rowsToDelete ?? 0,
      crawl_jobs: jobsToDelete,
      program_drafts: draftsToDelete ?? 0,
      file_artifacts: artifactsToDelete,
    },
    to_preserve: {
      observations: obsToKeep ?? 0,
      crawl_rows: rowsToKeep ?? 0,
      program_drafts: draftsToKeep ?? 0,
      file_artifacts: artifactsToKeep,
      canonical_tables: "universities, programs, university_offices — NEVER touched",
    },
  };
}

async function executeReset(srv: any, uniId: string) {
  const deleted: Record<string, number> = {};

  const protectedRowIds = await getProtectedRowIds(srv, uniId);
  const protectedProgramIds = await getProtectedProgramIds(srv, uniId);

  const { data: allArtifacts, error: artifactsError } = await srv
    .from("crawl_file_artifacts")
    .select("id, university_id, row_id, program_id, storage_bucket, storage_path")
    .eq("university_id", uniId);
  assertNoError(artifactsError, "execute.single.artifacts");

  const artifactsToDelete: ArtifactRow[] = (allArtifacts ?? []).filter(
    (artifact: ArtifactRow) => !isArtifactProtected(artifact, protectedRowIds, protectedProgramIds),
  );

  let storageDeleted = 0;
  const bucketGroups: Record<string, string[]> = {};
  for (const artifact of artifactsToDelete) {
    if (!artifact.storage_bucket || !artifact.storage_path) continue;
    if (!bucketGroups[artifact.storage_bucket]) bucketGroups[artifact.storage_bucket] = [];
    bucketGroups[artifact.storage_bucket].push(artifact.storage_path);
  }

  for (const [bucket, paths] of Object.entries(bucketGroups)) {
    for (const batch of chunk(paths, 100)) {
      const { error } = await srv.storage.from(bucket).remove(batch);
      assertNoError(error, `execute.single.storage.${bucket}`);
      storageDeleted += batch.length;
    }
  }
  deleted.storage_files = storageDeleted;

  if (artifactsToDelete.length > 0) {
    let artifactsDeleted = 0;
    for (const batch of chunk(artifactsToDelete.map((a) => a.id), 200)) {
      const { count, error } = await srv.from("crawl_file_artifacts").delete({ count: "exact" }).in("id", batch);
      assertNoError(error, "execute.single.deleteArtifacts");
      artifactsDeleted += count ?? 0;
    }
    deleted.file_artifacts = artifactsDeleted;
  } else {
    deleted.file_artifacts = 0;
  }

  const { count: obsDeleted, error: obsDeleteError } = await srv
    .from("official_site_observations")
    .delete({ count: "exact" })
    .eq("university_id", uniId)
    .in("status", RESETTABLE_OBS_STATUSES);
  assertNoError(obsDeleteError, "execute.single.deleteObservations");
  deleted.observations = obsDeleted ?? 0;

  const { count: rowsDeleted, error: rowsDeleteError } = await srv
    .from("official_site_crawl_rows")
    .delete({ count: "exact" })
    .eq("university_id", uniId)
    .in("crawl_status", RESETTABLE_ROW_STATUSES);
  assertNoError(rowsDeleteError, "execute.single.deleteRows");
  deleted.crawl_rows = rowsDeleted ?? 0;

  const { count: draftsDeleted, error: draftsDeleteError } = await srv
    .from("program_draft")
    .delete({ count: "exact" })
    .eq("university_id", uniId)
    .in("status", RESETTABLE_DRAFT_STATUSES);
  assertNoError(draftsDeleteError, "execute.single.deleteDrafts");
  deleted.program_drafts = draftsDeleted ?? 0;

  // Jobs are shared across universities; single reset never deletes jobs.
  deleted.crawl_jobs = 0;

  const { count: obsPreserved, error: obsPreservedError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", PROTECTED_OBS_STATUSES);
  assertNoError(obsPreservedError, "execute.single.preservedObs");

  const { count: rowsPreserved, error: rowsPreservedError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("crawl_status", PROTECTED_ROW_STATUSES);
  assertNoError(rowsPreservedError, "execute.single.preservedRows");

  const { count: draftsPreserved, error: draftsPreservedError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .eq("university_id", uniId)
    .in("status", PROTECTED_DRAFT_STATUSES);
  assertNoError(draftsPreservedError, "execute.single.preservedDrafts");

  return {
    deleted,
    preserved: {
      observations: obsPreserved ?? 0,
      crawl_rows: rowsPreserved ?? 0,
      program_drafts: draftsPreserved ?? 0,
    },
    canonical_touched: false,
  };
}

async function executeGlobalReset(srv: any) {
  const deleted: Record<string, number> = {};

  const protectedRowIds = await getProtectedRowIds(srv);
  const protectedProgramIds = await getProtectedProgramIds(srv);

  const { data: allArtifacts, error: artifactsError } = await srv
    .from("crawl_file_artifacts")
    .select("id, university_id, row_id, program_id, storage_bucket, storage_path");
  assertNoError(artifactsError, "execute.global.artifacts");

  const artifactsToDelete: ArtifactRow[] = (allArtifacts ?? []).filter(
    (artifact: ArtifactRow) => !isArtifactProtected(artifact, protectedRowIds, protectedProgramIds),
  );

  let storageDeleted = 0;
  const bucketGroups: Record<string, string[]> = {};
  for (const artifact of artifactsToDelete) {
    if (!artifact.storage_bucket || !artifact.storage_path) continue;
    if (!bucketGroups[artifact.storage_bucket]) bucketGroups[artifact.storage_bucket] = [];
    bucketGroups[artifact.storage_bucket].push(artifact.storage_path);
  }

  for (const [bucket, paths] of Object.entries(bucketGroups)) {
    for (const batch of chunk(paths, 100)) {
      const { error } = await srv.storage.from(bucket).remove(batch);
      assertNoError(error, `execute.global.storage.${bucket}`);
      storageDeleted += batch.length;
    }
  }
  deleted.storage_files = storageDeleted;

  if (artifactsToDelete.length > 0) {
    let artifactsDeleted = 0;
    for (const batch of chunk(artifactsToDelete.map((a) => a.id), 200)) {
      const { count, error } = await srv.from("crawl_file_artifacts").delete({ count: "exact" }).in("id", batch);
      assertNoError(error, "execute.global.deleteArtifacts");
      artifactsDeleted += count ?? 0;
    }
    deleted.file_artifacts = artifactsDeleted;
  } else {
    deleted.file_artifacts = 0;
  }

  const { count: obsDeleted, error: obsDeleteError } = await srv
    .from("official_site_observations")
    .delete({ count: "exact" })
    .in("status", RESETTABLE_OBS_STATUSES);
  assertNoError(obsDeleteError, "execute.global.deleteObservations");
  deleted.observations = obsDeleted ?? 0;

  const { count: rowsDeleted, error: rowsDeleteError } = await srv
    .from("official_site_crawl_rows")
    .delete({ count: "exact" })
    .in("crawl_status", RESETTABLE_ROW_STATUSES);
  assertNoError(rowsDeleteError, "execute.global.deleteRows");
  deleted.crawl_rows = rowsDeleted ?? 0;

  const { count: draftsDeleted, error: draftsDeleteError } = await srv
    .from("program_draft")
    .delete({ count: "exact" })
    .in("status", RESETTABLE_DRAFT_STATUSES);
  assertNoError(draftsDeleteError, "execute.global.deleteDrafts");
  deleted.program_drafts = draftsDeleted ?? 0;

  const keepJobIds = await getRemainingJobIdsAfterReset(srv);
  const { data: allJobs, error: allJobsError } = await srv.from("official_site_crawl_jobs").select("id");
  assertNoError(allJobsError, "execute.global.jobs");

  const jobIdsToDelete = (allJobs ?? []).map((j: any) => j.id).filter((id: string) => !keepJobIds.has(id));
  let jobsDeleted = 0;
  for (const batch of chunk(jobIdsToDelete, 100)) {
    const { count, error } = await srv.from("official_site_crawl_jobs").delete({ count: "exact" }).in("id", batch);
    assertNoError(error, "execute.global.deleteJobs");
    jobsDeleted += count ?? 0;
  }
  deleted.crawl_jobs = jobsDeleted;

  const { count: obsPreserved, error: obsPreservedError } = await srv
    .from("official_site_observations")
    .select("id", { count: "exact", head: true })
    .in("status", PROTECTED_OBS_STATUSES);
  assertNoError(obsPreservedError, "execute.global.preservedObs");

  const { count: rowsPreserved, error: rowsPreservedError } = await srv
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .in("crawl_status", PROTECTED_ROW_STATUSES);
  assertNoError(rowsPreservedError, "execute.global.preservedRows");

  const { count: draftsPreserved, error: draftsPreservedError } = await srv
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .in("status", PROTECTED_DRAFT_STATUSES);
  assertNoError(draftsPreservedError, "execute.global.preservedDrafts");

  return {
    deleted,
    preserved: {
      observations: obsPreserved ?? 0,
      crawl_rows: rowsPreserved ?? 0,
      program_drafts: draftsPreserved ?? 0,
    },
    canonical_touched: false,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
