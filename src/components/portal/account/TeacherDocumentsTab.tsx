/**
 * TeacherDocumentsTab — Teacher document upload/management inside /account.
 * Uses canonical teacher_documents CRM lane via useTeacherProfile.
 * Upload → teacher_upload_document action → teacher_documents table.
 */
import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { portalInvoke } from '@/api/portalInvoke';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileText, CheckCircle2, Clock, XCircle, 
  AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import type { TeacherProfileState, TeacherDocument } from '@/hooks/useTeacherProfile';

interface TeacherDocumentsTabProps {
  profile: TeacherProfileState;
}

const DOC_CATEGORIES = [
  { kind: 'teacher_identity', icon: FileText, required: true },
  { kind: 'teacher_education', icon: FileText, required: true },
  { kind: 'teacher_supporting', icon: FileText, required: false },
] as const;

export function TeacherDocumentsTab({ profile }: TeacherDocumentsTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getDocsForKind = useCallback((kind: string) => {
    return profile.documents.filter(d => d.file_kind === kind);
  }, [profile.documents]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3 me-1" />
            {t('portal.teacherAccount.docStatus.verified')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 me-1" />
            {t('portal.teacherAccount.docStatus.rejected')}
          </Badge>
        );
      case 'needs_reupload':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-3 w-3 me-1" />
            {t('portal.teacherAccount.docStatus.needsReupload')}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            <Clock className="h-3 w-3 me-1" />
            {t('portal.teacherAccount.docStatus.pending')}
          </Badge>
        );
    }
  };

  const handleUpload = async (kind: string, file: File) => {
    setUploading(kind);
    try {
      // Use canonical teacher_upload_document action
      const res = await portalInvoke<{ file_id: string }>('teacher_upload_document', {
        doc_type: kind,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Upload failed');
      }

      toast({ title: t('portal.teacherAccount.uploadSuccess') });
      // Refresh the profile to get updated documents list
      profile.refresh();
    } catch (err) {
      console.error('[TeacherDocumentsTab] Upload failed:', err);
      toast({ 
        title: t('portal.teacherAccount.uploadFailed'), 
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive' 
      });
    } finally {
      setUploading(null);
      const ref = fileInputRefs.current[kind];
      if (ref) ref.value = '';
    }
  };

  const handleFileSelect = (kind: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ 
        title: t('portal.teacherAccount.fileTooLarge'), 
        variant: 'destructive' 
      });
      return;
    }

    handleUpload(kind, file);
  };

  if (profile.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t('portal.teacherAccount.teacherDocuments')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('portal.teacherAccount.teacherDocumentsDesc')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={profile.refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('portal.teacherAccount.refreshStatus')}
        </Button>
      </div>

      {/* Document Categories */}
      <div className="space-y-4">
        {DOC_CATEGORIES.map(({ kind, icon: Icon, required }) => {
          const docs = getDocsForKind(kind);
          const isUploading = uploading === kind;

          return (
            <div key={kind} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Category Header */}
              <div className="p-5 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {t(`portal.teacherAccount.docKind.${kind}`)}
                        </p>
                        {required && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            {t('portal.teacherAccount.required')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(`portal.teacherAccount.docKindDesc.${kind}`)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <input
                      ref={el => { fileInputRefs.current[kind] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileSelect(kind)}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant={docs.length > 0 ? 'outline' : 'default'}
                      onClick={() => fileInputRefs.current[kind]?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin me-1.5" />
                      ) : (
                        <Upload className="h-4 w-4 me-1.5" />
                      )}
                      {docs.length > 0
                        ? t('portal.teacherAccount.reupload')
                        : t('portal.teacherAccount.uploadNow')
                      }
                    </Button>
                  </div>
                </div>
              </div>

              {/* Document List */}
              {docs.length > 0 ? (
                <div className="divide-y divide-border">
                  {docs.map((doc) => (
                    <div key={doc.file_id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                          {doc.rejection_reason && (
                            <p className="text-xs text-destructive mt-1">{doc.rejection_reason}</p>
                          )}
                          {doc.reviewer_notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">{doc.reviewer_notes}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('portal.teacherAccount.noDocumentsYet')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
