// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: Drag-drop multi-file upload
// ═══════════════════════════════════════════════════════════════
// Single + multi-file upload with drag & drop.
// Shows per-file progress, status, and queue.
// No OCR. No AI narration. No extraction.
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, X, CheckCircle2, AlertCircle, Loader2, Clock, Ban } from 'lucide-react';
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
        {/* Brain SVG */}
        <div className={cn(
          'relative w-48 h-48 transition-transform duration-300',
          isDragOver && 'scale-105',
        )}>
          <svg viewBox="0 0 200 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="brainGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="brainGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              </linearGradient>
              <filter id="brainGlow">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Left hemisphere */}
            <path
              d="M98 140 C98 140, 95 130, 92 120 C85 105, 65 100, 55 90 C40 78, 30 65, 32 50 C34 35, 45 22, 58 18 C68 15, 78 18, 85 25 C88 20, 92 15, 98 14 L98 140Z"
              fill="url(#brainGradLeft)"
              className={cn(
                'transition-all duration-300',
                isDragOver ? 'opacity-100' : 'opacity-80 group-hover:opacity-90',
              )}
            />
            {/* Left brain circuits */}
            <g stroke="hsl(var(--primary-foreground))" strokeWidth="0.8" fill="none" opacity={isDragOver ? '0.7' : '0.4'} className="transition-opacity duration-300">
              <path d="M70 35 L65 45 L55 48" />
              <path d="M80 30 L75 42 L65 50 L58 55" />
              <path d="M85 40 L78 55 L68 62" />
              <path d="M90 50 L82 65 L72 72" />
              <path d="M88 70 L78 80 L68 85" />
              <path d="M92 85 L82 95 L72 98" />
              <circle cx="70" cy="35" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="55" cy="48" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="58" cy="55" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="68" cy="62" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="72" cy="72" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="68" cy="85" r="2" fill="hsl(var(--primary-foreground))" />
              <circle cx="72" cy="98" r="2" fill="hsl(var(--primary-foreground))" />
            </g>

            {/* Right hemisphere */}
            <path
              d="M102 140 C102 140, 105 130, 108 120 C115 105, 135 100, 145 90 C160 78, 170 65, 168 50 C166 35, 155 22, 142 18 C132 15, 122 18, 115 25 C112 20, 108 15, 102 14 L102 140Z"
              fill="url(#brainGradRight)"
              className={cn(
                'transition-all duration-300',
                isDragOver ? 'opacity-100' : 'opacity-70 group-hover:opacity-85',
              )}
            />
            {/* Right brain circuits */}
            <g stroke="hsl(var(--primary))" strokeWidth="0.8" fill="none" opacity={isDragOver ? '0.6' : '0.3'} className="transition-opacity duration-300">
              <path d="M130 35 L135 45 L145 48" />
              <path d="M120 30 L125 42 L135 50 L142 55" />
              <path d="M115 40 L122 55 L132 62" />
              <path d="M110 50 L118 65 L128 72" />
              <path d="M112 70 L122 80 L132 85" />
              <path d="M108 85 L118 95 L128 98" />
              <circle cx="130" cy="35" r="2" fill="hsl(var(--primary))" />
              <circle cx="145" cy="48" r="2" fill="hsl(var(--primary))" />
              <circle cx="142" cy="55" r="2" fill="hsl(var(--primary))" />
              <circle cx="132" cy="62" r="2" fill="hsl(var(--primary))" />
              <circle cx="128" cy="72" r="2" fill="hsl(var(--primary))" />
              <circle cx="132" cy="85" r="2" fill="hsl(var(--primary))" />
              <circle cx="128" cy="98" r="2" fill="hsl(var(--primary))" />
            </g>

            {/* Center line */}
            <line x1="100" y1="14" x2="100" y2="140" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="3,3" />

            {/* Upload icon in center */}
            <g filter={isDragOver ? 'url(#brainGlow)' : undefined}>
              <circle cx="100" cy="75" r="16" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" className={cn(isDragOver && 'animate-pulse')} />
              <path d="M100 68 L100 82 M94 73 L100 67 L106 73" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* Pulse rings on drag */}
            {isDragOver && (
              <>
                <circle cx="100" cy="75" r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" opacity="0.5" className="animate-ping" />
              </>
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
