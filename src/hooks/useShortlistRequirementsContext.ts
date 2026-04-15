// ═══════════════════════════════════════════════════════════════
// useShortlistRequirementsContext — Door 4.5 bridge
// ═══════════════════════════════════════════════════════════════
// Resolves programId + universityId from the student's shortlist
// so the decision engine has real requirements to evaluate against.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getGuestShortlist,
  onShortlistChanged,
} from '@/lib/shortlistStore';

interface RequirementsContext {
  programId: string | null;
  universityId: string | null;
  programName: string | null;
  isLoading: boolean;
  source: 'shortlist' | 'none';
}

/**
 * Reads the student's first shortlisted program and resolves
 * its university_id for requirements loading.
 */
export function useShortlistRequirementsContext(): RequirementsContext {
  const [programId, setProgramId] = useState<string | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // React to shortlist changes
  useEffect(() => {
    function resolve() {
      const ids = getGuestShortlist();
      const first = ids[0] ?? null;
      if (first !== programId) {
        setProgramId(first);
      }
    }

    resolve();
    const unsub = onShortlistChanged(() => resolve());
    return unsub;
  }, [programId]);

  // When programId changes, look up university_id from programs table
  useEffect(() => {
    if (!programId) {
      setUniversityId(null);
      setProgramName(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('programs')
          .select('university_id, name_en, name_ar')
          .eq('id', programId)
          .maybeSingle();

        if (!cancelled && data) {
          setUniversityId(data.university_id ?? null);
          setProgramName(data.name_en || data.name_ar || programId);
          console.log('[RequirementsContext] Resolved from shortlist', {
            programId,
            universityId: data.university_id,
            programName: data.name_en || data.name_ar,
          });
        }
      } catch (e) {
        console.warn('[RequirementsContext] Lookup failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [programId]);

  return {
    programId,
    universityId,
    programName,
    isLoading,
    source: programId ? 'shortlist' : 'none',
  };
}
