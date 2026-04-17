// ═══════════════════════════════════════════════════════════════
// CentralUploadHub — Door 2: AI Brain Upload Zone
// ═══════════════════════════════════════════════════════════════
// Realistic top-down brain with progressive illumination
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DocumentRecord, ProcessingStatus } from '@/features/documents/document-registry-model';
import { AIDataFlowHero } from './AIDataFlowHero';

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

// ── Document positions: left side and right side ──
function getDocPositions(count: number): Array<{ x: number; y: number; side: 'left' | 'right' }> {
  if (count === 0) return [];
  const positions: Array<{ x: number; y: number; side: 'left' | 'right' }> = [];
  const leftSlots = Math.ceil(count / 2);
  const rightSlots = Math.floor(count / 2);

  // Left column
  for (let i = 0; i < leftSlots; i++) {
    const yStart = 60;
    const ySpacing = Math.min(70, 200 / Math.max(leftSlots, 1));
    positions.push({ x: 75, y: yStart + i * ySpacing, side: 'left' });
  }
  // Right column
  for (let i = 0; i < rightSlots; i++) {
    const yStart = 60;
    const ySpacing = Math.min(70, 200 / Math.max(rightSlots, 1));
    positions.push({ x: 525, y: yStart + i * ySpacing, side: 'right' });
  }
  return positions;
}

// ── Enhanced Mini Document ──
function MiniDoc({ x, y, status, name, index }: {
  x: number; y: number; status: ProcessingStatus; name: string; index: number;
}) {
  const w = 70, h = 85;
  const dx = x - w / 2, dy = y - h / 2;
  const isActive = status === 'uploading' || status === 'confirming';
  const isDone = status === 'registered';
  const isFailed = status === 'upload_failed';
  const fileType = getFileType(name);
  const typeColor = getFileTypeColor(fileType);
  const typeLabel = getFileTypeLabel(fileType);

  return (
    <g>
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`0,0; 0,${isActive ? -4 : -2}; 0,0`}
        dur={`${2.8 + index * 0.3}s`}
        repeatCount="indefinite"
      />

      {/* Shadow */}
      <rect x={dx + 3} y={dy + 4} width={w} height={h} rx="6" fill="black" opacity="0.1" />

      {/* Active glow pulse */}
      {isActive && (
        <rect x={dx - 5} y={dy - 5} width={w + 10} height={h + 10} rx="10"
          fill={typeColor} opacity="0.1" filter="url(#docGlow)">
          <animate attributeName="opacity" values="0.05;0.15;0.05" dur="1.4s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Doc body */}
      <rect x={dx} y={dy} width={w} height={h} rx="6"
        fill="hsl(var(--card))"
        stroke={isDone ? '#38A169' : isFailed ? 'hsl(var(--destructive))' : isActive ? typeColor : 'hsl(var(--border))'}
        strokeWidth={isActive ? 2 : 1}
      />

      {/* Dark header block */}
      <rect x={dx + 1} y={dy + 1} width={w - 2} height="18" rx="5" fill={typeColor}
        opacity={isDone ? 0.65 : isActive ? 0.85 : 0.35} />

      {/* Page fold corner */}
      <path d={`M${dx + w - 16} ${dy} L${dx + w} ${dy + 16}`}
        fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
      <path d={`M${dx + w - 16} ${dy} L${dx + w - 16} ${dy + 16} L${dx + w} ${dy + 16}`}
        fill="hsl(var(--muted))" opacity="0.5" />

      {/* Text line placeholders */}
      {[26, 34, 42, 50, 58].map((yOff, li) => (
        <rect key={li} x={dx + 9} y={dy + yOff} width={w * (0.75 - li * 0.06)} height="3"
          rx="1.5" fill="hsl(var(--muted-foreground))"
          opacity={0.22 - li * 0.025} />
      ))}

      {/* File type chip */}
      <rect x={dx + 7} y={dy + h - 22} width="30" height="14" rx="4" fill={typeColor} opacity="0.18" />
      <text x={dx + 22} y={dy + h - 12} textAnchor="middle" fontSize="8" fontWeight="700" fill={typeColor} opacity="0.75">
        {typeLabel}
      </text>

      {/* Status badges */}
      {isDone && (
        <g>
          <circle cx={dx + w - 10} cy={dy + h - 12} r="9" fill="#38A169" opacity="0.95">
            <animate attributeName="r" values="7;10;9" dur="0.5s" repeatCount="1" />
          </circle>
          <path d={`M${dx + w - 14} ${dy + h - 12} L${dx + w - 11} ${dy + h - 9} L${dx + w - 6} ${dy + h - 15}`}
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {isFailed && (
        <circle cx={dx + w - 10} cy={dy + h - 12} r="9" fill="hsl(var(--destructive))" opacity="0.9" />
      )}
      {isActive && (
        <g>
          <circle cx={dx + w - 10} cy={dy + h - 12} r="9" fill="hsl(var(--background))" stroke={typeColor} strokeWidth="1.5" />
          <circle cx={dx + w - 10} cy={dy + h - 12} r="5.5" fill="none" stroke={typeColor} strokeWidth="2"
            strokeDasharray="10 22" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate"
              from={`0 ${dx + w - 10} ${dy + h - 12}`} to={`360 ${dx + w - 10} ${dy + h - 12}`}
              dur="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* File name label */}
      <text x={x} y={dy + h + 14} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" opacity="0.7" fontWeight="500">
        {name.length > 12 ? name.slice(0, 10) + '…' : name}
      </text>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// Realistic Top-Down Brain SVG paths
// ═══════════════════════════════════════════════════════════════
const CX = 300, CY = 160;

// Left hemisphere outline
const LEFT_HEMI = `M${CX - 2} ${CY - 70} C${CX - 8} ${CY - 72} ${CX - 22} ${CY - 74} ${CX - 38} ${CY - 70} C${CX - 52} ${CY - 65} ${CX - 62} ${CY - 56} ${CX - 70} ${CY - 44} C${CX - 78} ${CY - 30} ${CX - 82} ${CY - 14} ${CX - 82} ${CY} C${CX - 82} ${CY + 16} ${CX - 78} ${CY + 30} ${CX - 70} ${CY + 42} C${CX - 60} ${CY + 56} ${CX - 46} ${CY + 66} ${CX - 30} ${CY + 72} C${CX - 18} ${CY + 76} ${CX - 8} ${CY + 78} ${CX - 2} ${CY + 78} Z`;

// Right hemisphere outline
const RIGHT_HEMI = `M${CX + 2} ${CY - 70} C${CX + 8} ${CY - 72} ${CX + 22} ${CY - 74} ${CX + 38} ${CY - 70} C${CX + 52} ${CY - 65} ${CX + 62} ${CY - 56} ${CX + 70} ${CY - 44} C${CX + 78} ${CY - 30} ${CX + 82} ${CY - 14} ${CX + 82} ${CY} C${CX + 82} ${CY + 16} ${CX + 78} ${CY + 30} ${CX + 70} ${CY + 42} C${CX + 60} ${CY + 56} ${CX + 46} ${CY + 66} ${CX + 30} ${CY + 72} C${CX + 18} ${CY + 76} ${CX + 8} ${CY + 78} ${CX + 2} ${CY + 78} Z`;

// Sulci (fold curves) - Left hemisphere
const LEFT_SULCI = [
  // Frontal lobe folds
  `M${CX - 15} ${CY - 60} C${CX - 28} ${CY - 55} ${CX - 45} ${CY - 50} ${CX - 60} ${CY - 42}`,
  `M${CX - 10} ${CY - 48} C${CX - 25} ${CY - 46} ${CX - 42} ${CY - 40} ${CX - 65} ${CY - 30}`,
  // Central sulcus
  `M${CX - 8} ${CY - 35} C${CX - 22} ${CY - 30} ${CX - 40} ${CY - 22} ${CX - 72} ${CY - 12}`,
  // Parietal folds
  `M${CX - 10} ${CY - 15} C${CX - 30} ${CY - 18} ${CX - 50} ${CY - 8} ${CX - 78} ${CY + 2}`,
  `M${CX - 8} ${CY + 5} C${CX - 25} ${CY + 2} ${CX - 48} ${CY + 8} ${CX - 75} ${CY + 18}`,
  // Temporal/occipital folds
  `M${CX - 10} ${CY + 22} C${CX - 28} ${CY + 20} ${CX - 48} ${CY + 26} ${CX - 68} ${CY + 35}`,
  `M${CX - 8} ${CY + 40} C${CX - 22} ${CY + 38} ${CX - 40} ${CY + 44} ${CX - 58} ${CY + 52}`,
  `M${CX - 6} ${CY + 56} C${CX - 18} ${CY + 55} ${CX - 32} ${CY + 60} ${CX - 42} ${CY + 65}`,
];

// Sulci - Right hemisphere (mirrored)
const RIGHT_SULCI = [
  `M${CX + 15} ${CY - 60} C${CX + 28} ${CY - 55} ${CX + 45} ${CY - 50} ${CX + 60} ${CY - 42}`,
  `M${CX + 10} ${CY - 48} C${CX + 25} ${CY - 46} ${CX + 42} ${CY - 40} ${CX + 65} ${CY - 30}`,
  `M${CX + 8} ${CY - 35} C${CX + 22} ${CY - 30} ${CX + 40} ${CY - 22} ${CX + 72} ${CY - 12}`,
  `M${CX + 10} ${CY - 15} C${CX + 30} ${CY - 18} ${CX + 50} ${CY - 8} ${CX + 78} ${CY + 2}`,
  `M${CX + 8} ${CY + 5} C${CX + 25} ${CY + 2} ${CX + 48} ${CY + 8} ${CX + 75} ${CY + 18}`,
  `M${CX + 10} ${CY + 22} C${CX + 28} ${CY + 20} ${CX + 48} ${CY + 26} ${CX + 68} ${CY + 35}`,
  `M${CX + 8} ${CY + 40} C${CX + 22} ${CY + 38} ${CX + 40} ${CY + 44} ${CX + 58} ${CY + 52}`,
  `M${CX + 6} ${CY + 56} C${CX + 18} ${CY + 55} ${CX + 32} ${CY + 60} ${CX + 42} ${CY + 65}`,
];

const ALL_SULCI = [...LEFT_SULCI, ...RIGHT_SULCI]; // 16 total

/** Inline SVG brain scene */
function BrainScene({ records, isProcessing, isDragOver }: {
  records: DocumentRecord[];
  isProcessing: boolean;
  isDragOver: boolean;
}) {
  const isActive = isDragOver || isProcessing || records.length > 0;
  const activeRecords = records.filter(r => r.processing_status !== 'cancelled');
  const fileCount = activeRecords.length;
  // Map file count to sulci illumination: 0 files = 0 lit, 8 files = all 16 lit
  const litSulci = Math.min(Math.ceil((fileCount / 8) * 16), 16);
  // Hemisphere fill opacity based on file count
  const hemiFill = Math.min(0.12 + (fileCount / 8) * 0.45, 0.55);

  const docPositions = useMemo(() => getDocPositions(activeRecords.length), [activeRecords.length]);

  return (
    <svg viewBox="0 0 600 340" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Brain fill gradient - soft purple/lavender */}
        <radialGradient id="brainFill" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id="brainGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
        </radialGradient>
        <radialGradient id="brainDimFill" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.02" />
        </radialGradient>
        {/* Flow line gradient */}
        <linearGradient id="flowGradL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="flowGradR" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="particleGrad">
          <stop offset="0%" stopColor="#EDE9FE" />
          <stop offset="100%" stopColor="#A78BFA" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="brainHaloFilter">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="docGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Arrowhead marker */}
        <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#A78BFA" opacity="0.6" />
        </marker>
        <marker id="arrowDim" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="hsl(var(--muted-foreground))" opacity="0.3" />
        </marker>
      </defs>

      {/* ===== DOCUMENTS + FLOW LINES ===== */}
      {activeRecords.map((record, i) => {
        if (i >= docPositions.length) return null;
        const pos = docPositions[i];
        const isRecordActive = record.processing_status === 'uploading' || record.processing_status === 'confirming';
        const isRecordDone = record.processing_status === 'registered';

        // Multiple flow lines from doc text sections to brain
        const brainEdgeX = pos.side === 'left' ? CX - 82 : CX + 82;
        const docEdgeX = pos.side === 'left' ? pos.x + 35 : pos.x - 35;
        const lineCount = 3;
        const lines = Array.from({ length: lineCount }, (_, li) => {
          const yOffset = (li - 1) * 14;
          const startY = pos.y + yOffset;
          const endY = CY + yOffset * 0.6;
          const midX = (docEdgeX + brainEdgeX) / 2;
          const curveY = (startY + endY) / 2;
          return {
            path: `M${docEdgeX},${startY} C${midX},${curveY - 5} ${midX},${curveY + 5} ${brainEdgeX},${endY}`,
            startY,
            endY,
          };
        });

        return (
          <g key={record.document_id}>
            {/* Flow lines */}
            {lines.map((line, li) => (
              <g key={`fl${li}`}>
                {/* Glow behind active lines */}
                {isRecordActive && (
                  <path d={line.path} fill="none" stroke="#A78BFA" strokeWidth="4" opacity="0.08" filter="url(#softGlow)" />
                )}
                <path
                  d={line.path}
                  fill="none"
                  stroke={isRecordDone ? '#38A169' : isRecordActive ? '#A78BFA' : 'hsl(var(--muted-foreground))'}
                  strokeWidth={isRecordActive ? 1.8 : 1}
                  opacity={isRecordActive ? 0.5 : isRecordDone ? 0.4 : 0.15}
                  strokeDasharray={isRecordActive ? "6,4" : "3,6"}
                  markerEnd={isRecordActive ? "url(#arrowPurple)" : "url(#arrowDim)"}
                >
                  {isRecordActive && (
                    <animate attributeName="stroke-dashoffset" from="20" to="0" dur={`${0.7 + li * 0.15}s`} repeatCount="indefinite" />
                  )}
                </path>

                {/* Data block rectangles flowing along path */}
                {isRecordActive && (
                  <rect width="8" height="5" rx="1" fill="#8B5CF6" opacity="0.6">
                    <animateMotion dur={`${1.0 + li * 0.2}s`} repeatCount="indefinite" begin={`${li * 0.3}s`} path={line.path} rotate="auto" />
                    <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.6s" repeatCount="indefinite" />
                  </rect>
                )}
              </g>
            ))}

            {/* Triple particles */}
            {isRecordActive && [0, 1, 2].map(p => (
              <circle key={`p${p}`} r={3 - p * 0.4} fill="url(#particleGrad)" opacity={0.8 - p * 0.15} filter="url(#glow)">
                <animateMotion
                  dur={`${0.85 + p * 0.2}s`}
                  repeatCount="indefinite"
                  begin={`${p * 0.28}s`}
                  path={lines[1].path}
                />
              </circle>
            ))}

            {/* Done burst */}
            {isRecordDone && (
              <g>
                <circle cx={brainEdgeX} cy={CY} r="3" fill="#38A169" opacity="0.5">
                  <animate attributeName="r" values="3;15;0" dur="1.2s" repeatCount="1" fill="freeze" />
                  <animate attributeName="opacity" values="0.5;0.1;0" dur="1.2s" repeatCount="1" fill="freeze" />
                </circle>
              </g>
            )}

            {/* Document icon */}
            <MiniDoc x={pos.x} y={pos.y} status={record.processing_status} name={record.original_file_name} index={i} />
          </g>
        );
      })}

      {/* Drag-over floating particles */}
      {isDragOver && activeRecords.length === 0 && (
        <g filter="url(#glow)">
          {[0, 1, 2, 3].map(i => {
            const angle = [150, 210, 330, 30][i];
            const rad = (angle * Math.PI) / 180;
            const startX = CX + Math.cos(rad) * 180;
            const startY = CY + Math.sin(rad) * 100;
            return (
              <circle key={`dp${i}`} r="5" fill="url(#particleGrad)" opacity="0.7">
                <animateMotion dur="1.2s" repeatCount="indefinite" begin={`${i * 0.25}s`}
                  path={`M${startX},${startY} L${CX},${CY}`} />
              </circle>
            );
          })}
        </g>
      )}

      {/* ===== CENTRAL BRAIN ===== */}
      <g>
        {/* Outer halo glow */}
        {isActive && (
          <ellipse cx={CX} cy={CY} rx="100" ry="95" fill="#8B5CF6" opacity="0.04" filter="url(#brainHaloFilter)">
            <animate attributeName="opacity" values="0.02;0.07;0.02" dur="3s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Left hemisphere fill */}
        <path d={LEFT_HEMI}
          fill={fileCount > 0 ? 'url(#brainFill)' : 'url(#brainDimFill)'}
          opacity={fileCount > 0 ? hemiFill : 0.25}
          className="transition-all duration-700"
        >
          {fileCount > 0 && (
            <animate attributeName="opacity" values={`${hemiFill * 0.85};${hemiFill};${hemiFill * 0.85}`}
              dur="3s" repeatCount="indefinite" />
          )}
        </path>

        {/* Right hemisphere fill */}
        <path d={RIGHT_HEMI}
          fill={fileCount > 0 ? 'url(#brainFill)' : 'url(#brainDimFill)'}
          opacity={fileCount > 0 ? hemiFill : 0.25}
          className="transition-all duration-700"
        >
          {fileCount > 0 && (
            <animate attributeName="opacity" values={`${hemiFill * 0.85};${hemiFill};${hemiFill * 0.85}`}
              dur="3.2s" repeatCount="indefinite" />
          )}
        </path>

        {/* Glow overlay on hemispheres when active */}
        {fileCount > 0 && (
          <>
            <path d={LEFT_HEMI} fill="url(#brainGlow)" filter="url(#softGlow)" opacity={hemiFill * 0.5}>
              <animate attributeName="opacity" values={`${hemiFill * 0.3};${hemiFill * 0.6};${hemiFill * 0.3}`} dur="2.5s" repeatCount="indefinite" />
            </path>
            <path d={RIGHT_HEMI} fill="url(#brainGlow)" filter="url(#softGlow)" opacity={hemiFill * 0.5}>
              <animate attributeName="opacity" values={`${hemiFill * 0.3};${hemiFill * 0.6};${hemiFill * 0.3}`} dur="2.7s" repeatCount="indefinite" />
            </path>
          </>
        )}

        {/* Hemisphere outlines */}
        <path d={LEFT_HEMI} fill="none"
          stroke={fileCount > 0 ? '#A78BFA' : 'hsl(var(--muted-foreground))'}
          strokeWidth={fileCount > 0 ? 2 : 1.5}
          opacity={fileCount > 0 ? 0.7 : 0.3}
          strokeLinejoin="round"
        />
        <path d={RIGHT_HEMI} fill="none"
          stroke={fileCount > 0 ? '#A78BFA' : 'hsl(var(--muted-foreground))'}
          strokeWidth={fileCount > 0 ? 2 : 1.5}
          opacity={fileCount > 0 ? 0.7 : 0.3}
          strokeLinejoin="round"
        />

        {/* Sulci (brain folds) — progressive illumination */}
        {ALL_SULCI.map((d, i) => {
          const isLit = i < litSulci;
          const isNewest = i === litSulci - 1 && litSulci > 0;
          return (
            <path key={`sulc${i}`} d={d} fill="none"
              stroke={isLit ? '#8B5CF6' : 'hsl(var(--muted-foreground))'}
              strokeWidth={isLit ? 1.5 : 0.8}
              opacity={isLit ? 0.55 : 0.12}
              strokeLinecap="round"
              className="transition-all duration-500"
            >
              {isLit && !isNewest && (
                <animate attributeName="opacity" values="0.35;0.6;0.35" dur={`${2.2 + (i % 4) * 0.3}s`} repeatCount="indefinite" />
              )}
              {isNewest && (
                <animate attributeName="opacity" values="0.3;0.8;0.5;0.7;0.4" dur="1.2s" repeatCount="indefinite" />
              )}
              {isLit && (
                <animate attributeName="stroke-width" values="1.2;2;1.2" dur={`${2 + (i % 3) * 0.4}s`} repeatCount="indefinite" />
              )}
            </path>
          );
        })}

        {/* Central longitudinal fissure */}
        <line x1={CX} y1={CY - 68} x2={CX} y2={CY + 76}
          stroke={fileCount > 0 ? '#7C3AED' : 'hsl(var(--muted-foreground))'}
          strokeWidth="2" opacity={fileCount > 0 ? 0.25 : 0.1} />

        {/* Brain stem hint */}
        <path d={`M${CX - 8} ${CY + 76} C${CX - 8} ${CY + 85} ${CX - 6} ${CY + 94} ${CX} ${CY + 100} C${CX + 6} ${CY + 94} ${CX + 8} ${CY + 85} ${CX + 8} ${CY + 76}`}
          fill={fileCount > 0 ? 'url(#brainFill)' : 'url(#brainDimFill)'}
          opacity={fileCount > 0 ? hemiFill * 0.7 : 0.15}
          stroke={fileCount > 0 ? '#A78BFA' : 'hsl(var(--muted-foreground))'}
          strokeWidth="1.2" strokeOpacity={fileCount > 0 ? 0.5 : 0.2}
        />

        {/* Sparkle particles around lit areas */}
        {fileCount > 0 && [0, 1, 2, 3, 4].map(i => {
          const angle = (i * 72 + 15) * Math.PI / 180;
          const r = 65 + (i % 2) * 15;
          const sx = CX + Math.cos(angle) * r;
          const sy = CY + Math.sin(angle) * r * 0.9;
          return (
            <circle key={`sp${i}`} cx={sx} cy={sy} r="1.5" fill="#C4B5FD" opacity="0" filter="url(#glow)">
              <animate attributeName="opacity" values="0;0.7;0" dur={`${1.5 + i * 0.4}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
              <animate attributeName="r" values="1;3;1" dur={`${1.5 + i * 0.4}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Processing pulse rings */}
        {isProcessing && [0, 1, 2].map(i => (
          <ellipse key={`pr${i}`} cx={CX} cy={CY} rx="80" ry="76" fill="none" stroke="#A78BFA" strokeWidth="1.5" opacity="0">
            <animate attributeName="rx" from="80" to="120" dur="2s" begin={`${i * 0.65}s`} repeatCount="indefinite" />
            <animate attributeName="ry" from="76" to="115" dur="2s" begin={`${i * 0.65}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0" dur="2s" begin={`${i * 0.65}s`} repeatCount="indefinite" />
          </ellipse>
        ))}

        {/* Center core glow */}
        <circle cx={CX} cy={CY} r="5" fill={fileCount > 0 ? '#DDD6FE' : 'hsl(var(--muted-foreground))'} opacity={fileCount > 0 ? 0.6 : 0.15} filter="url(#glow)">
          <animate attributeName="r" values="3;7;3" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values={fileCount > 0 ? "0.4;0.8;0.4" : "0.1;0.2;0.1"} dur="2.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Upload hint (no files) */}
      {!isActive && (
        <g opacity="0.35">
          <circle cx={CX} cy={CY} r="18" fill="hsl(var(--background))" opacity="0.6" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
          <path d={`M${CX} ${CY - 7} L${CX} ${CY + 7} M${CX - 5} ${CY - 2} L${CX} ${CY - 8} L${CX + 5} ${CY - 2}`}
            stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
          'relative flex flex-col items-center justify-center cursor-pointer transition-all group p-4',
          isDragOver && 'bg-primary/5 rounded-2xl',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div
          className={cn(
            'mx-auto transition-all duration-500 ease-out',
            records.length > 0 || isDragOver || isProcessing
              ? 'w-full max-w-3xl'
              : 'w-40 sm:w-48',
          )}
        >
          <AIDataFlowHero
            intensity={isProcessing ? 'lively' : 'normal'}
            ariaLabel={t('portal.uploadHub.title')}
            fileCount={records.length}
            hasFiles={records.length > 0}
            isDragOver={isDragOver}
            isProcessing={isProcessing}
          />
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

    </div>
  );
}
