import { lazy, Suspense, useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { deleteFile } from "@/api/crmStorage";
import { FileQualityCard } from "@/components/file-quality/FileQualityCard";
import { CanonicalFileSummary } from "@/components/student-file/CanonicalFileSummary";
import { CentralUploadHub } from "@/components/documents/CentralUploadHub";
import { LiveProfileAssembly } from "@/components/documents/LiveProfileAssembly";
import { SaveDocumentsBar } from "@/components/documents/SaveDocumentsBar";
import { DocumentAnalysisPanel } from "@/components/documents/DocumentAnalysisPanel";
import { AcademicTruthPanel } from "@/components/decision/AcademicTruthPanel";
import { DecisionPanel } from "@/components/decision/DecisionPanel";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountContentHeader } from "@/components/portal/account/AccountContentHeader";
import { useCanonicalStudentFile } from "@/hooks/useCanonicalStudentFile";
import { useStudentDocuments } from "@/hooks/useStudentDocuments";
import { useDocumentRegistry } from "@/hooks/useDocumentRegistry";
import { useDocumentAnalysis } from "@/hooks/useDocumentAnalysis";
import { useAcademicTruth } from "@/hooks/useAcademicTruth";
import { useDecisionEngine } from "@/hooks/useDecisionEngine";
import { useProgramRequirements } from "@/hooks/useProgramRequirements";
import { useShortlistRequirementsContext } from "@/hooks/useShortlistRequirementsContext";
import { useUnsavedDocumentsGuard } from "@/hooks/useUnsavedDocumentsGuard";
import type { FileQualityResult } from "@/features/file-quality/types";
import type { DocumentTypeFilter } from "./DocumentsTab";

const ProfileTab = lazy(() => import("@/components/portal/tabs/ProfileTab").then(m => ({ default: m.ProfileTab })));
const ReadinessTab = lazy(() => import("@/components/readiness/ReadinessTab").then(m => ({ default: m.ReadinessTab })));
const DocumentsTab = lazy(() => import("@/components/portal/tabs/DocumentsTab").then(m => ({ default: m.DocumentsTab })));

interface StudyFileTabProps {
  profile: any;
  crmProfile: any;
  onUpdate: (data: any) => Promise<any>;
  onRefetch: () => Promise<any>;
  onTabChange: (tab: string) => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
  fileQuality?: FileQualityResult | null;
}

function SectionSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
}

const PASSPORT_FILTER: DocumentTypeFilter[] = ['passport'];
const CERTIFICATE_FILTER: DocumentTypeFilter[] = ['certificate'];
const ADDITIONAL_FILTER: DocumentTypeFilter[] = ['additional'];

/** Generate a unique key for file tracking (avoids duplicate filename collision) */
let fileCounter = 0;
function uniqueFileKey(file: File): string {
  return `${file.name}__${file.size}__${++fileCounter}`;
}

export function StudyFileTab({ profile, crmProfile, onUpdate, onRefetch, onTabChange, onAvatarUpdate, fileQuality }: StudyFileTabProps) {
  const { t } = useLanguage();
  const { documents, refetch: refetchDocs } = useStudentDocuments();

  // ═══ Door 1: Base canonical file (CRM truth, no promotions) ═══
  const { canonicalFile: baseCanonicalFile } = useCanonicalStudentFile({
    crmProfile,
    documents,
    userId: profile?.user_id ?? null,
  });

  // ═══ Door 3: Document Analysis + Proposals ═══
  const analysisHook = useDocumentAnalysis({
    studentId: profile?.user_id ?? null,
    canonicalFile: baseCanonicalFile,
  });

  // ═══ Door 1: Merged canonical file (base + promoted overlay) ═══
  const { canonicalFile, hasIdentity, hasAcademic, hasLanguage, hasTargeting } = useCanonicalStudentFile({
    crmProfile,
    documents,
    userId: profile?.user_id ?? null,
    promotedFields: analysisHook.promotedFields,
  });

  // ═══ Door 4: Academic Truth ═══
  const academicTruthHook = useAcademicTruth({ canonicalFile });

  // ═══ Door 3→4 Bridge: Feed transcript text into subject row parsing ═══
  const parsedTranscriptIds = useRef(new Set<string>());
  useEffect(() => {
    for (const analysis of analysisHook.analyses) {
      if (
        analysis.classification_result === 'transcript' &&
        analysis.analysis_status === 'completed' &&
        analysis.text_content &&
        !parsedTranscriptIds.current.has(analysis.document_id)
      ) {
        parsedTranscriptIds.current.add(analysis.document_id);
        const rows = academicTruthHook.parseTranscript(
          analysis.text_content,
          profile?.user_id ?? 'unknown',
          analysis.document_id,
        );
        if (import.meta.env.DEV) {
          console.log('[Door3→4] Transcript parsed into subject rows', {
            documentId: analysis.document_id,
            subjectRowCount: rows.length,
            families: [...new Set(rows.map(r => r.subject_family))],
          });
        }
      }
    }
  }, [analysisHook.analyses, academicTruthHook.parseTranscript, profile?.user_id]);

  // ═══ Door 4.5: Program Requirements from DB ═══
  // Source: shortlist first, then CRM fallback
  const shortlistCtx = useShortlistRequirementsContext();
  const reqProgramId = shortlistCtx.programId ?? null;
  const reqUniversityId = shortlistCtx.universityId ?? crmProfile?.university_id ?? null;

  const { requirements, source: reqSource } = useProgramRequirements({
    programId: reqProgramId,
    universityId: reqUniversityId,
    targetDegree: canonicalFile?.targeting?.target_degree,
  });

  // Log requirements resolution for runtime proof
  useEffect(() => {
    console.log('[Door4.5] Requirements context', {
      source: shortlistCtx.source,
      programId: reqProgramId,
      universityId: reqUniversityId,
      programName: shortlistCtx.programName,
      requirementsLoaded: requirements.length,
      reqSource,
    });
  }, [reqProgramId, reqUniversityId, requirements.length, reqSource, shortlistCtx.source, shortlistCtx.programName]);

  // ═══ Door 5: Decision Engine ═══
  const decision = useDecisionEngine({
    canonicalFile,
    academicTruth: academicTruthHook.academicTruth,
    requirements,
  });

  // File map for post-upload analysis: keyed by unique ID, not filename
  const pendingFilesRef = useRef(new Map<string, { file: File; fileKey: string }>());
  // Map from original_file_name to unique keys for lookup
  const fileNameToKeysRef = useRef(new Map<string, string[]>());

  // ═══ Door 2: Document Registry + Upload Hub ═══
  const handleBatchComplete = useCallback(() => {
    refetchDocs({ silent: true });
  }, [refetchDocs]);

  const registry = useDocumentRegistry({
    studentId: profile?.user_id ?? null,
    onBatchComplete: handleBatchComplete,
  });

  // ═══ Unsaved-documents guard: warn on unload + auto-cleanup orphans ═══
  const guard = useUnsavedDocumentsGuard({
    enabled: !!profile?.user_id,
    onCleanupComplete: () => refetchDocs({ silent: true }),
  });

  // Trigger analysis when records become registered + track for save guard
  const prevRecordsRef = useRef<string[]>([]);
  useEffect(() => {
    const registeredIds = registry.records
      .filter(r => r.processing_status === 'registered')
      .map(r => r.document_id);
    
    const newlyRegistered = registeredIds.filter(id => !prevRecordsRef.current.includes(id));
    prevRecordsRef.current = registeredIds;

    for (const id of newlyRegistered) {
      const record = registry.records.find(r => r.document_id === id);
      if (!record) continue;

      // Track this newly uploaded file as "unsaved" until user confirms
      if (record.crm_file_id) {
        guard.trackDocument(record.crm_file_id);
      }

      // Find the file by name, consuming one key at a time to handle duplicates
      const keys = fileNameToKeysRef.current.get(record.original_file_name);
      if (keys && keys.length > 0) {
        const fileKey = keys.shift()!;
        const entry = pendingFilesRef.current.get(fileKey);
        if (entry && !analysisHook.getAnalysis(id)) {
          analysisHook.analyzeFile(entry.file, id, record.slot_hint);
          pendingFilesRef.current.delete(fileKey);
        }
        if (keys.length === 0) {
          fileNameToKeysRef.current.delete(record.original_file_name);
        }
      }
    }
  }, [registry.records, analysisHook, guard]);

  // Reconcile pending IDs against actual CRM documents — drops stale entries
  // (files deleted in another tab/session, or that never finished saving server-side).
  useEffect(() => {
    guard.reconcileWithValidIds(documents.map(d => d.id));
  }, [documents, guard]);

  const handleSaveDocuments = useCallback(async () => {
    guard.confirmAllSaved();
    await refetchDocs({ silent: true });
  }, [guard, refetchDocs]);

  const { toast } = useToast();

  const handleDeleteDoc = useCallback(async (crmFileId: string | null, documentId: string): Promise<boolean> => {
    // 1. Try to delete the CRM file if we have an ID. Treat missing/not-found as success.
    let crmOk = true;
    if (crmFileId) {
      const res = await deleteFile(crmFileId);
      crmOk = res.ok || res.error === 'FILE_NOT_FOUND';
      if (!crmOk) {
        console.error('[StudyFileTab] delete failed', res.error);
        toast({
          title: t('portal.assembly.lane.delete_failed'),
          description: res.error ?? '',
          variant: 'destructive',
        });
        return false;
      }
      guard.untrackDocument(crmFileId);
    }
    // 2. Always remove the local analysis/proposal record so the card disappears.
    analysisHook.dismissAnalysis(documentId);
    await refetchDocs({ silent: true });
    return true;
  }, [analysisHook, guard, refetchDocs, t, toast]);

  const handleDeleteAll = useCallback(async (items: Array<{ crmFileId: string | null; documentId: string }>) => {
    const results = await Promise.allSettled(
      items.map(it => it.crmFileId ? deleteFile(it.crmFileId) : Promise.resolve({ ok: true } as any)),
    );
    let ok = 0; let fail = 0;
    results.forEach((r, i) => {
      const okish = r.status === 'fulfilled' && (r.value.ok || r.value.error === 'FILE_NOT_FOUND');
      if (okish) {
        ok++;
        if (items[i].crmFileId) guard.untrackDocument(items[i].crmFileId!);
        analysisHook.dismissAnalysis(items[i].documentId);
      } else {
        fail++;
      }
    });
    toast({
      title: t('portal.assembly.lane.delete_done', { ok, fail }),
    });
    await refetchDocs({ silent: true });
  }, [analysisHook, guard, refetchDocs, t, toast]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    // ─── Passport de-duplication gate ───────────────────────────
    // If a passport is already in the file and the user is uploading
    // another one, ask whether to REPLACE rather than silently keep two.
    const incomingPassports = files.filter(
      f => guessSlotFromFileName(f.name) === 'passport'
    );
    const existingPassports = (documents || []).filter(
      d => (d.document_category || (d as any).file_kind) === 'passport'
    );

    let filesToUpload = files;

    if (incomingPassports.length > 0 && existingPassports.length > 0) {
      const confirmReplace = window.confirm(
        'يوجد جواز سفر مرفوع مسبقًا. هل تريد استبداله بالملف الجديد؟ (سيتم حذف الجواز القديم)'
      );

      if (!confirmReplace) {
        const passportNames = new Set(incomingPassports.map(f => f.name));
        filesToUpload = files.filter(f => !passportNames.has(f.name));
        if (filesToUpload.length === 0) return;
      } else {
        const deletions = await Promise.allSettled(
          existingPassports.map(d => deleteFile(d.id))
        );
        const failed = deletions.filter(
          r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
        ).length;
        if (failed > 0) {
          toast({
            title: 'تعذر حذف بعض الجوازات السابقة',
            variant: 'destructive',
          });
        }
        await refetchDocs({ silent: true });
      }
    }

    for (const file of filesToUpload) {
      const key = uniqueFileKey(file);
      pendingFilesRef.current.set(key, { file, fileKey: key });
      const existing = fileNameToKeysRef.current.get(file.name) || [];
      existing.push(key);
      fileNameToKeysRef.current.set(file.name, existing);
    }
    registry.enqueueFiles(filesToUpload, 'upload_hub');
  }, [registry, documents, refetchDocs, toast]);

  // ═══ Preview URLs collected from upload hub for assembly chips ═══
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>({});
  const handlePreviewsReady = useCallback((documentId: string, previewUrl: string) => {
    setPreviewUrls(prev => prev[documentId] === previewUrl ? prev : { ...prev, [documentId]: previewUrl });
  }, []);

  // ═══ Per-document issue summaries — drives RED wire + floating banner
  // above the file in the upload visualizer. Only failed/weak/unknown docs
  // get an entry. Successful docs render normally and continue down to the
  // assembly lanes. ═══
  const issuesByDocId = useMemo<Record<string, { reason: string }>>(() => {
    const map: Record<string, { reason: string }> = {};
    for (const a of analysisHook.analyses) {
      // Reason key resolution priority:
      //   1) explicit rejection_reason from engine
      //   2) unsupported classification → unsupported_file_type
      //   3) unreadable readability → unreadable_scan
      //   4) classification 'unknown' → classification_uncertain
      //   5) usefulness 'not_useful' → low_confidence
      let reasonKey: string | null = null;
      if (a.rejection_reason) {
        reasonKey = `portal.assembly.failure_reason.${a.rejection_reason}`;
      } else if (a.classification_result === 'unsupported') {
        reasonKey = 'portal.assembly.failure_reason.unsupported_file_type';
      } else if (a.readability_status === 'unreadable') {
        reasonKey = 'portal.assembly.failure_reason.unreadable_scan';
      } else if (a.classification_result === 'unknown' && a.analysis_status === 'completed') {
        reasonKey = 'portal.assembly.route_reason.classification_uncertain';
      } else if (a.usefulness_status === 'not_useful') {
        reasonKey = 'portal.assembly.route_reason.low_confidence';
      } else if (a.analysis_status === 'failed') {
        reasonKey = 'portal.assembly.failure_reason.reader_crashed';
      }
      if (!reasonKey) continue;
      const translated = t(reasonKey);
      const reason =
        typeof translated === 'string' && translated && translated !== reasonKey
          ? translated
          : reasonKey.split('.').pop() ?? 'issue';
      map[a.document_id] = { reason };
    }
    return map;
  }, [analysisHook.analyses, t]);

  return (
    <div className="space-y-8" data-canonical-status={canonicalFile?.file_status.profile_completion_status ?? 'none'}>
      {/* Top: Avatar + Page Title */}
      <div className="flex items-center gap-4">
        <AccountContentHeader
          profile={profile}
          crmProfile={crmProfile}
          canonicalIdentity={canonicalFile?.identity ?? null}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>


      {/* ═══ Save bar: shows only when there are unsaved uploads (top placement) ═══ */}
      <SaveDocumentsBar
        pendingCount={guard.pendingCount}
        onSave={handleSaveDocuments}
      />

      {/* ═══ Door 2: Central Upload Hub ═══ */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">{t('portal.uploadHub.title')}</h2>
        <CentralUploadHub
          records={registry.records}
          isUploading={registry.isUploading}
          disabled={crmProfile?.docs_locked}
          onFilesSelected={handleFilesSelected}
          onCancel={registry.cancelRecord}
          onDismiss={registry.dismissRecord}
          onClearCompleted={registry.clearCompleted}
          onPreviewsReady={handlePreviewsReady}
          issuesByDocId={issuesByDocId}
        />
      </section>

      {/* ═══ Live Profile Assembly (lower experience) ═══ */}
      <LiveProfileAssembly
        records={registry.records}
        analyses={analysisHook.analyses}
        proposals={analysisHook.proposals}
        artifacts={analysisHook.artifacts}
        hydratedArtifactSurfaces={analysisHook.hydratedArtifactSurfaces}
        promotedFields={analysisHook.promotedFields}
        subjectRows={academicTruthHook.subjectRows}
        previewUrls={previewUrls}
        crmDocuments={documents.map(d => ({ id: d.id, file_name: d.file_name }))}
        onDeleteDoc={handleDeleteDoc}
        onDeleteAll={handleDeleteAll}
        onEditField={analysisHook.editFieldValue}
      />

    </div>
  );
}
