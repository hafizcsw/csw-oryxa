/**
 * Scholarships management panel for university operators.
 * Splits fields into direct-safe (immediate) and governed (pending review).
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Award, Search, X, ChevronDown, ChevronUp, Save, Loader2, Calendar, ExternalLink, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Scholarship {
  id: string;
  title: string;
  status: string | null;
  deadline: string | null;
  amount: number | null;
  amount_value: number | null;
  amount_type: string | null;
  currency_code: string | null;
  coverage_type: string | null;
  eligibility: string[] | null;
  degree_level: string | null;
  study_level: string | null;
  description: string | null;
  application_url: string | null;
  is_active: boolean;
  program_id: string | null;
  pending_edits: number;
}

interface Props {
  universityId: string;
}

const STATUS_OPTIONS = ['published', 'draft', 'closed', 'upcoming'] as const;
const GOVERNED_FIELDS = new Set(['title', 'amount', 'amount_value', 'amount_type', 'currency_code', 'coverage_type', 'eligibility', 'degree_level', 'study_level', 'description']);

export function PageScholarshipsPanel({ universityId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Scholarship>>>({});

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'scholarships.list', university_id: universityId } });
    if (data?.ok) setScholarships(data.scholarships || []);
    setLoading(false);
  }, [universityId]);

  useEffect(() => { fetchScholarships(); }, [fetchScholarships]);

  const getEdit = (id: string) => edits[id] || {};
  const setField = (id: string, field: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveScholarship = async (id: string) => {
    const changes = edits[id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(id);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'scholarships.update', university_id: universityId, scholarship_id: id, ...changes } });
    if (data?.ok) {
      const directCount = data.direct_applied?.length || 0;
      const governedCount = data.governed_pending?.length || 0;
      let msg = '';
      if (directCount > 0) msg += t('pageOS.scholarships.directApplied', { count: directCount });
      if (governedCount > 0) msg += (msg ? ' · ' : '') + t('pageOS.scholarships.governedPending', { count: governedCount });
      toast({ title: msg || t('pageOS.scholarships.saved') });
      setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      await fetchScholarships();
    } else {
      toast({ title: t('pageOS.scholarships.saveError'), variant: 'destructive' });
    }
    setSaving(null);
  };

  const filtered = scholarships.filter(s => {
    if (!search.trim()) return true;
    return (s.title || '').toLowerCase().includes(search.toLowerCase());
  });

  const statusColor = (s: string | null) => {
    switch (s) {
      case 'published': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'upcoming': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'closed': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const FieldLabel = ({ label, field }: { label: string; field: string }) => {
    const isGoverned = GOVERNED_FIELDS.has(field);
    return (
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {label}
        {isGoverned ? (
          <span className="inline-flex items-center gap-0.5 text-amber-600"><ShieldCheck className="h-3 w-3" /></span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-green-600"><Clock className="h-3 w-3" /></span>
        )}
      </label>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('pageOS.scholarships.title')}</h3>
        <Badge variant="secondary">{scholarships.length}</Badge>
      </div>

      {/* Truth boundary legend */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">{t('pageOS.truth.legend')}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-green-600"><Clock className="h-3 w-3" /> {t('pageOS.truth.directLabel')}</span>
          <span className="inline-flex items-center gap-1 text-amber-600"><ShieldCheck className="h-3 w-3" /> {t('pageOS.truth.governedLabel')}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={t('pageOS.scholarships.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-8 flex flex-col items-center text-center gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('pageOS.scholarships.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sch => {
            const isExpanded = expandedId === sch.id;
            const edit = getEdit(sch.id);
            const hasChanges = Object.keys(edit).length > 0;
            const effectiveStatus = (edit.status as string) ?? sch.status ?? 'draft';

            return (
              <div key={sch.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : sch.id)}
                >
                  <Award className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{sch.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sch.degree_level && <span>{sch.degree_level}</span>}
                      {sch.deadline && <span> • {sch.deadline}</span>}
                      {sch.amount_value && <span> • {sch.amount_value} {sch.currency_code}</span>}
                    </div>
                  </div>
                  {sch.pending_edits > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                      {sch.pending_edits} {t('pageOS.truth.pending')}
                    </Badge>
                  )}
                  <Badge className={`text-xs ${statusColor(effectiveStatus)}`}>
                    {t(`pageOS.scholarships.status.${effectiveStatus}`)}
                  </Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                    {/* Governed fields */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <ShieldCheck className="h-4 w-4" />
                        {t('pageOS.truth.governedSection')}
                      </div>
                      <p className="text-xs text-amber-700">{t('pageOS.truth.governedHint')}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.scholarships.fields.title')} field="title" />
                          <input className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.title as string) ?? sch.title ?? ''} onChange={e => setField(sch.id, 'title', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.scholarships.fields.amount')} field="amount_value" />
                          <div className="flex gap-2">
                            <input type="number" className="flex-1 px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.amount_value as number) ?? sch.amount_value ?? ''} onChange={e => setField(sch.id, 'amount_value', e.target.value ? Number(e.target.value) : null)} />
                            <input className="w-20 px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.currency_code as string) ?? sch.currency_code ?? 'USD'} onChange={e => setField(sch.id, 'currency_code', e.target.value)} placeholder="USD" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.scholarships.fields.coverageType')} field="coverage_type" />
                          <select className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.coverage_type as string) ?? sch.coverage_type ?? ''} onChange={e => setField(sch.id, 'coverage_type', e.target.value || null)}>
                            <option value="">—</option>
                            <option value="full">Full</option>
                            <option value="partial">Partial</option>
                            <option value="tuition_only">Tuition Only</option>
                            <option value="stipend">Stipend</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.scholarships.fields.degreeLevel')} field="degree_level" />
                          <select className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.degree_level as string) ?? sch.degree_level ?? ''} onChange={e => setField(sch.id, 'degree_level', e.target.value || null)}>
                            <option value="">—</option>
                            <option value="Bachelor">Bachelor</option>
                            <option value="Master">Master</option>
                            <option value="PhD">PhD</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <FieldLabel label={t('pageOS.scholarships.fields.description')} field="description" />
                        <textarea className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm resize-y min-h-[80px]" value={(edit.description as string) ?? sch.description ?? ''} onChange={e => setField(sch.id, 'description', e.target.value || null)} rows={3} />
                      </div>
                    </div>

                    {/* Direct-safe fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <FieldLabel label={t('pageOS.scholarships.fields.status')} field="status" />
                        <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={effectiveStatus} onChange={e => setField(sch.id, 'status', e.target.value)}>
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{t(`pageOS.scholarships.status.${s}`)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <FieldLabel label={t('pageOS.scholarships.fields.deadline')} field="deadline" />
                        <input type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.deadline as string) ?? sch.deadline ?? ''} onChange={e => setField(sch.id, 'deadline', e.target.value || null)} />
                      </div>
                      <div className="col-span-full space-y-1">
                        <FieldLabel label={t('pageOS.scholarships.fields.applicationUrl')} field="application_url" />
                        <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.application_url as string) ?? sch.application_url ?? ''} onChange={e => setField(sch.id, 'application_url', e.target.value || null)} placeholder="https://..." />
                      </div>
                    </div>

                    {/* Active + save */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={(edit.is_active as boolean) ?? sch.is_active} onChange={e => setField(sch.id, 'is_active', e.target.checked)} className="rounded border-border" />
                        {t('pageOS.scholarships.fields.active')}
                      </label>
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        disabled={!hasChanges || saving === sch.id}
                        onClick={() => saveScholarship(sch.id)}
                      >
                        {saving === sch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {t('pageOS.scholarships.save')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
