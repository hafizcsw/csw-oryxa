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
import { calculateReadiness } from '@/features/readiness/engine';
import type { ReadinessProfile, RequirementTruthContext } from '@/features/readiness/types';

interface ReadinessTabProps {
  onTabChange?: (tab: string) => void;
}

const STORAGE_KEY = 'csw_readiness_profile';
const TARGET_KEY = 'csw_readiness_target_requirements';

function loadProfile(): ReadinessProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // noop
  }
  return {};
}

function loadTargetRequirements(): RequirementTruthContext | undefined {
  try {
    const saved = localStorage.getItem(TARGET_KEY);
    if (!saved) return undefined;
    const parsed = JSON.parse(saved) as RequirementTruthContext;
    if (!parsed || !parsed.source_status) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function ReadinessTab({ onTabChange }: ReadinessTabProps) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ReadinessProfile>(loadProfile);
  const [profileOpen, setProfileOpen] = useState(true);
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);
  const prepGridRef = useRef<HTMLDivElement | null>(null);

  const targetRequirements = useMemo(loadTargetRequirements, []);

  const handleChange = useCallback((updated: ReadinessProfile) => {
    setProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const result = useMemo(() => calculateReadiness(profile, targetRequirements), [profile, targetRequirements]);

  const gapCategories = useMemo(
    () => result.gaps.map(g => g.category),
    [result.gaps]
  );

  const handleServiceClick = useCallback((serviceId: string) => {
    setFocusedServiceId(serviceId);
    prepGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const hasData = !!(profile.target_country || profile.gpa || profile.english_test_type);

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

      {!result.requirement_truth_sufficient && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>{t('readiness.target_truth_missing')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="lg:sticky lg:top-4 space-y-4">
            {hasData ? (
              <ReadinessSummaryRail result={result} />
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
                  <AdmissionsProfileForm profile={profile} onChange={handleChange} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {hasData && result.gaps.length > 0 && (
            <GapCards gaps={result.gaps} onServiceClick={handleServiceClick} />
          )}

          {hasData && (
            <DocumentChecklist
              items={result.document_checklist}
              onUpload={() => onTabChange?.('documents')}
            />
          )}

          {hasData && (
            <AlternativeRoutes
              alternatives={result.alternatives}
              unavailableReasonKey={result.alternative_routes_unavailable_reason_key}
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
