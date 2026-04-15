/**
 * useOrxControlPanel — hooks for ORX super admin control panel
 * Uses direct fetch to edge function for full control over auth and error handling.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orx-control-panel`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated — please sign in.');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function invokeOrx(action: string, params?: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  if (json.ok === false) throw new Error(json.error || 'Unknown server error');
  return json;
}

export interface OrxSummary {
  total: number;
  scored: number;
  evaluating: number;
  insufficient: number;
  beta_candidate: number;
  beta_approved: number;
  blocked_missing_layer: number;
  blocked_low_confidence: number;
  blocked_uncalibrated: number;
  internal_only: number;
}

export interface CrawlStats {
  running: number;
  queued: number;
  paused: number;
  failed: number;
  completed: number;
  cancelled: number;
}

export interface OrxEntity {
  id: string;
  entity_id: string;
  entity_type: string;
  entity_name: string;
  country_code: string | null;
  status: string;
  exposure_status: string;
  score: number | null;
  confidence: number | null;
  rank_global: number | null;
  rank_country: number | null;
  country_score: number | null;
  university_score: number | null;
  program_score: number | null;
  badges: string[];
  methodology_version: string | null;
  evaluated_at: string | null;
  updated_at: string | null;
  published_facts_count: number;
  candidate_facts_count: number;
  approved_facts_count: number;
  evidence_count: number;
  progress_percent: number;
  // Crawl fields
  crawl_status: string;
  crawl_stage: string | null;
  crawl_started_at: string | null;
  crawl_finished_at: string | null;
  crawl_last_heartbeat: string | null;
  crawl_last_error: string | null;
  crawl_pages_discovered: number;
  crawl_pages_fetched: number;
  crawl_pages_processed: number;
  crawl_pages_total: number;
  crawl_evidence_created: number;
  crawl_facts_created: number;
  crawl_score_updated: boolean;
  crawl_job_type: string | null;
  crawl_retry_count: number;
}

export function useOrxSummary() {
  return useQuery<{ ok: boolean; summary: OrxSummary; crawl_stats: CrawlStats }>({
    queryKey: ['orx-control-summary'],
    queryFn: () => invokeOrx('summary'),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useOrxEntities() {
  return useQuery<{ ok: boolean; entities: OrxEntity[] }>({
    queryKey: ['orx-control-entities'],
    queryFn: () => invokeOrx('entities'),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useOrxEntityDetail(entityId: string | null) {
  return useQuery({
    queryKey: ['orx-control-detail', entityId],
    queryFn: () => invokeOrx('detail', { entity_id: entityId! }),
    enabled: !!entityId,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useOrxAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { action: string; [key: string]: any }) => {
      return invokeOrx(params.action, params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orx-control-summary'] });
      qc.invalidateQueries({ queryKey: ['orx-control-entities'] });
      qc.invalidateQueries({ queryKey: ['orx-control-detail'] });
    },
  });
}
