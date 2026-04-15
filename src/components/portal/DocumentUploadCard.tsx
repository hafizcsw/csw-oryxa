import { useState, useRef } from "react";
import { Upload, Eye, RefreshCw, Trash2, Download, CheckCircle, Loader2, FileText, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StudentDocument } from "@/hooks/useStudentDocuments";
import { cn } from "@/lib/utils";

interface DocumentUploadCardProps {
  existingDocument?: StudentDocument | null;
  label: string;
  required?: boolean;
  hint?: string;
  icon: React.ElementType;
  onUpload: (file: File) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onPreview?: () => void;
  onDownload?: () => void;
  uploading?: boolean;
  deleting?: boolean;
  accept?: string;
  // P6: Rejection info from CRM
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'needs_fix' | 'reviewing' | 'uploaded';
  rejectionReason?: string | null;
  adminNotes?: string | null;
  // 🆕 Lock all interactions when docs_locked
  disabled?: boolean;
}

export function DocumentUploadCard({
  existingDocument,
  label,
  required,
  hint,
  icon: Icon,
  onUpload,
  onDelete,
  onPreview,
  onDownload,
  uploading = false,
  deleting = false,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  reviewStatus,
  rejectionReason,
  adminNotes,
  disabled = false,
}: DocumentUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect file by ID existence (CRM private buckets have null file_url)
  const hasDocument = !!existingDocument?.id;
  const isImage = existingDocument?.file_name && /\.(jpg|jpeg|png|webp|gif)$/i.test(existingDocument.file_name);
  const isPdf = existingDocument?.file_name && /\.pdf$/i.test(existingDocument.file_name);
  
  // Determine effective review status (from prop or document)
  const effectiveStatus = reviewStatus || (existingDocument as any)?.review_status || 'pending';
  const effectiveRejectionReason = rejectionReason || (existingDocument as any)?.rejection_reason;
  const effectiveAdminNotes = adminNotes || (existingDocument as any)?.admin_notes;
  
  const isRejected = effectiveStatus === 'rejected' || effectiveStatus === 'needs_fix';
  const isApproved = effectiveStatus === 'approved' || effectiveStatus === 'verified';

  const handleFileSelect = async (file: File) => {
    if (disabled) return;  // 🆕 Block if locked
    if (file) {
      await onUpload(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;  // 🆕 Block if locked
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Get status badge config
  const getStatusBadge = () => {
    switch (effectiveStatus) {
      case 'approved':
      case 'verified':
        return { className: 'bg-green-500', icon: CheckCircle };
      case 'rejected':
      case 'needs_fix':
        return { className: 'bg-destructive', icon: XCircle };
      case 'reviewing':
      case 'uploaded':
        return { className: 'bg-blue-500', icon: Loader2 };
      default:
        return { className: 'bg-yellow-500', icon: AlertCircle };
    }
  };
  
  const statusBadge = getStatusBadge();

  // Document ID for focus_document event targeting
  const docId = existingDocument?.id || (existingDocument as any)?.storage_path;
  const docKind = (existingDocument as any)?.document_category || (existingDocument as any)?.file_kind;

  return (
    <div 
      className={cn(
        "flex flex-col sm:flex-row gap-4 items-start",
        isRejected && "ring-2 ring-destructive/50 rounded-lg p-3 bg-destructive/5"
      )}
      data-doc-id={docId}
      data-doc-kind={docKind}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept={accept}
        className="hidden"
      />

      {/* Document Preview Area - Rectangular */}
      <div
        className={cn(
          "relative w-[120px] h-[160px] rounded-xl overflow-hidden",
          "border-2 transition-all duration-200 cursor-pointer group flex-shrink-0",
          isDragOver && "border-primary bg-primary/10 scale-105",
          hasDocument && !isRejected && "border-success/50 bg-success/5",
          hasDocument && isRejected && "border-destructive/50 bg-destructive/5",
          !hasDocument && "border-dashed border-muted-foreground/30 bg-muted/30",
          (uploading || deleting) && "pointer-events-none opacity-70"
        )}
        onClick={() => !uploading && !deleting && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Document Content */}
        {hasDocument ? (
          <>
            {isImage && existingDocument?.signed_url ? (
              <img
                src={existingDocument.signed_url}
                alt={existingDocument.file_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                <FileText className="w-12 h-12 text-primary/70" />
                <span className="text-[10px] text-muted-foreground mt-1 px-2 text-center truncate w-full">
                  {isPdf ? 'PDF' : existingDocument?.file_name?.split('.').pop()?.toUpperCase() || 'FILE'}
                </span>
              </div>
            )}
            
            {/* Status Badge */}
            <div className={cn(
              "absolute top-2 right-2 text-white rounded-full p-1 shadow-lg",
              statusBadge.className
            )}>
              <statusBadge.icon className="w-3 h-3" />
            </div>

            {/* Action Bar - Always visible on mobile, hover on desktop */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0",
              "bg-gradient-to-t from-black/90 via-black/60 to-transparent",
              "flex items-center justify-center gap-1 py-2 px-1",
              "transition-all duration-200",
              "sm:opacity-0 group-hover:opacity-100"
            )}>
              {onPreview && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); onPreview(); }}
                  title="عرض"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDownload && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); onDownload?.(); }}
                  title="تحميل"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={disabled}
                title="استبدال"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-white hover:bg-destructive/80"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  disabled={deleting || disabled}
                  title="حذف"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <>
                <Icon className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <Upload className="w-4 h-4 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground mt-1">اسحب الملف</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{label}</span>
          {required && <span className="text-destructive text-xs">*</span>}
        </div>
        
        {hint && !hasDocument && (
          <p className="text-xs text-muted-foreground mb-2">{hint}</p>
        )}

        {hasDocument ? (
          <div className="space-y-2">
            {/* Status indicator */}
            <div className={cn(
              "flex items-center gap-2 text-sm",
              isApproved && "text-success",
              isRejected && "text-destructive",
              !isApproved && !isRejected && "text-muted-foreground"
            )}>
              {isApproved && <><CheckCircle className="w-4 h-4" /><span>تم التحقق</span></>}
              {isRejected && <><XCircle className="w-4 h-4" /><span>مرفوض - يحتاج إصلاح</span></>}
              {!isApproved && !isRejected && <><Loader2 className="w-4 h-4" /><span>قيد المراجعة</span></>}
            </div>
            
            {/* P6: Rejection reason alert */}
            {isRejected && (effectiveRejectionReason || effectiveAdminNotes) && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>سبب الرفض:</strong> {effectiveRejectionReason || effectiveAdminNotes}
                </AlertDescription>
              </Alert>
            )}
            
            <p className="text-xs text-muted-foreground truncate" title={existingDocument?.file_name}>
              {existingDocument?.file_name}
            </p>
            {existingDocument?.uploaded_at && (
              <p className="text-xs text-muted-foreground">
                تم الرفع: {formatDate(existingDocument.uploaded_at)}
              </p>
            )}
            
            {/* Rejection: Show upload button only */}
            {isRejected && (
              <Button 
                variant="destructive"
                size="sm" 
                className="h-8 gap-1.5 text-xs mt-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || disabled}
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                رفع ملف جديد
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              اضغط أو اسحب ملفاً لرفعه
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              PDF, JPG, PNG - حد أقصى 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
