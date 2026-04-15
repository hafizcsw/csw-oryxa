import { useState, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AdmissionsProfileForm } from './AdmissionsProfileForm';
import { ReadinessSummaryRail } from './ReadinessSummaryRail';
import { GapCards } from './GapCards';
import { DocumentChecklist } from './DocumentChecklist';
import { AlternativeRoutes } from './AlternativeRoutes';
import { PrepServiceGrid } from './PrepServiceGrid';
import { useStudentReadiness } from '@/hooks/useStudentReadiness';
import { adaptCrmToReadinessProfile } from '@/features/readiness/profileAdapter';
import type { ReadinessProfile, RequirementTruthContext } from '@/features/readiness/types';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';

interface ReadinessTabProps {
  onTabChange?: (tab: string) => void;
  /** CRM-backed student profile — the ONLY source of truth */
  crmProfile?: StudentPortalProfile | null;
  /** CRM-backed student documents */
  documents?: StudentDocument[];
  /** Target program/university requirements (from DB truth) */
  targetRequirements?: RequirementTruthContext;
}

const STORAGE_KEY = 'csw_readiness_profile';

/**
 * Load supplementary fields that CRM doesn't yet store (test scores, intake preferences).
 * These are ONLY used to supplement CRM data, not replace it.
 */
function loadSupplementaryProfile(): Partial<ReadinessProfile> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only return fields CRM doesn't provide
      return {
        english_test_type: parsed.english_test_type,
        english_test_score: parsed.english_test_score,
        other_test_type: parsed.other_test_type,
        other_test_score: parsed.other_test_score,
        intake_semester: parsed.intake_semester,
        intake_year: parsed.intake_year,
        subjects_completed: parsed.subjects_completed,
        scholarship_needed: parsed.scholarship_needed,
      };
    }
  } catch {
    // noop
  }
  return {};
}

export function ReadinessTab({ onTabChange, crmProfile, documents = [], targetRequirements }: ReadinessTabProps) {
  const { t } = useLanguage();
  const [supplementary, setSupplementary] = useState<Partial<ReadinessProfile>>(loadSupplementaryProfile);
  const [profileOpen, setProfileOpen] = useState(true);
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);
  const prepGridRef = useRef<HTMLDivElement | null>(null);

  // Compose CRM-backed readiness with supplementary inputs
  const { completeness, eligibility, gates } = useStudentReadiness(
    crmProfile ?? null,
    documents,
    targetRequirements,
  );

  // Merge CRM-adapted profile with supplementary fields for the form
  const mergedProfile = useMemo(() => {
    const crmAdapted = adaptCrmToReadinessProfile(crmProfile ?? null, documents);
    return { ...crmAdapted, ...supplementary };
  }, [crmProfile, documents, supplementary]);

  const handleChange = useCallback((updated: ReadinessProfile) => {
    // Only persist supplementary fields (test scores, intake prefs)
    const supp: Partial<ReadinessProfile> = {
      english_test_type: updated.english_test_type,
      english_test_score: updated.english_test_score,
      other_test_type: updated.other_test_type,
      other_test_score: updated.other_test_score,
      intake_semester: updated.intake_semester,
      intake_year: updated.intake_year,
      subjects_completed: updated.subjects_completed,
      scholarship_needed: updated.scholarship_needed,
    };
    setSupplementary(supp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(supp));
  }, []);

  const gapCategories = useMemo(
    () => eligibility.gaps.map(g => g.category),
    [eligibility.gaps]
  );

  const handleServiceClick = useCallback((serviceId: string) => {
    setFocusedServiceId(serviceId);
    prepGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const hasData = !!(crmProfile || mergedProfile.english_test_type || mergedProfile.gpa);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('readiness.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('readiness.subtitle')}</p>
        </div>
      </div>

      {!eligibility.requirement_truth_sufficient && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>{t('readiness.target_truth_missing')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="lg:sticky lg:top-4 space-y-4">
            {hasData ? (
              <ReadinessSummaryRail result={eligibility} />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
                <Shield className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">{t('readiness.empty_state')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 order-1 lg:order-2 space-y-8">
          <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full h-14 justify-between px-6 rounded-none">
                  <span className="font-semibold text-foreground">{t('readiness.profile.title')}</span>
                  {profileOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-6 pt-0">
                  <AdmissionsProfileForm profile={mergedProfile} onChange={handleChange} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {hasData && eligibility.gaps.length > 0 && (
            <GapCards gaps={eligibility.gaps} onServiceClick={handleServiceClick} />
          )}

          {hasData && (
            <DocumentChecklist
              items={eligibility.document_checklist}
              onUpload={() => onTabChange?.('documents')}
            />
          )}

          {hasData && (
            <AlternativeRoutes
              alternatives={eligibility.alternatives}
              unavailableReasonKey={eligibility.alternative_routes_unavailable_reason_key}
            />
          )}

          {hasData && (
            <div ref={prepGridRef}>
              <PrepServiceGrid
                highlightCategories={gapCategories}
                focusedServiceId={focusedServiceId}
                onServiceClick={handleServiceClick}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
