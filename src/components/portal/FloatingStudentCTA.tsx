/**
 * FloatingStudentCTA - Smart floating action button
 * Shows priority action based on CRM snapshot state
 * 
 * Priority:
 * 1. Rejected/needs_fix docs (destructive)
 * 2. Pending payments (secondary)
 * 3. Profile incomplete (default)
 * 4. High priority next actions
 * 5. Guest → auth
 */

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileWarning, 
  CreditCard, 
  User, 
  AlertCircle, 
  LogIn,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudentSnapshot } from '@/hooks/useStudentSnapshot';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
interface FloatingStudentCTAProps {
  className?: string;
}

type CTAType = 'rejected_docs' | 'pending_payment' | 'profile_incomplete' | 'high_priority_action' | 'guest' | null;

interface CTAConfig {
  type: CTAType;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  variant: 'destructive' | 'default' | 'secondary' | 'outline';
  onClick: () => void;
}

export function FloatingStudentCTA({ className }: FloatingStudentCTAProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { openAuthModal, sessionType, studentPortalToken } = useMalakChat();
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  
  // Check for Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSupabaseSession(!!session);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setHasSupabaseSession(!!session);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  const { 
    snapshot, 
    loading,
    rejectedDocs, 
    hasPendingPayments, 
    pendingPaymentsTotal, 
    paymentsCurrency,
    highPriorityActions, 
    isProfileConfirmed 
  } = useStudentSnapshot({
    enabled: !!studentPortalToken
  });
  
  // Determine CTA based on priority
  const ctaConfig = useMemo((): CTAConfig | null => {
    // ✅ If user has Supabase session, they're fully logged in - don't show guest CTA
    const isAuthenticated = hasSupabaseSession || !!studentPortalToken;
    
    // Guest → CTA to auth (only if NOT authenticated)
    if (!isAuthenticated && (sessionType === 'guest' || !studentPortalToken)) {
      return {
        type: 'guest',
        label: t('cta.createFreeAccount'),
        sublabel: t('cta.saveProgress'),
        icon: LogIn,
        variant: 'default',
        onClick: () => openAuthModal()
      };
    }
    
    // Priority 1: Rejected/needs_fix docs
    if (rejectedDocs.length > 0) {
      const count = rejectedDocs.length;
      return {
        type: 'rejected_docs',
        label: t('cta.docsNeedFix').replace('{count}', String(count)),
        sublabel: t('cta.clickToView'),
        icon: FileWarning,
        variant: 'destructive',
        onClick: () => navigate('/account?tab=documents')
      };
    }
    
    // Priority 2: Pending payments (using correct data structure)
    if (hasPendingPayments) {
      return {
        type: 'pending_payment',
        label: t('cta.paymentDue'),
        sublabel: `${pendingPaymentsTotal.toLocaleString()} ${paymentsCurrency}`,
        icon: CreditCard,
        variant: 'secondary',
        onClick: () => navigate('/account?tab=payments')
      };
    }
    
    // Priority 3: Profile not confirmed
    if (!isProfileConfirmed && snapshot) {
      return {
        type: 'profile_incomplete',
        label: t('cta.completeProfile'),
        sublabel: t('cta.speedUpProcessing'),
        icon: User,
        variant: 'default',
        onClick: () => navigate('/account?tab=profile')
      };
    }
    
    // Priority 4: High priority next actions
    if (highPriorityActions.length > 0) {
      const action = highPriorityActions[0];
      return {
        type: 'high_priority_action',
        label: action.label,
        icon: AlertCircle,
        variant: 'default',
        onClick: () => {
          if (action.target_tab) {
            navigate(`/account?tab=${action.target_tab}`);
          }
        }
      };
    }
    
    // No CTA needed
    return null;
  }, [
    sessionType, 
    studentPortalToken, 
    hasSupabaseSession,
    rejectedDocs, 
    hasPendingPayments, 
    pendingPaymentsTotal, 
    paymentsCurrency,
    isProfileConfirmed, 
    highPriorityActions, 
    snapshot,
    navigate, 
    openAuthModal,
    t
  ]);
  
  // ✅ Early returns AFTER all hooks (React rules)
  if (loading && studentPortalToken) return null;
  if (!ctaConfig) return null;
  
  const Icon = ctaConfig.icon;
  const isRTL = language === 'ar';
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;
  
  return (
    <div 
      id="floating-student-cta"
      data-floating-cta="true"
      data-tour-id="floating-cta"
      className={cn(
        "fixed bottom-[88px] sm:bottom-24 z-40 animate-in slide-in-from-bottom-4 duration-500",
        isRTL ? "right-20 sm:right-24" : "left-3 sm:left-4",
        className
      )}
    >
      <Button
        variant={ctaConfig.variant}
        size="lg"
        onClick={ctaConfig.onClick}
        className={cn(
          "h-auto py-2 px-3 sm:py-3 sm:px-4 flex items-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all",
          "rounded-full",
          ctaConfig.variant === 'destructive' && "animate-pulse"
        )}
      >
        <div className="p-1.5 sm:p-2 rounded-full bg-background/20">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className={isRTL ? "text-right" : "text-left"}>
          <div className="font-semibold text-xs sm:text-sm">{ctaConfig.label}</div>
          {ctaConfig.sublabel && (
            <div className="text-[10px] sm:text-xs opacity-80">{ctaConfig.sublabel}</div>
          )}
        </div>
        <ChevronIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-60" />
      </Button>
    </div>
  );
}