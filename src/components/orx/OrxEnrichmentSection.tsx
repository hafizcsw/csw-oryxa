/**
 * OrxEnrichmentSection — Renders published enrichment facts for beta-approved entities.
 * Only shows facts with status=published from vw_entity_enrichment_published.
 * Never renders raw evidence.
 */

import { useTranslation } from 'react-i18next';
import { Award, BookOpen, ExternalLink, FileText, Sparkles, Shield, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEntityEnrichmentFacts, groupFactsByType, type EnrichmentFact } from '@/hooks/useEntityEnrichmentFacts';
import { cn } from '@/lib/utils';

interface OrxEnrichmentSectionProps {
  entityType: 'university' | 'program' | 'country';
  entityId: string | null | undefined;
  isBetaApproved: boolean;
  className?: string;
}

const FACT_TYPE_CONFIG: Record<string, { icon: typeof Award; labelKey: string; color: string }> = {
  accreditation: {
    icon: Shield,
    labelKey: 'orx.enrichment.accreditation',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  professional_recognition: {
    icon: Award,
    labelKey: 'orx.enrichment.professionalRecognition',
    color: 'text-blue-600 dark:text-blue-400',
  },
  official_handbook: {
    icon: BookOpen,
    labelKey: 'orx.enrichment.officialHandbook',
    color: 'text-violet-600 dark:text-violet-400',
  },
  official_brochure: {
    icon: FileText,
    labelKey: 'orx.enrichment.officialBrochure',
    color: 'text-amber-600 dark:text-amber-400',
  },
  curriculum_link: {
    icon: BookOpen,
    labelKey: 'orx.enrichment.curriculumLink',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  external_registry: {
    icon: ExternalLink,
    labelKey: 'orx.enrichment.externalRegistry',
    color: 'text-slate-600 dark:text-slate-400',
  },
  notable_program_fact: {
    icon: Sparkles,
    labelKey: 'orx.enrichment.notableFact',
    color: 'text-primary',
  },
  lab_facility: {
    icon: FlaskConical,
    labelKey: 'orx.enrichment.labFacility',
    color: 'text-rose-600 dark:text-rose-400',
  },
  official_resource: {
    icon: FileText,
    labelKey: 'orx.enrichment.officialResource',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
};

function FactCard({ fact }: { fact: EnrichmentFact }) {
  const { t } = useTranslation();
  const config = FACT_TYPE_CONFIG[fact.fact_type] || FACT_TYPE_CONFIG.notable_program_fact;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/40 hover:border-border/70 transition-colors">
      <div className={cn('mt-0.5 shrink-0', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {fact.display_text && (
          <p className="text-sm text-foreground leading-relaxed">{fact.display_text}</p>
        )}
        {fact.source_url && (
          <a
            href={fact.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {fact.source_domain || new URL(fact.source_url).hostname}
          </a>
        )}
        {fact.confidence != null && fact.confidence >= 80 && (
          <Badge variant="outline" className="mt-1.5 text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400">
            {t('orx.enrichment.verified')}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function OrxEnrichmentSection({ entityType, entityId, isBetaApproved, className }: OrxEnrichmentSectionProps) {
  const { t } = useTranslation();
  const { data: facts, isLoading } = useEntityEnrichmentFacts({
    entityType,
    entityId,
    enabled: isBetaApproved,
  });

  // Gate: only render for beta-approved entities with published facts
  if (!isBetaApproved || isLoading || !facts || facts.length === 0) {
    return null;
  }

  const grouped = groupFactsByType(facts);

  // Priority display order
  const displayOrder = [
    'accreditation',
    'professional_recognition',
    'official_handbook',
    'official_brochure',
    'curriculum_link',
    'external_registry',
    'lab_facility',
    'notable_program_fact',
    'official_resource',
  ];

  const orderedGroups = displayOrder
    .filter(type => grouped[type]?.length > 0)
    .map(type => ({ type, facts: grouped[type] }));

  // Also include any fact types not in the predefined order
  Object.keys(grouped).forEach(type => {
    if (!displayOrder.includes(type) && grouped[type].length > 0) {
      orderedGroups.push({ type, facts: grouped[type] });
    }
  });

  if (orderedGroups.length === 0) return null;

  return (
    <Card className={cn('border-border/60', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('orx.enrichment.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t('orx.enrichment.subtitle')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {orderedGroups.map(({ type, facts: groupFacts }) => {
          const config = FACT_TYPE_CONFIG[type] || FACT_TYPE_CONFIG.notable_program_fact;
          const Icon = config.icon;
          return (
            <div key={type}>
              <h4 className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2', config.color)}>
                <Icon className="h-3.5 w-3.5" />
                {t(config.labelKey)}
              </h4>
              <div className="space-y-2">
                {groupFacts.slice(0, 5).map(fact => (
                  <FactCard key={fact.id} fact={fact} />
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground/70 pt-2 border-t border-border/30">
          {t('orx.enrichment.poweredBy')}
        </p>
      </CardContent>
    </Card>
  );
}
