import { lazy, Suspense, useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { deleteFile } from "@/api/crmStorage";
import { FileQualityCard } from "@/components/file-quality/FileQualityCard";
import { CanonicalFileSummary } from "@/components/student-file/CanonicalFileSummary";
import { CentralUploadHub } from "@/components/documents/CentralUploadHub";
import { UploadGuidanceCard } from "@/components/documents/UploadGuidanceCard";
import { PostUploadSteps } from "@/components/documents/PostUploadSteps";
import { LiveProfileAssembly } from "@/components/documents/LiveProfileAssembly";
import { SaveDocumentsBar } from "@/components/documents/SaveDocumentsBar";
import { DocumentAnalysisPanel } from "@/components/documents/DocumentAnalysisPanel";
import { EngineActivityStrip } from "@/components/documents/EngineActivityStrip";
import { AcademicTruthPanel } from "@/components/decision/AcademicTruthPanel";
import { DecisionPanel } from "@/components/decision/DecisionPanel";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountContentHeader } from "@/components/portal/account/AccountContentHeader";
import { useCanonicalStudentFile } from "@/hooks/useCanonicalStudentFile";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { IdentityActivationDialog } from "@/components/portal/identity/IdentityActivationDialog";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { guessSlotFromFileName } from "@/features/documents/document-registry-model";
import { useDocumentLaneFacts } from "@/hooks/useDocumentLaneFacts";
import { LaneFactsCard } from "@/components/student-file/LaneFactsCard";
import { useStudentEvaluation } from "@/hooks/useStudentEvaluation";
import { analysesToEvalInputs } from "@/features/evaluation-snapshot/adapter";
import { StudentEvaluationWorkspace } from "@/components/evaluation/StudentEvaluationWorkspace";

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
  // ═══ CANONICAL IDENTITY GATE — single lock point for the academic file ═══
  const { status: identityStatus, refetch: refetchIdentity, loading: identityLoading } = useIdentityStatus();
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const { documents, refetch: refetchDocs } = useStudentDocuments();
  // ═══ Door 2: Lane Facts truth surface ═══
  const { byDocId: laneFactsByDocId, refetch: refetchLaneFacts } = useDocumentLaneFacts();

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
    // Door 2: refresh lane facts after upload batch — facts persisted by uploadAndRegister.
    void refetchLaneFacts();
  }, [refetchDocs, refetchLaneFacts]);

  const registry = useDocumentRegistry({
    studentId: profile?.user_id ?? null,
    onBatchComplete: handleBatchComplete,
  });

  // ═══ Auto-purge orphaned lane facts ═══
  // Lane facts whose source CRM document has been deleted are stale.
  // We sweep them once after documents + facts have loaded.
  const orphanSweepRef = useRef(false);
  useEffect(() => {
    if (orphanSweepRef.current) return;
    const factIds = Object.keys(laneFactsByDocId);
    if (factIds.length === 0) return;
    // Wait until documents have actually loaded at least once
    const validIds = new Set(documents.map(d => d.id));
    const orphans = factIds.filter(id => !validIds.has(id));
    if (orphans.length === 0) {
      orphanSweepRef.current = true;
      return;
    }
    orphanSweepRef.current = true;
    void (async () => {
      try {
        // ⛔ Door-1 closure: orphan auto-purge of document_lane_facts is DISABLED.
        // The live pipeline writes lane facts immediately, but the local snapshot
        // used to compute "orphans" lags by one refresh cycle, so this sweep was
        // deleting fresh rows (pg_stat: 92 inserted / 92 deleted / 0 live).
        // Foundation + analyses orphan cleanup is left untouched.
        const { supabase } = await import('@/integrations/supabase/client');
        await Promise.allSettled([
          (supabase as any).from('document_foundation_outputs').delete().in('document_id', orphans),
          // (supabase as any).from('document_lane_facts').delete().in('document_id', orphans), // DISABLED — Door-1 truth-table
          (supabase as any).from('document_analyses').delete().in('document_id', orphans),
        ]);
        console.log('[StudyFileTab] purged orphaned foundation/analyses (lane_facts skipped)', { count: orphans.length });
        await refetchLaneFacts();
      } catch (e) {
        console.warn('[StudyFileTab] orphan sweep failed (non-fatal)', e);
      }
    })();
  }, [laneFactsByDocId, documents, refetchLaneFacts]);

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
          // CRITICAL: pass storage_path AND crm_file_id so the engine can
          // attempt the self-hosted paddle provider via the edge proxy.
          // file_id is preferred for ownership; storage_path is the fallback
          // ownership signal. Without BOTH, the reader fails closed.
          analysisHook.analyzeFile(
            entry.file,
            id,
            record.slot_hint,
            record.storage_path,
            record.crm_file_id,
          );
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
    await guard.confirmAllSaved();
    await refetchDocs({ silent: true });
  }, [guard, refetchDocs]);

  const { toast } = useToast();

  const handleDeleteDoc = useCallback(async (crmFileId: string | null, documentId: string): Promise<boolean> => {
    // 1. Try to delete the CRM file if we have an ID. Treat missing/not-found as success.
    let crmOk = true;
    if (crmFileId) {
      const res = await deleteFile(crmFileId, documentId);
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

    // 2. Cascade-clean ALL document-scoped rows so re-uploads behave clean.
    //    Foundation/lane/analysis rows are keyed by document_id, which equals
    //    crm_file_id for CRM-backed docs. We attempt both keys defensively.
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const ids = Array.from(new Set([crmFileId, documentId].filter(Boolean) as string[]));
      if (ids.length > 0) {
        await Promise.allSettled([
          (supabase as any).from('document_foundation_outputs').delete().in('document_id', ids),
          (supabase as any).from('document_lane_facts').delete().in('document_id', ids),
          (supabase as any).from('document_analyses').delete().in('document_id', ids),
        ]);
        // eslint-disable-next-line no-console
        console.log('[StudyFileTab] cascade-cleaned doc rows', { ids });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[StudyFileTab] cascade clean threw (non-fatal)', e);
    }

    // 3. Always remove the local analysis/registry rows so the UI disappears immediately.
    analysisHook.dismissAnalysis(documentId);
    registry.dismissRecord(documentId);
    await refetchDocs({ silent: true });
    await refetchLaneFacts();
    return true;
  }, [analysisHook, guard, refetchDocs, refetchLaneFacts, registry, t, toast]);

  const handleDeleteAll = useCallback(async (items: Array<{ crmFileId: string | null; documentId: string }>) => {
    const results = await Promise.allSettled(
      items.map(it => it.crmFileId ? deleteFile(it.crmFileId, it.documentId) : Promise.resolve({ ok: true } as any)),
    );
    let ok = 0; let fail = 0;
    const idsToCascade: string[] = [];
    results.forEach((r, i) => {
      const okish = r.status === 'fulfilled' && (r.value.ok || r.value.error === 'FILE_NOT_FOUND');
      if (okish) {
        ok++;
        if (items[i].crmFileId) {
          guard.untrackDocument(items[i].crmFileId!);
          idsToCascade.push(items[i].crmFileId!);
        }
        idsToCascade.push(items[i].documentId);
        analysisHook.dismissAnalysis(items[i].documentId);
        registry.dismissRecord(items[i].documentId);
      } else {
        fail++;
      }
    });

    // Cascade-clean foundation/lane/analysis rows for everything we successfully removed.
    if (idsToCascade.length > 0) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const uniq = Array.from(new Set(idsToCascade));
        await Promise.allSettled([
          (supabase as any).from('document_foundation_outputs').delete().in('document_id', uniq),
          (supabase as any).from('document_lane_facts').delete().in('document_id', uniq),
          (supabase as any).from('document_analyses').delete().in('document_id', uniq),
        ]);
        // eslint-disable-next-line no-console
        console.log('[StudyFileTab] bulk cascade-cleaned doc rows', { count: uniq.length });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[StudyFileTab] bulk cascade clean threw (non-fatal)', e);
      }
    }

    toast({
      title: t('portal.assembly.lane.delete_done', { ok, fail }),
    });
    await refetchDocs({ silent: true });
    await refetchLaneFacts();
  }, [analysisHook, guard, refetchDocs, refetchLaneFacts, registry, t, toast]);

  const handleDismissUploadHub = useCallback((documentId: string) => {
    const record = registry.records.find((r) => r.document_id === documentId);
    if (!record) {
      registry.dismissRecord(documentId);
      return;
    }
    void handleDeleteDoc(record.crm_file_id, documentId);
  }, [handleDeleteDoc, registry]);

  const autoPassportCleanupRef = useRef(new Set<string>());

  const handleFilesSelected = useCallback(async (files: File[]) => {
    // ─── Passport de-duplication gate ───────────────────────────
    // Use both CRM category + prior analysis truth so we do not rely only
    // on filename heuristics or legacy file_kind correctness.
    const incomingPassports = files.filter(
      f => guessSlotFromFileName(f.name) === 'passport'
    );

    const existingPassportMap = new Map<string, { crmFileId: string | null; documentId: string | null }>();

    for (const d of documents || []) {
      if ((d.document_category || (d as any).file_kind) === 'passport') {
        existingPassportMap.set(`crm:${d.id}`, { crmFileId: d.id, documentId: null });
      }
    }

    for (const a of analysisHook.analyses) {
      if (a.classification_result !== 'passport') continue;
      const rec = registry.records.find(r => r.document_id === a.document_id);
      const filename = rec?.original_file_name ?? analysisHook.hydratedArtifactSurfaces[a.document_id]?.documentFilename ?? null;
      const crmDoc = filename ? (documents || []).find(d => d.file_name === filename) : null;
      const crmFileId = rec?.crm_file_id ?? crmDoc?.id ?? null;
      const key = crmFileId ? `crm:${crmFileId}` : `analysis:${a.document_id}`;
      existingPassportMap.set(key, { crmFileId, documentId: a.document_id });
    }

    const existingPassports = Array.from(existingPassportMap.values());
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
        for (const existing of existingPassports) {
          if (existing.crmFileId || existing.documentId) {
            await handleDeleteDoc(existing.crmFileId, existing.documentId ?? `passport-replaced:${existing.crmFileId}`);
          }
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
  }, [registry, documents, analysisHook.analyses, analysisHook.hydratedArtifactSurfaces, handleDeleteDoc, refetchDocs]);

  // ⛔ TEMPORARILY DISABLED — auto-passport-cleanup is paused while we
  // collect runtime proof of the Paddle cutover. It was deleting real
  // passports / certificates whenever classification mis-fired or the
  // multi-document ownership bug duplicated rows. Re-enable only after:
  //   1) Single-file Paddle proof is captured (passport alone, then
  //      certificate alone).
  //   2) Multi-document ownership bug is closed separately.
  // Do NOT remove this guard without an explicit go-ahead.
  useEffect(() => {
    return; // hard disable — keep the rest as reference for re-enabling
    // eslint-disable-next-line no-unreachable
    const passportDocs = analysisHook.analyses
      .filter(a => a.analysis_status === 'completed' && a.classification_result === 'passport')
      .map(a => {
        const rec = registry.records.find(r => r.document_id === a.document_id);
        const filename = rec?.original_file_name ?? analysisHook.hydratedArtifactSurfaces[a.document_id]?.documentFilename ?? null;
        const crmDoc = filename ? (documents || []).find(d => d.file_name === filename) : null;
        return {
          documentId: a.document_id,
          crmFileId: rec?.crm_file_id ?? crmDoc?.id ?? null,
          timestamp: Date.parse(a.updated_at || a.created_at || '') || 0,
        };
      })
      .filter(d => d.crmFileId || d.documentId);

    if (passportDocs.length <= 1) return;

    passportDocs.sort((a, b) => b.timestamp - a.timestamp);
    const [, ...duplicates] = passportDocs;
    const actionable = duplicates.filter(d => !autoPassportCleanupRef.current.has(d.documentId));
    if (actionable.length === 0) return;

    actionable.forEach(d => autoPassportCleanupRef.current.add(d.documentId));

    void (async () => {
      for (const duplicate of actionable) {
        await handleDeleteDoc(duplicate.crmFileId, duplicate.documentId);
      }
      await refetchDocs({ silent: true });
    })();
  }, [analysisHook.analyses, analysisHook.hydratedArtifactSurfaces, registry.records, documents, handleDeleteDoc, refetchDocs]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>({});
  const handlePreviewsReady = useCallback((documentId: string, previewUrl: string) => {
    setPreviewUrls(prev => prev[documentId] === previewUrl ? prev : { ...prev, [documentId]: previewUrl });
  }, []);

  // ═══ Per-document issue summaries — drives RED wire + floating banner
  // above the file in the upload visualizer. Only failed/weak/unknown docs
  // get an entry. Successful docs render normally and continue down to the
  // assembly lanes.
  //
  // TRUTH-SURFACE RULE (do NOT lie to the user):
  //   "reader_crashed" must ONLY surface for a real parser exception.
  //   For images / scanned content where Door 2 is local-only and Door 3
  //   OCR is the actual reader (and may be unavailable / pending), the
  //   honest label is "awaiting_ocr" — not "Reader crashed".
  // ═══
  const docMimeById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of documents || []) {
      if (d?.id) map[d.id] = (d as any).mime_type ?? '';
    }
    return map;
  }, [documents]);

  const isImageLikeMime = (mime: string | undefined): boolean => {
    if (!mime) return false;
    return mime.startsWith('image/');
  };

  const issuesByDocId = useMemo<Record<string, { reason: string }>>(() => {
    const map: Record<string, { reason: string }> = {};
    for (const a of analysisHook.analyses) {
      const mime = docMimeById[a.document_id] ?? '';
      const isImage = isImageLikeMime(mime);

      // Reason key resolution priority:
      //   1) explicit rejection_reason from engine
      //      • reader_crashed on an image → awaiting_ocr (Door 3 not ready)
      //      • reader_crashed on non-image → real reader_crashed
      //   2) unsupported classification → unsupported_file_type
      //   3) unreadable readability:
      //      • image → awaiting_ocr (cannot judge until Door 3 reads it)
      //      • non-image → unreadable_scan
      //   4) classification 'unknown' → needs_review (neutral, honest)
      //   5) usefulness 'not_useful' → low_confidence
      //   6) analysis_status 'failed':
      //      • image → awaiting_ocr
      //      • non-image → reader_crashed
      let reasonKey: string | null = null;
      if (a.rejection_reason === 'reader_crashed') {
        reasonKey = isImage
          ? 'portal.assembly.failure_reason.awaiting_ocr'
          : 'portal.assembly.failure_reason.reader_crashed';
      } else if (a.rejection_reason) {
        reasonKey = `portal.assembly.failure_reason.${a.rejection_reason}`;
      } else if (a.classification_result === 'unsupported') {
        reasonKey = 'portal.assembly.failure_reason.unsupported_file_type';
      } else if (a.readability_status === 'unreadable') {
        reasonKey = isImage
          ? 'portal.assembly.failure_reason.awaiting_ocr'
          : 'portal.assembly.failure_reason.unreadable_scan';
      } else if (a.classification_result === 'unknown' && a.analysis_status === 'completed') {
        reasonKey = 'portal.assembly.failure_reason.needs_review';
      } else if (a.usefulness_status === 'not_useful') {
        reasonKey = 'portal.assembly.route_reason.low_confidence';
      } else if (a.analysis_status === 'failed') {
        reasonKey = isImage
          ? 'portal.assembly.failure_reason.awaiting_ocr'
          : 'portal.assembly.failure_reason.reader_crashed';
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
  }, [analysisHook.analyses, docMimeById, t]);

  // ═══ Phase A: Student Evaluation Workspace (persisted) ═══
  const evalDocs = useMemo(
    () => analysesToEvalInputs(analysisHook.analyses, {
      citizenshipCountry: canonicalFile?.identity?.citizenship ?? null,
    }),
    [analysisHook.analyses, canonicalFile?.identity?.citizenship],
  );

  const evaluation = useStudentEvaluation({
    userId: profile?.user_id ?? null,
    docs: evalDocs,
    enabled: !!profile?.user_id,
  });

  const documentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of documents || []) {
      if (d?.id) map[d.id] = d.file_name ?? d.id.slice(0, 8);
    }
    return map;
  }, [documents]);

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
            {t('portal.identity.gate.title')}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {t('portal.identity.gate.body')}
          </p>
          <Button
            onClick={() => setIdentityDialogOpen(true)}
            className="bg-warning hover:bg-warning/90 text-warning-foreground font-semibold"
          >
            <ShieldCheck className="w-4 h-4 me-2" />
            {t('portal.identity.gate.cta')}
          </Button>
        </div>
        <IdentityActivationDialog
          open={identityDialogOpen}
          onOpenChange={setIdentityDialogOpen}
          onApproved={() => { void refetchIdentity(); }}
        />
      </div>
    );
  }

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

      {/* ═══ Door 2: Central Upload Hub — unified card ═══ */}
      <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        <UploadGuidanceCard />
        <div className="border-t border-border bg-background/40 px-4 py-4">
          <CentralUploadHub
            records={registry.records}
            isUploading={registry.isUploading}
            disabled={crmProfile?.docs_locked}
            onFilesSelected={handleFilesSelected}
            onCancel={registry.cancelRecord}
            onDismiss={handleDismissUploadHub}
            onClearCompleted={registry.clearCompleted}
            onPreviewsReady={handlePreviewsReady}
            issuesByDocId={issuesByDocId}
          />
        </div>
        <div className="border-t border-border">
          <PostUploadSteps />
        </div>
      </section>

      {/* ═══ Live engine activity — what is the engine doing right now ═══ */}
      <EngineActivityStrip liveStages={analysisHook.liveStages} />

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

      {/* ═══ Phase A: Student Evaluation Workspace (persisted under extracted info) ═══ */}
      <StudentEvaluationWorkspace
        loading={evaluation.loading}
        computing={evaluation.computing}
        saved={evaluation.saved}
        credentialsByDocId={evaluation.credentialsByDocId}
        snapshot={evaluation.snapshot}
        snapshotResult={evaluation.snapshotResult}
        lastComputedAt={evaluation.lastComputedAt}
        recomputeReason={evaluation.recomputeReason}
        documentNames={documentNames}
        onRecompute={evaluation.recompute}
      />

    </div>
  );
}

