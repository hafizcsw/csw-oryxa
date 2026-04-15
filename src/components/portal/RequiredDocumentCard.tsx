import { useState, useRef, useCallback } from "react";
import { 
  Camera, FileText, GraduationCap, Eye, Download, 
  RefreshCw, Trash2, Upload, Loader2, CheckCircle, 
  XCircle, Clock, AlertCircle, ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StudentDocument } from "@/hooks/useStudentDocuments";
import { useLanguage } from "@/contexts/LanguageContext";

type DocumentType = 'photo' | 'passport' | 'certificate';

interface RequiredDocumentCardProps {
  type: DocumentType;
  document?: StudentDocument | null;
  uploading?: boolean;
  deleting?: boolean;
  disabled?: boolean;
  rejectionReason?: string | null;
  // Passport fields
  passportName?: string;
  passportNumber?: string;
  passportExpiry?: string;
  onPassportFieldChange?: (field: string, value: string) => void;
  // Certificate fields
  educationLevel?: string;
  gpa?: string;
  onCertificateFieldChange?: (field: string, value: string) => void;
  // Actions
  onUpload: (file: File) => Promise<boolean>;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function RequiredDocumentCard({
  type,
  document,
  uploading,
  deleting,
  disabled,
  rejectionReason,
  passportName,
  passportNumber,
  passportExpiry,
  onPassportFieldChange,
  educationLevel,
  gpa,
  onCertificateFieldChange,
  onUpload,
  onPreview,
  onDownload,
  onDelete,
}: RequiredDocumentCardProps) {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const TYPE_CONFIG = {
    photo: {
      icon: Camera,
      title: t('portal.documents.photo'),
      hint: t('portal.documents.photoHint'),
      accept: "image/*",
    },
    passport: {
      icon: FileText,
      title: t('portal.documents.passport'),
      hint: t('portal.documents.passportHint'),
      accept: ".pdf,.jpg,.jpeg,.png,.webp",
    },
    certificate: {
      icon: GraduationCap,
      title: t('portal.documents.certificate'),
      hint: t('portal.documents.certificateHint'),
      accept: ".pdf,.jpg,.jpeg,.png,.webp",
    },
  };

  const STATUS_CONFIG = {
    verified: { bg: "bg-emerald-500", label: t('portal.documents.statusVerified'), icon: CheckCircle },
    approved: { bg: "bg-emerald-500", label: t('portal.documents.statusVerified'), icon: CheckCircle },
    accepted: { bg: "bg-emerald-500", label: t('portal.documents.statusVerified'), icon: CheckCircle },
    rejected: { bg: "bg-destructive", label: t('portal.documents.statusRejected'), icon: XCircle },
    pending: { bg: "bg-amber-500", label: t('portal.documents.statusPending'), icon: Clock },
    reviewing: { bg: "bg-blue-500", label: t('portal.documents.statusReviewing'), icon: Loader2 },
    uploaded: { bg: "bg-blue-500", label: t('portal.documents.statusReviewing'), icon: Loader2 },
  };

  const EDUCATION_LEVELS = [
    { value: 'high_school', label: t('portal.documents.eduHighSchool') },
    { value: 'diploma', label: t('portal.documents.eduDiploma') },
    { value: 'bachelor', label: t('portal.documents.eduBachelor') },
    { value: 'master', label: t('portal.documents.eduMaster') },
    { value: 'phd', label: t('portal.documents.eduPhd') },
  ];
  
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  const hasDocument = !!document?.id;
  const isImage = document?.file_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|webp|gif)$/i.test(document?.file_name || '');
  const status = document?.status || 'pending';
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled || uploading) return;
    await onUpload(file);
  }, [disabled, uploading, onUpload]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [disabled, uploading, handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const dateLocale = language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className={cn(
      "bg-card rounded-2xl border overflow-hidden transition-all duration-200",
      isDragOver && "ring-2 ring-primary ring-offset-2",
      status === 'rejected' && "border-destructive/50",
      hasDocument && status !== 'rejected' && "border-border",
      !hasDocument && "border-dashed border-muted-foreground/30"
    )}>
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Preview Area */}
      <div 
        className={cn(
          "relative aspect-[4/3] bg-muted/30 cursor-pointer group",
          disabled && "cursor-not-allowed opacity-60"
        )}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Status Badge - Top Right */}
        {hasDocument && (
          <div className={cn(
            "absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1.5",
            statusConfig.bg
          )}>
            <StatusIcon className={cn("h-3.5 w-3.5", status === 'reviewing' && "animate-spin")} />
            {statusConfig.label}
          </div>
        )}

        {/* Content */}
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary/5">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <span className="text-sm text-primary font-medium">{t('portal.documents.uploadingFile')}</span>
          </div>
        ) : hasDocument && document?.signed_url ? (
          // Show image preview
          isImage ? (
            <img 
              src={document.signed_url} 
              alt={config.title}
              className="w-full h-full object-cover"
            />
          ) : (
            // File icon for PDFs
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground max-w-[80%] truncate">
                {document.file_name}
              </span>
            </div>
          )
        ) : hasDocument ? (
          // Document exists but no signed_url
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
            <span className="text-sm text-muted-foreground">{document.file_name}</span>
          </div>
        ) : (
          // Empty state - upload prompt
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragOver ? "bg-primary/20" : "bg-muted/50"
            )}>
              <Icon className={cn(
                "h-8 w-8 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{config.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('portal.documents.dragOrClick')}
              </p>
            </div>
          </div>
        )}

        {/* Action Overlay - visible on hover (desktop) or always (mobile) */}
        {hasDocument && !uploading && !disabled && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 p-2",
            "bg-gradient-to-t from-black/80 via-black/50 to-transparent",
            "flex items-center justify-center gap-1.5",
            "transition-opacity duration-200",
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          )}>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onPreview(); }}
              title={t('portal.documents.preview')}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              title={t('portal.documents.download')}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              title={t('portal.documents.replace')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-red-500/80"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              title={t('portal.documents.delete')}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-4">
        {/* Title & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-foreground">{config.title}</h4>
          </div>
          {!hasDocument && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {t('portal.documents.required')}
            </span>
          )}
        </div>

        {/* Rejection Reason */}
        {status === 'rejected' && rejectionReason && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t('portal.documents.rejectionReason')}:</p>
              <p className="text-destructive/80 mt-0.5">{rejectionReason}</p>
            </div>
          </div>
        )}

        {/* Passport Fields */}
        {type === 'passport' && onPassportFieldChange && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {t('portal.documents.englishName')}
              </label>
              <Input
                value={passportName || ''}
                onChange={(e) => onPassportFieldChange('passport_name', e.target.value)}
                placeholder="MOHAMMED ALI"
                className="h-10 bg-background text-sm"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {t('portal.documents.passportNumber')}
                </label>
                <Input
                  value={passportNumber || ''}
                  onChange={(e) => onPassportFieldChange('passport_number', e.target.value)}
                  placeholder="A12345678"
                  className="h-10 bg-background text-sm min-w-0 text-left font-mono tracking-wide"
                  dir="ltr"
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {t('portal.documents.expiryDate')}
                </label>
                <Input
                  type="date"
                  value={passportExpiry || ''}
                  onChange={(e) => onPassportFieldChange('passport_expiry', e.target.value)}
                  className="h-10 bg-background text-sm min-w-0"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {/* Certificate Fields */}
        {type === 'certificate' && onCertificateFieldChange && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {t('portal.documents.academicLevel')}
              </label>
              <Select 
                value={educationLevel || ''} 
                onValueChange={(value) => onCertificateFieldChange('last_education_level', value)}
              >
                <SelectTrigger className="h-10 bg-background text-sm">
                  <SelectValue placeholder={t('portal.documents.selectLevel')} />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {t('portal.documents.gpa')}
              </label>
              <Input
                value={gpa || ''}
                onChange={(e) => onCertificateFieldChange('gpa', e.target.value)}
                placeholder={t('portal.documents.gpaExample')}
                className="h-10 bg-background text-sm"
              />
            </div>
          </div>
        )}

        {/* File Info */}
        {hasDocument && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="truncate max-w-[60%]">{document.file_name}</span>
            <span>{document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString(dateLocale) : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
