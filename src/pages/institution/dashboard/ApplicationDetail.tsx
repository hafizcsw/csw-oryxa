/**
 * Institution Dashboard - Application Detail
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, User, GraduationCap, FileText, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApplicationStatus } from '@/types/institution';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'under_review', 'more_docs_needed', 'conditional', 'accepted', 'rejected', 'closed'
];

export default function InstitutionApplicationDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Button>

      <h2 className="text-lg font-bold">{t('institution.applicationDetail.title')}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Student Summary */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('institution.applicationDetail.studentSummary')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('institution.applicationDetail.noData')}</p>
        </div>

        {/* Program Summary */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('institution.applicationDetail.programSummary')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('institution.applicationDetail.noData')}</p>
        </div>

        {/* Documents */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('institution.applicationDetail.documents')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('institution.applicationDetail.noData')}</p>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('institution.applicationDetail.timeline')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('institution.applicationDetail.noData')}</p>
        </div>
      </div>

      {/* Status Actions */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">{t('institution.applicationDetail.updateStatus')}</h3>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(status => (
            <Button key={status} variant="outline" size="sm" className="rounded-lg text-xs">
              {t(`institution.appStatus.${status}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Institution Notes */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('institution.applicationDetail.notes')}</h3>
        </div>
        <textarea
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
          placeholder={t('institution.applicationDetail.addNote')}
        />
        <Button size="sm" className="mt-2 rounded-lg">{t('common.save')}</Button>
      </div>
    </div>
  );
}
