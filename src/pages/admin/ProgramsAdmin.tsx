import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLookups } from "@/hooks/useLookups";
import { DSButton } from "@/components/design-system/DSButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UniversitiesSelect } from "@/components/admin/UniversitiesSelect";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2, AlertTriangle, Rocket, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

type Program = {
  id: string;
  title: string;
  university_id: string;
  degree_id?: string | null;
  tuition_yearly?: number | null;
  duration_months?: number | null;
  ielts_required?: number | null;
  next_intake_date?: string | null;
  delivery_mode?: string | null;
  teaching_language?: string | null;
  currency_code?: string | null;
  city?: string | null;
  university_name?: string;
  publish_status?: string;
};

type BulkPublishState = {
  isOpen: boolean;
  loading: boolean;
  progress: number;
  result: { updated: number } | null;
  filter: 'all_drafts' | 'university';
  universityId: string;
};

export default function ProgramsAdmin() {
  const { degrees } = useLookups();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Program[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Program> | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [bulkPublish, setBulkPublish] = useState<BulkPublishState>({
    isOpen: false,
    loading: false,
    progress: 0,
    result: null,
    filter: 'all_drafts',
    universityId: '',
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s
      ? rows
      : rows.filter(
          r =>
            r.title.toLowerCase().includes(s) ||
            (r.university_name && r.university_name.toLowerCase().includes(s))
        );
  }, [rows, q]);

  const loadUniversities = async () => {
    // No longer needed - using UniversitiesSelect component with virtual scrolling
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("programs")
      .select(
        "id,title,university_id,degree_id,tuition_yearly,duration_months,ielts_required,next_intake_date,delivery_mode,teaching_language,currency_code,city,publish_status,universities(name)"
      )
      .order("title")
      .limit(1000);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    const mapped = (data || []).map((r: any) => ({
      ...r,
      university_name: r.universities?.name || "—",
    }));
    setRows(mapped);
    setLoading(false);
  };

  const loadDraftCount = async () => {
    const { count, error } = await supabase
      .from("programs")
      .select("id", { count: 'exact', head: true })
      .eq("publish_status", "draft");
    console.log('[ProgramsAdmin] Draft count:', count, error);
    setDraftCount(count || 0);
  };

  useEffect(() => {
    loadUniversities();
    load();
    loadDraftCount();
  }, []);

  const remove = async (id: string) => {
    if (!confirm(t('admin.programsAdmin.confirmDelete'))) return;
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: t('admin.programsAdmin.error'), description: error.message });
      return;
    }
    toast({ title: t('admin.programsAdmin.deleted') });
    setRows(prev => prev.filter(x => x.id !== id));
  };

  const save = async () => {
    if (!editing) return;
    const { id, university_name, ...payload } = editing as any;
    
    // ❌ BLOCKED: No new program creation from this page
    if (!id) {
      toast({
        variant: "destructive",
        title: t('admin.programsAdmin.blockedPath'),
        description: t('admin.programsAdmin.blockedPathDesc'),
      });
      return;
    }
    
    // ✅ UPDATE only allowed
    const { error: err } = await supabase.from("programs").update(payload).eq("id", id);
    if (err) {
      toast({ variant: "destructive", title: t('admin.programsAdmin.error'), description: err.message });
      return;
    }
    toast({ title: t('admin.programsAdmin.updated') });
    setEditing(null);
    await load();
  };

  const executeBulkPublish = async () => {
    setBulkPublish(prev => ({ ...prev, loading: true, progress: 10 }));
    
    try {
      const filters: Record<string, string> = { publish_status: 'draft' };
      if (bulkPublish.filter === 'university' && bulkPublish.universityId) {
        filters.university_id = bulkPublish.universityId;
      }

      setBulkPublish(prev => ({ ...prev, progress: 30 }));

      const { data, error } = await supabase.functions.invoke('admin-programs-bulk', {
        body: {
          action: 'fill_and_publish',
          filters,
          defaults: {
            intake_months: [9],
            next_intake_date: '2025-09-01',
            study_mode: 'on_campus',
            languages: ['en'],
            duration_months: 24,
            tuition_usd_min: 10000,
            tuition_usd_max: 30000,
          }
        }
      });

      setBulkPublish(prev => ({ ...prev, progress: 90 }));

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      setBulkPublish(prev => ({ 
        ...prev, 
        loading: false, 
        progress: 100, 
        result: { updated: data.updated } 
      }));

      toast({ 
        title: t('admin.programsAdmin.bulkPublishSuccess'), 
        description: t('admin.programsAdmin.bulkPublishSuccessDesc').replace('{count}', String(data.updated))
      });

      await load();
      await loadDraftCount();
    } catch (err: any) {
      console.error('Bulk publish error:', err);
      toast({ 
        variant: "destructive", 
        title: t('admin.programsAdmin.bulkPublishError'), 
        description: err.message 
      });
      setBulkPublish(prev => ({ ...prev, loading: false, progress: 0 }));
    }
  };

  return (
    <>
      <div className="container mx-auto py-8 px-4" dir="rtl">
        {/* ⚠️ Deprecation Banner */}
        <div className="mb-6 p-4 bg-muted border border-border rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground">{t('admin.programsAdmin.deprecationTitle')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('admin.programsAdmin.deprecationDesc')}
            </p>
            <a 
              href="/admin/universities" 
              className="inline-block mt-2 text-sm font-medium text-primary hover:text-primary/80 underline"
            >
              {t('admin.programsAdmin.goToUniversities')}
            </a>
          </div>
        </div>

        {/* 🚀 Bulk Publish Card */}
        {draftCount > 0 && (
          <div className="mb-6 p-6 bg-card border-2 border-primary/30 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Rocket className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">{t('admin.programsAdmin.bulkPublishTitle')}</h2>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.programsAdmin.draftsCount').replace('{count}', String(draftCount))}
              </span>
            </div>
            
            {!bulkPublish.result ? (
              <>
                <p className="text-muted-foreground mb-4">
                  {t('admin.programsAdmin.bulkPublishDesc').replace('{count}', String(draftCount))}
                </p>
                
                <div className="flex flex-wrap gap-4 items-end mb-4">
                  <div>
                    <Label className="mb-2 block">{t('admin.programsAdmin.publishScope')}</Label>
                    <Select
                      value={bulkPublish.filter}
                      onValueChange={(val) => setBulkPublish(prev => ({ 
                        ...prev, 
                        filter: val as 'all_drafts' | 'university' 
                      }))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_drafts">{t('admin.programsAdmin.allDrafts').replace('{count}', String(draftCount))}</SelectItem>
                        <SelectItem value="university">{t('admin.programsAdmin.specificUniversity')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {bulkPublish.filter === 'university' && (
                    <div>
                      <Label className="mb-2 block">{t('admin.programsAdmin.selectUniversity')}</Label>
                      <UniversitiesSelect
                        selectedId={bulkPublish.universityId}
                        onSelect={(uni) => setBulkPublish(prev => ({ ...prev, universityId: uni.id }))}
                      />
                    </div>
                  )}
                </div>

                {bulkPublish.loading && (
                  <div className="mb-4">
                    <Progress value={bulkPublish.progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">{t('admin.programsAdmin.publishing')}</p>
                  </div>
                )}

                <DSButton 
                  variant="primary" 
                  onClick={executeBulkPublish}
                  disabled={bulkPublish.loading || (bulkPublish.filter === 'university' && !bulkPublish.universityId)}
                  className="gap-2"
                >
                  {bulkPublish.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  {t('admin.programsAdmin.publishAllAtOnce')}
                </DSButton>
              </>
            ) : (
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">{t('admin.programsAdmin.publishedSuccess').replace('{count}', String(bulkPublish.result.updated))}</span>
                <DSButton 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBulkPublish(prev => ({ ...prev, result: null, progress: 0 }))}
                >
                  {t('admin.programsAdmin.publishMore')}
                </DSButton>
              </div>
            )}
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t('admin.programsAdmin.pageTitle')}</h1>
          <p className="text-muted-foreground">{t('admin.programsAdmin.pageDescription')}</p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <Input
            placeholder={t('admin.programsAdmin.searchPlaceholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
            className="max-w-xs"
          />
          <DSButton variant="outline" onClick={load}>
            {t('admin.programsAdmin.refresh')}
          </DSButton>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-4 font-semibold">{t('admin.programsAdmin.columns.program')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.university')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.level')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.language')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.feesYear')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.ielts')}</th>
                  <th className="p-4 font-semibold">{t('admin.programsAdmin.columns.mode')}</th>
                  <th className="p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{r.title}</td>
                    <td className="p-4">{r.university_name}</td>
                    <td className="p-4">{degrees.find(d => d.id === r.degree_id)?.name || "—"}</td>
                    <td className="p-4">{r.teaching_language || "—"}</td>
                    <td className="p-4">
                      {r.tuition_yearly ? `${r.tuition_yearly} ${r.currency_code || ""}` : "—"}
                    </td>
                    <td className="p-4">{r.ielts_required ?? "—"}</td>
                    <td className="p-4">{r.delivery_mode || "—"}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <DSButton variant="outline" size="sm" onClick={() => setEditing(r)}>
                          <Pencil className="w-4 h-4" />
                        </DSButton>
                        <DSButton variant="outline" size="sm" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </DSButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-12 text-muted-foreground">
                      {t('admin.programsAdmin.noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg border max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editing.id ? t('admin.programsAdmin.modal.editTitle') : t('admin.programsAdmin.modal.addTitle')}
              </h2>
              <div className="grid gap-4">
                <div>
                  <Label>{t('admin.programsAdmin.modal.programName')}</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))}
                    placeholder={t('admin.programsAdmin.modal.programNamePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin.programsAdmin.modal.university')}</Label>
                  <Select
                    value={editing.university_id || ""}
                    onValueChange={val => setEditing(p => ({ ...p!, university_id: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.programsAdmin.modal.selectUniversity')} />
                    </SelectTrigger>
                    <SelectContent>
                      {universities.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('admin.programsAdmin.modal.level')}</Label>
                    <Select
                      value={editing.degree_id || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, degree_id: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.programsAdmin.modal.selectLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('admin.programsAdmin.modal.none')}</SelectItem>
                        {degrees.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('admin.programsAdmin.modal.teachingLanguage')}</Label>
                    <Select
                      value={editing.teaching_language || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, teaching_language: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.programsAdmin.modal.selectLanguage')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="tr">Türkçe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('admin.programsAdmin.modal.studyMode')}</Label>
                    <Select
                      value={editing.delivery_mode || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, delivery_mode: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.programsAdmin.modal.selectMode')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on-campus">{t('admin.programsAdmin.modal.onCampus')}</SelectItem>
                        <SelectItem value="online">{t('admin.programsAdmin.modal.online')}</SelectItem>
                        <SelectItem value="hybrid">{t('admin.programsAdmin.modal.hybrid')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t('admin.programsAdmin.modal.yearlyFees')}</Label>
                    <Input
                      type="number"
                      value={editing.tuition_yearly ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, tuition_yearly: Number(e.target.value) || null }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t('admin.programsAdmin.modal.currency')}</Label>
                    <Input
                      value={editing.currency_code || ""}
                      onChange={e => setEditing(p => ({ ...p!, currency_code: e.target.value }))}
                      placeholder="GBP/EUR/TRY"
                    />
                  </div>
                  <div>
                    <Label>{t('admin.programsAdmin.modal.ieltsRequired')}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editing.ielts_required ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, ielts_required: Number(e.target.value) || null }))
                      }
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('admin.programsAdmin.modal.duration')}</Label>
                    <Input
                      type="number"
                      value={editing.duration_months ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, duration_months: Number(e.target.value) || null }))
                      }
                      placeholder="36"
                    />
                  </div>
                  <div>
                    <Label>{t('admin.programsAdmin.modal.nextIntake')}</Label>
                    <Input
                      type="date"
                      value={editing.next_intake_date ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, next_intake_date: e.target.value || null }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>{t('admin.programsAdmin.modal.city')}</Label>
                  <Input
                    value={editing.city || ""}
                    onChange={e => setEditing(p => ({ ...p!, city: e.target.value || null }))}
                    placeholder="London"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <DSButton variant="primary" onClick={save}>
                  {t('admin.programsAdmin.modal.save')}
                </DSButton>
                <DSButton variant="outline" onClick={() => setEditing(null)}>
                  {t('admin.programsAdmin.modal.cancel')}
                </DSButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
