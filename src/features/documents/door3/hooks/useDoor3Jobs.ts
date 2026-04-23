// ═══════════════════════════════════════════════════════════════
// ⛔ DEPRECATED — DEAD PATH (Phase A truth-table)
// ═══════════════════════════════════════════════════════════════
// Reads the legacy `document_jobs` table which is NOT part of the live
// document path. The live path writes to `document_lane_facts` /
// `document_review_queue` via mistral-document-pipeline.
// See: docs/document-pipeline-truth-table.md
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Door3Job } from '../types';

/**
 * @deprecated DEAD PATH. `document_jobs` is not part of the live pipeline.
 * Use `useDocumentLaneFacts` for live document truth.
 */
export function useDoor3Jobs(documentId?: string) {
  const [jobs, setJobs] = useState<Door3Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn(
      '[DEPRECATED] useDoor3Jobs subscribed — `document_jobs` is a dead path. ' +
        'See docs/document-pipeline-truth-table.md',
    );
    let active = true;
    const load = async () => {
      let q = supabase.from('document_jobs').select('*').order('created_at', { ascending: false }).limit(50);
      if (documentId) q = q.eq('document_id', documentId);
      const { data } = await q;
      if (active) {
        setJobs((data ?? []) as Door3Job[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel('door3-jobs' + (documentId ? `-${documentId}` : ''))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_jobs',
          filter: documentId ? `document_id=eq.${documentId}` : undefined },
        () => { load(); },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [documentId]);

  return { jobs, loading };
}
