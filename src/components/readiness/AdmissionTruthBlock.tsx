/**
 * Structured Admission Truth Block
 * Shows honest admission requirements for a university or program
 * Degrades gracefully when data is missing
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Clock, GraduationCap, Globe, BookOpen, FileText, Calendar, DollarSign, Home, ArrowRight, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AdmissionRequirement {
  label_key: string;
  value?: string | number | null;
  met?: boolean; // if student data available
  unavailable?: boolean;
}

interface AdmissionRoute {
  type: 'direct' | 'conditional' | 'foundation' | 'pathway' | 'preparatory';
  label_key: string;
  requirements: AdmissionRequirement[];
  available?: boolean | null;
}

export interface TruthBlockData {
  routes?: AdmissionRoute[];
  language_requirements?: Array<{ test: string; min_score?: number | null }>;
  academic_requirements?: Array<{ label_key: string; value?: string | null }>;
  prerequisite_subjects?: string[];
  deadlines?: Array<{ intake: string; deadline?: string | null; status?: 'open' | 'closed' | 'upcoming' }>;
  scholarships?: Array<{ name: string; deadline?: string | null; type?: string }>;
  housing?: { available: boolean; cost_monthly?: number | null; currency?: string };
  required_documents?: string[];
  application_steps?: string[];
  last_verified?: string | null;
  source_status?: 'verified' | 'unverified' | 'partial';
}

interface AdmissionTruthBlockProps {
  data: TruthBlockData;
  entityType: 'university' | 'program';
  className?: string;
}

function StatusBadge({ status }: { status?: 'verified' | 'unverified' | 'partial' }) {
  const { t } = useTranslation();
  if (!status) return null;
  const config = {
    verified: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', key: 'truth.status.verified' },
    unverified: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', key: 'truth.status.unverified' },
    partial: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', key: 'truth.status.partial' },
  };
  const c = config[status];
  return <Badge className={cn('text-xs font-medium', c.color)}>{t(c.key)}</Badge>;
}

function UnavailableNote() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-2">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{t('truth.data_unavailable')}</span>
    </div>
  );
}

export function AdmissionTruthBlock({ data, entityType, className }: AdmissionTruthBlockProps) {
  const { t } = useTranslation();

  const hasAny = data.routes?.length || data.language_requirements?.length ||
    data.academic_requirements?.length || data.deadlines?.length ||
    data.required_documents?.length || data.scholarships?.length ||
    data.prerequisite_subjects?.length || data.application_steps?.length ||
    data.housing || data.last_verified || data.source_status;

  if (!hasAny) {
    return (
      <div className={cn('rounded-2xl border border-border bg-card p-6', className)}>
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">{t('truth.admission_requirements')}</h3>
        </div>
        <UnavailableNote />
      </div>
    );
  }

  return (
    <div data-entity-type={entityType} className={cn('rounded-2xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t('truth.admission_requirements')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={data.source_status} />
          {data.last_verified && (
            <span className="text-xs text-muted-foreground">
              {t('truth.last_verified')}: {new Date(data.last_verified).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Admission Routes */}
        {data.routes && data.routes.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              {t('truth.admission_routes')}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.routes.map((route, i) => (
                <div key={i} className={cn(
                  'rounded-xl border p-4 space-y-3',
                  route.available ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                )}>
                  <div className="space-y-1.5">
                    <span className="font-medium text-sm text-foreground block">{t(route.label_key)}</span>
                    <Badge variant={route.available === true ? 'default' : route.available === false ? 'secondary' : 'outline'} className="text-xs">
                      {route.available === true
                        ? t('truth.route_available')
                        : route.available === false
                          ? t('truth.route_unavailable')
                          : t('truth.route_unknown')}
                    </Badge>
                  </div>
                  {route.requirements.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                      {route.requirements.map((req, ri) => (
                        <div key={ri} className="flex items-center gap-2 text-xs text-muted-foreground">
                          {req.unavailable ? (
                            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                          ) : req.met ? (
                            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                          )}
                          <span>{t(req.label_key)}: {req.value ?? t('truth.not_specified')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Language Requirements */}
        {data.language_requirements && data.language_requirements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              {t('truth.language_requirements')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.language_requirements.map((lr, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-sm">
                  <span className="font-medium">{lr.test}</span>
                  {lr.min_score != null && (
                    <Badge variant="outline" className="text-xs">{lr.min_score}+</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Academic Requirements */}
        {data.academic_requirements && data.academic_requirements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {t('truth.academic_requirements')}
            </h4>
            <div className="space-y-1">
              {data.academic_requirements.map((ar, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{t(ar.label_key)}: {ar.value ?? t('truth.not_specified')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prerequisite Subjects */}
        {data.prerequisite_subjects && data.prerequisite_subjects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {t('truth.prerequisite_subjects')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.prerequisite_subjects.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Deadlines */}
        {data.deadlines && data.deadlines.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {t('truth.deadlines')}
            </h4>
            <div className="space-y-1.5">
              {data.deadlines.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                  <span className="text-foreground font-medium">{d.intake}</span>
                  <div className="flex items-center gap-2">
                    {d.deadline ? (
                      <span className="text-muted-foreground">{new Date(d.deadline).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">{t('truth.not_specified')}</span>
                    )}
                    {d.status && (
                      <Badge variant={d.status === 'open' ? 'default' : d.status === 'upcoming' ? 'secondary' : 'destructive'} className="text-xs">
                        {t(`truth.intake_${d.status}`)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Documents */}
        {data.required_documents && data.required_documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {t('truth.required_documents')}
            </h4>
            <div className="space-y-1">
              {data.required_documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {doc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Application Steps */}
        {data.application_steps && data.application_steps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              {t('truth.application_steps')}
            </h4>
            <div className="space-y-1.5">
              {data.application_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">{i + 1}</span>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scholarships Summary */}
        {data.scholarships && data.scholarships.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              {t('truth.scholarships')}
            </h4>
            <div className="space-y-1.5">
              {data.scholarships.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                  <span className="text-foreground">{s.name}</span>
                  <div className="flex items-center gap-2">
                    {s.type && <Badge variant="outline" className="text-xs">{s.type}</Badge>}
                    {s.deadline && (
                      <span className="text-xs text-muted-foreground">{new Date(s.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Housing */}
        {data.housing && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              {t('truth.housing')}
            </h4>
            <div className="text-sm text-muted-foreground">
              {data.housing.available ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{t('truth.housing_available')}</span>
                  {data.housing.cost_monthly != null && (
                    <span className="font-medium text-foreground">
                      ~{data.housing.cost_monthly} {data.housing.currency || 'USD'}/{t('truth.per_month')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t('truth.housing_unavailable')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
