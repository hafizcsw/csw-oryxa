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
          'relative w-56 h-52 transition-transform duration-300',
          isDragOver && 'scale-105',
        )}>
          <svg viewBox="0 0 512 460" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="brainLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="brainRight" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>
              <filter id="brainShadow">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="hsl(var(--primary))" floodOpacity="0.25" />
              </filter>
              <filter id="glowPulse">
                <feGaussianBlur stdDeviation="6" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g filter="url(#brainShadow)">
              {/* ── Left hemisphere ── realistic brain shape with folds */}
              <path
                d="M248 400 C240 385, 230 360, 220 340 C205 310, 175 295, 150 275
                   C120 250, 95 225, 80 195 C65 165, 55 140, 55 115
                   C55 90, 62 70, 78 52 C94 34, 118 22, 145 18
                   C165 15, 185 20, 200 32 C212 42, 225 28, 240 20
                   C248 16, 252 16, 256 18 L256 400 Z"
                fill="url(#brainLeft)"
                className={cn(
                  'transition-all duration-300',
                  isDragOver ? 'opacity-100' : 'opacity-85 group-hover:opacity-95',
                )}
              />

              {/* Left hemisphere brain folds (sulci) */}
              <g stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" fill="none"
                 opacity={isDragOver ? '0.5' : '0.25'} strokeLinecap="round"
                 className="transition-opacity duration-300">
                {/* Frontal lobe folds */}
                <path d="M230 45 C215 50, 195 48, 178 55 C160 62, 148 58, 135 52" />
                <path d="M242 72 C225 78, 200 75, 180 82 C162 88, 140 80, 120 75" />
                <path d="M248 100 C228 108, 205 102, 185 110 C168 116, 148 108, 128 100 C110 93, 90 98, 78 105" />
                {/* Parietal folds */}
                <path d="M250 135 C232 142, 210 138, 190 145 C172 150, 155 145, 138 138 C118 130, 98 135, 82 142" />
                <path d="M252 170 C235 178, 215 172, 195 180 C178 186, 160 178, 142 172 C122 165, 105 170, 88 178" />
                {/* Temporal lobe folds */}
                <path d="M250 205 C238 212, 218 208, 200 215 C182 220, 165 215, 148 208 C130 200, 112 205, 95 212" />
                <path d="M248 240 C235 248, 218 242, 200 250 C185 255, 168 248, 152 242 C135 235, 118 240, 105 248" />
                <path d="M242 275 C230 282, 215 278, 198 285 C182 290, 168 285, 155 278" />
                <path d="M235 310 C225 316, 210 312, 198 318 C185 322, 172 318, 162 312" />
              </g>

              {/* ── Right hemisphere ── */}
              <path
                d="M264 400 C272 385, 282 360, 292 340 C307 310, 337 295, 362 275
                   C392 250, 417 225, 432 195 C447 165, 457 140, 457 115
                   C457 90, 450 70, 434 52 C418 34, 394 22, 367 18
                   C347 15, 327 20, 312 32 C300 42, 287 28, 272 20
                   C264 16, 260 16, 256 18 L256 400 Z"
                fill="url(#brainRight)"
                className={cn(
                  'transition-all duration-300',
                  isDragOver ? 'opacity-100' : 'opacity-75 group-hover:opacity-88',
                )}
              />

              {/* Right hemisphere brain folds */}
              <g stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none"
                 opacity={isDragOver ? '0.45' : '0.2'} strokeLinecap="round"
                 className="transition-opacity duration-300">
                <path d="M282 45 C297 50, 317 48, 334 55 C352 62, 364 58, 377 52" />
                <path d="M270 72 C287 78, 312 75, 332 82 C350 88, 372 80, 392 75" />
                <path d="M264 100 C284 108, 307 102, 327 110 C344 116, 364 108, 384 100 C402 93, 422 98, 434 105" />
                <path d="M262 135 C280 142, 302 138, 322 145 C340 150, 357 145, 374 138 C394 130, 414 135, 430 142" />
                <path d="M260 170 C277 178, 297 172, 317 180 C334 186, 352 178, 370 172 C390 165, 407 170, 424 178" />
                <path d="M262 205 C274 212, 294 208, 312 215 C330 220, 347 215, 364 208 C382 200, 400 205, 417 212" />
                <path d="M264 240 C277 248, 294 242, 312 250 C327 255, 344 248, 360 242 C377 235, 394 240, 407 248" />
                <path d="M270 275 C282 282, 297 278, 314 285 C330 290, 344 285, 357 278" />
                <path d="M277 310 C287 316, 302 312, 314 318 C327 322, 340 318, 350 312" />
              </g>

              {/* Center fissure */}
              <line x1="256" y1="18" x2="256" y2="400" stroke="hsl(var(--border))" strokeWidth="2" opacity="0.5" />

              {/* Brain stem */}
              <path
                d="M240 390 C240 400, 242 420, 248 435 C252 445, 256 450, 260 445
                   C264 435, 268 420, 272 400 C272 395, 268 390, 264 390 Z"
                fill="hsl(var(--primary))" opacity="0.4"
              />
            </g>

            {/* ── Circuit nodes (tech overlay) ── */}
            <g className="transition-opacity duration-300" opacity={isDragOver ? '0.7' : '0.35'}>
              {/* Left side nodes + lines */}
              <g stroke="hsl(var(--primary-foreground))" strokeWidth="1" fill="none">
                <path d="M180 60 L160 80 L140 82" />
                <path d="M200 95 L175 110 L150 112" />
                <path d="M195 150 L170 162 L145 160" />
                <path d="M190 210 L168 220 L148 218" />
              </g>
              <g fill="hsl(var(--primary-foreground))">
                <circle cx="140" cy="82" r="3" />
                <circle cx="150" cy="112" r="3" />
                <circle cx="145" cy="160" r="3" />
                <circle cx="148" cy="218" r="3" />
                <circle cx="180" cy="60" r="2.5" />
                <circle cx="200" cy="95" r="2.5" />
              </g>

              {/* Right side nodes + lines */}
              <g stroke="hsl(var(--primary))" strokeWidth="1" fill="none">
                <path d="M332 60 L352 80 L372 82" />
                <path d="M312 95 L337 110 L362 112" />
                <path d="M317 150 L342 162 L367 160" />
                <path d="M322 210 L344 220 L364 218" />
              </g>
              <g fill="hsl(var(--primary))" opacity="0.6">
                <circle cx="372" cy="82" r="3" />
                <circle cx="362" cy="112" r="3" />
                <circle cx="367" cy="160" r="3" />
                <circle cx="364" cy="218" r="3" />
                <circle cx="332" cy="60" r="2.5" />
                <circle cx="312" cy="95" r="2.5" />
              </g>
            </g>

            {/* ── Upload icon center ── */}
            <g filter={isDragOver ? 'url(#glowPulse)' : undefined}>
              <circle cx="256" cy="200" r="28" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2.5"
                className={cn(isDragOver && 'animate-pulse')} />
              <path d="M256 188 L256 212 M246 196 L256 186 L266 196"
                stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {isDragOver && (
              <circle cx="256" cy="200" r="36" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" className="animate-ping" />
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
