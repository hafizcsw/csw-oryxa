// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: AI Brain Upload Zone
// ═══════════════════════════════════════════════════════════════
// Progressive brain illumination + dynamic document visualization
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

// ── File type detection for color coding ──
function getFileType(filename: string): 'pdf' | 'image' | 'doc' | 'spreadsheet' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  return 'other';
}

function getFileTypeColor(type: ReturnType<typeof getFileType>): string {
  switch (type) {
    case 'pdf': return '#E53E3E';
    case 'image': return '#38A169';
    case 'doc': return '#3182CE';
    case 'spreadsheet': return '#D69E2E';
    default: return '#718096';
  }
}

function getFileTypeLabel(type: ReturnType<typeof getFileType>): string {
  switch (type) {
    case 'pdf': return 'PDF';
    case 'image': return 'IMG';
    case 'doc': return 'DOC';
    case 'spreadsheet': return 'XLS';
    default: return 'FILE';
  }
}

// ── Positions for documents around the brain ──
function getDocPositions(count: number): Array<{ x: number; y: number; side: 'left' | 'right' }> {
  if (count === 0) return [];
  const positions: Array<{ x: number; y: number; side: 'left' | 'right' }> = [];
  const brainCx = 300, brainCy = 150;
  const radius = 180;

  const leftSlots = Math.ceil(count / 2);
  const rightSlots = Math.floor(count / 2);

  for (let i = 0; i < leftSlots; i++) {
    const spread = Math.min(90, leftSlots > 1 ? 90 : 0);
    const baseAngle = 180;
    const offset = leftSlots > 1 ? (i / (leftSlots - 1) - 0.5) * spread : 0;
    const angle = (baseAngle + offset) * Math.PI / 180;
    positions.push({
      x: brainCx + Math.cos(angle) * radius,
      y: brainCy + Math.sin(angle) * (radius * 0.55),
      side: 'left',
    });
  }

  for (let i = 0; i < rightSlots; i++) {
    const spread = Math.min(90, rightSlots > 1 ? 90 : 0);
    const baseAngle = 0;
    const offset = rightSlots > 1 ? (i / (rightSlots - 1) - 0.5) * spread : 0;
    const angle = (baseAngle + offset) * Math.PI / 180;
    positions.push({
      x: brainCx + Math.cos(angle) * radius,
      y: brainCy + Math.sin(angle) * (radius * 0.55),
      side: 'right',
    });
  }

  return positions;
}

// ── Enhanced Mini Document Icon ──
function MiniDoc({ x, y, status, name, index }: {
  x: number; y: number; status: ProcessingStatus; name: string; index: number;
}) {
  const w = 60, h = 75;
  const dx = x - w / 2, dy = y - h / 2;
  const isActive = status === 'uploading' || status === 'confirming';
  const isDone = status === 'registered';
  const isFailed = status === 'upload_failed';
  const fileType = getFileType(name);
  const typeColor = getFileTypeColor(fileType);
  const typeLabel = getFileTypeLabel(fileType);
  const cornerSize = 14;

  return (
    <g>
      {/* Floating/bobbing animation when idle */}
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`0,0; 0,${isActive ? -3 : -2}; 0,0`}
        dur={`${2.5 + index * 0.3}s`}
        repeatCount="indefinite"
      />

      {/* Active glow */}
      {isActive && (
        <rect x={dx - 4} y={dy - 4} width={w + 8} height={h + 8} rx="8"
          fill={typeColor} opacity="0.12" filter="url(#docGlow)">
          <animate attributeName="opacity" values="0.08;0.18;0.08" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Shadow */}
      <rect x={dx + 3} y={dy + 3} width={w} height={h} rx="5" fill="black" opacity="0.08" />

      {/* Document body */}
      <rect x={dx} y={dy} width={w} height={h} rx="5"
        fill="hsl(var(--card))"
        stroke={isDone ? '#38A169' : isFailed ? 'hsl(var(--destructive))' : isActive ? typeColor : 'hsl(var(--border))'}
        strokeWidth={isActive ? 2 : isDone ? 1.5 : 1}
      />

      {/* Color header bar */}
      <rect x={dx} y={dy} width={w} height="14" rx="5" fill={typeColor} opacity={isDone ? 0.7 : isActive ? 0.85 : 0.4} />
      <rect x={dx} y={dy + 10} width={w} height="4" fill={typeColor} opacity={isDone ? 0.7 : isActive ? 0.85 : 0.4} />

      {/* Page curl */}
      <path d={`M${dx + w - cornerSize} ${dy + 14} L${dx + w} ${dy + 14} L${dx + w} ${dy + 14 + cornerSize}`}
        fill="hsl(var(--muted))" />
      <path d={`M${dx + w - cornerSize} ${dy + 14} L${dx + w} ${dy + 14 + cornerSize}`}
        fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />

      {/* Text lines */}
      <rect x={dx + 8} y={dy + 22} width={w * 0.55} height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.25" />
      <rect x={dx + 8} y={dy + 29} width={w * 0.75} height="2.5" rx="1.2" fill="hsl(var(--muted-foreground))" opacity="0.18" />
      <rect x={dx + 8} y={dy + 35} width={w * 0.6} height="2.5" rx="1.2" fill="hsl(var(--muted-foreground))" opacity="0.14" />
      <rect x={dx + 8} y={dy + 41} width={w * 0.7} height="2.5" rx="1.2" fill="hsl(var(--muted-foreground))" opacity="0.12" />
      <rect x={dx + 8} y={dy + 47} width={w * 0.45} height="2.5" rx="1.2" fill="hsl(var(--muted-foreground))" opacity="0.10" />

      {/* File type chip */}
      <rect x={dx + 6} y={dy + h - 20} width="28" height="13" rx="3" fill={typeColor} opacity="0.2" />
      <text x={dx + 20} y={dy + h - 11} textAnchor="middle" fontSize="7" fontWeight="bold" fill={typeColor} opacity="0.8">
        {typeLabel}
      </text>

      {/* Status badge */}
      {isDone && (
        <g>
          <circle cx={dx + w - 8} cy={dy + h - 10} r="8" fill="#38A169" opacity="0.95">
            <animate attributeName="r" values="6;9;8" dur="0.5s" repeatCount="1" />
          </circle>
          <path d={`M${dx + w - 12} ${dy + h - 10} L${dx + w - 9} ${dy + h - 7.5} L${dx + w - 4.5} ${dy + h - 13}`}
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {isFailed && (
        <g>
          <circle cx={dx + w - 8} cy={dy + h - 10} r="8" fill="hsl(var(--destructive))" opacity="0.95" />
          <path d={`M${dx + w - 11} ${dy + h - 13} L${dx + w - 5} ${dy + h - 7} M${dx + w - 5} ${dy + h - 13} L${dx + w - 11} ${dy + h - 7}`}
            fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      {isActive && (
        <g>
          <circle cx={dx + w - 8} cy={dy + h - 10} r="8" fill="hsl(var(--background))" stroke={typeColor} strokeWidth="1.5" />
          <circle cx={dx + w - 8} cy={dy + h - 10} r="5" fill="none" stroke={typeColor} strokeWidth="2" strokeDasharray="10 22" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${dx + w - 8} ${dy + h - 10}`} to={`360 ${dx + w - 8} ${dy + h - 10}`} dur="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* File name */}
      <text x={x} y={dy + h + 13} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" opacity="0.8" fontWeight="500">
        {name.length > 12 ? name.slice(0, 10) + '…' : name}
      </text>
    </g>
  );
}

// ── Brain segment paths (8 lobes for progressive illumination) ──
const CX = 300, CY = 150;
const BRAIN_SEGMENTS = [
  // Left hemisphere - 4 segments (top to bottom)
  `M${CX} ${CY - 55} C${CX - 10} ${CY - 57} ${CX - 25} ${CY - 55} ${CX - 35} ${CY - 45} C${CX - 42} ${CY - 38} ${CX - 48} ${CY - 30} ${CX - 50} ${CY - 20} L${CX - 25} ${CY - 25} L${CX} ${CY - 30} Z`,
  `M${CX - 50} ${CY - 20} C${CX - 52} ${CY - 10} ${CX - 52} ${CY} ${CX - 50} ${CY + 8} L${CX - 25} ${CY} L${CX - 25} ${CY - 25} Z`,
  `M${CX - 50} ${CY + 8} C${CX - 48} ${CY + 18} ${CX - 42} ${CY + 28} ${CX - 35} ${CY + 35} L${CX - 18} ${CY + 20} L${CX - 25} ${CY} Z`,
  `M${CX - 35} ${CY + 35} C${CX - 25} ${CY + 42} ${CX - 12} ${CY + 47} ${CX} ${CY + 48} L${CX} ${CY + 20} L${CX - 18} ${CY + 20} Z`,
  // Right hemisphere - 4 segments (top to bottom)
  `M${CX} ${CY - 55} C${CX + 10} ${CY - 57} ${CX + 25} ${CY - 55} ${CX + 35} ${CY - 45} C${CX + 42} ${CY - 38} ${CX + 48} ${CY - 30} ${CX + 50} ${CY - 20} L${CX + 25} ${CY - 25} L${CX} ${CY - 30} Z`,
  `M${CX + 50} ${CY - 20} C${CX + 52} ${CY - 10} ${CX + 52} ${CY} ${CX + 50} ${CY + 8} L${CX + 25} ${CY} L${CX + 25} ${CY - 25} Z`,
  `M${CX + 50} ${CY + 8} C${CX + 48} ${CY + 18} ${CX + 42} ${CY + 28} ${CX + 35} ${CY + 35} L${CX + 18} ${CY + 20} L${CX + 25} ${CY} Z`,
  `M${CX + 35} ${CY + 35} C${CX + 25} ${CY + 42} ${CX + 12} ${CY + 47} ${CX} ${CY + 48} L${CX} ${CY + 20} L${CX + 18} ${CY + 20} Z`,
];

// Neural network nodes inside brain
const NEURAL_NODES = [
  { cx: CX - 30, cy: CY - 25, segment: 0 },
  { cx: CX - 35, cy: CY - 5, segment: 1 },
  { cx: CX - 28, cy: CY + 15, segment: 2 },
  { cx: CX - 12, cy: CY + 30, segment: 3 },
  { cx: CX + 30, cy: CY - 25, segment: 4 },
  { cx: CX + 35, cy: CY - 5, segment: 5 },
  { cx: CX + 28, cy: CY + 15, segment: 6 },
  { cx: CX + 12, cy: CY + 30, segment: 7 },
  { cx: CX, cy: CY - 15, segment: -1 },
  { cx: CX, cy: CY + 5, segment: -1 },
  { cx: CX - 15, cy: CY, segment: -1 },
  { cx: CX + 15, cy: CY, segment: -1 },
];

const NEURAL_LINKS: [number, number][] = [
  [0, 8], [1, 10], [2, 10], [3, 9], [4, 8], [5, 11], [6, 11], [7, 9],
  [8, 9], [8, 10], [8, 11], [9, 10], [9, 11], [10, 11],
  [0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7],
];

/** Inline SVG brain with progressive illumination */
function BrainScene({ records, isProcessing, isDragOver }: {
  records: DocumentRecord[];
  isProcessing: boolean;
  isDragOver: boolean;
}) {
  const isActive = isDragOver || isProcessing || records.length > 0;
  const activeRecords = records.filter(r => r.processing_status !== 'cancelled');
  const fileCount = activeRecords.length;
  const litSegments = Math.min(fileCount, 8);
  const doneCount = activeRecords.filter(r => r.processing_status === 'registered').length;

  const docPositions = useMemo(() => getDocPositions(activeRecords.length), [activeRecords.length]);

  return (
    <svg viewBox="0 0 600 320" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Warm amber gradient for lit segments */}
        <radialGradient id="brainAmber" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F6E05E" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ED8936" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#C05621" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id="brainAmberSoft" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FEFCBF" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#F6AD55" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#DD6B20" stopOpacity="0.08" />
        </radialGradient>
        {/* Dim gradient for unlit segments */}
        <linearGradient id="brainDim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="brainStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
        </linearGradient>
        {/* Flow path gradient */}
        <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F6AD55" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ED8936" stopOpacity="0.3" />
        </linearGradient>
        {/* Particle gradient */}
        <radialGradient id="particleGrad">
          <stop offset="0%" stopColor="#FEFCBF" />
          <stop offset="100%" stopColor="#F6AD55" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="docGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ===== DYNAMIC DOCUMENTS + FLOW LINES ===== */}
      {activeRecords.map((record, i) => {
        if (i >= docPositions.length) return null;
        const pos = docPositions[i];
        const isRecordActive = record.processing_status === 'uploading' || record.processing_status === 'confirming';
        const isRecordDone = record.processing_status === 'registered';
        const endX = CX + (pos.side === 'left' ? -55 : 55);
        const ctrlX = (pos.x + CX) / 2;
        const ctrlY = pos.y * 0.6 + CY * 0.4;
        const pathD = `M${pos.x},${pos.y} Q${ctrlX},${ctrlY} ${endX},${CY}`;

        return (
          <g key={record.document_id}>
            {/* Glowing flow path */}
            {isRecordActive && (
              <path d={pathD} fill="none" stroke="url(#flowGrad)" strokeWidth="4" opacity="0.15" filter="url(#softGlow)" />
            )}
            <path
              d={pathD}
              fill="none"
              stroke={isRecordDone ? '#38A169' : isRecordActive ? '#F6AD55' : 'hsl(var(--muted-foreground))'}
              strokeWidth={isRecordActive ? 2.5 : 1.5}
              opacity={isRecordActive ? 0.6 : isRecordDone ? 0.5 : 0.2}
              strokeDasharray={isRecordActive ? "8,4" : isRecordDone ? "none" : "4,8"}
            >
              {isRecordActive && (
                <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />
              )}
            </path>

            {/* Arrowhead */}
            {(() => {
              const ax = CX + (pos.side === 'left' ? -50 : 50);
              const dir = pos.side === 'left' ? 1 : -1;
              return (
                <polygon
                  points={`${ax},${CY - 5} ${ax},${CY + 5} ${ax + dir * 10},${CY}`}
                  fill={isRecordDone ? '#38A169' : isRecordActive ? '#F6AD55' : 'hsl(var(--muted-foreground))'}
                  opacity={isRecordActive ? 0.7 : 0.25}
                />
              );
            })()}

            {/* Triple particle system */}
            {isRecordActive && [0, 1, 2].map(p => (
              <circle key={`p${p}`} r={3.5 - p * 0.5} fill="url(#particleGrad)" opacity={0.9 - p * 0.15} filter="url(#glow)">
                <animateMotion
                  dur={`${0.9 + p * 0.25}s`}
                  repeatCount="indefinite"
                  begin={`${p * 0.3}s`}
                  path={pathD}
                />
                <animate attributeName="r" values={`${2 - p * 0.3};${4.5 - p * 0.5};${2 - p * 0.3}`} dur="0.7s" repeatCount="indefinite" />
              </circle>
            ))}

            {/* Done burst */}
            {isRecordDone && (
              <g>
                <circle cx={endX} cy={CY} r="3" fill="#38A169" opacity="0.6">
                  <animate attributeName="r" values="3;12;0" dur="1.2s" repeatCount="1" fill="freeze" />
                  <animate attributeName="opacity" values="0.6;0.15;0" dur="1.2s" repeatCount="1" fill="freeze" />
                </circle>
                {[0, 60, 120, 180, 240, 300].map(angle => {
                  const rad = (angle * Math.PI) / 180;
                  return (
                    <circle key={angle} cx={endX} cy={CY} r="1.5" fill="#68D391" opacity="0">
                      <animate attributeName="cx" from={`${endX}`} to={`${endX + Math.cos(rad) * 18}`} dur="0.8s" fill="freeze" />
                      <animate attributeName="cy" from={`${CY}`} to={`${CY + Math.sin(rad) * 18}`} dur="0.8s" fill="freeze" />
                      <animate attributeName="opacity" values="0;0.8;0" dur="0.8s" fill="freeze" />
                    </circle>
                  );
                })}
              </g>
            )}

            {/* Mini document icon */}
            <MiniDoc x={pos.x} y={pos.y} status={record.processing_status} name={record.original_file_name} index={i} />
          </g>
        );
      })}

      {/* ===== DRAG-OVER floating particles ===== */}
      {isDragOver && activeRecords.length === 0 && (
        <g filter="url(#glow)">
          {[150, 210, 330, 30].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const startX = CX + Math.cos(rad) * 180;
            const startY = CY + Math.sin(rad) * 100;
            return (
              <circle key={`dp${i}`} r="5" fill="url(#particleGrad)" opacity="0.7">
                <animateMotion dur="1.2s" repeatCount="indefinite" begin={`${i * 0.25}s`}
                  path={`M${startX},${startY} L${CX},${CY}`} />
                <animate attributeName="r" values="3;6;3" dur="0.8s" repeatCount="indefinite" />
              </circle>
            );
          })}
        </g>
      )}

      {/* ===== CENTRAL BRAIN WITH PROGRESSIVE ILLUMINATION ===== */}
      <g>
        {/* Outer ambient glow when active */}
        {isActive && (
          <ellipse cx={CX} cy={CY} rx="65" ry="58" fill="#F6AD55" opacity="0.06" filter="url(#strongGlow)">
            <animate attributeName="opacity" values="0.03;0.09;0.03" dur="3s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Brain segments — progressive illumination */}
        {BRAIN_SEGMENTS.map((path, i) => {
          const isLit = i < litSegments;
          const isLatestLit = i === litSegments - 1 && litSegments > 0;
          return (
            <g key={`seg${i}`}>
              <path
                d={path}
                fill={isLit ? 'url(#brainAmber)' : 'url(#brainDim)'}
                stroke={isLit ? '#ED8936' : 'hsl(var(--muted-foreground))'}
                strokeWidth={isLit ? 1 : 0.5}
                strokeOpacity={isLit ? 0.6 : 0.2}
                opacity={isLit ? 0.85 : 0.3}
                className="transition-all duration-700"
              >
                {isLit && !isLatestLit && (
                  <animate attributeName="opacity" values="0.7;0.9;0.7" dur={`${2.5 + i * 0.2}s`} repeatCount="indefinite" />
                )}
                {isLatestLit && (
                  <animate attributeName="opacity" values="0.5;1;0.7;0.9;0.75" dur="1.5s" repeatCount="indefinite" />
                )}
              </path>
              {/* Glow overlay for lit segments */}
              {isLit && (
                <path d={path} fill="url(#brainAmberSoft)" filter="url(#softGlow)" opacity="0.4">
                  <animate attributeName="opacity" values="0.2;0.5;0.2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                </path>
              )}
            </g>
          );
        })}

        {/* Brain outline (drawn over segments) */}
        {/* Left hemisphere outline */}
        <path
          d={`M${CX} ${CY - 55} C${CX - 10} ${CY - 57} ${CX - 25} ${CY - 55} ${CX - 35} ${CY - 45} C${CX - 45} ${CY - 35} ${CX - 52} ${CY - 25} ${CX - 52} ${CY - 10} C${CX - 52} ${CY + 5} ${CX - 48} ${CY + 15} ${CX - 40} ${CY + 25} C${CX - 32} ${CY + 35} ${CX - 20} ${CY + 42} ${CX - 10} ${CY + 45} C${CX - 5} ${CY + 47} ${CX - 2} ${CY + 48} ${CX} ${CY + 48}`}
          fill="none" stroke={litSegments > 0 ? '#ED8936' : 'url(#brainStroke)'} strokeWidth="2" strokeLinejoin="round"
          opacity={litSegments > 0 ? 0.7 : 1}
        />
        {/* Right hemisphere outline */}
        <path
          d={`M${CX} ${CY - 55} C${CX + 10} ${CY - 57} ${CX + 25} ${CY - 55} ${CX + 35} ${CY - 45} C${CX + 45} ${CY - 35} ${CX + 52} ${CY - 25} ${CX + 52} ${CY - 10} C${CX + 52} ${CY + 5} ${CX + 48} ${CY + 15} ${CX + 40} ${CY + 25} C${CX + 32} ${CY + 35} ${CX + 20} ${CY + 42} ${CX + 10} ${CY + 45} C${CX + 5} ${CY + 47} ${CX + 2} ${CY + 48} ${CX} ${CY + 48}`}
          fill="none" stroke={litSegments > 0 ? '#ED8936' : 'url(#brainStroke)'} strokeWidth="2" strokeLinejoin="round"
          opacity={litSegments > 0 ? 0.7 : 1}
        />

        {/* Sulci (brain folds) */}
        {[
          `M${CX - 32} ${CY - 35} C${CX - 25} ${CY - 30} ${CX - 20} ${CY - 32} ${CX - 12} ${CY - 38}`,
          `M${CX - 42} ${CY - 15} C${CX - 32} ${CY - 20} ${CX - 22} ${CY - 18} ${CX - 10} ${CY - 22}`,
          `M${CX - 45} ${CY} C${CX - 35} ${CY - 2} ${CX - 22} ${CY + 2} ${CX - 5} ${CY - 5}`,
          `M${CX - 40} ${CY + 18} C${CX - 30} ${CY + 13} ${CX - 18} ${CY + 17} ${CX - 5} ${CY + 12}`,
          `M${CX + 32} ${CY - 35} C${CX + 25} ${CY - 30} ${CX + 20} ${CY - 32} ${CX + 12} ${CY - 38}`,
          `M${CX + 42} ${CY - 15} C${CX + 32} ${CY - 20} ${CX + 22} ${CY - 18} ${CX + 10} ${CY - 22}`,
          `M${CX + 45} ${CY} C${CX + 35} ${CY - 2} ${CX + 22} ${CY + 2} ${CX + 5} ${CY - 5}`,
          `M${CX + 40} ${CY + 18} C${CX + 30} ${CY + 13} ${CX + 18} ${CY + 17} ${CX + 5} ${CY + 12}`,
        ].map((d, i) => (
          <path key={`sulc${i}`} d={d} fill="none"
            stroke={litSegments > Math.floor(i / 2) ? '#DD6B20' : 'hsl(var(--primary))'}
            strokeWidth="1" opacity={litSegments > Math.floor(i / 2) ? 0.4 : 0.2} />
        ))}

        {/* Central dividing line */}
        <line x1={CX} y1={CY - 53} x2={CX} y2={CY + 46} stroke={litSegments > 0 ? '#ED8936' : 'hsl(var(--primary))'} strokeWidth="1.5" opacity="0.15" />

        {/* Brain stem */}
        <path
          d={`M${CX - 5} ${CY + 45} C${CX - 5} ${CY + 55} ${CX - 7} ${CY + 65} ${CX - 10} ${CY + 75} M${CX + 5} ${CY + 45} C${CX + 5} ${CY + 55} ${CX + 7} ${CY + 65} ${CX + 10} ${CY + 75}`}
          fill="none" stroke={litSegments > 0 ? '#ED8936' : 'url(#brainStroke)'} strokeWidth="1.5" opacity="0.35"
        />

        {/* ===== NEURAL NETWORK OVERLAY ===== */}
        {/* Links */}
        {NEURAL_LINKS.map(([a, b], i) => {
          const na = NEURAL_NODES[a], nb = NEURAL_NODES[b];
          const linkLit = (na.segment < litSegments || na.segment === -1) && (nb.segment < litSegments || nb.segment === -1) && litSegments > 0;
          return (
            <line key={`nl${i}`} x1={na.cx} y1={na.cy} x2={nb.cx} y2={nb.cy}
              stroke={linkLit ? '#F6E05E' : 'hsl(var(--muted-foreground))'} strokeWidth={linkLit ? 1.2 : 0.5}
              opacity={linkLit ? 0.35 : 0.08}
            >
              {linkLit && (
                <animate attributeName="opacity" values="0.2;0.45;0.2" dur={`${1.5 + (i % 4) * 0.3}s`} repeatCount="indefinite" />
              )}
            </line>
          );
        })}
        {/* Nodes */}
        {NEURAL_NODES.map((node, i) => {
          const nodeLit = (node.segment < litSegments || node.segment === -1) && litSegments > 0;
          return (
            <circle key={`nn${i}`} cx={node.cx} cy={node.cy} r={nodeLit ? 3 : 1.5}
              fill={nodeLit ? '#FEFCBF' : 'hsl(var(--muted-foreground))'}
              opacity={nodeLit ? 0.8 : 0.15}
              filter={nodeLit ? 'url(#glow)' : undefined}
            >
              {nodeLit && (
                <animate attributeName="r" values="2;3.5;2" dur={`${1.2 + (i % 3) * 0.4}s`} repeatCount="indefinite" />
              )}
            </circle>
          );
        })}

        {/* Processing pulse rings */}
        {isProcessing && [0, 1, 2].map(i => (
          <ellipse key={`pr${i}`} cx={CX} cy={CY} rx="55" ry="50" fill="none" stroke="#F6AD55" strokeWidth="1.5" opacity="0">
            <animate attributeName="rx" from="55" to="90" dur="2s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            <animate attributeName="ry" from="50" to="82" dur="2s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0" dur="2s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
          </ellipse>
        ))}

        {/* Center core */}
        <circle cx={CX} cy={CY} r="6" fill={litSegments > 0 ? '#FEFCBF' : 'hsl(var(--primary))'} opacity={litSegments > 0 ? 0.7 : 0.3} filter="url(#glow)">
          <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values={litSegments > 0 ? "0.5;0.9;0.5" : "0.2;0.4;0.2"} dur="2s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Upload hint at brain center (only when no files) */}
      {!isActive && (
        <g opacity="0.4">
          <circle cx={CX} cy={CY} r="15" fill="hsl(var(--background))" opacity="0.65" stroke="hsl(var(--primary))" strokeWidth="1" />
          <path d={`M${CX} ${CY - 6} L${CX} ${CY + 6} M${CX - 5} ${CY - 2} L${CX} ${CY - 7} L${CX + 5} ${CY - 2}`}
            stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}
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
        <div className="w-full max-w-lg">
          <BrainScene records={records} isProcessing={isProcessing} isDragOver={isDragOver} />
        </div>

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
