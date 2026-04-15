// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: Drag-drop multi-file upload
// ═══════════════════════════════════════════════════════════════
// Single + multi-file upload with drag & drop.
// Shows per-file progress, status, and queue.
// No OCR. No AI narration. No extraction.
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, X, CheckCircle2, AlertCircle, Loader2, Clock, Ban } from 'lucide-react';
import brainImg from '@/assets/brain-upload.png';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DocumentRecord, ProcessingStatus } from '@/features/documents/document-registry-model';

interface CentralUploadHubProps {
  records: DocumentRecord[];
  isUploading: boolean;
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  onCancel: (documentId: string) => void;
  onDismiss: (documentId: string) => void;
  onClearCompleted: () => void;
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';

function statusIcon(status: ProcessingStatus) {
  switch (status) {
    case 'registered':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'upload_failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'uploading':
    case 'confirming':
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case 'pending_upload':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    default:
      return <FileUp className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusLabel(status: ProcessingStatus, t: (key: string) => string): string {
  const key = `portal.uploadHub.status_${status}`;
  return t(key);
}

export function CentralUploadHub({
  records,
  isUploading,
  disabled,
  onFilesSelected,
  onCancel,
  onDismiss,
  onClearCompleted,
}: CentralUploadHubProps) {
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }, [disabled, onFilesSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFilesSelected(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onFilesSelected]);

  const completedCount = records.filter(r =>
    r.processing_status === 'registered' ||
    r.processing_status === 'upload_failed' ||
    r.processing_status === 'cancelled'
  ).length;

  const hasActiveRecords = records.length > 0;

  return (
    <div className="space-y-3" data-door2-consumer="upload-hub">
      {/* Brain drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center cursor-pointer transition-all group',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {/* Brain SVG — lobed shape like reference */}
        <div className={cn(
          'relative w-52 h-48 transition-transform duration-300',
          isDragOver && 'scale-105',
        )}>
          <svg viewBox="0 0 400 380" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bFL" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.38" />
              </linearGradient>
              <linearGradient id="bFR" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              </linearGradient>
              <filter id="glow2">
                <feGaussianBlur stdDeviation="4" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ═══ LEFT HEMISPHERE — bulbous lobed outline ═══ */}
            <path
              d="M200 30
                 C192 28, 178 24, 165 30
                 C150 38, 142 52, 130 60
                 C116 50, 96 46, 78 58
                 C58 72, 48 92, 46 112
                 C36 110, 24 122, 22 142
                 C18 166, 28 190, 42 206
                 C36 214, 30 230, 38 248
                 C48 270, 66 282, 82 290
                 C78 302, 72 316, 84 330
                 C98 346, 120 352, 142 350
                 C160 348, 174 338, 184 324
                 C192 310, 196 292, 198 276
                 C200 264, 200 252, 200 242
                 Z"
              fill="url(#bFL)"
              stroke="hsl(var(--primary))"
              strokeWidth="2.8"
              strokeLinejoin="round"
              className={cn('transition-all duration-300', isDragOver ? 'opacity-100' : 'opacity-80 group-hover:opacity-95')}
            />
            {/* Left sulci */}
            <g stroke="hsl(var(--primary))" strokeWidth="1.6" fill="none" strokeLinecap="round"
               opacity={isDragOver ? '0.55' : '0.3'} className="transition-opacity duration-300">
              <path d="M192 58 C174 64, 154 54, 136 64 C120 72, 106 62, 90 68" />
              <path d="M196 95 C176 104, 150 92, 128 102 C108 110, 86 98, 66 108" />
              <path d="M198 135 C178 146, 150 132, 126 144 C102 154, 76 140, 52 152" />
              <path d="M198 175 C180 186, 156 172, 134 184 C114 194, 92 180, 68 192" />
              <path d="M196 218 C178 228, 156 216, 136 226 C118 234, 98 222, 78 232" />
              <path d="M192 258 C176 268, 156 256, 140 266 C126 274, 110 264, 96 272" />
              <path d="M184 296 C170 304, 154 294, 140 302 C128 308, 116 300, 106 308" />
            </g>

            {/* ═══ RIGHT HEMISPHERE ═══ */}
            <path
              d="M200 30
                 C208 28, 222 24, 235 30
                 C250 38, 258 52, 270 60
                 C284 50, 304 46, 322 58
                 C342 72, 352 92, 354 112
                 C364 110, 376 122, 378 142
                 C382 166, 372 190, 358 206
                 C364 214, 370 230, 362 248
                 C352 270, 334 282, 318 290
                 C322 302, 328 316, 316 330
                 C302 346, 280 352, 258 350
                 C240 348, 226 338, 216 324
                 C208 310, 204 292, 202 276
                 C200 264, 200 252, 200 242
                 Z"
              fill="url(#bFR)"
              stroke="hsl(var(--primary))"
              strokeWidth="2.8"
              strokeLinejoin="round"
              className={cn('transition-all duration-300', isDragOver ? 'opacity-100' : 'opacity-70 group-hover:opacity-88')}
            />
            {/* Right sulci */}
            <g stroke="hsl(var(--primary))" strokeWidth="1.6" fill="none" strokeLinecap="round"
               opacity={isDragOver ? '0.45' : '0.25'} className="transition-opacity duration-300">
              <path d="M208 58 C226 64, 246 54, 264 64 C280 72, 294 62, 310 68" />
              <path d="M204 95 C224 104, 250 92, 272 102 C292 110, 314 98, 334 108" />
              <path d="M202 135 C222 146, 250 132, 274 144 C298 154, 324 140, 348 152" />
              <path d="M202 175 C220 186, 244 172, 266 184 C286 194, 308 180, 332 192" />
              <path d="M204 218 C222 228, 244 216, 264 226 C282 234, 302 222, 322 232" />
              <path d="M208 258 C224 268, 244 256, 260 266 C274 274, 290 264, 304 272" />
              <path d="M216 296 C230 304, 246 294, 260 302 C272 308, 284 300, 294 308" />
            </g>

            {/* Center fissure */}
            <line x1="200" y1="30" x2="200" y2="350" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.25" />

            {/* Brain stem */}
            <path d="M190 348 C192 358, 196 368, 200 372 C204 368, 208 358, 210 348"
              fill="none" stroke="hsl(var(--primary))" strokeWidth="2.2" opacity="0.35" strokeLinecap="round" />

            {/* ── Upload icon center ── */}
            <g filter={isDragOver ? 'url(#glow2)' : undefined}>
              <circle cx="200" cy="190" r="28" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2.2"
                className={cn(isDragOver && 'animate-pulse')} />
              <path d="M200 178 L200 202 M191 186 L200 176 L209 186"
                stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {isDragOver && (
              <circle cx="200" cy="190" r="36" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" className="animate-ping" />
            )}
          </svg>
        </div>

        {/* Label below brain */}
        <div className="text-center mt-1">
          <p className={cn(
            'text-sm font-medium transition-colors',
            isDragOver ? 'text-primary' : 'text-foreground',
          )}>
            {t('portal.uploadHub.dropzone_title')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('portal.uploadHub.dropzone_subtitle')}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Queue / Records list */}
      {hasActiveRecords && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              {t('portal.uploadHub.queue_title')}
              {isUploading && (
                <span className="ml-2 text-primary">
                  ({t('portal.uploadHub.in_progress')})
                </span>
              )}
            </span>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCompleted}
                className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                {t('portal.uploadHub.clear_completed')}
              </Button>
            )}
          </div>

          {/* Records */}
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {records.map(record => (
              <div
                key={record.document_id}
                className="flex items-center gap-3 px-4 py-2.5"
                data-registry-id={record.document_id}
                data-registry-status={record.processing_status}
              >
                {statusIcon(record.processing_status)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    {record.original_file_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {statusLabel(record.processing_status, t)}
                    </span>
                    {record.slot_hint && record.slot_hint !== 'unknown' && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                        {record.slot_hint}
                      </span>
                    )}
                  </div>
                  {(record.processing_status === 'uploading' || record.processing_status === 'confirming') && (
                    <Progress value={record.upload_progress} className="h-1 mt-1" />
                  )}
                  {record.error_message && (
                    <p className="text-[10px] text-destructive mt-0.5 truncate">
                      {record.error_message}
                    </p>
                  )}
                </div>
                {/* Actions */}
                {record.processing_status === 'pending_upload' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onCancel(record.document_id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {(record.processing_status === 'registered' ||
                  record.processing_status === 'upload_failed' ||
                  record.processing_status === 'cancelled') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => onDismiss(record.document_id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
