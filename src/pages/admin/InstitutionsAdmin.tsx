/**
 * Admin Institutions Hub
 * Lists institutions via CRM adapter — NOT direct portal table reads.
 * Click a row to open the institution's dashboard in admin mode.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listInstitutions, type CrmInstitutionSummary } from '@/services/institutionCrmAdapter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Building2, CheckCircle2, Clock, AlertTriangle, Ban,
  RefreshCw, ChevronRight, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', icon: AlertTriangle },
  more_info_requested: { label: 'More Info', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', icon: Ban },
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  high: 'text-red-600 dark:text-red-400',
  unknown: 'text-muted-foreground',
};

export default function InstitutionsAdmin() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<CrmInstitutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await listInstitutions({
      statusFilter,
      query,
      limit: 100,
    });
    setInstitutions(data);
    setLoading(false);
  }, [query, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Stats
  const pendingCount = institutions.filter(i => ['claim_submitted', 'under_review'].includes(i.accessState)).length;
  const approvedCount = institutions.filter(i => i.claimStatus === 'approved').length;
  const rejectedCount = institutions.filter(i => i.claimStatus === 'rejected').length;

  const handleOpenInstitution = (inst: CrmInstitutionSummary) => {
    navigate(`/admin/institutions/${inst.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Institutions Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage institution claims, verification, and access control
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={FileText} label="Total Claims" value={institutions.length} color="text-primary" />
        <SummaryCard icon={Clock} label="Pending Review" value={pendingCount} color="text-amber-600 dark:text-amber-400" />
        <SummaryCard icon={CheckCircle2} label="Approved" value={approvedCount} color="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard icon={Ban} label="Rejected" value={rejectedCount} color="text-red-600 dark:text-red-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or country..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'submitted', 'under_review', 'more_info_requested', 'approved', 'rejected', 'draft'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Institutions Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Institution</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Access</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Activity</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              )}
              {!loading && institutions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No institutions found</td>
                </tr>
              )}
              {institutions.map((inst) => {
                const statusCfg = STATUS_CONFIG[inst.claimStatus] || STATUS_CONFIG.draft;
                const StatusIcon = statusCfg.icon;
                return (
                  <tr
                    key={inst.id}
                    onClick={() => handleOpenInstitution(inst)}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground block">{inst.institutionName}</span>
                          <span className="text-xs text-muted-foreground">{inst.officialEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inst.city && `${inst.city}, `}{inst.country}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={cn('gap-1', statusCfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{inst.accessState}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium capitalize', RISK_COLORS[inst.riskLevel])}>
                        {inst.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inst.lastActivity
                        ? new Date(inst.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
