/**
 * Institution Dashboard - Applications List
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ApplicationStatus } from '@/types/institution';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  under_review: 'institution.appStatus.underReview',
  more_docs_needed: 'institution.appStatus.moreDocs',
  conditional: 'institution.appStatus.conditional',
  accepted: 'institution.appStatus.accepted',
  rejected: 'institution.appStatus.rejected',
  closed: 'institution.appStatus.closed',
};

export default function InstitutionApplications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('institution.nav.applications')}</h2>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <Input
          placeholder={t('institution.applications.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl"
        />
        <Button variant="outline" className="gap-2 rounded-xl">
          <Filter className="w-4 h-4" />
          {t('common.filter')}
        </Button>
      </div>

      {/* Empty State */}
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('institution.applications.empty')}</p>
      </div>
    </div>
  );
}
