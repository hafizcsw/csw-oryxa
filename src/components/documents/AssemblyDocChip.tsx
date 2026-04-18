// ═══════════════════════════════════════════════════════════════
// AssemblyDocChip — small thumbnail+name chip pinned to a lane
// ═══════════════════════════════════════════════════════════════

import { FileText, FileImage, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssemblyDocChipProps {
  filename: string;
  previewUrl?: string | null;
  dropping?: boolean;
}

function iconFor(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx'].includes(ext)) return FileText;
  return FileIcon;
}

export function AssemblyDocChip({ filename, previewUrl, dropping }: AssemblyDocChipProps) {
  const Icon = iconFor(filename);
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-card shadow-sm text-xs max-w-[200px] transition-all duration-700',
        dropping ? 'translate-y-[-12px] opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="w-7 h-9 object-cover rounded-sm border border-border/50"
          loading="lazy"
        />
      ) : (
        <span className="w-7 h-9 grid place-items-center rounded-sm bg-muted border border-border/50">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </span>
      )}
      <span className="truncate text-foreground/80" title={filename}>
        {filename}
      </span>
    </div>
  );
}
