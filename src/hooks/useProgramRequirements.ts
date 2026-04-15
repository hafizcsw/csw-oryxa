// ═══════════════════════════════════════════════════════════════
// useProgramRequirements — Door 4.5: Requirements loading hook
// ═══════════════════════════════════════════════════════════════
// Loads program/university requirements from DB for decision engine.
// Supports university-level consensus fallback when no program_id.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProgramRequirement } from '@/features/program-requirements/types';
import { createRequirement } from '@/features/program-requirements/types';
import { fetchProgramRequirements } from '@/features/program-requirements/requirements-adapter';

interface UseProgramRequirementsOptions {
  /** Program ID if available */
  programId?: string | null;
  /** University ID fallback */
  universityId?: string | null;
  /** Target degree level for filtering consensus */
  targetDegree?: string | null;
}

interface UseProgramRequirementsResult {
  requirements: ProgramRequirement[];
  isLoading: boolean;
  source: 'program' | 'university_consensus' | 'none';
}

export function useProgramRequirements({
  programId,
  universityId,
  targetDegree,
}: UseProgramRequirementsOptions): UseProgramRequirementsResult {
  const [requirements, setRequirements] = useState<ProgramRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<'program' | 'university_consensus' | 'none'>('none');
  const lastKey = useRef('');

  useEffect(() => {
    const key = `${programId ?? ''}|${universityId ?? ''}|${targetDegree ?? ''}`;
    if (key === lastKey.current) return;
    if (!programId && !universityId) return;
    lastKey.current = key;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        // 1. Try program-level requirements
        if (programId) {
          const reqs = await fetchProgramRequirements(programId);
          if (!cancelled && reqs.length > 0) {
            setRequirements(reqs);
            setSource('program');
            setIsLoading(false);
            return;
          }
        }

        // 2. Fallback: university-level consensus
        if (universityId) {
          const reqs = await fetchUniversityConsensus(universityId, targetDegree);
          if (!cancelled) {
            setRequirements(reqs);
            setSource(reqs.length > 0 ? 'university_consensus' : 'none');
            setIsLoading(false);
            return;
          }
        }

        if (!cancelled) {
          setRequirements([]);
          setSource('none');
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRequirements([]);
          setSource('none');
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [programId, universityId, targetDegree]);

  return { requirements, isLoading, source };
}

/**
 * Load university-level consensus requirements.
 * Uses admissions_consensus table with university_id filter.
 */
async function fetchUniversityConsensus(
  universityId: string,
  targetDegree?: string | null,
): Promise<ProgramRequirement[]> {
  let query = supabase
    .from('admissions_consensus')
    .select('consensus_min_gpa, consensus_min_ielts, consensus_min_toefl, confidence_score, degree_level')
    .eq('university_id', universityId)
    .eq('is_stale', false);

  if (targetDegree) {
    // Map common degree names to consensus degree_level values
    const degreeMap: Record<string, string> = {
      bachelor: 'Bachelor', master: 'Master', phd: 'PhD',
      foundation: 'Foundation', diploma: 'Diploma',
    };
    const mapped = degreeMap[targetDegree.toLowerCase()] ?? targetDegree;
    query = query.eq('degree_level', mapped);
  }

  const { data } = await query.limit(1).maybeSingle();
  if (!data) return [];

  const reqs: ProgramRequirement[] = [];
  const conf = data.confidence_score ?? 0.5;
  const fakeProgId = `uni:${universityId}`;

  if (data.consensus_min_gpa != null) {
    reqs.push(createRequirement(fakeProgId, 'overall_grade_minimum', {
      minimum_overall_grade: data.consensus_min_gpa,
      confidence: conf,
      review_status: 'consensus',
    }));
  }

  if (data.consensus_min_ielts != null) {
    reqs.push(createRequirement(fakeProgId, 'english_minimum', {
      english_test_type: 'ielts',
      minimum_english_total: data.consensus_min_ielts,
      confidence: conf,
      review_status: 'consensus',
    }));
  }

  if (data.consensus_min_toefl != null) {
    reqs.push(createRequirement(fakeProgId, 'english_minimum', {
      english_test_type: 'toefl',
      minimum_english_total: data.consensus_min_toefl,
      confidence: conf,
      review_status: 'consensus',
    }));
  }

  return reqs;
}
