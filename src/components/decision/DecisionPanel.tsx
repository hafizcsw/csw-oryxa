import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle,
  Target, Zap, TrendingUp, AlertOctagon, MapPin,
} from 'lucide-react';
import type { DecisionResult, DomainDecision, Blocker, LanguageGap, DecisionReason } from '@/features/decision-engine/types';

interface DecisionPanelProps {
  decision: DecisionResult;
  requirementsCount?: number;
  requirementsSource?: string;
  requirementsProgramName?: string;
}

const STATUS_COLORS = {
  complete: 'text-green-600 bg-green-500/10',
  partial: 'text-amber-600 bg-amber-500/10',
  insufficient: 'text-red-600 bg-red-500/10',
  eligible: 'text-green-600 bg-green-500/10',
  conditionally_eligible: 'text-amber-600 bg-amber-500/10',
  not_eligible: 'text-red-600 bg-red-500/10',
  unknown: 'text-muted-foreground bg-muted',
  strong_fit: 'text-green-600 bg-green-500/10',
  moderate_fit: 'text-amber-600 bg-amber-500/10',
  weak_fit: 'text-red-500 bg-red-500/10',
  no_fit: 'text-red-600 bg-red-500/10',
  strong: 'text-green-600 bg-green-500/10',
  moderate: 'text-amber-600 bg-amber-500/10',
  weak: 'text-red-500 bg-red-500/10',
};

export function DecisionPanel({ decision }: DecisionPanelProps) {
  const { t } = useLanguage();
  const d = decision;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t('decision.panel_title')}</h3>
          <p className="text-xs text-muted-foreground">{t('decision.panel_subtitle')}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            icon={<Target className="h-4 w-4" />}
            title={t('decision.completeness')}
            status={d.completeness_status}
            score={d.completeness_score}
          />
          <StatusCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            title={t('decision.eligibility_title')}
            status={d.eligibility_status}
          />
          <StatusCard
            icon={<Zap className="h-4 w-4" />}
            title={t('decision.fit_title')}
            status={d.fit_status}
          />
          <StatusCard
            icon={<TrendingUp className="h-4 w-4" />}
            title={t('decision.competitiveness')}
            status={d.competitiveness_status}
          />
        </div>

        {/* Blockers */}
        {d.blockers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-500" />
              {t('decision.blockers_title')} ({d.blockers.length})
            </h4>
            <div className="space-y-2">
              {d.blockers.map(b => (
                <BlockerCard key={b.blocker_id} blocker={b} />
              ))}
            </div>
          </div>
        )}

        {/* Language Gaps */}
        {d.language_gaps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              {t('decision.language_gaps')}
            </h4>
            <div className="space-y-1">
              {d.language_gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-muted/30">
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-foreground">
                    {g.test_type.toUpperCase()} {g.component}: {g.student_score ?? '—'} / {g.required_score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Items */}
        {d.missing_required_items.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              {t('decision.missing_items')} ({d.missing_required_items.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {d.missing_required_items.map(item => (
                <span key={item.code} className="px-2 py-1 rounded bg-amber-500/10 text-amber-700 text-xs">
                  {t(item.label_key)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Domain Decisions */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t('decision.candidate_domains')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[...d.candidate_domains, ...d.maybe_domains, ...d.rejected_domains].map(dom => (
              <DomainCard key={dom.domain} domain={dom} />
            ))}
          </div>
        </div>

        {/* Counts */}
        {d.data_lane_available && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <CountCard label={t('decision.countries')} count={d.candidate_country_count} />
            <CountCard label={t('decision.universities')} count={d.candidate_university_count} />
            <CountCard label={t('decision.programs')} count={d.candidate_program_count} />
          </div>
        )}

        {!d.data_lane_available && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {t('decision.counts_not_available')}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusCard({ icon, title, status, score }: {
  icon: React.ReactNode;
  title: string;
  status: string;
  score?: number;
}) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.unknown;
  return (
    <div className={`rounded-xl p-3 ${colors}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-sm font-bold capitalize">{status.replace('_', ' ')}</p>
      {score !== undefined && (
        <div className="mt-1">
          <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full rounded-full bg-current transition-all" style={{ width: `${score}%` }} />
          </div>
          <p className="text-xs mt-0.5">{score}%</p>
        </div>
      )}
    </div>
  );
}

function BlockerCard({ blocker }: { blocker: Blocker }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-200/30">
      {blocker.severity === 'blocking' ?
        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> :
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      }
      <div>
        <p className="text-sm font-medium text-foreground">{t(blocker.label_key)}</p>
        {blocker.detail && <p className="text-xs text-muted-foreground">{blocker.detail}</p>}
      </div>
    </div>
  );
}

function DomainCard({ domain }: { domain: DomainDecision }) {
  const { t } = useLanguage();
  const statusIcon = domain.status === 'candidate' ? '✅' : domain.status === 'maybe' ? '🟡' : '❌';
  const bg = domain.status === 'candidate' ? 'bg-green-500/5 border-green-200/30' :
    domain.status === 'maybe' ? 'bg-amber-500/5 border-amber-200/30' :
    'bg-muted/30 border-border/50';

  return (
    <div className={`rounded-xl p-3 border ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{statusIcon}</span>
        <span className="text-sm font-semibold text-foreground capitalize">{domain.domain.replace('_', ' ')}</span>
      </div>
      <div className="space-y-0.5">
        {domain.reasons.slice(0, 3).map((r, i) => (
          <p key={i} className="text-xs text-muted-foreground">{t(r.label_key)}</p>
        ))}
      </div>
    </div>
  );
}

function CountCard({ label, count }: { label: string; count: number | null }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <p className="text-2xl font-bold text-foreground">{count ?? '—'}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
