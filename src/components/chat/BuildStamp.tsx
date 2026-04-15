/**
 * BuildStamp - Displays build/deployment info for debugging
 * 
 * Shows: BUILD_ID, DEPLOY_TARGET, FUNCTIONS_BASE
 * Visible to both user and operator for environment verification
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { BUILD_ID, DEPLOY_TARGET, FUNCTIONS_BASE, UX_MODE } from '@/lib/program/validators';

interface BuildStampProps {
  variant?: 'compact' | 'expanded';
  className?: string;
}

export function BuildStamp({ variant = 'compact', className = '' }: BuildStampProps) {
  const [expanded, setExpanded] = useState(variant === 'expanded');
  
  // Short version for display
  const shortBuildId = BUILD_ID.slice(-8);
  
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors ${className}`}
        title="Show build info"
      >
        <Info className="w-3 h-3" />
        <span className="font-mono">{shortBuildId}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  }
  
  return (
    <div className={`text-[10px] bg-muted/30 rounded-md p-2 space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-muted-foreground">Build Info</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted-foreground/60 hover:text-muted-foreground"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
      
      <div className="space-y-0.5 font-mono">
        <div className="flex gap-2">
          <span className="text-muted-foreground/60">BUILD_ID:</span>
          <span className="text-foreground/80">{BUILD_ID}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground/60">UX_MODE:</span>
          <span className="text-foreground/80">{UX_MODE}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground/60">TARGET:</span>
          <span className="text-foreground/80">{DEPLOY_TARGET}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground/60">FUNCS:</span>
          <span className="text-foreground/80 break-all">{FUNCTIONS_BASE}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline BuildStamp for chat header
 */
export function InlineBuildStamp({ className = '' }: { className?: string }) {
  const shortBuildId = BUILD_ID.slice(-8);
  
  return (
    <span 
      className={`font-mono text-[9px] text-muted-foreground/40 ${className}`}
      title={`BUILD: ${BUILD_ID} | UX: ${UX_MODE} | TARGET: ${DEPLOY_TARGET} | FUNCS: ${FUNCTIONS_BASE}`}
    >
      v{shortBuildId}
    </span>
  );
}
