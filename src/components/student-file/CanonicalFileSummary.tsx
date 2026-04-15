// ═══════════════════════════════════════════════════════════════
// CanonicalFileSummary — First visible consumer of canonical truth
// ═══════════════════════════════════════════════════════════════
// Renders canonical student file blocks as a compact status strip.
// Read-only. No writeback. Door 1 scope only.
// ═══════════════════════════════════════════════════════════════

import { useLanguage } from '@/contexts/LanguageContext';
import { User, GraduationCap, Languages, Target } from 'lucide-react';
import type { CanonicalStudentFile, CompletionStatus } from '@/features/student-file/canonical-model';

interface Props {
  canonicalFile: CanonicalStudentFile;
  hasIdentity: boolean;
  hasAcademic: boolean;
  hasLanguage: boolean;
  hasTargeting: boolean;
}

function statusColor(status: CompletionStatus): string {
  switch (status) {
    case 'verified':  return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'complete':  return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'partial':   return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'incomplete':
    default:          return 'bg-muted text-muted-foreground border-border';
  }
}

function countFilled(obj: Record<string, unknown>): { filled: number; total: number } {
  const entries = Object.values(obj);
  const total = entries.length;
  const filled = entries.filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
  return { filled, total };
}

export function CanonicalFileSummary({ canonicalFile, hasIdentity, hasAcademic, hasLanguage, hasTargeting }: Props) {
  const { t } = useLanguage();

  const blocks = [
    {
      key: 'identity' as const,
      icon: User,
      label: t('portal.studyFile.identity'),
      has: hasIdentity,
      status: canonicalFile.file_status.identity_integrity_status,
      counts: countFilled(canonicalFile.identity),
    },
    {
      key: 'academic' as const,
      icon: GraduationCap,
      label: t('portal.studyFile.academic'),
      has: hasAcademic,
      status: canonicalFile.file_status.academic_truth_status,
      counts: countFilled(canonicalFile.academic),
    },
    {
      key: 'language' as const,
      icon: Languages,
      label: t('portal.studyFile.language'),
      has: hasLanguage,
      status: canonicalFile.file_status.language_readiness_status,
      counts: countFilled(canonicalFile.language),
    },
    {
      key: 'targeting' as const,
      icon: Target,
      label: t('portal.studyFile.targeting'),
      has: hasTargeting,
      status: canonicalFile.file_status.profile_completion_status,
      counts: countFilled(canonicalFile.targeting),
    },
  ];

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-2"
      data-canonical-consumer="file-summary"
    >
      {blocks.map(block => {
        const Icon = block.icon;
        const statusKey = `portal.studyFile.status_${block.status}` as const;
        return (
          <div
            key={block.key}
            className={`
              flex items-center gap-2 rounded-lg border px-3 py-2
              ${statusColor(block.status)}
              transition-colors
            `}
            data-canonical-block={block.key}
            data-canonical-status={block.status}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium truncate">{block.label}</div>
              <div className="text-[10px] opacity-70 font-mono">
                {block.counts.filled}/{block.counts.total}
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-wider opacity-60 shrink-0">
              {t(statusKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
