import { useState, useRef } from "react";
import { 
  FileText, Download, Eye, Trash2, Upload, 
  ChevronDown, ChevronUp, Loader2, Plus 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudentDocument } from "@/hooks/useStudentDocuments";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdditionalFilesTableProps {
  files: StudentDocument[];
  onUpload: (files: File[]) => Promise<void>;
  onPreview: (doc: StudentDocument) => void;
  onDownload: (doc: StudentDocument) => void;
  onDelete: (doc: StudentDocument) => Promise<void>;
  uploading?: boolean;
  disabled?: boolean;
}

const MAX_VISIBLE = 4;

export function AdditionalFilesTable({
  files,
  onUpload,
  onPreview,
  onDownload,
  onDelete,
  uploading,
  disabled,
}: AdditionalFilesTableProps) {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleFiles = expanded ? files : files.slice(0, MAX_VISIBLE);
  const hiddenCount = files.length - MAX_VISIBLE;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      await onUpload(selectedFiles);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (doc: StudentDocument) => {
    setDeletingId(doc.id);
    try {
      await onDelete(doc);
    } finally {
      setDeletingId(null);
    }
  };

  const isPreviewable = (fileName: string) => 
    /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(fileName);

  const dateLocale = language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        onChange={handleFileSelect}
        className="hidden"
        multiple
        disabled={disabled || uploading}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">{t('portal.documents.additionalFiles')}</h4>
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{t('portal.documents.addFile')}</span>
        </Button>
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('portal.documents.noAdditionalFiles')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('portal.documents.additionalFilesHint')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {visibleFiles.map((doc) => (
            <div 
              key={doc.id}
              className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString(dateLocale) : ''}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {isPreviewable(doc.file_name) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onPreview(doc)}
                    title={t('portal.documents.preview')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onDownload(doc)}
                  title={t('portal.documents.download')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {!disabled && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    title={t('portal.documents.delete')}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Expand/Collapse Button */}
          {files.length > MAX_VISIBLE && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  {t('portal.documents.showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  {t('portal.documents.showMore').replace('{count}', String(hiddenCount))}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
