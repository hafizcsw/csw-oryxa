/**
 * QualificationGateGuard — wraps application/submit buttons and blocks if gate is closed.
 * When blocked, shows reasons and routes to CSW improvement path.
 * NOTE: This guard is for APPLICATION SUBMISSION only, not for inquiry/contact.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { GateCheckResult } from '@/hooks/useQualificationGates';

interface QualificationGateGuardProps {
  gate: GateCheckResult;
  children: React.ReactElement;
  /** If true, renders children directly when gate is open (no wrapper) */
  passthrough?: boolean;
}

export function QualificationGateGuard({
  gate,
  children,
  passthrough = true,
}: QualificationGateGuardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (gate.allowed && passthrough) {
    return children;
  }

  if (gate.allowed) {
    return children;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative inline-flex w-full">
          <div className="w-full opacity-60 pointer-events-none">
            {children}
          </div>
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
            aria-label={t('file_quality.gates.blocked_label')}
          >
            <Lock className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-3" align="center">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span>{t('file_quality.gates.submission_blocked')}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('file_quality.gates.submission_blocked_hint')}
        </p>
        <ul className="space-y-1">
          {gate.reasons.map((reason) => (
            <li key={reason} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-destructive mt-0.5">•</span>
              <span>{t(reason)}</span>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            setOpen(false);
            navigate('/account?tab=profile');
          }}
        >
          <ArrowRight className="h-3 w-3 me-1" />
          {t('file_quality.gates.improve_profile')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
