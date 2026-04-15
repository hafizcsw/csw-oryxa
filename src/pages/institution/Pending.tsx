/**
 * Institution Pending Dashboard
 * Shown for unverified institutions with claims under review
 */
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { InstitutionPreviewBanner } from '@/components/institution/InstitutionPreviewBanner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInstitutionAccess } from '@/hooks/useInstitutionAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock, Building2, FileText, Upload, AlertCircle,
  CheckCircle2, XCircle, MessageSquare, Loader2, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { InstitutionClaim, ClaimStatus } from '@/types/institution';

const STATUS_CONFIG: Record<ClaimStatus, { icon: React.ElementType; color: string; labelKey: string }> = {
  draft: { icon: FileText, color: 'text-muted-foreground', labelKey: 'institution.status.draft' },
  submitted: { icon: Clock, color: 'text-blue-500', labelKey: 'institution.status.submitted' },
  under_review: { icon: Clock, color: 'text-amber-500', labelKey: 'institution.status.underReview' },
  more_info_requested: { icon: AlertCircle, color: 'text-orange-500', labelKey: 'institution.status.moreInfo' },
  approved: { icon: CheckCircle2, color: 'text-emerald-500', labelKey: 'institution.status.approved' },
  rejected: { icon: XCircle, color: 'text-red-500', labelKey: 'institution.status.rejected' },
};

export default function InstitutionPending() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { accessState, claimId, institutionName, resolve } = useInstitutionAccess();
  const [claim, setClaim] = useState<InstitutionClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadClaim();
  }, [claimId]);

  const loadClaim = async () => {
    if (!claimId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('institution-access-state', {
        body: { action: 'get_claim', claim_id: claimId },
      });
      if (!error && data?.ok) {
        setClaim(data.claim);
      }
    } catch (err) {
      console.error('[Pending] Load claim error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !claimId) return;
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const paths: string[] = [];
      for (const file of files) {
        const path = `institution-claims/${session.user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('documents').upload(path, file);
        if (!error) paths.push(path);
      }

      if (paths.length > 0) {
        await supabase.functions.invoke('institution-access-state', {
          body: { action: 'add_evidence', claim_id: claimId, evidence_paths: paths },
        });
        toast({ title: t('institution.pending.evidenceUploaded') });
        loadClaim();
      }
    } catch (err) {
      console.error('[Pending] Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleResubmit = async () => {
    if (!claimId) return;
    try {
      await supabase.functions.invoke('institution-access-state', {
        body: { action: 'resubmit_claim', claim_id: claimId },
      });
      toast({ title: t('institution.pending.resubmitted') });
      resolve();
      loadClaim();
    } catch (err) {
      console.error('[Pending] Resubmit error:', err);
    }
  };

  const claimStatus = (claim?.status || 'submitted') as ClaimStatus;
  const statusConfig = STATUS_CONFIG[claimStatus] || STATUS_CONFIG.submitted;
  const StatusIcon = statusConfig.icon;

  return (
    <Layout>
      <InstitutionPreviewBanner />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">
            {institutionName || t('institution.pending.title')}
          </h1>
          <p className="text-muted-foreground">{t('institution.pending.description')}</p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                <span className={`font-semibold ${statusConfig.color}`}>
                  {t(statusConfig.labelKey)}
                </span>
              </div>

              <div className="grid gap-3 text-sm">
                {claim?.institution_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('institution.claim.institutionName')}</span>
                    <span className="font-medium">{claim.institution_name}</span>
                  </div>
                )}
                {claim?.submitted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('institution.pending.submittedDate')}</span>
                    <span className="font-medium">{new Date(claim.submitted_at).toLocaleDateString()}</span>
                  </div>
                )}
                {claim?.official_email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('institution.claim.officialEmail')}</span>
                    <span className="font-medium" dir="ltr">{claim.official_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reviewer Notes */}
            {claim?.reviewer_notes && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    {t('institution.pending.reviewerNotes')}
                  </span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">{claim.reviewer_notes}</p>
              </div>
            )}

            {/* Missing Items */}
            {claim?.missing_items && claim.missing_items.length > 0 && (
              <div className="rounded-2xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-400">
                    {t('institution.pending.missingItems')}
                  </span>
                </div>
                <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-300 space-y-1">
                  {claim.missing_items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence */}
            {claim?.evidence_paths && claim.evidence_paths.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-3">{t('institution.pending.uploadedEvidence')}</h3>
                <div className="space-y-1">
                  {claim.evidence_paths.map((path, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      {path.split('/').pop()}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {/* Upload more evidence */}
              <div className="flex-1">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleUploadMore}
                  className="hidden"
                  id="more-evidence"
                />
                <Button
                  variant="outline"
                  className="w-full gap-2 rounded-xl"
                  onClick={() => document.getElementById('more-evidence')?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t('institution.pending.uploadMore')}
                </Button>
              </div>

              {/* Resubmit if rejected */}
              {(claimStatus === 'rejected' || claimStatus === 'more_info_requested') && (
                <Button onClick={handleResubmit} className="flex-1 gap-2 rounded-xl">
                  <RefreshCw className="w-4 h-4" />
                  {t('institution.pending.resubmit')}
                </Button>
              )}
            </div>

            {/* Contact Support */}
            <div className="text-center pt-4">
              <Button variant="link" className="text-muted-foreground text-sm">
                {t('institution.pending.contactSupport')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
