/**
 * ============================================================
 * CONSENT BANNER COMPONENT
 * ============================================================
 * 
 * Shows when CRM requires user consent before proceeding with search.
 * Part of the 3-phase workflow: Clarify → Consent → Start
 * 
 * DOOR 10: Consent Gate
 * - CRM sends phase="awaiting_consent" or consent_status="pending"
 * - Portal shows this banner with "Agree" button
 * - On click, Portal sends consent: { status: "granted" } + filters_hash
 */

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Shield, Loader2, HelpCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface ConsentBannerProps {
  filtersHash: string | null;
  missingFields?: string[];
  holdReason?: string | null;
  onConsent: (granted: boolean, filtersHash: string | null) => void;
  isLoading?: boolean;
}

export function ConsentBanner({
  filtersHash,
  missingFields = [],
  holdReason,
  onConsent,
  isLoading = false,
}: ConsentBannerProps) {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  
  // If there are missing fields, show clarify message instead
  if (missingFields.length > 0) {
    return (
      <Alert className="mx-4 mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              {t('portal.consent.missingFields')}: {missingFields.join(isRTL ? '، ' : ', ')}
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className={cn(
      "mx-4 mb-4 p-4 rounded-lg border",
      "bg-primary/5 border-primary/20",
      "dark:bg-primary/10 dark:border-primary/30"
    )}>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">
            {t('portal.consent.title')}
          </span>
        </div>
        
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {holdReason || t('portal.consent.description')}
        </p>
        
        {/* Action Buttons */}
        <div className={cn(
          "flex gap-2",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}>
          <Button
            onClick={() => onConsent(true, filtersHash)}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                {t('portal.consent.agree')}
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => onConsent(false, filtersHash)}
            disabled={isLoading}
            className="flex-1"
          >
            {t('portal.consent.modify')}
          </Button>
        </div>
        
        {/* Debug: Filter Hash (dev only) */}
        {import.meta.env.DEV && filtersHash && (
          <p className="text-xs text-muted-foreground font-mono">
            filters_hash: {filtersHash.slice(0, 16)}...
          </p>
        )}
      </div>
    </div>
  );
}
