// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: AI Brain Upload Zone
// ═══════════════════════════════════════════════════════════════
// Documents flow into a central brain — animated neural paths
// show data being "analyzed" during upload/processing.
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
  return t(`portal.uploadHub.status_${status}`);
}

/** Inline SVG brain with document-flow animation */
function BrainScene({ isActive, isProcessing, isDragOver }: { isActive: boolean; isProcessing: boolean; isDragOver: boolean }) {
  return (
    <svg viewBox="0 0 600 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Brain gradient */}
        <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="brainStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ===== LEFT DOCUMENT ===== */}
      <g className={cn('transition-all duration-500', isActive ? 'opacity-100' : 'opacity-40')}>
        {/* Document page */}
        <rect x="30" y="60" width="120" height="160" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Folded corner */}
        <path d="M120 60 L150 60 L150 90 L120 60Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Text lines */}
        <rect x="45" y="80" width="60" height="5" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3" />
        <rect x="45" y="95" width="80" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
        <rect x="45" y="107" width="70" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
        <rect x="45" y="119" width="85" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="45" y="131" width="50" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="45" y="148" width="40" height="8" rx="2" fill="hsl(var(--primary))" opacity="0.3" />
        <rect x="45" y="165" width="75" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="45" y="177" width="60" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="45" y="195" width="35" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
      </g>

      {/* ===== RIGHT DOCUMENT ===== */}
      <g className={cn('transition-all duration-500', isActive ? 'opacity-100' : 'opacity-40')}>
        <rect x="450" y="60" width="120" height="160" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <path d="M540 60 L570 60 L570 90 L540 60Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* ID photo placeholder */}
        <circle cx="530" cy="90" r="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />
        <rect x="465" y="80" width="45" height="5" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3" />
        <rect x="465" y="95" width="55" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
        <rect x="465" y="107" width="90" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
        <rect x="465" y="119" width="80" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="465" y="131" width="70" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="465" y="148" width="90" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="465" y="160" width="60" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
        <rect x="465" y="177" width="50" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" />
      </g>

      {/* ===== FLOW ARROWS: Left doc → Brain ===== */}
      <g className={cn('transition-opacity duration-300', isActive ? 'opacity-100' : 'opacity-30')}>
        {/* Arrow lines from left doc to brain */}
        <path d="M155 110 L220 130" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.6s" repeatCount="indefinite" />}
        </path>
        <path d="M155 140 L220 145" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.5s" repeatCount="indefinite" />}
        </path>
        <path d="M155 170 L220 160" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.7s" repeatCount="indefinite" />}
        </path>
        {/* Arrowheads */}
        <polygon points="220,127 220,133 228,130" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        <polygon points="220,142 220,148 228,145" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        <polygon points="220,157 220,163 228,160" fill="hsl(var(--muted-foreground))" opacity="0.5" />
      </g>

      {/* ===== FLOW ARROWS: Right doc → Brain ===== */}
      <g className={cn('transition-opacity duration-300', isActive ? 'opacity-100' : 'opacity-30')}>
        <path d="M445 110 L380 130" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.6s" repeatCount="indefinite" />}
        </path>
        <path d="M445 140 L380 145" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.5s" repeatCount="indefinite" />}
        </path>
        <path d="M445 170 L380 160" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray={isActive ? "4,4" : "none"}>
          {isActive && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.7s" repeatCount="indefinite" />}
        </path>
        <polygon points="380,127 380,133 372,130" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        <polygon points="380,142 380,148 372,145" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        <polygon points="380,157 380,163 372,160" fill="hsl(var(--muted-foreground))" opacity="0.5" />
      </g>

      {/* ===== ANIMATED DATA PARTICLES (when processing) ===== */}
      {isProcessing && (
        <g filter="url(#glow)">
          {/* Left side particles */}
          {[0, 1, 2].map(i => (
            <circle key={`lp${i}`} r="3" fill="hsl(var(--primary))" opacity="0.8">
              <animateMotion
                dur={`${1.0 + i * 0.3}s`}
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
                path={`M155,${110 + i * 30} L${240 + i * 5},${130 + i * 15} L300,150`}
              />
              <animate attributeName="r" values="2;4;2" dur={`${1.0 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* Right side particles */}
          {[0, 1, 2].map(i => (
            <circle key={`rp${i}`} r="3" fill="hsl(var(--primary))" opacity="0.8">
              <animateMotion
                dur={`${1.1 + i * 0.25}s`}
                repeatCount="indefinite"
                begin={`${i * 0.35 + 0.15}s`}
                path={`M445,${110 + i * 30} L${360 - i * 5},${130 + i * 15} L300,150`}
              />
              <animate attributeName="r" values="2;4;2" dur={`${1.1 + i * 0.25}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      )}

      {/* ===== DRAG-OVER PARTICLES ===== */}
      {isDragOver && !isProcessing && (
        <g filter="url(#glow)">
          {[0, 1, 2, 3].map(i => {
            const fromLeft = i < 2;
            const startX = fromLeft ? 155 : 445;
            const startY = 110 + (i % 2) * 50;
            return (
              <circle key={`dp${i}`} r="3.5" fill="hsl(var(--primary))" opacity="0.7">
                <animateMotion
                  dur="0.8s"
                  repeatCount="indefinite"
                  begin={`${i * 0.2}s`}
                  path={`M${startX},${startY} L300,150`}
                />
              </circle>
            );
          })}
        </g>
      )}

      {/* ===== CENTRAL BRAIN ===== */}
      <g className={cn('transition-all duration-500', isActive && 'drop-shadow-lg')}>
        {/* Brain glow when active */}
        {isActive && (
          <ellipse cx="300" cy="145" rx="55" ry="50" fill="hsl(var(--primary))" opacity="0.08" filter="url(#softGlow)">
            <animate attributeName="opacity" values="0.05;0.12;0.05" dur="2s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Brain — Left hemisphere */}
        <path
          d="M300 95 
             C290 93 275 95 265 105
             C255 115 248 125 248 140
             C248 155 252 165 260 175
             C268 185 280 192 290 195
             C295 197 298 198 300 198"
          fill="url(#brainGrad)" stroke="url(#brainStroke)" strokeWidth="2" strokeLinejoin="round"
        />
        {/* Left hemisphere folds/sulci */}
        <path d="M268 115 C275 120 280 118 288 112" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
        <path d="M258 135 C268 130 278 132 290 128" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.25" />
        <path d="M255 150 C265 148 278 152 295 145" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d="M260 168 C270 163 282 167 295 162" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d="M272 182 C280 178 290 180 298 176" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.15" />

        {/* Brain — Right hemisphere */}
        <path
          d="M300 95 
             C310 93 325 95 335 105
             C345 115 352 125 352 140
             C352 155 348 165 340 175
             C332 185 320 192 310 195
             C305 197 302 198 300 198"
          fill="url(#brainGrad)" stroke="url(#brainStroke)" strokeWidth="2" strokeLinejoin="round"
        />
        {/* Right hemisphere folds */}
        <path d="M332 115 C325 120 320 118 312 112" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
        <path d="M342 135 C332 130 322 132 310 128" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.25" />
        <path d="M345 150 C335 148 322 152 305 145" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d="M340 168 C330 163 318 167 305 162" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d="M328 182 C320 178 310 180 302 176" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.15" />

        {/* Central dividing line */}
        <line x1="300" y1="97" x2="300" y2="196" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.2" />

        {/* Brain stem */}
        <path
          d="M295 195 C295 205 293 215 290 225 M305 195 C305 205 307 215 310 225"
          fill="none" stroke="url(#brainStroke)" strokeWidth="1.5" opacity="0.5"
        />

        {/* Neural sparkle at center when active */}
        {isActive && (
          <g>
            <circle cx="300" cy="145" r="4" fill="hsl(var(--primary))" opacity="0.6">
              <animate attributeName="r" values="3;6;3" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.2s" repeatCount="indefinite" />
            </circle>
            {/* Small sparkle dots */}
            {[0, 60, 120, 180, 240, 300].map(angle => {
              const r = 20;
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={angle}
                  cx={300 + Math.cos(rad) * r}
                  cy={145 + Math.sin(rad) * r}
                  r="1.5"
                  fill="hsl(var(--primary))"
                  opacity="0.5"
                >
                  <animate
                    attributeName="opacity"
                    values="0.2;0.7;0.2"
                    dur="1.5s"
                    begin={`${angle / 360}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}
          </g>
        )}
      </g>

      {/* Upload icon at brain center */}
      <g className="transition-opacity duration-300" opacity={isProcessing ? 0.9 : 0.6}>
        {isProcessing ? (
          <g>
            <circle cx="300" cy="145" r="14" fill="hsl(var(--background))" opacity="0.85" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            {/* Spinning loader */}
            <circle cx="300" cy="145" r="8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="15 35" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 300 145" to="360 300 145" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        ) : (
          <g>
            <circle cx="300" cy="145" r="14" fill="hsl(var(--background))" opacity="0.7" stroke="hsl(var(--primary))" strokeWidth="1" opacity2="0.4" />
            {/* Upload arrow icon */}
            <path d="M300 139 L300 151 M295 143 L300 138 L305 143" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
          </g>
        )}
      </g>
    </svg>
  );
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
          'relative flex flex-col items-center justify-center cursor-pointer transition-all group',
          'rounded-2xl border-2 border-dashed p-4',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {/* The SVG scene */}
        <div className="w-full max-w-md">
          <BrainScene isActive={isActive} isProcessing={isProcessing} isDragOver={isDragOver} />
        </div>

        {/* Label below */}
        <div className="text-center mt-1">
          <p className={cn(
            'text-sm font-medium transition-colors',
            isActive ? 'text-primary' : 'text-foreground',
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
