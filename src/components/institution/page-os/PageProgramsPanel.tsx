/**
 * Programs management panel for university operators.
 * Splits fields into direct-safe (immediate) and governed (pending review).
 * Includes offers management per program.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, GraduationCap, ChevronDown, ChevronUp, Save, Loader2, Users, Calendar, ExternalLink, AlertCircle, ShieldCheck, Clock, Package, Plus, Trash2, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Program {
  id: string;
  title: string;
  degree_level: string | null;
  language: string | null;
  teaching_language: string | null;
  duration_months: number | null;
  tuition_yearly: number | null;
  currency_code: string | null;
  is_active: boolean;
  published: boolean;
  publish_status: string | null;
  application_deadline: string | null;
  apply_url: string | null;
  seats_total: number | null;
  seats_available: number | null;
  seats_status: string | null;
  study_mode: string | null;
  delivery_mode: string | null;
  pending_edits: number;
}

interface Offer {
  id: string;
  program_id: string;
  intake_term: string | null;
  intake_year: number | null;
  teaching_language: string | null;
  study_mode: string | null;
  delivery_mode: string | null;
  seats_total: number | null;
  seats_available: number | null;
  seats_status: string | null;
  application_deadline: string | null;
  apply_url: string | null;
  offer_status: string;
  tuition_amount: number | null;
  currency_code: string | null;
  faculty: string | null;
  department: string | null;
  campus: string | null;
}

interface Props {
  universityId: string;
}

const SEATS_STATUSES = ['open', 'limited', 'full', 'closed'] as const;

const GOVERNED_FIELDS = new Set(['title', 'degree_level', 'teaching_language', 'duration_months', 'tuition_yearly', 'currency_code']);

export function PageProgramsPanel({ universityId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Program>>>({});

  // Offers state
  const [offersExpanded, setOffersExpanded] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, Offer[]>>({});
  const [offersLoading, setOffersLoading] = useState<string | null>(null);
  const [offerEdits, setOfferEdits] = useState<Record<string, Partial<Offer>>>({});
  const [offerSaving, setOfferSaving] = useState<string | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'programs.list', university_id: universityId } });
    if (data?.ok) setPrograms(data.programs || []);
    setLoading(false);
  }, [universityId]);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  // ── Offers management via edge function ──
  const loadOffers = async (programId: string) => {
    setOffersLoading(programId);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'offers.list', university_id: universityId, program_id: programId } });
    if (data?.ok) {
      setOffers(prev => ({ ...prev, [programId]: data.offers || [] }));
    }
    setOffersLoading(null);
  };

  const toggleOffers = (programId: string) => {
    if (offersExpanded === programId) {
      setOffersExpanded(null);
    } else {
      setOffersExpanded(programId);
      if (!offers[programId]) loadOffers(programId);
    }
  };

  const addOffer = async (programId: string) => {
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'offers.create', university_id: universityId, program_id: programId } });
    if (data?.ok && data.offer) {
      setOffers(prev => ({
        ...prev,
        [programId]: [data.offer, ...(prev[programId] || [])],
      }));
      toast({ title: t('offers.created') });
    } else {
      toast({ title: t('error.generic'), variant: 'destructive' });
    }
  };

  const saveOffer = async (offer: Offer) => {
    setOfferSaving(offer.id);
    const changes = offerEdits[offer.id] || {};
    const payload = { ...offer, ...changes };
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'offers.update',
        university_id: universityId,
        offer_id: offer.id,
        intake_term: payload.intake_term,
        intake_year: payload.intake_year,
        teaching_language: payload.teaching_language,
        study_mode: payload.study_mode,
        delivery_mode: payload.delivery_mode,
        seats_total: payload.seats_total,
        seats_available: payload.seats_available,
        seats_status: payload.seats_status,
        application_deadline: payload.application_deadline,
        apply_url: payload.apply_url,
        offer_status: payload.offer_status,
        tuition_amount: payload.tuition_amount,
        currency_code: payload.currency_code,
        faculty: payload.faculty,
        department: payload.department,
        campus: payload.campus,
      } });
    setOfferSaving(null);
    if (data?.ok) {
      setOfferEdits(prev => { const n = { ...prev }; delete n[offer.id]; return n; });
      toast({ title: t('offers.saved') });
    } else {
      toast({ title: t('error.generic'), variant: 'destructive' });
    }
  };

  const deleteOffer = async (offerId: string, programId: string) => {
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'offers.delete', university_id: universityId, offer_id: offerId } });
    if (data?.ok) {
      setOffers(prev => ({
        ...prev,
        [programId]: (prev[programId] || []).filter(o => o.id !== offerId),
      }));
      toast({ title: t('offers.deleted') });
    }
  };

  const getOfferEdit = (id: string) => offerEdits[id] || {};
  const setOfferField = (id: string, field: string, value: unknown) => {
    setOfferEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getEdit = (id: string) => edits[id] || {};
  const setField = (id: string, field: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveProgram = async (id: string) => {
    const changes = edits[id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(id);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'programs.update', university_id: universityId, program_id: id, ...changes } });
    if (data?.ok) {
      const directCount = data.direct_applied?.length || 0;
      const governedCount = data.governed_pending?.length || 0;
      let msg = '';
      if (directCount > 0) msg += t('pageOS.programs.directApplied', { count: directCount });
      if (governedCount > 0) msg += (msg ? ' · ' : '') + t('pageOS.programs.governedPending', { count: governedCount });
      toast({ title: msg || t('pageOS.programs.saved') });
      setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      await fetchPrograms();
    } else {
      toast({ title: t('pageOS.programs.saveError'), variant: 'destructive' });
    }
    setSaving(null);
  };

  const filtered = programs.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.title || '').toLowerCase().includes(q) || (p.degree_level || '').toLowerCase().includes(q);
  });

  const seatsStatusColor = (s: string | null) => {
    switch (s) {
      case 'open': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'limited': return 'bg-amber-500/10 text-amber-700 border-amber-200';
      case 'full': return 'bg-red-500/10 text-red-700 border-red-200';
      case 'closed': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const FieldLabel = ({ label, field }: { label: string; field: string }) => {
    const isGoverned = GOVERNED_FIELDS.has(field);
    return (
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {label}
        {isGoverned ? (
          <span className="inline-flex items-center gap-0.5 text-amber-600" title={t('pageOS.truth.governedTooltip')}>
            <ShieldCheck className="h-3 w-3" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-green-600" title={t('pageOS.truth.directTooltip')}>
            <Clock className="h-3 w-3" />
          </span>
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('pageOS.programs.title')}</h3>
          <Badge variant="secondary">{programs.length}</Badge>
        </div>
      </div>

      {/* Truth boundary legend */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">{t('pageOS.truth.legend')}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-green-600">
            <Clock className="h-3 w-3" /> {t('pageOS.truth.directLabel')}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600">
            <ShieldCheck className="h-3 w-3" /> {t('pageOS.truth.governedLabel')}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={t('pageOS.programs.searchPlaceholder')}
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
          <p className="text-sm text-muted-foreground">{t('pageOS.programs.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(prog => {
            const isExpanded = expandedId === prog.id;
            const edit = getEdit(prog.id);
            const hasChanges = Object.keys(edit).length > 0;
            const effectiveSeatsStatus = (edit.seats_status as string) ?? prog.seats_status ?? 'open';
            const programOffers = offers[prog.id] || [];
            const isOffersOpen = offersExpanded === prog.id;

            return (
              <div key={prog.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : prog.id)}
                >
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{prog.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {prog.degree_level && <span>{prog.degree_level}</span>}
                      {prog.duration_months && <span>• {prog.duration_months} {t('pageOS.programs.months')}</span>}
                      {prog.teaching_language && <span>• {prog.teaching_language.toUpperCase()}</span>}
                    </div>
                  </div>
                  {prog.pending_edits > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                      {prog.pending_edits} {t('pageOS.truth.pending')}
                    </Badge>
                  )}
                  <Badge className={`text-xs ${seatsStatusColor(effectiveSeatsStatus)}`}>
                    {t(`pageOS.programs.seats.${effectiveSeatsStatus}`)}
                  </Badge>
                  {prog.published ? (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700">{t('pageOS.programs.published')}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">{t('pageOS.programs.draft')}</Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                    {/* Governed fields section */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <ShieldCheck className="h-4 w-4" />
                        {t('pageOS.truth.governedSection')}
                      </div>
                      <p className="text-xs text-amber-700">{t('pageOS.truth.governedHint')}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.title')} field="title" />
                          <input className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.title as string) ?? prog.title ?? ''} onChange={e => setField(prog.id, 'title', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.degreeLevel')} field="degree_level" />
                          <select className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.degree_level as string) ?? prog.degree_level ?? ''} onChange={e => setField(prog.id, 'degree_level', e.target.value)}>
                            <option value="">—</option>
                            <option value="Bachelor">Bachelor</option>
                            <option value="Master">Master</option>
                            <option value="PhD">PhD</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Certificate">Certificate</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.language')} field="teaching_language" />
                          <input className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.teaching_language as string) ?? prog.teaching_language ?? ''} onChange={e => setField(prog.id, 'teaching_language', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.duration')} field="duration_months" />
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.duration_months as number) ?? prog.duration_months ?? ''} onChange={e => setField(prog.id, 'duration_months', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.tuition')} field="tuition_yearly" />
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.tuition_yearly as number) ?? prog.tuition_yearly ?? ''} onChange={e => setField(prog.id, 'tuition_yearly', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('pageOS.programs.fields.currency')} field="currency_code" />
                          <input className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-background text-sm" value={(edit.currency_code as string) ?? prog.currency_code ?? ''} onChange={e => setField(prog.id, 'currency_code', e.target.value)} placeholder="USD, EUR, TRY..." />
                        </div>
                      </div>
                    </div>

                    {/* Direct-safe fields section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <FieldLabel label={t('pageOS.programs.fields.deadline')} field="application_deadline" />
                        <input type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.application_deadline as string) ?? prog.application_deadline ?? ''} onChange={e => setField(prog.id, 'application_deadline', e.target.value || null)} />
                      </div>
                      <div className="space-y-1">
                        <FieldLabel label={t('pageOS.programs.fields.applyUrl')} field="apply_url" />
                        <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.apply_url as string) ?? prog.apply_url ?? ''} onChange={e => setField(prog.id, 'apply_url', e.target.value || null)} placeholder="https://..." />
                      </div>
                    </div>

                    {/* Seats - direct safe */}
                    <div className="rounded-lg border border-border p-3 space-y-3 bg-background">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4 text-primary" />
                        {t('pageOS.programs.seats.title')}
                        <span className="text-xs text-green-600 inline-flex items-center gap-0.5"><Clock className="h-3 w-3" /> {t('pageOS.truth.directLabel')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t('pageOS.programs.seats.total')}</label>
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.seats_total as number) ?? prog.seats_total ?? ''} onChange={e => setField(prog.id, 'seats_total', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t('pageOS.programs.seats.available')}</label>
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={(edit.seats_available as number) ?? prog.seats_available ?? ''} onChange={e => setField(prog.id, 'seats_available', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{t('pageOS.programs.seats.status')}</label>
                          <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={effectiveSeatsStatus} onChange={e => setField(prog.id, 'seats_status', e.target.value)}>
                            {SEATS_STATUSES.map(s => (
                              <option key={s} value={s}>{t(`pageOS.programs.seats.${s}`)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ═══ OFFERS SECTION ═══ */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                      <button
                        className="w-full flex items-center justify-between"
                        onClick={() => toggleOffers(prog.id)}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Package className="h-4 w-4 text-primary" />
                          {t('offers.title')}
                          {programOffers.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{programOffers.length}</Badge>
                          )}
                        </div>
                        {isOffersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>

                      {isOffersOpen && (
                        <div className="space-y-3 pt-2">
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => addOffer(prog.id)} className="gap-1.5 rounded-xl text-xs">
                              <Plus className="w-3.5 h-3.5" /> {t('offers.add')}
                            </Button>
                          </div>

                          {offersLoading === prog.id && (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                          )}

                          {programOffers.length === 0 && offersLoading !== prog.id && (
                            <p className="text-xs text-muted-foreground text-center py-3">{t('offers.empty')}</p>
                          )}

                          {programOffers.map(offer => {
                            const oe = getOfferEdit(offer.id);
                            const hasOfferChanges = Object.keys(oe).length > 0;
                            return (
                              <div key={offer.id} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                                <div className="flex items-center justify-between">
                                  <Badge variant={(oe.offer_status as string ?? offer.offer_status) === 'active' ? 'default' : 'secondary'} className="text-xs">
                                    {oe.offer_status as string ?? offer.offer_status}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => saveOffer(offer)}
                                      disabled={!hasOfferChanges || offerSaving === offer.id}
                                      className="gap-1 text-xs h-7"
                                    >
                                      {offerSaving === offer.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                      {t('action.save')}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7" onClick={() => deleteOffer(offer.id, prog.id)}>
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.intakeTerm')}</label>
                                    <select
                                      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.intake_term as string ?? offer.intake_term ?? ''}
                                      onChange={e => setOfferField(offer.id, 'intake_term', e.target.value)}
                                    >
                                      <option value="">—</option>
                                      <option value="fall">Fall</option>
                                      <option value="spring">Spring</option>
                                      <option value="summer">Summer</option>
                                      <option value="winter">Winter</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.intakeYear')}</label>
                                    <input type="number" className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.intake_year as number ?? offer.intake_year ?? ''}
                                      onChange={e => setOfferField(offer.id, 'intake_year', parseInt(e.target.value) || null)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.status')}</label>
                                    <select
                                      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.offer_status as string ?? offer.offer_status}
                                      onChange={e => setOfferField(offer.id, 'offer_status', e.target.value)}
                                    >
                                      <option value="active">Active</option>
                                      <option value="draft">Draft</option>
                                      <option value="closed">Closed</option>
                                      <option value="archived">Archived</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.language')}</label>
                                    <input className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.teaching_language as string ?? offer.teaching_language ?? ''}
                                      onChange={e => setOfferField(offer.id, 'teaching_language', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {t('offers.seatsTotal')}
                                    </label>
                                    <input type="number" className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.seats_total as number ?? offer.seats_total ?? ''}
                                      onChange={e => setOfferField(offer.id, 'seats_total', parseInt(e.target.value) || null)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                                      <Calendar className="w-3 h-3" /> {t('offers.deadline')}
                                    </label>
                                    <input type="date" className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.application_deadline as string ?? offer.application_deadline ?? ''}
                                      onChange={e => setOfferField(offer.id, 'application_deadline', e.target.value || null)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" /> {t('offers.tuition')}
                                    </label>
                                    <input type="number" className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.tuition_amount as number ?? offer.tuition_amount ?? ''}
                                      onChange={e => setOfferField(offer.id, 'tuition_amount', parseFloat(e.target.value) || null)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.campus')}</label>
                                    <input className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.campus as string ?? offer.campus ?? ''}
                                      onChange={e => setOfferField(offer.id, 'campus', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-2 md:col-span-3">
                                    <label className="text-[10px] text-muted-foreground uppercase">{t('offers.applyUrl')}</label>
                                    <input className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                                      value={oe.apply_url as string ?? offer.apply_url ?? ''}
                                      onChange={e => setOfferField(offer.id, 'apply_url', e.target.value)}
                                      placeholder="https://..."
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Publish toggle + save */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={(edit.published as boolean) ?? prog.published} onChange={e => setField(prog.id, 'published', e.target.checked)} className="rounded border-border" />
                        {t('pageOS.programs.fields.published')}
                      </label>
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        disabled={!hasChanges || saving === prog.id}
                        onClick={() => saveProgram(prog.id)}
                      >
                        {saving === prog.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {t('pageOS.programs.save')}
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
