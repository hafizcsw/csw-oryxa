// ═══════════════════════════════════════════════════════════════
// useShortlistRequirementsContext — Door 4.5 bridge
// ═══════════════════════════════════════════════════════════════
// Resolves programId + universityId for the decision engine.
// Priority: authenticated DB shortlist → guest localStorage fallback.
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
  source: 'db_shortlist' | 'guest_shortlist' | 'none';
}

/**
 * Resolves the student's first shortlisted program for requirements loading.
 * Uses authenticated DB shortlist when available, guest localStorage as fallback.
 */
export function useShortlistRequirementsContext(): RequirementsContext {
  const [programId, setProgramId] = useState<string | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<RequirementsContext['source']>('none');

  // Step 1: Resolve program ID from best available source
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // Try authenticated shortlist first (DB truth)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { data, error } = await supabase.rpc('shortlist_list' as any);
          if (!error && data) {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const items = parsed?.items ?? parsed ?? [];
            if (Array.isArray(items) && items.length > 0 && items[0]?.program_id) {
              if (!cancelled) {
                setProgramId(items[0].program_id);
                setSource('db_shortlist');
                console.log('[RequirementsContext] Using DB shortlist', {
                  programId: items[0].program_id,
                  totalItems: items.length,
                });
              }
              return;
            }
          }
        }
      } catch {
        // Fall through to guest shortlist
      }

      // Fallback: guest localStorage shortlist
      const guestIds = getGuestShortlist();
      if (!cancelled) {
        const first = guestIds[0] ?? null;
        setProgramId(first);
        setSource(first ? 'guest_shortlist' : 'none');
        if (first) {
          console.log('[RequirementsContext] Using guest shortlist', { programId: first });
        }
      }
    }

    resolve();

    // Re-resolve on guest shortlist changes
    const unsub = onShortlistChanged(() => resolve());
    return () => { cancelled = true; unsub(); };
  }, []);

  // Step 2: Resolve university_id + program name from programs table
  useEffect(() => {
    if (!programId) {
      setUniversityId(null);
      setProgramName(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('programs')
          .select('university_id, title, title_ar')
          .eq('id', programId)
          .maybeSingle();

        if (!cancelled && data) {
          setUniversityId(data.university_id ?? null);
          setProgramName(data.title || data.title_ar || programId);
          console.log('[RequirementsContext] Resolved program', {
            programId,
            universityId: data.university_id,
            programName: data.title || data.title_ar,
            source,
          });
        }
      } catch (e) {
        console.warn('[RequirementsContext] Lookup failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [programId, source]);

  return {
    programId,
    universityId,
    programName,
    isLoading,
    source,
  };
}
