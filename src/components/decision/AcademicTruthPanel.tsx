import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, GraduationCap, FlaskConical, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { AcademicTruth, SubjectRow, SubjectFamily } from '@/features/academic-truth/types';

interface AcademicTruthPanelProps {
  academicTruth: AcademicTruth;
}

const FAMILY_ICONS: Record<SubjectFamily, string> = {
  chemistry: '🧪', biology: '🧬', physics: '⚛️', mathematics: '📐',
  english: '📝', computer_science: '💻', economics: '📊',
  business: '💼', social_science: '🌍', other: '📚',
};

export function AcademicTruthPanel({ academicTruth }: AcademicTruthPanelProps) {
  const { t } = useLanguage();
  const at = academicTruth;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t('decision.academic_truth_title')}</h3>
          <p className="text-xs text-muted-foreground">{t('decision.academic_truth_subtitle')}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Academic Facts */}
        <div className="grid grid-cols-2 gap-4">
          <Fact label={t('decision.field.education_level')} value={at.last_education_level} />
          <Fact label={t('decision.field.credential')} value={at.credential_name} />
          <Fact label={t('decision.field.institution')} value={at.institution_name || at.awarding_institution} />
          <Fact label={t('decision.field.gpa')} value={at.gpa_raw ? `${at.gpa_raw}${at.grading_scale ? `/${at.grading_scale}` : ''}` : null} />
          <Fact label={t('decision.field.graduation_year')} value={at.graduation_year?.toString()} />
          <Fact label={t('decision.field.study_status')} value={at.study_status !== 'unknown' ? at.study_status : null} />
          <Fact label={t('decision.field.country_of_education')} value={at.country_of_education} />
          <Fact label={t('decision.field.credential_type')} value={at.credential_type} />
        </div>

        {/* Subject Rows */}
        {at.subject_rows.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('decision.subjects_discovered')} ({at.subject_rows.length})
            </h4>
            <div className="space-y-2">
              {at.subject_rows.map(row => (
                <SubjectRowCard key={row.row_id} row={row} />
              ))}
            </div>
          </div>
        )}

        {at.subject_rows.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {t('decision.no_subjects_yet')}
          </div>
        )}

        {/* Subject Families Summary */}
        {at.subject_families_present.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {at.subject_families_present.map(f => (
              <span key={f} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {FAMILY_ICONS[f]} {f.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground/50">—</span>}
      </p>
    </div>
  );
}

function SubjectRowCard({ row }: { row: SubjectRow }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
      <span className="text-lg">{FAMILY_ICONS[row.subject_family]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{row.subject_raw_name}</p>
        <p className="text-xs text-muted-foreground">{row.subject_family.replace('_', ' ')}</p>
      </div>
      {row.grade_raw && (
        <span className="text-sm font-mono font-medium text-foreground">{row.grade_raw}</span>
      )}
      {row.passed !== null && (
        row.passed ?
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> :
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      )}
      {row.confidence < 0.7 && (
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" title="Low confidence" />
      )}
    </div>
  );
}
