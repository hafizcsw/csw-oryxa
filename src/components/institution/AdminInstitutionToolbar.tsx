/**
 * Admin Institution Toolbar
 * Shown above the institution dashboard when in super-admin mode.
 * 
 * Clearly separates:
 * - Real access state (from CRM, read-only badge)
 * - Preview state (local UI switching for testing views)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Shield, CheckCircle2, Clock, AlertTriangle, Ban,
  Lock, Eye, ChevronDown,
  MessageSquare, Activity, FileWarning, Globe
} from 'lucide-react';
import type { InstitutionAccessState, ClaimStatus } from '@/types/institution';

interface AdminInstitutionToolbarProps {
  institutionId: string;
  institutionName: string;
  /** The real persisted access state from CRM */
  realAccessState: InstitutionAccessState;
  /** The local preview state for UI switching */
  previewAccessState: InstitutionAccessState;
  claimStatus?: ClaimStatus;
  /** Preview-only: switches local UI state, NOT persisted */
  onPreviewStateChange?: (state: InstitutionAccessState) => void;
}

const ACCESS_STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  no_institution_link: { label: 'No Link', color: 'bg-muted text-muted-foreground', icon: Clock },
  claim_draft: { label: 'Claim Draft', color: 'bg-muted text-muted-foreground', icon: Clock },
  claim_submitted: { label: 'Claim Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', icon: AlertTriangle },
  more_info_requested: { label: 'More Info Needed', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', icon: AlertTriangle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', icon: Ban },
  verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  restricted: { label: 'Restricted', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', icon: Lock },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', icon: Ban },
};

const PREVIEW_STATES: InstitutionAccessState[] = ['verified', 'restricted', 'claim_submitted', 'suspended'];

export function AdminInstitutionToolbar({
  institutionId,
  institutionName,
  realAccessState,
  previewAccessState,
  claimStatus,
  onPreviewStateChange,
}: AdminInstitutionToolbarProps) {
  const navigate = useNavigate();
  const [showPreviewDropdown, setShowPreviewDropdown] = useState(false);

  const realCfg = ACCESS_STATE_CONFIG[realAccessState] || ACCESS_STATE_CONFIG.verified;
  const RealIcon = realCfg.icon;

  const previewCfg = ACCESS_STATE_CONFIG[previewAccessState] || ACCESS_STATE_CONFIG.verified;
  const isPreviewDifferent = previewAccessState !== realAccessState;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800" dir="ltr">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/institutions')}
              className="h-8 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Hub
            </Button>
            <div className="h-5 w-px bg-amber-300 dark:bg-amber-700" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                Admin View — {institutionName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Real Access State (read-only) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">Real:</span>
              <Badge variant="secondary" className={cn('gap-1', realCfg.color)}>
                <RealIcon className="w-3 h-3" />
                {realCfg.label}
              </Badge>
            </div>

            {/* Preview State Switcher (clearly labeled) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">Preview:</span>
              <div className="relative">
                <button
                  onClick={() => setShowPreviewDropdown(!showPreviewDropdown)}
                  className="inline-flex items-center gap-1"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 cursor-pointer border-dashed',
                      isPreviewDifferent && 'border-amber-500 bg-amber-100/50 dark:bg-amber-900/30'
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    {previewCfg.label}
                    <ChevronDown className="w-3 h-3" />
                  </Badge>
                </button>
                {showPreviewDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-background border border-border rounded-lg shadow-lg py-1 z-50 min-w-44">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
                      Preview State (UI only)
                    </div>
                    {PREVIEW_STATES.map(s => {
                      const cfg = ACCESS_STATE_CONFIG[s];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            onPreviewStateChange?.(s);
                            setShowPreviewDropdown(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-foreground',
                            previewAccessState === s && 'font-bold text-primary'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                          {s === realAccessState && (
                            <span className="ml-auto text-[10px] text-muted-foreground">(real)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="h-5 w-px bg-amber-300 dark:bg-amber-700" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <MessageSquare className="w-3 h-3" />
              Notes
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Activity className="w-3 h-3" />
              Audit
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <FileWarning className="w-3 h-3" />
              Changes
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Globe className="w-3 h-3" />
              Public Page
            </Button>
          </div>
        </div>

        {/* Bottom Row: Summary */}
        <div className="flex items-center gap-4 mt-2 text-xs text-amber-700 dark:text-amber-400">
          <span>ID: {institutionId.slice(0, 8)}…</span>
          {claimStatus && <span>Claim: {claimStatus}</span>}
          {isPreviewDifferent && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-300 font-medium">
              <Eye className="w-3 h-3" />
              Viewing as: {previewCfg.label} (preview only)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
