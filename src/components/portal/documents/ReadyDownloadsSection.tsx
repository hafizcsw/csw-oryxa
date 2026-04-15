import { useState } from "react";
import { Download, Eye, FileText, Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePortalFilesV1, PortalFileV1, FILE_KIND_KEYS } from "@/hooks/usePortalFilesV1";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReadyDownloadsSectionProps {
  applicationId?: string;
}

// File card component
function FileCard({ 
  file, 
  onPreview, 
  onDownload,
  isLoading,
  getLabel
}: { 
  file: PortalFileV1; 
  onPreview: () => void;
  onDownload: () => void;
  isLoading: boolean;
  getLabel: (kind: string) => string;
}) {
  const { t } = useLanguage();
  const meta = FILE_KIND_KEYS[file.file_kind] || { key: file.file_kind, icon: '📄', priority: 99 };
  const label = getLabel(file.file_kind);
  
  const statusConfig = {
    ready: { labelKey: 'portal.files.status.ready', color: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
    approved: { labelKey: 'portal.files.status.approved', color: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
    pending_review: { labelKey: 'portal.files.status.pendingReview', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Clock },
    rejected: { labelKey: 'portal.files.status.rejected', color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: AlertCircle },
    hidden: { labelKey: 'portal.files.status.hidden', color: 'bg-muted text-muted-foreground', icon: FileText },
  };
  
  const status = statusConfig[file.status] || statusConfig.ready;
  const StatusIcon = status.icon;
  
  const isPreviewable = file.mime_type?.startsWith('image/') || file.mime_type === 'application/pdf';
  
  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl shrink-0">
            {meta.icon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-foreground truncate">{label}</h4>
              <Badge variant="outline" className={cn("text-xs", status.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {t(status.labelKey)}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground truncate">{file.file_name}</p>
            
            {file.title && (
              <p className="text-xs text-muted-foreground mt-1">{file.title}</p>
            )}
            
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(file.created_at).toLocaleDateString('ar-SA')}
              {file.size_bytes && ` • ${(file.size_bytes / 1024).toFixed(0)} KB`}
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {isPreviewable && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onPreview}
                disabled={isLoading}
                className="gap-1.5"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {t('portal.files.previewBtn')}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="default" 
              onClick={onDownload}
              disabled={isLoading}
              className="gap-1.5"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('portal.files.downloadBtn')}
            </Button>
          </div>
        </div>
        
        {/* Admin notes (if rejected) */}
        {file.status === 'rejected' && file.admin_notes && (
          <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>{t('portal.files.rejectionReason')}:</strong> {file.admin_notes}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Empty state
function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Download className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('portal.files.noFilesTitle')}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {t('portal.files.noFilesDesc')}
      </p>
    </div>
  );
}

export function ReadyDownloadsSection({ applicationId }: ReadyDownloadsSectionProps) {
  const { t } = useLanguage();
  const { grouped, loading, error, refetch, getSignedUrl, getFileKindLabel } = usePortalFilesV1(applicationId);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; mimeType?: string } | null>(null);

  const handlePreview = async (file: PortalFileV1) => {
    setLoadingFileId(file.id);
    try {
      const url = await getSignedUrl(file);
      if (url) {
        setPreviewDoc({ url, name: file.file_name, mimeType: file.mime_type || undefined });
      } else {
        toast.error(t('portal.files.previewFailed'));
      }
    } catch (err) {
      toast.error(t('portal.files.previewFailed'));
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDownload = async (file: PortalFileV1) => {
    setLoadingFileId(file.id);
    try {
      const url = await getSignedUrl(file);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(t('portal.files.downloading'));
      } else {
        toast.error(t('portal.files.downloadLinkFailed'));
      }
    } catch (err) {
      toast.error(t('portal.files.downloadFailed'));
    } finally {
      setLoadingFileId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted/30 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-destructive/50 mx-auto mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const readyFiles = grouped.ready_downloads;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <Download className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('portal.files.readyTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('portal.files.readySubtitle')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Files List */}
      {readyFiles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {readyFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onPreview={() => handlePreview(file)}
              onDownload={() => handleDownload(file)}
              isLoading={loadingFileId === file.id}
              getLabel={getFileKindLabel}
            />
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex-1 min-h-0">
            {previewDoc?.mimeType?.startsWith('image/') ? (
              <img 
                src={previewDoc.url} 
                alt={previewDoc.name}
                className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
              />
            ) : previewDoc?.mimeType === 'application/pdf' ? (
              <iframe
                src={previewDoc.url}
                className="w-full h-[70vh] rounded-lg border"
                title={previewDoc.name}
              />
            ) : (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('portal.files.cannotPreview')}</p>
                <Button 
                  variant="default" 
                  className="mt-4 gap-2"
                  onClick={() => {
                    if (previewDoc?.url) {
                      window.open(previewDoc.url, '_blank');
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  {t('portal.files.downloadFile')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
