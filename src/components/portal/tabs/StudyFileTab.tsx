// ═══════════════════════════════════════════════════════════════
// StudyFileTab — Order 3R.2-c hard cutover surface
// ───────────────────────────────────────────────────────────────
// Allowed (and only):
//   • Identity gate (read-only)
//   • Upload Documents (draft-only via usePortalDrafts)
//   • PortalDraftsList (which renders StudyFileReviewDrawer +
//     StudyFileMissingSummary internally)
//   • PostUploadSteps (privacy-corrected copy)
//
// Forbidden in this surface (removed entirely from this file):
//   • SaveDocumentsBar / mark_files_saved / useUnsavedDocumentsGuard
//   • EngineActivityStrip / LiveProfileAssembly
//   • DocumentAnalysisPanel / accept-reject proposals
//   • FileQualityCard / CanonicalFileSummary
//   • AcademicTruthPanel / DecisionPanel / LaneFactsCard
//   • DocumentsTab (Passport/Certificate/Additional)
//   • ProfileTab / ReadinessTab embeds
//   • StudentEvaluationWorkspace / Recompute
//   • useStudentDocuments + useDocumentRegistry write paths
//   • uploadAndRegisterFile / prepare_upload / confirm_upload / deleteFile
//   • mistral-document-pipeline auto-scan
//   • orphan-sweep / cascade delete on document_lane_facts /
//     document_review_queue / document_analyses /
//     document_foundation_outputs / student_evaluation_snapshots
//   • passport-cleanup auto effect
//   • useDocumentAnalysis / useAcademicTruth / useDecisionEngine /
//     useStudentEvaluation / useDocumentLaneFacts
//
// Result: zero CRM mutation, zero OCR/Mistral/DeepSeek change,
// zero Identity change, zero migrations. Pure draft-first surface.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { UploadGuidanceCard } from "@/components/documents/UploadGuidanceCard";
import { PostUploadSteps } from "@/components/documents/PostUploadSteps";
import { AccountContentHeader } from "@/components/portal/account/AccountContentHeader";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { IdentityActivationDialog } from "@/components/portal/identity/IdentityActivationDialog";
import { Lock, ShieldCheck, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortalDrafts } from "@/hooks/usePortalDrafts";
import { PortalDraftsList } from "@/components/portal/study-file/PortalDraftsList";
import type { FileQualityResult } from "@/features/file-quality/types";

interface StudyFileTabProps {
  profile: any;
  crmProfile: any;
  onUpdate: (data: any) => Promise<any>;
  onRefetch: () => Promise<any>;
  onTabChange: (tab: string) => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
  /** Kept for prop compatibility; intentionally unused in the cutover surface. */
  fileQuality?: FileQualityResult | null;
}

export function StudyFileTab({
  profile,
  crmProfile,
  onAvatarUpdate,
}: StudyFileTabProps) {
  const { t } = useLanguage();

  // ═══ Identity gate (read-only) ═══
  const {
    status: identityStatus,
    refetch: refetchIdentity,
    loading: identityLoading,
  } = useIdentityStatus();
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);

  // ═══ Draft-only upload layer (private portal-drafts bucket) ═══
  const drafts = usePortalDrafts({ studentUserId: profile?.user_id ?? null });

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (!files?.length) return;
      drafts.enqueueFiles(files);
    },
    [drafts],
  );

  const onPickFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      handleFilesSelected(list);
      e.target.value = "";
    },
    [handleFilesSelected],
  );

  // ✅ CANONICAL LOCK: render gate UI instead of academic file when identity not approved.
  if (!identityLoading && identityStatus.blocks_academic_file) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center">
              <Lock className="w-8 h-8 text-warning" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {t("portal.identity.gate.title")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {t("portal.identity.gate.body")}
          </p>
          <Button
            onClick={() => setIdentityDialogOpen(true)}
            className="bg-warning hover:bg-warning/90 text-warning-foreground font-semibold"
          >
            <ShieldCheck className="w-4 h-4 me-2" />
            {t("portal.identity.gate.cta")}
          </Button>
        </div>
        <IdentityActivationDialog
          open={identityDialogOpen}
          onOpenChange={setIdentityDialogOpen}
          onApproved={() => {
            void refetchIdentity();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top: Avatar + Page Title */}
      <div className="flex items-center gap-4">
        <AccountContentHeader
          profile={profile}
          crmProfile={crmProfile}
          canonicalIdentity={null}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>

      {/* ═══ Upload Documents — draft-only ═══ */}
      <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        <UploadGuidanceCard />

        <div className="border-t border-border bg-background/40 px-4 py-4">
          <label
            htmlFor="study-file-upload-input"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background/60 px-4 py-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <UploadIcon className="h-6 w-6 text-primary" />
            <div className="text-sm font-medium text-foreground">
              {t("portal.uploadHub.dropzone.cta", {
                defaultValue: "Upload Documents",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("portal.uploadHub.dropzone.formats", {
                defaultValue: "PDF · JPG · PNG · DOCX · 20MB per file",
              })}
            </div>
            <input
              id="study-file-upload-input"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.docx,application/pdf,image/*"
              className="hidden"
              onChange={onPickFiles}
              disabled={crmProfile?.docs_locked}
            />
          </label>
        </div>

        {/* Drafts list — internally renders Review drawer + Missing summary */}
        <div className="border-t border-border bg-background/40 px-4 py-4">
          <PortalDraftsList
            drafts={drafts.drafts}
            pending={drafts.pending}
            onDelete={(id) => {
              void drafts.removeDraft(id);
            }}
          />
        </div>

        <div className="border-t border-border">
          <PostUploadSteps />
        </div>
      </section>
    </div>
  );
}
