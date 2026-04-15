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
  const isProcessing = isUploading || records.some(r =>
    r.processing_status === 'uploading' || r.processing_status === 'confirming'
  );
  const isActive = isDragOver || isProcessing;

  return (
    <div className="space-y-3" data-door2-consumer="upload-hub">
      {/* Brain drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center cursor-pointer transition-all group py-4',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {/* Brain container with neural effects */}
        <div className={cn(
          'relative w-44 h-44 transition-transform duration-500 flex items-center justify-center',
          isActive && 'scale-105',
        )}>
          {/* Outer pulse rings when processing */}
          {isProcessing && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-2 rounded-full border border-primary/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
            </>
          )}

          {/* Neural connection lines — visible when processing */}
          {isProcessing && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
              {/* Animated signal paths flowing into brain center */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = 100 + Math.cos(rad) * 95;
                const y1 = 100 + Math.sin(rad) * 95;
                const x2 = 100 + Math.cos(rad) * 35;
                const y2 = 100 + Math.sin(rad) * 35;
                return (
                  <g key={angle}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.3" />
                    {/* Animated dot traveling along the line */}
                    <circle r="2.5" fill="hsl(var(--primary))" opacity="0.8">
                      <animateMotion
                        dur={`${1.2 + i * 0.15}s`}
                        repeatCount="indefinite"
                        path={`M${x1},${y1} L${x2},${y2}`}
                      />
                    </circle>
                  </g>
                );
              })}
              {/* Inner glow */}
              <circle cx="100" cy="100" r="30" fill="hsl(var(--primary))" opacity="0.06">
                <animate attributeName="r" values="28;34;28" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.04;0.1;0.04" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          )}

          {/* Drag-over neural sparks */}
          {isDragOver && !isProcessing && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
              {[30, 90, 150, 210, 270, 330].map((angle) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = 100 + Math.cos(rad) * 90;
                const y1 = 100 + Math.sin(rad) * 90;
                const x2 = 100 + Math.cos(rad) * 40;
                const y2 = 100 + Math.sin(rad) * 40;
                return (
                  <circle key={angle} r="2" fill="hsl(var(--primary))" opacity="0.6">
                    <animateMotion
                      dur="0.8s"
                      repeatCount="indefinite"
                      path={`M${x1},${y1} L${x2},${y2}`}
                    />
                  </circle>
                );
              })}
            </svg>
          )}

          {/* Brain image */}
          <img
            src={brainImg}
            alt=""
            className={cn(
              'w-32 h-32 object-contain transition-all duration-500 relative z-10',
              isActive
                ? 'opacity-100 drop-shadow-[0_0_24px_hsl(var(--primary)/0.4)]'
                : 'opacity-50 group-hover:opacity-75 group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)/0.2)]',
            )}
            draggable={false}
            width={512}
            height={512}
            loading="lazy"
          />

          {/* Center icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className={cn(
              'rounded-full transition-all duration-300',
              isProcessing
                ? 'p-2 bg-primary/10 border border-primary/30'
                : 'p-2.5 bg-background/70 border-2 border-primary/30 group-hover:border-primary/50',
              isDragOver && !isProcessing && 'border-primary bg-background/90 scale-110',
            )}>
              {isProcessing ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Upload className={cn(
                  'h-5 w-5 transition-colors',
                  isDragOver ? 'text-primary' : 'text-primary/60 group-hover:text-primary',
                )} />
              )}
            </div>
          </div>
        </div>

        {/* Label below brain */}
        <div className="text-center mt-2">
          <p className={cn(
            'text-sm font-medium transition-colors',
            isProcessing ? 'text-primary' : isDragOver ? 'text-primary' : 'text-foreground',
          )}>
            {isProcessing ? t('portal.uploadHub.in_progress') : t('portal.uploadHub.dropzone_title')}
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
