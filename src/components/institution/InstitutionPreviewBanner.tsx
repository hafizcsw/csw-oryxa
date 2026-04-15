/**
 * Preview Mode Banner
 * Persistent bar shown inside institution dashboard when admin is previewing
 */
import { useInstitutionPreview } from '@/contexts/InstitutionPreviewContext';
import { Building2, Eye, ArrowLeftRight, X, ChevronDown, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { InstitutionAccessState } from '@/types/institution';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

const STATE_CONFIG: Record<string, { label: string; dot: string }> = {
  verified: { label: 'Verified', dot: 'bg-emerald-500' },
  restricted: { label: 'Restricted', dot: 'bg-amber-500' },
  claim_submitted: { label: 'Pending', dot: 'bg-blue-500' },
  under_review: { label: 'Pending', dot: 'bg-blue-500' },
  suspended: { label: 'Locked', dot: 'bg-red-500' },
};

const SWITCHABLE_STATES: InstitutionAccessState[] = ['verified', 'restricted', 'claim_submitted', 'suspended'];

export function InstitutionPreviewBanner() {
  const { preview, isPreviewActive, updatePreviewState, switchInstitution, exitPreview } = useInstitutionPreview();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isPreviewActive) return null;

  const currentState = STATE_CONFIG[preview.accessState] || STATE_CONFIG.verified;

  const handleStateSwitch = (state: InstitutionAccessState) => {
    updatePreviewState(state);
    setShowDropdown(false);
    const routes: Record<string, string> = {
      verified: '/',
      restricted: '/',
      claim_submitted: '/institution/pending',
      under_review: '/institution/pending',
      suspended: '/institution/locked',
    };
    navigate(routes[state] || '/');
  };

  const handleExit = () => {
    exitPreview();
    navigate('/');
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-500 to-amber-400 text-amber-950 shadow-sm" dir="ltr">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {/* Left: Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tracking-wide uppercase">Super Admin Preview</span>
          </div>

          <div className="h-4 w-px bg-amber-700/30 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm font-semibold truncate">{preview.institutionName}</span>
          </div>

          <div className="h-4 w-px bg-amber-700/30 shrink-0" />

          {/* State Chip with dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-700/20 transition-colors text-xs font-semibold"
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', currentState.dot)} />
              {currentState.label}
              <ChevronDown className={cn('w-3 h-3 transition-transform', showDropdown && 'rotate-180')} />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-xl shadow-xl py-1.5 z-50 min-w-36 animate-in fade-in-0 zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Preview State
                </div>
                {SWITCHABLE_STATES.map(s => {
                  const cfg = STATE_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleStateSwitch(s)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/80 transition-colors text-foreground',
                        preview.accessState === s && 'font-bold text-primary bg-primary/5'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={switchInstitution}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold hover:bg-amber-600/30 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Switch
          </button>
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold hover:bg-amber-600/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
