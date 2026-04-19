// ═══════════════════════════════════════════════════════════════
// useDoor3Jobs — realtime subscription on document_jobs
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Door3Job } from '../types';

export function useDoor3Jobs(documentId?: string) {
  const [jobs, setJobs] = useState<Door3Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
