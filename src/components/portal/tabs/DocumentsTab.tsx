import { useState, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { signFile } from "@/api/crmStorage";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStudentDocuments, StudentDocument, UploadProgress } from "@/hooks/useStudentDocuments";
import { DocumentVaultHeader } from "@/components/portal/DocumentVaultHeader";
import { RequiredDocumentCard } from "@/components/portal/RequiredDocumentCard";
import { AdditionalFilesTable } from "@/components/portal/AdditionalFilesTable";
import type { StudentProfile, StudentPortalProfile } from "@/hooks/useStudentProfile";
import { TabNavigation } from "./TabNavigation";
import { useStudentSnapshot, DocumentSnapshot } from "@/hooks/useStudentSnapshot";
import { useLanguage } from "@/contexts/LanguageContext";

// Helper: Normalize category
const normalizeCategory = (cat?: string | null) =>
  cat === "general" ? "additional" : (cat || "");

// Helper: Extract timestamp from storage_path
const extractTs = (s?: string | null): number => {
  if (!s) return 0;
  const m = s.match(/\/(\d{10,})_/);
  return m ? Number(m[1]) : 0;
};

// Helper: Get document time
const docTime = (d: StudentDocument): number => {
  const t = d.uploaded_at ? Date.parse(d.uploaded_at) : 0;
  const result = (Number.isFinite(t) && t > 0) ? t : extractTs(d.storage_path);
  return Number.isFinite(result) ? result : 0;
};

// Helper: Check blob URL
const isBlobUrl = (url?: string | null): boolean => 
  !!url && url.startsWith('blob:');

export type DocumentTypeFilter = 'photo' | 'passport' | 'certificate' | 'additional';

interface DocumentsTabProps {
  profile?: StudentProfile;
  crmProfile?: StudentPortalProfile | null;
  onUpdate?: (payload: Partial<StudentPortalProfile>) => Promise<boolean>;
  onTabChange?: (tab: string) => void;
  /** When set, only show these document types. Omit to show all. */
  docTypesFilter?: DocumentTypeFilter[];
  /** When true, hide header/progress/success/security/nav chrome */
  compact?: boolean;
}

export function DocumentsTab({ profile, crmProfile, onUpdate, onTabChange, docTypesFilter, compact }: DocumentsTabProps) {
  const { t } = useLanguage();
  const { 
    documents: studentDocs, 
    loading,
    error,
    featureAvailable,
    uploadDocument, 
    uploadDocuments,
    uploadProgress,
    deleteDocument,
    deleteDuplicates,
    getDuplicatesInfo,
    refetch
  } = useStudentDocuments();
  
  const { snapshot } = useStudentSnapshot();
  
  // Build mapping from file_kind to snapshot doc (for rejection reasons)
  const snapshotDocsMap = useMemo(() => {
    const map = new Map<string, DocumentSnapshot>();
    snapshot?.documents?.forEach(doc => {
      if (doc.file_kind) {
        map.set(doc.file_kind, doc);
      }
    });
    return map;
  }, [snapshot?.documents]);

  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState<string | null>(null);
  const [isSavingDocs, setIsSavingDocs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Duplicates dialog state
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);
  
  // Replace confirm dialog
  const [replaceConfirm, setReplaceConfirm] = useState<{ 
    open: boolean; 
    category: string | null;
    fileName: string | null;
    pendingFile: File | null;
  }>({ open: false, category: null, fileName: null, pendingFile: null });

  // Document form fields
  const [docFormData, setDocFormData] = useState({
    passport_name: '',
    passport_number: '',
    passport_expiry: '',
    gpa: '',
    last_education_level: '',
  });

  // Sync form data with crmProfile
  useEffect(() => {
    if (crmProfile) {
      setDocFormData(prev => ({
        ...prev,
        passport_name: crmProfile.passport_name || '',
        passport_number: crmProfile.passport_number || '',
        passport_expiry: crmProfile.passport_expiry || '',
        gpa: crmProfile.gpa || '',
        last_education_level: crmProfile.last_education_level || '',
      }));
    }
  }, [crmProfile]);

  // Duplicates info
  const duplicatesInfo = useMemo(() => getDuplicatesInfo(), [studentDocs, getDuplicatesInfo]);

  // Get document by category (newest first)
  const getDocByCategory = useCallback((category: string): StudentDocument | null => {
    const wanted = normalizeCategory(category);
    const docs = (studentDocs || []).filter(d =>
      normalizeCategory(d.document_category) === wanted
    );
    if (docs.length === 0) return null;
    const sorted = [...docs].sort((a, b) => docTime(b) - docTime(a));
    return sorted[0];
  }, [studentDocs]);

  // Additional files
  const additionalFiles = useMemo(() => 
    studentDocs.filter(d => d.document_category === 'additional'),
    [studentDocs]
  );

  // Required docs status
  const photoDoc = getDocByCategory('photo');
  const passportDoc = getDocByCategory('passport');
  const certificateDoc = getDocByCategory('certificate');
  
  const requiredDocs = [photoDoc, passportDoc, certificateDoc];
  const completedRequired = requiredDocs.filter(d => !!d?.id).length;
  const totalRequired = 3;

  // Rejection reasons from snapshot
  const getRejectReason = (category: string) => {
    const snapshotDoc = snapshotDocsMap.get(category);
    if (snapshotDoc?.review_status === 'rejected' || snapshotDoc?.status === 'rejected') {
      return snapshotDoc.student_visible_note || snapshotDoc.rejection_reason || null;
    }
    return null;
  };

  // Handle field changes
  const handleDocFieldChange = (field: string, value: string) => {
    setDocFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-save on field blur (debounced save)
  const handleSaveDocFields = async () => {
    if (!onUpdate) return;
    setIsSavingDocs(true);
    try {
      let cleanGpa: string | null = null;
      if (docFormData.gpa) {
        const numericGpa = docFormData.gpa.replace(/[^0-9.]/g, '');
        if (numericGpa) cleanGpa = numericGpa;
      }
      await onUpdate({
        passport_name: docFormData.passport_name || null,
        passport_number: docFormData.passport_number || null,
        passport_expiry: docFormData.passport_expiry || null,
        gpa: cleanGpa,
        last_education_level: docFormData.last_education_level || null,
      });
    } finally {
      setIsSavingDocs(false);
    }
  };

  // Handle upload with confirmation
  const handleCategoryUploadWithConfirm = async (file: File, category: string): Promise<boolean> => {
    // ✅ P0: Client-side docs_locked guard
    if (crmProfile?.docs_locked && category !== 'avatar') {
      toast.error(crmProfile.docs_lock_reason || t('portal.documents.docsLocked'));
      return false;
    }
    
    const existing = getDocByCategory(category);
    if (existing) {
      setReplaceConfirm({ 
        open: true, 
        category, 
        fileName: existing.file_name,
        pendingFile: file 
      });
      return false;
    }
    return handleCategoryUpload(file, category);
  };

  const confirmReplace = async () => {
    if (replaceConfirm?.category && replaceConfirm?.pendingFile) {
      await handleCategoryUpload(replaceConfirm.pendingFile, replaceConfirm.category);
    }
    setReplaceConfirm({ open: false, category: null, fileName: null, pendingFile: null });
  };

  const handleCategoryUpload = async (file: File, category: string) => {
    setUploadingCategory(category);
    const success = await uploadDocument(file, category);
    setUploadingCategory(null);
    return success;
  };

  // Preview handler
  const handlePreviewDocument = async (category: string) => {
    const doc = getDocByCategory(category);
    if (!doc) return;
    
    if (doc.signed_url) {
      setPreviewDoc({ url: doc.signed_url, name: doc.file_name });
      return;
    }
    
    setLoadingSignedUrl(doc.id);
    try {
      const result = await signFile(doc.id);
      if (result.ok && result.signed_url) {
        setPreviewDoc({ url: result.signed_url, name: doc.file_name });
      } else {
        toast.error(t('portal.documents.previewFailed'));
      }
    } finally {
      setLoadingSignedUrl(null);
    }
  };

  // Download handler
  const handleDownloadDocument = async (category: string) => {
    const doc = getDocByCategory(category);
    if (!doc) return;
    
    if (doc.signed_url && !isBlobUrl(doc.signed_url)) {
      window.open(doc.signed_url, '_blank');
      return;
    }
    
    setLoadingSignedUrl(doc.id);
    try {
      const result = await signFile(doc.id);
      if (result.ok && result.signed_url) {
        window.open(result.signed_url, '_blank');
      } else {
        toast.error(t('portal.documents.downloadFailed'));
      }
    } finally {
      setLoadingSignedUrl(null);
    }
  };

  // Delete handler
  const handleDeleteDocument = async (category: string): Promise<boolean> => {
    // ✅ P0: Client-side docs_locked guard for delete
    if (crmProfile?.docs_locked) {
      toast.error(crmProfile.docs_lock_reason || t('portal.documents.docsLockedDelete'));
      return false;
    }
    
    const doc = getDocByCategory(category);
    if (!doc?.storage_path) {
      toast.error(t('portal.documents.noFileToDelete'));
      return false;
    }
    
    setDeletingCategory(category);
    try {
      const success = await deleteDocument(doc.storage_path);
      return success;
    } finally {
      setDeletingCategory(null);
    }
  };

  // Additional files handlers
  const handleAdditionalUpload = async (files: File[]) => {
    setUploadingCategory('additional');
    await uploadDocuments(files, 'additional');
    setUploadingCategory(null);
  };

  const handleAdditionalPreview = async (doc: StudentDocument) => {
    if (doc.signed_url) {
      setPreviewDoc({ url: doc.signed_url, name: doc.file_name });
      return;
    }
    setLoadingSignedUrl(doc.id);
    try {
      const result = await signFile(doc.id);
      if (result.ok && result.signed_url) {
        setPreviewDoc({ url: result.signed_url, name: doc.file_name });
      } else {
        toast.error(t('portal.documents.previewFailed'));
      }
    } finally {
      setLoadingSignedUrl(null);
    }
  };

  const handleAdditionalDownload = async (doc: StudentDocument) => {
    if (doc.signed_url && !isBlobUrl(doc.signed_url)) {
      window.open(doc.signed_url, '_blank');
      return;
    }
    setLoadingSignedUrl(doc.id);
    try {
      const result = await signFile(doc.id);
      if (result.ok && result.signed_url) {
        window.open(result.signed_url, '_blank');
      } else {
        toast.error(t('portal.documents.downloadFailed'));
      }
    } finally {
      setLoadingSignedUrl(null);
    }
  };

  const handleAdditionalDelete = async (doc: StudentDocument) => {
    // ✅ P0: Client-side docs_locked guard for additional files
    if (crmProfile?.docs_locked) {
      toast.error(crmProfile.docs_lock_reason || t('portal.documents.docsLockedDelete'));
      return;
    }
    
    await deleteDocument(doc);
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const isPdf = (fileName: string) => /\.pdf$/i.test(fileName);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted/30 rounded-xl h-20" />
        ))}
      </div>
    );
  }

  const showType = (type: DocumentTypeFilter) => !docTypesFilter || docTypesFilter.includes(type);

  return (
    <div className="space-y-6">
      {/* Header with Progress - hidden in compact mode */}
      {!compact && (
      <DocumentVaultHeader
        totalRequired={totalRequired}
        completedRequired={completedRequired}
        isLocked={crmProfile?.docs_locked}
        lockReason={crmProfile?.docs_lock_reason}
        duplicatesCount={duplicatesInfo.toDelete.length}
        onRefresh={handleRefresh}
        onDeleteDuplicates={() => setShowDuplicatesDialog(true)}
        isRefreshing={isRefreshing}
      />
      )}

      {/* Upload Progress */}
      {Object.entries(uploadProgress).filter(([_, p]) => p.stage !== 'done').length > 0 && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <p className="text-sm font-medium text-primary flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('portal.documents.uploading')}
          </p>
          {Object.entries(uploadProgress)
            .filter(([_, p]) => p.stage !== 'done')
            .map(([key, p]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[200px]">{p.fileName}</span>
                  <span className="text-muted-foreground">
                    {p.stage === 'prepare' && t('portal.documents.preparing')}
                    {p.stage === 'upload' && t('portal.documents.uploadingFile')}
                    {p.stage === 'confirm' && t('portal.documents.confirming')}
                    {p.stage === 'error' && <span className="text-destructive">{p.error}</span>}
                  </span>
                </div>
                <Progress value={p.percent} className="h-2" />
              </div>
            ))}
        </div>
      )}

      {/* Rejection Banner */}
      {(() => {
        const rejectedDocs = snapshot?.documents?.filter(d => 
          d.review_status === 'rejected' || d.status === 'rejected'
        ) || [];
        if (rejectedDocs.length === 0) return null;
        
        return (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">
                  {t('portal.documents.someDocsRejected')}
                </h4>
                <ul className="mt-2 space-y-1">
                  {rejectedDocs.map(doc => (
                    <li key={doc.id} className="text-sm text-muted-foreground">
                      <strong>{doc.file_kind}:</strong>{' '}
                      {doc.student_visible_note || doc.rejection_reason || t('portal.documents.noReasonSpecified')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Required Documents Grid */}
      {(showType('photo') || showType('passport') || showType('certificate')) && (
      <div className={compact ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {showType('photo') && (
        <RequiredDocumentCard
          type="photo"
          document={photoDoc}
          uploading={uploadingCategory === 'photo'}
          deleting={deletingCategory === 'photo'}
          disabled={crmProfile?.docs_locked}
          rejectionReason={getRejectReason('photo')}
          onUpload={(file) => handleCategoryUploadWithConfirm(file, 'photo')}
          onPreview={() => handlePreviewDocument('photo')}
          onDownload={() => handleDownloadDocument('photo')}
          onDelete={() => handleDeleteDocument('photo')}
        />
        )}

        {showType('passport') && (
        <RequiredDocumentCard
          type="passport"
          document={passportDoc}
          uploading={uploadingCategory === 'passport'}
          deleting={deletingCategory === 'passport'}
          disabled={crmProfile?.docs_locked}
          rejectionReason={getRejectReason('passport')}
          passportName={docFormData.passport_name}
          passportNumber={docFormData.passport_number}
          passportExpiry={docFormData.passport_expiry}
          onPassportFieldChange={handleDocFieldChange}
          onUpload={(file) => handleCategoryUploadWithConfirm(file, 'passport')}
          onPreview={() => handlePreviewDocument('passport')}
          onDownload={() => handleDownloadDocument('passport')}
          onDelete={() => handleDeleteDocument('passport')}
        />
        )}

        {showType('certificate') && (
        <RequiredDocumentCard
          type="certificate"
          document={certificateDoc}
          uploading={uploadingCategory === 'certificate'}
          deleting={deletingCategory === 'certificate'}
          disabled={crmProfile?.docs_locked}
          rejectionReason={getRejectReason('certificate')}
          educationLevel={docFormData.last_education_level}
          gpa={docFormData.gpa}
          onCertificateFieldChange={handleDocFieldChange}
          onUpload={(file) => handleCategoryUploadWithConfirm(file, 'certificate')}
          onPreview={() => handlePreviewDocument('certificate')}
          onDownload={() => handleDownloadDocument('certificate')}
          onDelete={() => handleDeleteDocument('certificate')}
        />
        )}
      </div>
      )}

      {/* Save Button */}
      {onUpdate && (showType('passport') || showType('certificate')) && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveDocFields}
            disabled={isSavingDocs}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {isSavingDocs ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('portal.documents.saving')}
              </>
            ) : (
              t('portal.documents.saveData')
            )}
          </Button>
        </div>
      )}

      {/* Additional Files */}
      {showType('additional') && (
      <AdditionalFilesTable
        files={additionalFiles}
        onUpload={handleAdditionalUpload}
        onPreview={handleAdditionalPreview}
        onDownload={handleAdditionalDownload}
        onDelete={handleAdditionalDelete}
        uploading={uploadingCategory === 'additional'}
        disabled={crmProfile?.docs_locked}
      />
      )}

      {/* Success Banner */}
      {!compact && completedRequired === totalRequired && (
        <div className="bg-gradient-to-r from-success/10 via-success/5 to-transparent border border-success/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-success/20">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-success">{t('portal.documents.allDocsComplete')}</p>
            <p className="text-sm text-muted-foreground">{t('portal.documents.allDocsCompleteDesc')}</p>
          </div>
        </div>
      )}

      {/* Security Info */}
      {!compact && (
      <div className="bg-muted/30 rounded-xl border border-border p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="text-sm">
          <p className="font-medium text-foreground mb-1">{t('portal.documents.securityTitle')}</p>
          <p className="text-muted-foreground text-xs">
            {t('portal.documents.securityDesc')}
          </p>
        </div>
      </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle>{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
            {previewDoc && isPdf(previewDoc.name) ? (
              <iframe 
                src={previewDoc.url} 
                className="w-full h-[70vh] rounded-lg border border-border"
                title={previewDoc.name}
              />
            ) : previewDoc ? (
              <img 
                src={previewDoc.url} 
                alt={previewDoc.name}
                className="max-w-full h-auto mx-auto rounded-lg"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace Confirmation Dialog */}
      <AlertDialog 
        open={replaceConfirm?.open} 
        onOpenChange={(open) => !open && setReplaceConfirm({ open: false, category: null, fileName: null, pendingFile: null })}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-foreground">{t('portal.documents.replaceFileTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('portal.documents.replaceFileDesc').replace('{fileName}', replaceConfirm?.fileName || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:gap-2">
            <AlertDialogAction 
              onClick={confirmReplace}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('portal.documents.replace')}
            </AlertDialogAction>
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-border">
              {t('btn.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Duplicates Dialog */}
      <AlertDialog 
        open={showDuplicatesDialog} 
        onOpenChange={setShowDuplicatesDialog}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">{t('portal.documents.deleteDuplicatesTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-3">
              <p>
                {t('portal.documents.duplicatesFound').replace('{count}', String(duplicatesInfo.toDelete.length))}
              </p>
              <p>
                {t('portal.documents.keepNewestCopy')}
              </p>
              
              {Object.entries(duplicatesInfo.byKind).length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-foreground mb-2">{t('portal.documents.details')}:</p>
                  {Object.entries(duplicatesInfo.byKind).map(([kind, info]) => (
                    <div key={kind} className="flex justify-between">
                      <span className="text-muted-foreground">{kind}:</span>
                      <span>
                        {t('portal.documents.willDelete')} {info.duplicates.length} | {t('portal.documents.willKeep')} 1
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={async () => {
                setIsDeletingDuplicates(true);
                try {
                  await deleteDuplicates();
                  await refetch();
                } finally {
                  setIsDeletingDuplicates(false);
                  setShowDuplicatesDialog(false);
                }
              }}
              disabled={isDeletingDuplicates}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isDeletingDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  {t('portal.documents.deleting')}
                </>
              ) : (
                t('portal.documents.deleteCount').replace('{count}', String(duplicatesInfo.toDelete.length))
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isDeletingDuplicates}>{t('btn.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tab Navigation */}
      {!compact && onTabChange && <TabNavigation currentTab="documents" onTabChange={onTabChange} />}
    </div>
  );
}
