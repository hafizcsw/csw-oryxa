// ═══════════════════════════════════════════════════════════════
// useDoor3Transcript — read academic rows + summary for a document
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Door3AcademicRow, Door3AcademicSummary } from '../types';

export function useDoor3Transcript(documentId?: string) {
  const [rows, setRows] = useState<Door3AcademicRow[]>([]);
  const [summary, setSummary] = useState<Door3AcademicSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) { setLoading(false); return; }
    let active = true;
    (async () => {
      const [r, s] = await Promise.all([
        supabase.from('document_academic_rows').select('*').eq('document_id', documentId),
        supabase.from('document_academic_summary').select('*').eq('document_id', documentId),
      ]);
      if (!active) return;
      setRows((r.data ?? []) as Door3AcademicRow[]);
      setSummary((s.data ?? []) as Door3AcademicSummary[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [documentId]);

  return { rows, summary, loading };
}
