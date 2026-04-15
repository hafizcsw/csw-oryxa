/**
 * Institution Claim Page
 * Form for claiming an existing institution or requesting a new one
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClaimFormData {
  institution_name: string;
  official_email: string;
  website: string;
  country: string;
  city: string;
  job_title: string;
  department: string;
  notes: string;
}

export default function InstitutionClaim() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const state = location.state as { mode: 'claim' | 'new'; institution?: any; prefill?: any } | null;
  const isClaim = state?.mode === 'claim';
  const existingInstitution = state?.institution;

  const [form, setForm] = useState<ClaimFormData>({
    institution_name: existingInstitution?.name || state?.prefill?.institution_name || '',
    official_email: '',
    website: '',
    country: existingInstitution?.country || '',
    city: existingInstitution?.city || '',
    job_title: '',
    department: '',
    notes: '',
  });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: keyof ClaimFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setEvidenceFiles(prev => [...prev, ...files].slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Upload evidence files
      const evidencePaths: string[] = [];
      for (const file of evidenceFiles) {
        const path = `institution-claims/${session.user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, file);
        if (!uploadError) {
          evidencePaths.push(path);
        }
      }

      // Submit claim via edge function
      const { data, error } = await supabase.functions.invoke('institution-access-state', {
        body: {
          action: 'submit_claim',
          claim: {
            ...form,
            institution_id: existingInstitution?.id || null,
            claim_type: isClaim ? 'claim_existing' : 'request_new',
            evidence_paths: evidencePaths,
          },
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: t('institution.claim.submitted'),
        description: t('institution.claim.submittedDesc'),
      });

      // Navigate to pending after delay
      setTimeout(() => navigate('/institution/pending'), 2000);
    } catch (err) {
      console.error('[InstitutionClaim] Submit error:', err);
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold">{t('institution.claim.submitted')}</h2>
          <p className="text-muted-foreground">{t('institution.claim.submittedDesc')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2 text-muted-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>

        <h1 className="text-xl font-bold text-foreground mb-1">
          {isClaim ? t('institution.claim.titleClaim') : t('institution.claim.titleNew')}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isClaim ? t('institution.claim.descClaim') : t('institution.claim.descNew')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.institutionName')} *</label>
              <Input
                value={form.institution_name}
                onChange={(e) => updateField('institution_name', e.target.value)}
                required
                disabled={isClaim}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.officialEmail')} *</label>
              <Input
                type="email"
                value={form.official_email}
                onChange={(e) => updateField('official_email', e.target.value)}
                required
                dir="ltr"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.website')} *</label>
              <Input
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                required
                dir="ltr"
                placeholder="https://"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.country')} *</label>
              <Input
                value={form.country}
                onChange={(e) => updateField('country', e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.city')} *</label>
              <Input
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.jobTitle')} *</label>
              <Input
                value={form.job_title}
                onChange={(e) => updateField('job_title', e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('institution.claim.department')}</label>
              <Input
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('institution.claim.evidence')}</label>
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="evidence-upload"
              />
              <label htmlFor="evidence-upload" className="cursor-pointer">
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('institution.claim.uploadEvidence')}</p>
              </label>
              {evidenceFiles.length > 0 && (
                <div className="mt-3 space-y-1">
                  {evidenceFiles.map((f, i) => (
                    <p key={i} className="text-xs text-foreground">{f.name}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('institution.claim.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl text-sm font-semibold"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin ml-2" /> {t('common.submitting')}</>
            ) : (
              t('institution.claim.submit')
            )}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
