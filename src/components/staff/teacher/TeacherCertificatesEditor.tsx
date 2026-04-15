/**
 * TeacherCertificatesEditor — Manage and display teacher certificates.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Award, Plus, Trash2, Loader2, Pencil, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Certificate {
  id?: string;
  title: string;
  issuer: string;
  year_start: number | null;
  year_end: number | null;
  is_verified: boolean;
}

interface Props {
  readOnly?: boolean;
  teacherUserId?: string;
}

export function TeacherCertificatesEditor({ readOnly = false, teacherUserId }: Props) {
  const { t } = useLanguage();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const userId = teacherUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const { data } = await (supabase as any)
        .from('teacher_certificates')
        .select('*')
        .eq('user_id', userId)
        .order('year_start', { ascending: false });

      if (data) setCerts(data);
    } catch (err) {
      console.error('[TeacherCertificatesEditor] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => { loadCerts(); }, [loadCerts]);

  const addCert = () => {
    setCerts(prev => [...prev, { title: '', issuer: '', year_start: new Date().getFullYear(), year_end: new Date().getFullYear(), is_verified: false }]);
  };

  const updateCert = (index: number, field: keyof Certificate, value: any) => {
    setCerts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeCert = (index: number) => {
    setCerts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all existing
      await (supabase as any).from('teacher_certificates').delete().eq('user_id', user.id);

      // Insert current
      const validCerts = certs.filter(c => c.title.trim());
      if (validCerts.length > 0) {
        const rows = validCerts.map(c => ({
          user_id: user.id,
          title: c.title,
          issuer: c.issuer || null,
          year_start: c.year_start,
          year_end: c.year_end,
          is_verified: c.is_verified,
        }));
        const { error } = await (supabase as any).from('teacher_certificates').insert(rows);
        if (error) throw error;
      }

      toast.success(t('staff.teacher.certificates.saved', { defaultValue: 'Certificates saved' }));
      setEditing(false);
      loadCerts();
    } catch (err: any) {
      console.error('[TeacherCertificatesEditor] Save error:', err);
      toast.error(err?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" />
            {t('staff.teacher.certificates.title', { defaultValue: 'Certificates' })}
          </h4>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editing ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing
                ? t('staff.teacher.certificates.save', { defaultValue: 'Save' })
                : t('staff.teacher.certificates.edit', { defaultValue: 'Edit' })}
            </Button>
          )}
        </div>

        {certs.length === 0 && !editing ? (
          <p className="text-sm text-muted-foreground italic">
            {t('staff.teacher.certificates.empty', { defaultValue: 'No certificates added yet' })}
          </p>
        ) : (
          <div className="space-y-3">
            {certs.map((cert, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                {editing ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={cert.title}
                          onChange={(e) => updateCert(i, 'title', e.target.value)}
                          placeholder={t('staff.teacher.certificates.titlePlaceholder', { defaultValue: 'Certificate name' })}
                        />
                        <Input
                          value={cert.issuer}
                          onChange={(e) => updateCert(i, 'issuer', e.target.value)}
                          placeholder={t('staff.teacher.certificates.issuerPlaceholder', { defaultValue: 'Issuing organization' })}
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={cert.year_start ?? ''}
                            onChange={(e) => updateCert(i, 'year_start', e.target.value ? Number(e.target.value) : null)}
                            placeholder={t('staff.teacher.certificates.yearStart', { defaultValue: 'Start year' })}
                            className="w-28"
                          />
                          <span className="self-center text-muted-foreground">—</span>
                          <Input
                            type="number"
                            value={cert.year_end ?? ''}
                            onChange={(e) => updateCert(i, 'year_end', e.target.value ? Number(e.target.value) : null)}
                            placeholder={t('staff.teacher.certificates.yearEnd', { defaultValue: 'End year' })}
                            className="w-28"
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeCert(i)} className="text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {cert.year_start}{cert.year_end && cert.year_end !== cert.year_start ? ` — ${cert.year_end}` : ''}
                        </span>
                      </div>
                      <p className="font-medium mt-0.5">{cert.title}</p>
                      {cert.issuer && <p className="text-sm text-muted-foreground">{cert.issuer}</p>}
                      {cert.is_verified && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">
                            {t('staff.teacher.certificates.verified', { defaultValue: 'Certificate verified' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <Button variant="outline" size="sm" onClick={addCert} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t('staff.teacher.certificates.add', { defaultValue: 'Add Certificate' })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
