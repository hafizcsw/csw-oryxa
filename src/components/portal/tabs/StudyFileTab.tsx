import { lazy, Suspense, useCallback, useRef, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileQualityCard } from "@/components/file-quality/FileQualityCard";
import { CanonicalFileSummary } from "@/components/student-file/CanonicalFileSummary";
import { CentralUploadHub } from "@/components/documents/CentralUploadHub";
import { LiveProfileAssembly } from "@/components/documents/LiveProfileAssembly";
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

  // Trigger analysis when records become registered
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
  }, [registry.records, analysisHook]);

  const handleFilesSelected = useCallback((files: File[]) => {
    for (const file of files) {
      const key = uniqueFileKey(file);
      pendingFilesRef.current.set(key, { file, fileKey: key });
      const existing = fileNameToKeysRef.current.get(file.name) || [];
      existing.push(key);
      fileNameToKeysRef.current.set(file.name, existing);
    }
    registry.enqueueFiles(files, 'upload_hub');
  }, [registry]);

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
        />
      </section>
    </div>
  );
}
