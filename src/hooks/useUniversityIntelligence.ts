/**
 * useUniversityIntelligence — hook for university intelligence & optimization data.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsSummary {
  period_days: number;
  page_views: number;
  inquiries: number;
  applications: number;
  decisions: { accepted: number; rejected: number; waitlisted: number };
  status_breakdown: Record<string, number>;
  top_programs: Array<{ program_id: string; name_en: string; name_ar: string; degree_level: string; count: number }>;
  avg_response_time_hours: number | null;
  doc_request_friction: { total: number; pending: number };
  stalled_cases: number;
  threads_needing_reply: number;
  funnel: { page_views: number; inquiries: number; applications: number; under_review: number; decisions: number };
}

export interface OperatorPriorities {
  overdue_reviews: Array<any>;
  pending_doc_requests: Array<any>;
  threads_needing_reply: Array<any>;
  stalled_cases: Array<any>;
  high_priority_apps: Array<any>;
}

export interface ORXGuidance {
  composite_score: number;
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    guidance: string;
    improvable: boolean;
  }>;
  top_actions: Array<{
    factor: string;
    current_score: number;
    guidance_key: string;
  }>;
  data_sources: Record<string, number | null>;
}

export interface Diagnostics {
  programs_no_applications: Array<{ id: string; name_en: string; name_ar: string; degree_level: string }>;
  avg_status_durations_hours: Record<string, number>;
  drop_off_rate: number;
  overdue_by_program: Array<{ program_id: string; name_en: string; name_ar: string; count: number }>;
  total_applications: number;
}

export interface Templates {
  doc_request: Array<{ id: string; label_key: string; message_key: string }>;
  decision: Array<{ id: string; label_key: string; message_key: string }>;
  follow_up: Array<{ id: string; label_key: string; message_key: string }>;
}

async function invoke(action: string, universityId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('university-intelligence', {
    body: { action, university_id: universityId, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useUniversityIntelligence(universityId: string) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [priorities, setPriorities] = useState<OperatorPriorities | null>(null);
  const [orx, setOrx] = useState<ORXGuidance | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const setLoadingKey = (key: string, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));

  const fetchAnalytics = useCallback(async (days = 30) => {
    setLoadingKey('analytics', true);
    try {
      const res = await invoke('analytics.summary', universityId, { days });
      setAnalytics(res.analytics);
    } finally { setLoadingKey('analytics', false); }
  }, [universityId]);

  const fetchPriorities = useCallback(async () => {
    setLoadingKey('priorities', true);
    try {
      const res = await invoke('operator.priorities', universityId);
      setPriorities(res.priorities);
    } finally { setLoadingKey('priorities', false); }
  }, [universityId]);

  const fetchOrx = useCallback(async () => {
    setLoadingKey('orx', true);
    try {
      const res = await invoke('orx.guidance', universityId);
      setOrx(res.orx);
    } finally { setLoadingKey('orx', false); }
  }, [universityId]);

  const fetchDiagnostics = useCallback(async () => {
    setLoadingKey('diagnostics', true);
    try {
      const res = await invoke('diagnostics', universityId);
      setDiagnostics(res.diagnostics);
    } finally { setLoadingKey('diagnostics', false); }
  }, [universityId]);

  const fetchTemplates = useCallback(async () => {
    setLoadingKey('templates', true);
    try {
      const res = await invoke('templates.list', universityId);
      setTemplates(res.templates);
    } finally { setLoadingKey('templates', false); }
  }, [universityId]);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchAnalytics(),
      fetchPriorities(),
      fetchOrx(),
      fetchDiagnostics(),
      fetchTemplates(),
    ]);
  }, [fetchAnalytics, fetchPriorities, fetchOrx, fetchDiagnostics, fetchTemplates]);

  return {
    analytics, priorities, orx, diagnostics, templates,
    loading,
    fetchAnalytics, fetchPriorities, fetchOrx, fetchDiagnostics, fetchTemplates, fetchAll,
  };
}
