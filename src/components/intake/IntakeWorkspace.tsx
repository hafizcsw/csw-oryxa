/**
 * IntakeWorkspace — University operator view of incoming student applications.
 * Full canonical intake list with filter, sort, search, and application detail.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIntakeApi } from '@/hooks/useIntakeApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Inbox, CheckCircle2, XCircle, Clock, MessageCircle, Loader2, AlertTriangle, Search, ArrowUpDown, Eye } from 'lucide-react';
import { IntakeApplicationDetail } from './IntakeApplicationDetail';

interface IntakeWorkspaceProps {
  universityId: string;
}

const INTAKE_STATUSES = [
  'submitted', 'ready_for_review', 'info_requested', 'docs_received',
  'under_review', 'accepted', 'rejected', 'waitlisted', 'withdrawn', 'closed',
] as const;

const STATUS_ICONS: Record<string, typeof Clock> = {
  submitted: Clock,
  ready_for_review: Inbox,
  info_requested: MessageCircle,
  docs_received: Inbox,
  under_review: Loader2,
  accepted: CheckCircle2,
  rejected: XCircle,
  waitlisted: AlertTriangle,
  withdrawn: XCircle,
  closed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-muted text-muted-foreground',
  ready_for_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  info_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  docs_received: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  under_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  waitlisted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  withdrawn: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

interface IntakeApplication {
  id: string;
  user_id: string;
  program_id: string;
  university_id: string;
  overall_score: number;
  verdict: string;
  status: string;
  reviewer_notes: string | null;
  reviewer_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  file_quality_snapshot: Record<string, unknown>;
  applicant_name?: string | null;
  applicant_email?: string | null;
  programs?: { id: string; name_en: string; name_ar: string; degree_level: string } | null;
}

export function IntakeWorkspace({ universityId }: IntakeWorkspaceProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { listForUniversity } = useIntakeApi();
  const [applications, setApplications] = useState<IntakeApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'submitted_at' | 'reviewed_at'>('submitted_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const status = filterStatus === 'all' ? undefined : filterStatus;
      const result = await listForUniversity(universityId, status, {
        search: searchTerm || undefined,
        sortBy,
        sortOrder,
      });
      setApplications(result.applications);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [universityId, filterStatus, searchTerm, sortBy, sortOrder, listForUniversity]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const toggleSort = () => {
    if (sortBy === 'submitted_at' && sortOrder === 'desc') {
      setSortOrder('asc');
    } else if (sortBy === 'submitted_at' && sortOrder === 'asc') {
      setSortBy('reviewed_at');
      setSortOrder('desc');
    } else {
      setSortBy('submitted_at');
      setSortOrder('desc');
    }
  };

  if (selectedAppId) {
    return (
      <IntakeApplicationDetail
        applicationId={selectedAppId}
        universityId={universityId}
        onBack={() => {
          setSelectedAppId(null);
          fetchApplications();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('intake.workspace.title')}</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('intake.workspace.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-48"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('intake.workspace.all_statuses')}</SelectItem>
              {INTAKE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{t(`intake.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={toggleSort} className="gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === 'submitted_at' ? t('intake.workspace.submitted_at') : t('intake.workspace.reviewed_at')}
            {sortOrder === 'desc' ? ' ↓' : ' ↑'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t('intake.workspace.empty')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.applicant')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.program')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.score')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.status')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.submitted_at')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('intake.workspace.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {applications.map((app) => {
                const StatusIcon = STATUS_ICONS[app.status] || Clock;
                return (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedAppId(app.id)}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{app.applicant_name || app.applicant_email || app.user_id.slice(0, 8) + '…'}</span>
                      {app.applicant_email && app.applicant_name && (
                        <div className="text-xs text-muted-foreground">{app.applicant_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground text-sm">
                        {app.programs ? (language === 'ar' && app.programs.name_ar ? app.programs.name_ar : app.programs.name_en) : app.program_id.slice(0, 8) + '…'}
                      </span>
                      {app.programs?.degree_level && (
                        <div className="text-xs text-muted-foreground capitalize">{app.programs.degree_level}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${app.overall_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{app.overall_score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`gap-1 ${STATUS_COLORS[app.status] || ''}`}>
                        <StatusIcon className="h-3 w-3" />
                        {t(`intake.status.${app.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={(e) => { e.stopPropagation(); setSelectedAppId(app.id); }}>
                        <Eye className="h-3.5 w-3.5" />
                        {t('intake.workspace.view')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
