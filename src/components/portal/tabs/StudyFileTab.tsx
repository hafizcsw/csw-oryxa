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
import {
  guessSlotFromFileName,
  mapLegacyKindToSlot,
  type DocumentRecord,
} from "@/features/documents/document-registry-model";
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
  const { documents, loading: documentsLoading, refetch: refetchDocs } = useStudentDocuments();
  const [docsLoadedOnce, setDocsLoadedOnce] = useState(false);
  useEffect(() => {
    if (!documentsLoading) setDocsLoadedOnce(true);
  }, [documentsLoading]);
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

  const activeCrmDocumentIds = useMemo(() => new Set(documents.map((doc) => doc.id)), [documents]);
  const purgeScopeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const doc of documents) {
      if (doc.id) purgeScopeIdsRef.current.add(doc.id);
    }
    for (const record of registry.records) {
      const persistedId = record.crm_file_id ?? null;
      if (persistedId) purgeScopeIdsRef.current.add(persistedId);
    }
  }, [documents, registry.records]);

  const activeRegistryRecords = useMemo(() => {
    return registry.records.filter((record) => {
      if (record.processing_status !== 'registered') return true;
      const persistedId = record.crm_file_id ?? record.document_id;
      return activeCrmDocumentIds.has(persistedId);
    });
  }, [activeCrmDocumentIds, registry.records]);

  const displayRecords = useMemo<DocumentRecord[]>(() => {
    const now = new Date().toISOString();
    const liveById = new Map<string, DocumentRecord>();

    for (const record of activeRegistryRecords) {
      liveById.set(record.document_id, record);
      if (record.crm_file_id) {
        liveById.set(`crm:${record.crm_file_id}`, record);
      }
    }

    const hydratedFromCrm = documents
      .filter((doc) => !liveById.has(doc.id) && !liveById.has(`crm:${doc.id}`))
      .map((doc): DocumentRecord => ({
        document_id: doc.id,
        crm_file_id: doc.id,
        student_id: profile?.user_id ?? '',
        uploaded_by_role: 'student',
        source_surface: 'legacy',
        original_file_name: doc.file_name,
        mime_type: doc.file_type || 'application/octet-stream',
        file_size_bytes: doc.file_size ?? 0,
        storage_path: doc.storage_path || null,
        slot_hint: mapLegacyKindToSlot(doc.document_category),
        processing_status: 'registered',
        readability_status: 'unknown',
        usefulness_status: 'unknown',
        duplicate_status: 'unknown',
        rejection_reason: doc.rejection_reason ?? null,
        file_url: doc.file_path || null,
        signed_url: doc.signed_url ?? null,
        error_message: null,
        upload_progress: 100,
        created_at: doc.created_at || doc.uploaded_at || now,
        updated_at: doc.created_at || doc.uploaded_at || now,
      }));

    return [...hydratedFromCrm, ...activeRegistryRecords];
  }, [activeRegistryRecords, documents, profile?.user_id]);

  const activeDisplayDocumentIds = useMemo(() => {
    const ids = new Set<string>(documents.map((doc) => doc.id));
    for (const record of displayRecords) {
      const persistedId = record.crm_file_id ?? (record.processing_status === 'registered' ? record.document_id : null);
      if (persistedId) ids.add(persistedId);
    }
    return ids;
  }, [displayRecords, documents]);

  const visibleAnalyses = useMemo(
    () => analysisHook.analyses.filter((analysis) => activeDisplayDocumentIds.has(analysis.document_id)),
    [activeDisplayDocumentIds, analysisHook.analyses],
  );

  const visibleProposals = useMemo(
    () => analysisHook.proposals.filter((proposal) => activeDisplayDocumentIds.has(proposal.document_id)),
    [activeDisplayDocumentIds, analysisHook.proposals],
  );

  const visibleHydratedArtifactSurfaces = useMemo(
    () => Object.fromEntries(
      Object.entries(analysisHook.hydratedArtifactSurfaces).filter(([documentId]) => activeDisplayDocumentIds.has(documentId)),
    ),
    [activeDisplayDocumentIds, analysisHook.hydratedArtifactSurfaces],
  );

  // ═══ Auto-purge orphaned Portal-DB rows whose CRM file was deleted ═══
  // Runs whenever the CRM document list changes (including after user deletes
  // files in CRM). Protected by `docsLoadedOnce` to avoid wiping fresh rows
  // while the initial listFiles() is still in flight.
  const orphanSweepSignatureRef = useRef<string>('');
  useEffect(() => {
    if (!docsLoadedOnce) return;
    if (!profile?.user_id) return;
    if (registry.isUploading) return;

    const factIds = Object.keys(laneFactsByDocId).filter(id => purgeScopeIdsRef.current.has(id));
    const analysisIds = analysisHook.analyses
      .map(a => a.document_id)
      .filter(id => purgeScopeIdsRef.current.has(id));
    const candidateIds = Array.from(new Set([...factIds, ...analysisIds]));
    if (candidateIds.length === 0) return;

    const validIds = new Set<string>(documents.map(d => d.id));
    const orphans = candidateIds.filter(id => !validIds.has(id));
    if (orphans.length === 0) return;

    // Signature guard: don't re-run purge for the same orphan set
    const sig = orphans.slice().sort().join('|');
    if (orphanSweepSignatureRef.current === sig) return;
    orphanSweepSignatureRef.current = sig;

    void (async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await Promise.allSettled([
          (supabase as any).from('document_foundation_outputs').delete().in('document_id', orphans),
          (supabase as any).from('document_lane_facts').delete().in('document_id', orphans),
          (supabase as any).from('document_review_queue').delete().in('document_id', orphans),
          (supabase as any).from('document_analyses').delete().in('document_id', orphans),
        ]);
        orphans.forEach(id => purgeScopeIdsRef.current.delete(id));
        console.log('[StudyFileTab] purged orphaned portal-db rows', { count: orphans.length, orphans });
        await refetchLaneFacts();
        await analysisHook.refetch?.();
      } catch (e) {
        console.warn('[StudyFileTab] orphan sweep failed (non-fatal)', e);
      }
    })();
  }, [docsLoadedOnce, laneFactsByDocId, analysisHook.analyses, documents, registry.isUploading, profile?.user_id, refetchLaneFacts, analysisHook]);

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

  // ═══ Auto-scan CRM files that have no analysis yet ═══
  // Files that arrive from CRM (uploaded elsewhere, or surviving a refresh)
  // never pass through the registry's "registered" → analyzeFile path because
  // there is no local File object. We invoke mistral-document-pipeline directly
  // using bucket/path/signed_url from the CRM so the scan actually runs.
  const autoScanTriggeredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!docsLoadedOnce) return;
    if (!profile?.user_id) return;
    if (documents.length === 0) return;

    const analyzedIds = new Set(analysisHook.analyses.map(a => a.document_id));
    const registeredIds = new Set(registry.records.map(r => r.document_id));

    const toScan = (documents as any[]).filter((doc) => {
      if (analyzedIds.has(doc.id)) return false;
      if (registeredIds.has(doc.id)) return false; // handled by the registered-path above
      if (autoScanTriggeredRef.current.has(doc.id)) return false;
      return true;
    });
    if (toScan.length === 0) return;

    void (async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { signFile } = await import('@/api/crmStorage');
      for (const doc of toScan) {
        autoScanTriggeredRef.current.add(doc.id);
        const bucket = doc.storage_bucket || doc.bucket || 'customer-files';
        const path = doc.storage_path || doc.path;
        if (!path) {
          console.warn('[StudyFileTab] auto-scan skip: missing storage_path', doc.id);
          continue;
        }
        console.log('[StudyFileTab] 🚀 auto-scan CRM file', {
          document_id: doc.id,
          file_name: doc.file_name,
          bucket,
          path,
        });
        try {
          const signRes = await signFile(doc.id);
          const signedUrl = signRes.ok ? signRes.signed_url : null;
          if (!signedUrl) {
            console.warn('[StudyFileTab] auto-scan sign failed', doc.id, signRes.error);
            continue;
          }
          const { data, error } = await supabase.functions.invoke('mistral-document-pipeline', {
            body: {
              document_id: doc.id,
              bucket,
              path,
              file_kind: doc.file_kind || 'additional',
              declared_family: 'unknown',
              signed_url: signedUrl,
            },
          });
          if (error) {
            console.warn('[StudyFileTab] auto-scan pipeline error', doc.id, error);
          } else {
            console.log('[StudyFileTab] ✅ auto-scan pipeline ran', doc.id, data);
          }
          void analysisHook.refetch?.();
        } catch (e) {
          console.warn('[StudyFileTab] auto-scan threw', doc.id, e);
        }
      }
    })();
  }, [docsLoadedOnce, documents, analysisHook, registry.records, profile?.user_id]);

  // Reconcile pending IDs against actual CRM documents — drops stale entries
  // (files deleted in another tab/session, or that never finished saving server-side).
  useEffect(() => {
    guard.reconcileWithValidIds(documents.map(d => d.id));
  }, [documents, guard]);

  // ═══ Auto-save on analysis completion ═══
  // Once a document's analysis reaches a terminal state (completed / failed /
  // skipped), the extracted facts are already persisted in DB. We commit the
  // CRM file immediately so it survives a refresh — no manual "Save" needed.
  const autoSavedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (guard.pendingCount === 0) return;
    const pending = new Set(guard.pendingIds);

    // Map document_id → crm_file_id via registry records
    const crmIdByDocId = new Map<string, string>();
    for (const r of registry.records) {
      if (r.crm_file_id) crmIdByDocId.set(r.document_id, r.crm_file_id);
    }

    const toSave: string[] = [];
    for (const a of analysisHook.analyses) {
      const isTerminal =
        a.analysis_status === 'completed' ||
        a.analysis_status === 'failed' ||
        a.analysis_status === 'skipped';
      if (!isTerminal) continue;
      const crmId = crmIdByDocId.get(a.document_id);
      if (!crmId) continue;
      if (!pending.has(crmId)) continue;
      if (autoSavedRef.current.has(crmId)) continue;
      toSave.push(crmId);
    }

    if (toSave.length === 0) return;
    toSave.forEach(id => autoSavedRef.current.add(id));

    void (async () => {
      try {
        const { markFilesSaved } = await import('@/api/crmStorage');
        await markFilesSaved(toSave);
        toSave.forEach(id => guard.untrackDocument(id));
        if (import.meta.env.DEV) {
          console.log('[StudyFileTab] auto-saved analyzed docs', { count: toSave.length });
        }
      } catch (e) {
        // Un-mark so a later pass can retry
        toSave.forEach(id => autoSavedRef.current.delete(id));
        if (import.meta.env.DEV) console.warn('[StudyFileTab] auto-save failed', e);
      }
    })();
  }, [analysisHook.analyses, registry.records, guard]);

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
          (supabase as any).from('document_review_queue').delete().in('document_id', ids),
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
          (supabase as any).from('document_review_queue').delete().in('document_id', uniq),
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
      const crmDoc = documents.find((d) => d.id === documentId);
      if (crmDoc) {
        void handleDeleteDoc(crmDoc.id, crmDoc.id);
        return;
      }
      registry.dismissRecord(documentId);
      return;
    }
    void handleDeleteDoc(record.crm_file_id, documentId);
  }, [documents, handleDeleteDoc, registry]);

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
    for (const a of visibleAnalyses) {
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
  }, [docMimeById, t, visibleAnalyses]);

  // ═══ Phase A: Student Evaluation Workspace (persisted) ═══
  const evalDocs = useMemo(
    () => analysesToEvalInputs(visibleAnalyses, {
      citizenshipCountry: canonicalFile?.identity?.citizenship ?? null,
    }),
    [visibleAnalyses, canonicalFile?.identity?.citizenship],
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
            records={displayRecords}
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
        records={displayRecords}
        analyses={visibleAnalyses}
        proposals={visibleProposals}
        artifacts={analysisHook.artifacts}
        hydratedArtifactSurfaces={visibleHydratedArtifactSurfaces}
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

      {/* ═══════════════════════════════════════════════════════════════════
          🔍 وضع المراجعة — جميع الأقسام المخفية معروضة الآن
          راجع كل قسم واتخذ قراراً (إبقاء / حذف / إعادة تصميم).
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-12 space-y-8 border-t-4 border-dashed border-warning pt-8">
        <div className="rounded-lg bg-warning/10 border border-warning/40 p-4">
          <h2 className="text-lg font-bold">🔍 وضع المراجعة — الأقسام المخفية</h2>
          <p className="text-sm text-muted-foreground mt-1">
            كل قسم معروض بعنوان مرقّم. أخبرني بالرقم والقرار (إبقاء/حذف/تعديل).
          </p>
        </div>

        {/* [1] FileQualityCard */}
        {fileQuality && (
          <section className="rounded-lg border-2 border-primary/30 p-4">
            <div className="mb-3 text-xs font-semibold uppercase text-primary">
              [1] FileQualityCard — بطاقة جودة الملف
            </div>
            <FileQualityCard result={fileQuality} />
          </section>
        )}

        {/* [2] CanonicalFileSummary */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [2] CanonicalFileSummary — ملخص الملف الموحد
          </div>
          {canonicalFile ? (
            <CanonicalFileSummary
              canonicalFile={canonicalFile}
              hasIdentity={hasIdentity}
              hasAcademic={hasAcademic}
              hasLanguage={hasLanguage}
              hasTargeting={hasTargeting}
            />
          ) : (
            <p className="text-sm text-muted-foreground">لا يوجد ملف موحد بعد.</p>
          )}
        </section>

        {/* [3] DocumentAnalysisPanel */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [3] DocumentAnalysisPanel — لوحة تحليل المستندات
          </div>
          <DocumentAnalysisPanel
            analyses={visibleAnalyses}
            proposals={visibleProposals}
            liveStages={analysisHook.liveStages}
            onEditField={analysisHook.editFieldValue}
          />
        </section>

        {/* [4] AcademicTruthPanel */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [4] AcademicTruthPanel — لوحة الحقيقة الأكاديمية
          </div>
          <AcademicTruthPanel
            truth={academicTruthHook.truth}
            subjectRows={academicTruthHook.subjectRows}
          />
        </section>

        {/* [5] DecisionPanel */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [5] DecisionPanel — لوحة القرار
          </div>
          <DecisionPanel decision={decisionHook.decision} />
        </section>

        {/* [6] LaneFactsCards */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [6] LaneFactsCard — بطاقات حقائق المسارات ({Object.keys(laneFactsByDocId).length})
          </div>
          <div className="space-y-3">
            {Object.entries(laneFactsByDocId).map(([docId, facts]) => (
              <LaneFactsCard key={docId} documentId={docId} facts={facts} />
            ))}
            {Object.keys(laneFactsByDocId).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد حقائق مسارات حالياً.</p>
            )}
          </div>
        </section>

        {/* [7] DocumentsTab — Passport */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [7] DocumentsTab (PASSPORT) — قسم رفع جواز السفر
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <DocumentsTab
              profile={profile}
              crmProfile={crmProfile}
              onUpdate={onUpdate}
              onTabChange={onTabChange}
              docTypesFilter={PASSPORT_FILTER}
              compact
            />
          </Suspense>
        </section>

        {/* [8] DocumentsTab — Certificate */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [8] DocumentsTab (CERTIFICATE) — قسم رفع الشهادة
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <DocumentsTab
              profile={profile}
              crmProfile={crmProfile}
              onUpdate={onUpdate}
              onTabChange={onTabChange}
              docTypesFilter={CERTIFICATE_FILTER}
              compact
            />
          </Suspense>
        </section>

        {/* [9] DocumentsTab — Additional */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [9] DocumentsTab (ADDITIONAL) — المستندات الإضافية
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <DocumentsTab
              profile={profile}
              crmProfile={crmProfile}
              onUpdate={onUpdate}
              onTabChange={onTabChange}
              docTypesFilter={ADDITIONAL_FILTER}
              compact
            />
          </Suspense>
        </section>

        {/* [10] ProfileTab — الحالة التعليمية */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [10] ProfileTab — الملف الشخصي / الحالة التعليمية
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <ProfileTab
              profile={profile}
              crmProfile={crmProfile}
              onUpdate={onUpdate}
              onRefetch={onRefetch}
            />
          </Suspense>
        </section>

        {/* [11] ReadinessTab */}
        <section className="rounded-lg border-2 border-primary/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-primary">
            [11] ReadinessTab — الجاهزية للتقديم
          </div>
          <Suspense fallback={<SectionSkeleton />}>
            <ReadinessTab profile={profile} crmProfile={crmProfile} />
          </Suspense>
        </section>
      </div>

    </div>
  );
}

