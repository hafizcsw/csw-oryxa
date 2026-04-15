// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: AI Brain Upload Zone
// ═══════════════════════════════════════════════════════════════
// Documents dynamically appear around the brain based on actual
// upload count. Each file gets its own document icon + flow path.
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useMemo } from 'react';
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

// ── Positions for documents around the brain ──
// Distribute documents in a semicircle on both sides
function getDocPositions(count: number): Array<{ x: number; y: number; side: 'left' | 'right' }> {
  if (count === 0) return [];
  const positions: Array<{ x: number; y: number; side: 'left' | 'right' }> = [];
  const brainCx = 300, brainCy = 150;
  const radius = 170;

  // Distribute evenly around, alternating left/right
  // Angles: spread from top-left to bottom-left, then top-right to bottom-right
  const leftSlots = Math.ceil(count / 2);
  const rightSlots = Math.floor(count / 2);

  // Left side: angles from 150° to 210° (spread around 180°)
  for (let i = 0; i < leftSlots; i++) {
    const spread = Math.min(80, leftSlots > 1 ? 80 : 0);
    const baseAngle = 180;
    const offset = leftSlots > 1 ? (i / (leftSlots - 1) - 0.5) * spread : 0;
    const angle = (baseAngle + offset) * Math.PI / 180;
    positions.push({
      x: brainCx + Math.cos(angle) * radius,
      y: brainCy + Math.sin(angle) * (radius * 0.6),
      side: 'left',
    });
  }

  // Right side: angles around 0°
  for (let i = 0; i < rightSlots; i++) {
    const spread = Math.min(80, rightSlots > 1 ? 80 : 0);
    const baseAngle = 0;
    const offset = rightSlots > 1 ? (i / (rightSlots - 1) - 0.5) * spread : 0;
    const angle = (baseAngle + offset) * Math.PI / 180;
    positions.push({
      x: brainCx + Math.cos(angle) * radius,
      y: brainCy + Math.sin(angle) * (radius * 0.6),
      side: 'right',
    });
  }

  return positions;
}

// ── Mini document icon SVG ──
function MiniDoc({ x, y, status, name, index }: {
  x: number; y: number; status: ProcessingStatus; name: string; index: number;
}) {
  const w = 50, h = 62;
  const dx = x - w / 2, dy = y - h / 2;
  const isActive = status === 'uploading' || status === 'confirming';
  const isDone = status === 'registered';
  const isFailed = status === 'upload_failed';
  const cornerSize = 12;

  return (
    <g>
      {/* Document shadow/glow */}
      {isActive && (
        <rect x={dx - 2} y={dy - 2} width={w + 4} height={h + 4} rx="5"
          fill="hsl(var(--primary))" opacity="0.15" filter="url(#softGlow)">
          <animate attributeName="opacity" values="0.1;0.2;0.1" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Document body */}
      <rect x={dx} y={dy} width={w} height={h} rx="3"
        fill="hsl(var(--card))"
        stroke={isDone ? 'hsl(142 71% 45%)' : isFailed ? 'hsl(var(--destructive))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
        strokeWidth={isActive ? 1.5 : 1}
      />
      {/* Folded corner */}
      <path d={`M${dx + w - cornerSize} ${dy} L${dx + w} ${dy} L${dx + w} ${dy + cornerSize} Z`}
        fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.5" />

      {/* Text lines */}
      <rect x={dx + 6} y={dy + 10} width={w * 0.5} height="3" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.3" />
      <rect x={dx + 6} y={dy + 18} width={w * 0.7} height="2.5" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.2" />
      <rect x={dx + 6} y={dy + 24} width={w * 0.55} height="2.5" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.15" />
      <rect x={dx + 6} y={dy + 30} width={w * 0.65} height="2.5" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.15" />
      <rect x={dx + 6} y={dy + 38} width={w * 0.4} height="4" rx="1"
        fill={isDone ? 'hsl(142 71% 45%)' : 'hsl(var(--primary))'} opacity="0.3" />
      <rect x={dx + 6} y={dy + 47} width={w * 0.6} height="2.5" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.12" />

      {/* Status indicator */}
      {isDone && (
        <circle cx={dx + w - 5} cy={dy + h - 5} r="6" fill="hsl(142 71% 45%)" opacity="0.9">
          <animate attributeName="r" values="5;7;5" dur="0.6s" repeatCount="1" />
        </circle>
      )}
      {isDone && (
        <path d={`M${dx + w - 8} ${dy + h - 5} L${dx + w - 5.5} ${dy + h - 3} L${dx + w - 2.5} ${dy + h - 7.5}`}
          fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {isFailed && (
        <circle cx={dx + w - 5} cy={dy + h - 5} r="5" fill="hsl(var(--destructive))" opacity="0.9" />
      )}

      {/* File name (truncated) */}
      <text x={x} y={dy + h + 11} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" opacity="0.7">
        {name.length > 10 ? name.slice(0, 8) + '…' : name}
      </text>
    </g>
  );
}

/** Inline SVG brain with dynamic document positions */
function BrainScene({ records, isProcessing, isDragOver }: {
  records: DocumentRecord[];
  isProcessing: boolean;
  isDragOver: boolean;
}) {
  const isActive = isDragOver || isProcessing || records.length > 0;
  const activeRecords = records.filter(r =>
    r.processing_status !== 'cancelled'
  );

  const docPositions = useMemo(() => getDocPositions(activeRecords.length), [activeRecords.length]);

  const brainCx = 300, brainCy = 150;

  return (
    <svg viewBox="0 0 600 320" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="brainStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ===== DYNAMIC DOCUMENTS + FLOW LINES ===== */}
      {activeRecords.map((record, i) => {
        if (i >= docPositions.length) return null;
        const pos = docPositions[i];
        const isRecordActive = record.processing_status === 'uploading' || record.processing_status === 'confirming';
        const isRecordDone = record.processing_status === 'registered';

        return (
          <g key={record.document_id}>
            {/* Flow line: document → brain */}
            <path
              d={`M${pos.x},${pos.y} Q${(pos.x + brainCx) / 2},${pos.y * 0.7 + brainCy * 0.3} ${brainCx + (pos.side === 'left' ? -52 : 52)},${brainCy}`}
              fill="none"
              stroke={isRecordDone ? 'hsl(142 71% 45%)' : 'hsl(var(--muted-foreground))'}
              strokeWidth="1.2"
              opacity={isRecordActive ? 0.5 : 0.25}
              strokeDasharray={isRecordActive ? "5,5" : isRecordDone ? "none" : "3,6"}
            >
              {isRecordActive && (
                <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.6s" repeatCount="indefinite" />
              )}
            </path>

            {/* Arrowhead */}
            {(() => {
              const ax = brainCx + (pos.side === 'left' ? -48 : 48);
              const dir = pos.side === 'left' ? 1 : -1;
              return (
                <polygon
                  points={`${ax},${brainCy - 4} ${ax},${brainCy + 4} ${ax + dir * 8},${brainCy}`}
                  fill={isRecordDone ? 'hsl(142 71% 45%)' : 'hsl(var(--muted-foreground))'}
                  opacity={isRecordActive ? 0.6 : 0.3}
                />
              );
            })()}

            {/* Animated particle along the path */}
            {isRecordActive && (
              <circle r="3.5" fill="hsl(var(--primary))" opacity="0.85" filter="url(#glow)">
                <animateMotion
                  dur={`${1.0 + (i % 3) * 0.2}s`}
                  repeatCount="indefinite"
                  begin={`${i * 0.15}s`}
                  path={`M${pos.x},${pos.y} Q${(pos.x + brainCx) / 2},${pos.y * 0.7 + brainCy * 0.3} ${brainCx + (pos.side === 'left' ? -52 : 52)},${brainCy}`}
                />
                <animate attributeName="r" values="2;4;2" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Done particle burst */}
            {isRecordDone && (
              <circle cx={brainCx + (pos.side === 'left' ? -45 : 45)} cy={brainCy} r="3" fill="hsl(142 71% 45%)" opacity="0.5">
                <animate attributeName="r" values="3;8;0" dur="1s" repeatCount="1" fill="freeze" />
                <animate attributeName="opacity" values="0.6;0.2;0" dur="1s" repeatCount="1" fill="freeze" />
              </circle>
            )}

            {/* Mini document icon */}
            <MiniDoc
              x={pos.x}
              y={pos.y}
              status={record.processing_status}
              name={record.original_file_name}
              index={i}
            />
          </g>
        );
      })}

      {/* ===== DRAG-OVER floating particles (no files yet) ===== */}
      {isDragOver && activeRecords.length === 0 && (
        <g filter="url(#glow)">
          {[150, 210, 330, 30].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const startX = brainCx + Math.cos(rad) * 170;
            const startY = brainCy + Math.sin(rad) * 100;
            return (
              <circle key={`dp${i}`} r="4" fill="hsl(var(--primary))" opacity="0.6">
                <animateMotion
                  dur="1s"
                  repeatCount="indefinite"
                  begin={`${i * 0.25}s`}
                  path={`M${startX},${startY} L${brainCx},${brainCy}`}
                />
              </circle>
            );
          })}
        </g>
      )}

      {/* ===== CENTRAL BRAIN ===== */}
      <g>
        {/* Brain glow when active */}
        {(isActive || isDragOver) && (
          <ellipse cx={brainCx} cy={brainCy} rx="58" ry="52" fill="hsl(var(--primary))" opacity="0.07" filter="url(#softGlow)">
            <animate attributeName="opacity" values="0.04;0.12;0.04" dur="2s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Brain — Left hemisphere */}
        <path
          d={`M${brainCx} ${brainCy - 55}
             C${brainCx - 10} ${brainCy - 57} ${brainCx - 25} ${brainCy - 55} ${brainCx - 35} ${brainCy - 45}
             C${brainCx - 45} ${brainCy - 35} ${brainCx - 52} ${brainCy - 25} ${brainCx - 52} ${brainCy - 10}
             C${brainCx - 52} ${brainCy + 5} ${brainCx - 48} ${brainCy + 15} ${brainCx - 40} ${brainCy + 25}
             C${brainCx - 32} ${brainCy + 35} ${brainCx - 20} ${brainCy + 42} ${brainCx - 10} ${brainCy + 45}
             C${brainCx - 5} ${brainCy + 47} ${brainCx - 2} ${brainCy + 48} ${brainCx} ${brainCy + 48}`}
          fill="url(#brainGrad)" stroke="url(#brainStroke)" strokeWidth="2" strokeLinejoin="round"
        />
        {/* Left sulci */}
        <path d={`M${brainCx - 32} ${brainCy - 35} C${brainCx - 25} ${brainCy - 30} ${brainCx - 20} ${brainCy - 32} ${brainCx - 12} ${brainCy - 38}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
        <path d={`M${brainCx - 42} ${brainCy - 15} C${brainCx - 32} ${brainCy - 20} ${brainCx - 22} ${brainCy - 18} ${brainCx - 10} ${brainCy - 22}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.25" />
        <path d={`M${brainCx - 45} ${brainCy} C${brainCx - 35} ${brainCy - 2} ${brainCx - 22} ${brainCy + 2} ${brainCx - 5} ${brainCy - 5}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d={`M${brainCx - 40} ${brainCy + 18} C${brainCx - 30} ${brainCy + 13} ${brainCx - 18} ${brainCy + 17} ${brainCx - 5} ${brainCy + 12}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d={`M${brainCx - 28} ${brainCy + 32} C${brainCx - 20} ${brainCy + 28} ${brainCx - 10} ${brainCy + 30} ${brainCx - 2} ${brainCy + 26}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.15" />

        {/* Brain — Right hemisphere */}
        <path
          d={`M${brainCx} ${brainCy - 55}
             C${brainCx + 10} ${brainCy - 57} ${brainCx + 25} ${brainCy - 55} ${brainCx + 35} ${brainCy - 45}
             C${brainCx + 45} ${brainCy - 35} ${brainCx + 52} ${brainCy - 25} ${brainCx + 52} ${brainCy - 10}
             C${brainCx + 52} ${brainCy + 5} ${brainCx + 48} ${brainCy + 15} ${brainCx + 40} ${brainCy + 25}
             C${brainCx + 32} ${brainCy + 35} ${brainCx + 20} ${brainCy + 42} ${brainCx + 10} ${brainCy + 45}
             C${brainCx + 5} ${brainCy + 47} ${brainCx + 2} ${brainCy + 48} ${brainCx} ${brainCy + 48}`}
          fill="url(#brainGrad)" stroke="url(#brainStroke)" strokeWidth="2" strokeLinejoin="round"
        />
        {/* Right sulci */}
        <path d={`M${brainCx + 32} ${brainCy - 35} C${brainCx + 25} ${brainCy - 30} ${brainCx + 20} ${brainCy - 32} ${brainCx + 12} ${brainCy - 38}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
        <path d={`M${brainCx + 42} ${brainCy - 15} C${brainCx + 32} ${brainCy - 20} ${brainCx + 22} ${brainCy - 18} ${brainCx + 10} ${brainCy - 22}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.25" />
        <path d={`M${brainCx + 45} ${brainCy} C${brainCx + 35} ${brainCy - 2} ${brainCx + 22} ${brainCy + 2} ${brainCx + 5} ${brainCy - 5}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d={`M${brainCx + 40} ${brainCy + 18} C${brainCx + 30} ${brainCy + 13} ${brainCx + 18} ${brainCy + 17} ${brainCx + 5} ${brainCy + 12}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
        <path d={`M${brainCx + 28} ${brainCy + 32} C${brainCx + 20} ${brainCy + 28} ${brainCx + 10} ${brainCy + 30} ${brainCx + 2} ${brainCy + 26}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.15" />

        {/* Central dividing line */}
        <line x1={brainCx} y1={brainCy - 53} x2={brainCx} y2={brainCy + 46} stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.15" />

        {/* Brain stem */}
        <path
          d={`M${brainCx - 5} ${brainCy + 45} C${brainCx - 5} ${brainCy + 55} ${brainCx - 7} ${brainCy + 65} ${brainCx - 10} ${brainCy + 75}
              M${brainCx + 5} ${brainCy + 45} C${brainCx + 5} ${brainCy + 55} ${brainCx + 7} ${brainCy + 65} ${brainCx + 10} ${brainCy + 75}`}
          fill="none" stroke="url(#brainStroke)" strokeWidth="1.5" opacity="0.4"
        />

        {/* Neural sparkle at center when active */}
        {(isActive || isDragOver) && (
          <g>
            <circle cx={brainCx} cy={brainCy} r="4" fill="hsl(var(--primary))" opacity="0.5">
              <animate attributeName="r" values="3;7;3" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
            </circle>
            {[0, 72, 144, 216, 288].map(angle => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle key={angle} cx={brainCx + Math.cos(rad) * 22} cy={brainCy + Math.sin(rad) * 22}
                  r="1.5" fill="hsl(var(--primary))" opacity="0.4">
                  <animate attributeName="opacity" values="0.15;0.6;0.15" dur="1.8s" begin={`${angle / 400}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>
        )}
      </g>

      {/* Upload icon at brain center */}
      <g opacity={isProcessing ? 0.9 : isDragOver ? 0.8 : 0.5}>
        {isProcessing ? (
          <g>
            <circle cx={brainCx} cy={brainCy} r="15" fill="hsl(var(--background))" opacity="0.85" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <circle cx={brainCx} cy={brainCy} r="9" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="16 38" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${brainCx} ${brainCy}`} to={`360 ${brainCx} ${brainCy}`} dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        ) : (
          <g>
            <circle cx={brainCx} cy={brainCy} r="15" fill="hsl(var(--background))" opacity="0.65" stroke="hsl(var(--primary))" strokeWidth="1" />
            <path d={`M${brainCx} ${brainCy - 6} L${brainCx} ${brainCy + 6} M${brainCx - 5} ${brainCy - 2} L${brainCx} ${brainCy - 7} L${brainCx + 5} ${brainCy - 2}`}
              stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
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
        {/* The SVG scene — dynamic documents around brain */}
        <div className="w-full max-w-lg">
          <BrainScene records={records} isProcessing={isProcessing} isDragOver={isDragOver} />
        </div>

        {/* Label below */}
        <div className="text-center mt-1">
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
