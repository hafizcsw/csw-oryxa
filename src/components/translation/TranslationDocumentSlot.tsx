import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Upload, 
  Check, 
  AlertCircle, 
  Loader2, 
  FileText, 
  User, 
  GraduationCap, 
  Home,
  Heart,
  RefreshCw,
  Trash2,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QualityBadge } from './QualityBadge';

export type SlotId = 'passport' | 'certificate' | 'transcript' | 'residence' | 
                     'birth_certificate' | 'diploma' | 'medical';

export const ALL_DOC_SLOTS: SlotId[] = [
  'passport', 'certificate', 'transcript', 'residence',
  'birth_certificate', 'diploma', 'medical'
];

export type SlotStatus = 'idle' | 'uploading' | 'checking' | 'ready' | 'rejected';

export interface SlotUI {
  jobId?: string;
  status: SlotStatus;
  localPreviewUrl?: string;
  uploadedPreviewUrl?: string;
  precheck?: { 
    score?: number; 
    pages?: number; 
    rejectionCode?: string;
    fixTips?: string[];
  };
  fileName?: string;
  docSlotOverride?: SlotId; // User-selected doc type (if different from slot position)
}

interface TranslationDocumentSlotProps {
  slotId: SlotId;
  slot: SlotUI;
  isSelected: boolean;
  onSelect: () => void;
  onFileSelect: (file: File) => void;
  onReplace?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onDocSlotChange?: (newSlot: SlotId) => void;
  disabled?: boolean;
  locked?: boolean; // After quote accepted, can't change
}

const SLOT_ICONS: Record<SlotId, React.ComponentType<{ className?: string }>> = {
  passport: User,
  certificate: GraduationCap,
  transcript: FileText,
  residence: Home,
  birth_certificate: FileText,
  diploma: GraduationCap,
  medical: Heart,
};

// AI Scanning Effect Component
const AIScanOverlay = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
    {/* Scan Line */}
    <div 
      className="absolute left-0 right-0 h-1 animate-ai-scan-line" 
      style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--ai-scan)), transparent)' }}
    />
    
    {/* Detection Corners */}
    <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 animate-ai-corners rounded-tl" style={{ borderColor: 'hsl(var(--ai-scan))' }} />
    <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 animate-ai-corners rounded-tr" style={{ borderColor: 'hsl(var(--ai-scan))' }} />
    <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 animate-ai-corners rounded-bl" style={{ borderColor: 'hsl(var(--ai-scan))' }} />
    <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 animate-ai-corners rounded-br" style={{ borderColor: 'hsl(var(--ai-scan))' }} />
    
    {/* AI Label */}
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/95 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 shadow-sm" style={{ color: 'hsl(var(--ai-scan))' }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(var(--ai-scan))' }} />
      AI
    </div>
  </div>
);

export function TranslationDocumentSlot({
  slotId,
  slot,
  isSelected,
  onSelect,
  onFileSelect,
  onReplace,
  onDelete,
  onPreview,
  onDocSlotChange,
  disabled = false,
  locked = false,
}: TranslationDocumentSlotProps) {
  const { t } = useTranslation('translation');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const Icon = SLOT_ICONS[slot.docSlotOverride || slotId];
  const effectiveDocSlot = slot.docSlotOverride || slotId;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect]);

  const handleUploadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const getStatusBadge = () => {
    switch (slot.status) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('unified.uploading')}
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="secondary" className="gap-1 bg-[hsl(var(--ai-scan)/0.15)] text-[hsl(var(--ai-scan))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('unified.checking')}
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            {t('unified.ready')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {t('unified.rejected')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {t('unified.awaiting')}
          </Badge>
        );
    }
  };

  const previewUrl = slot.localPreviewUrl || slot.uploadedPreviewUrl;
  const isPdf = Boolean(previewUrl) && (
    slot.fileName?.toLowerCase().endsWith('.pdf') ||
    previewUrl?.toLowerCase().includes('.pdf') ||
    previewUrl?.toLowerCase().includes('application/pdf')
  );
  const isScanning = slot.status === 'checking';

  return (
    <Card
      data-slot-id={slotId}
      className={cn(
        'cursor-pointer transition-all duration-300 hover:shadow-lg',
        isSelected && 'ring-2 ring-primary border-primary',
        isScanning && 'ring-2 ring-[hsl(var(--ai-scan))] animate-ai-pulse',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={disabled ? undefined : onSelect}
      onDrop={disabled ? undefined : handleDrop}
      onDragOver={disabled ? undefined : handleDragOver}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-5">
          {/* Thumbnail or Icon - with hover overlay for actions */}
          <div 
            className={cn(
              "group relative h-36 w-36 flex-shrink-0 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden border border-border/50",
              isScanning && "border-[hsl(var(--ai-scan)/0.5)]"
            )}
          >
            {previewUrl ? (
              <>
                {isPdf ? (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                    <FileText className="h-12 w-12" />
                    <span className="mt-2 text-xs font-medium">PDF</span>
                  </div>
                ) : (
                  <img 
                    src={previewUrl} 
                    alt={t(`docSlots.${slotId}`)}
                    className="h-full w-full object-cover"
                  />
                )}
                {/* Hover overlay with actions */}
                {!disabled && slot.status !== 'uploading' && slot.status !== 'checking' && (
                  <div className="absolute inset-0 bg-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPreview(true);
                      }}
                      className="p-1 sm:p-1.5 rounded-full bg-background/30 hover:bg-background/50 transition-colors"
                      title={t('unified.viewFile')}
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-background" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReplace?.();
                      }}
                      className="p-1 sm:p-1.5 rounded-full bg-background/30 hover:bg-background/50 transition-colors"
                      title={t('unified.replaceFile')}
                    >
                      <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 text-background" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                      }}
                      className="p-1 sm:p-1.5 rounded-full bg-destructive/70 hover:bg-destructive transition-colors"
                      title={t('unified.deleteFile')}
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-background" />
                    </button>
                  </div>
                )}
                {/* AI Scan Effect */}
                {isScanning && <AIScanOverlay />}
              </>
            ) : (
              <Icon className="h-16 w-16 text-muted-foreground/60" />
            )}
            {slot.status === 'uploading' && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="font-semibold text-base text-foreground truncate">
                {t(`docSlots.${effectiveDocSlot}`)}
              </h4>
              {getStatusBadge()}
            </div>

            {/* Document Type Selector - show when file is uploaded and not locked */}
            {slot.status === 'ready' && !locked && onDocSlotChange && (
              <div className="mb-3">
                <Select
                  value={effectiveDocSlot}
                  onValueChange={(val) => onDocSlotChange(val as SlotId)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder={t('unified.selectDocType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_DOC_SLOTS.map((ds) => (
                      <SelectItem key={ds} value={ds}>
                        {t(`docSlots.${ds}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {slot.fileName && (
              <p className="text-sm text-muted-foreground truncate mb-3">
                {slot.fileName}
              </p>
            )}

            {slot.status === 'idle' && (
              <Button
                size="default"
                variant="outline"
                onClick={handleUploadClick}
                disabled={disabled}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {t('unified.upload')}
              </Button>
            )}

            {slot.status === 'rejected' && (
              <Button
                size="default"
                variant="outline"
                onClick={handleUploadClick}
                disabled={disabled}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t('unified.replace')}
              </Button>
            )}

            {slot.status === 'ready' && (
              <div className="flex items-center gap-3 flex-wrap">
                {slot.precheck?.score !== undefined && (
                  <QualityBadge score={slot.precheck.score} showPercentage={true} size="sm" />
                )}
                {slot.precheck?.pages && (
                  <span className="text-sm text-muted-foreground">
                    {t('unified.pages', { count: slot.precheck.pages })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            isPdf ? (
              <iframe
                title={t(`docSlots.${slotId}`)}
                src={previewUrl}
                className="w-full h-[80vh] rounded-lg"
              />
            ) : (
              <img 
                src={previewUrl} 
                alt={t(`docSlots.${slotId}`)}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

