import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStudentApplications, StudentApplication, ApplicationService } from "@/hooks/useStudentApplications";
import { useDraftApplications, DraftApplication } from "@/hooks/useDraftApplications";
import { useSubmissionCache } from "@/hooks/useSubmissionCache";
import { useStudentPayments, StudentPayment } from "@/hooks/useStudentPayments";
import { Heart, Send, CheckCircle2, XCircle, Clock, Loader2, MapPin, CreditCard, Package, FileText, Pencil, Trash2, RefreshCw, Upload, Eye, Receipt, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { StudentPortalProfile } from "@/hooks/useStudentProfile";
import { TabNavigation } from "./TabNavigation";
import { PaymentProofModal } from "@/components/portal/PaymentProofModal";
import { PaymentEvidenceModal } from "@/components/portal/payments/PaymentEvidenceModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { StudentApplicationsPanel } from "@/components/intake/StudentApplicationsPanel";

// Status badge component - uses translations
function StatusBadge({
  status,
  t
}: {
  status: StudentApplication['status'];
  t: (key: string) => string;
}) {
  const config = {
    shortlisted: {
      labelKey: 'portal.applications.status.shortlisted',
      icon: Heart,
      className: 'bg-primary/10 text-primary'
    },
    submitted: {
      labelKey: 'portal.applications.status.submitted',
      icon: Send,
      className: 'bg-info/10 text-info'
    },
    under_review: {
      labelKey: 'portal.applications.status.underReview',
      icon: Clock,
      className: 'bg-warning/10 text-warning'
    },
    accepted: {
      labelKey: 'portal.applications.status.accepted',
      icon: CheckCircle2,
      className: 'bg-success/10 text-success'
    },
    rejected: {
      labelKey: 'portal.applications.status.rejected',
      icon: XCircle,
      className: 'bg-destructive/10 text-destructive'
    },
    withdrawn: {
      labelKey: 'portal.applications.status.withdrawn',
      icon: XCircle,
      className: 'bg-muted text-muted-foreground'
    },
    pending_payment: {
      labelKey: 'portal.applications.status.pendingPayment',
      icon: CreditCard,
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
    in_review: {
      labelKey: 'portal.applications.status.inReview',
      icon: Clock,
      className: 'bg-info/10 text-info'
    },
    active: {
      labelKey: 'portal.applications.status.active',
      icon: CheckCircle2,
      className: 'bg-success/10 text-success'
    }
  };
  const {
    labelKey,
    icon: Icon,
    className
  } = config[status] || config.shortlisted;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>;
}

// Payment status badge
function PaymentStatusBadge({
  status,
  t
}: {
  status?: StudentApplication['payment_status'];
  t: (key: string) => string;
}) {
  if (!status) return null;
  const config = {
    requested: {
      labelKey: 'portal.applications.paymentStatuses.requested',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
    proof_received: {
      labelKey: 'portal.applications.paymentStatuses.proofReceived',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    proof_rejected: {
      labelKey: 'portal.applications.paymentStatuses.proofRejected',
      className: 'bg-red-500/10 text-red-600 dark:text-red-400'
    },
    fully_paid: {
      labelKey: 'portal.applications.paymentStatuses.fullyPaid',
      className: 'bg-green-500/10 text-green-600 dark:text-green-400'
    }
  };
  const {
    labelKey,
    className
  } = config[status] || config.requested;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      <CreditCard className="h-3 w-3" />
      {t(labelKey)}
    </span>;
}

// Application card component
function ApplicationCard({
  app,
  onRemove,
  onGoToPayment,
  onGoToCase
}: {
  app: StudentApplication;
  onRemove?: (programId: string) => void;
  onGoToPayment?: (paymentId: string) => void;
  onGoToCase?: (applicationId: string) => void;
}) {
  const { t } = useLanguage();
  const [isRemoving, setIsRemoving] = useState(false);
  const isShortlisted = app.status === 'shortlisted';
  const isPendingPayment = app.status === 'pending_payment';
  const isFullyPaid = app.payment_status === 'fully_paid';
  const hasServices = app.services && app.services.length > 0;
  const handleToggleFavorite = () => {
    if (!onRemove || !app.program_id) return;
    setIsRemoving(true);
    onRemove(app.program_id);
    toast.success(t('portal.applications.removedFromFavorites'));
    setIsRemoving(false);
  };
  // Limit services to show max 4
  const displayedServices = hasServices ? app.services!.slice(0, 4) : [];
  const remainingServicesCount = hasServices ? Math.max(0, app.services!.length - 4) : 0;

  return <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow h-full min-h-[280px] flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h4 className="font-semibold text-foreground truncate max-w-[200px] cursor-default">{app.program_name}</h4>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px]">
                <p>{app.program_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-sm text-muted-foreground truncate">{app.university_name}</p>
          {app.country && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {app.country}{app.city ? ` - ${app.city}` : ''}
            </p>}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {/* Heart Button - only for shortlisted items */}
          {isShortlisted && onRemove && <Button variant="ghost" size="icon" className={cn("h-8 w-8 transition-colors", "text-primary hover:bg-primary/10")} onClick={handleToggleFavorite} disabled={isRemoving} title={t('portal.applications.removeFromFavorites')}>
              <Heart className="h-4 w-4 fill-current" />
            </Button>}
          <StatusBadge status={app.status} t={t} />
        </div>
      </div>
      
      {/* ✅ Services List - Max 4 with remaining count */}
      {hasServices && <div className="mt-3 pt-3 border-t border-border flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('portal.applications.selectedServices')}</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {displayedServices.map((svc, idx) => <li key={idx} className="flex justify-between">
                <span className="truncate flex-1">• {svc.name}</span>
                <span className="font-medium shrink-0 mr-2">${svc.line_total}</span>
              </li>)}
            {remainingServicesCount > 0 && <li className="text-muted-foreground/70 text-xs">
                + {remainingServicesCount} {t('portal.applications.moreServices')}
              </li>}
          </ul>
          {/* Total always visible */}
          {app.total_amount && <div className="mt-2 pt-2 border-t border-dashed border-border flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">{t('portal.applications.total')}</span>
              <span className="text-lg font-bold text-primary">${app.total_amount}</span>
            </div>}
        </div>}
      
      {/* ✅ Payment Status & CTA - Always at bottom */}
      {(app.payment_id || isPendingPayment || app.payment_status) && <div className="mt-auto pt-3 border-t border-border">
          {(app.payment_id || app.payment_status) && <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t('portal.applications.paymentStatus')}</span>
              <PaymentStatusBadge status={app.payment_status} t={t} />
            </div>}
          
          {/* Go to Payment button - show for pending_payment OR when has payment_id with requested/proof_rejected status */}
          {(isPendingPayment || app.payment_status === 'requested' || app.payment_status === 'proof_rejected') && onGoToPayment && app.payment_id && <Button size="sm" className="w-full gap-2 mt-2" onClick={() => onGoToPayment(app.payment_id!)}>
              <CreditCard className="h-4 w-4" />
              {t('portal.applications.goToPayment')}
            </Button>}
          
          {/* Go to Case Status - show for fully_paid or proof_received */}
          {(isFullyPaid || app.payment_status === 'proof_received') && onGoToCase && <Button size="sm" variant="outline" className="w-full gap-2 mt-2" onClick={() => onGoToCase(app.application_id)}>
              <FileText className="h-4 w-4" />
              {t('portal.applications.caseStatus')}
            </Button>}
        </div>}
      
      {app.status === 'shortlisted' && <div className="mt-auto pt-3 border-t border-border">
          <Button size="sm" variant="outline" className="w-full gap-2" disabled>
            <Send className="h-3 w-3" />
            {t('portal.applications.applyNowSoon')}
          </Button>
        </div>}
    </div>;
}

// Empty state component
function EmptyState() {
  const { t } = useLanguage();
  return <div className="text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Send className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('portal.applications.empty')}</h3>
      <p className="text-sm text-muted-foreground mb-2 max-w-sm mx-auto">
        {t('portal.applications.emptyDesc')}
      </p>
    </div>;
}

// Section component
function Section({
  title,
  description,
  children,
  count,
  dotColor = "bg-primary"
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  count: number;
  dotColor?: string;
}) {
  if (count === 0) return null;
  return <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <div>
          <h3 className="font-semibold text-foreground">{title} ({count})</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {children}
      </div>
    </div>;
}

// Compact Payment Card for inline display
function CompactPaymentCard({
  payment,
  onUploadProof,
  onViewEvidence,
  isHighlighted,
  t
}: {
  payment: StudentPayment;
  onUploadProof: () => void;
  onViewEvidence: () => void;
  isHighlighted?: boolean;
  t: (key: string) => string;
}) {
  const statusConfig = {
    requested: {
      labelKey: 'portal.applications.paymentStatuses.requested',
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      icon: CreditCard
    },
    proof_received: {
      labelKey: 'portal.applications.paymentStatuses.proofReceived',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      icon: Clock
    },
    proof_rejected: {
      labelKey: 'portal.applications.paymentStatuses.proofRejected',
      color: 'bg-red-500/10 text-red-600 dark:text-red-400',
      icon: AlertCircle
    },
    fully_paid: {
      labelKey: 'portal.applications.paymentStatuses.fullyPaid',
      color: 'bg-green-500/10 text-green-600 dark:text-green-400',
      icon: CheckCircle2
    }
  };
  const {
    labelKey,
    color,
    icon: StatusIcon
  } = statusConfig[payment.status] || statusConfig.requested;
  const hasEvidence = !!(payment.evidence_file_id || payment.storage_path || payment.evidence_storage_path);
  return <div className={cn("bg-card border rounded-xl p-4 transition-all", isHighlighted && "ring-2 ring-primary ring-offset-2", payment.status === 'proof_rejected' && "border-red-300 dark:border-red-800")}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Amount & Status */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-2xl font-bold text-foreground">${payment.amount_required}</span>
            <p className="text-xs text-muted-foreground">{payment.currency}</p>
          </div>
          
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color}`}>
            <StatusIcon className="h-4 w-4" />
            {t(labelKey)}
          </span>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* View Evidence button */}
          {hasEvidence && payment.status !== 'requested' && <Button size="sm" variant="outline" onClick={onViewEvidence} className="gap-1.5">
              <Eye className="h-4 w-4" />
              {t('portal.applications.viewProof')}
            </Button>}
          
          {/* Upload/Re-upload button */}
          {(payment.status === 'requested' || payment.status === 'proof_rejected') && <Button size="sm" onClick={onUploadProof} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {payment.status === 'proof_rejected' ? t('portal.applications.reUpload') : t('portal.applications.uploadProof')}
            </Button>}
          
          {/* Receipt */}
          {payment.status === 'fully_paid' && payment.receipt_no && <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              {payment.receipt_no}
            </span>}
        </div>
      </div>
      
      {/* Rejection reason */}
      {payment.status === 'proof_rejected' && payment.rejection_reason && <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
          <p className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span><strong>{t('portal.applications.rejectionReason')}</strong> {payment.rejection_reason}</span>
          </p>
        </div>}
    </div>;
}

// Draft Card component
function DraftCard({
  draft,
  onRetry,
  onEdit,
  onDelete,
  isRetrying
}: {
  draft: DraftApplication;
  onRetry: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isRetrying: boolean;
}) {
  const { t } = useLanguage();
  return <div className="bg-card border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
              {t('portal.applications.draft')}
            </span>
          </div>
          <h4 className="font-semibold text-foreground truncate">{draft.program_name || t('portal.applications.undefinedProgram')}</h4>
          <p className="text-sm text-muted-foreground truncate">{draft.university_name}</p>
        </div>
        
        <div className="text-left shrink-0">
          {draft.total_amount && <span className="text-lg font-bold text-foreground">${draft.total_amount}</span>}
        </div>
      </div>
      
      {/* Services List */}
      {draft.services.length > 0 && <div className="flex-1 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('portal.applications.selectedServicesLabel')}</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {draft.services.slice(0, 4).map((s, idx) => <li key={idx} className="flex justify-between">
                <span>• {s.name || s.service_code}</span>
                {s.line_total && <span className="font-medium">${s.line_total}</span>}
              </li>)}
            {draft.services.length > 4 && <li className="text-muted-foreground/70">+ {draft.services.length - 4} {t('portal.applications.moreServices')}</li>}
          </ul>
        </div>}
      
      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto pt-3 border-t border-border">
        <Button size="sm" onClick={onRetry} disabled={isRetrying} className="flex-1 gap-1.5">
          {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {t('portal.applications.sendNow')}
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1">
          <Pencil className="h-3 w-3" />
          {t('portal.applications.edit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive gap-1">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>;
}
interface ApplicationsTabProps {
  crmProfile: StudentPortalProfile | null;
  onUpdate: (payload: Partial<StudentPortalProfile>) => Promise<boolean>;
  onTabChange?: (tab: string) => void;
  showStatusOnly?: boolean;
}
export function ApplicationsTab({
  crmProfile,
  onUpdate,
  onTabChange,
  showStatusOnly = false
}: ApplicationsTabProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const targetApplicationId = searchParams.get('application_id');
  const targetPaymentId = searchParams.get('payment_id');
  const {
    loading,
    error,
    featureAvailable,
    submitted,
    decided,
    pendingPayment
  } = useStudentApplications();

  // ✅ Payments hook
  const {
    payments: rawPayments,
    loading: paymentsLoading,
    refetch: refetchPayments
  } = useStudentPayments();
  
  // ✅ Guard against non-array payments
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  // Draft applications (local outbox)
  const {
    drafts,
    remove: removeDraft
  } = useDraftApplications();
  const {
    getById: getCacheById,
    getAll: getAllCache
  } = useSubmissionCache();
  const [retryingDraftId, setRetryingDraftId] = useState<string | null>(null);

  // ✅ Payment modal states
  const [uploadModalPayment, setUploadModalPayment] = useState<StudentPayment | null>(null);
  const [evidenceModalPayment, setEvidenceModalPayment] = useState<StudentPayment | null>(null);

  // Refs for scroll
  const applicationRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const paymentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Enrich applications with cache data (services, total_amount, payment_id)
  const enrichApplication = (app: StudentApplication): StudentApplication => {
    // If already has services, return as-is
    if (app.services && app.services.length > 0) return app;

    // Try to find in cache by ID or program_id
    const cacheItem = getCacheById(app.id) || (app.program_id ? getAllCache().find(c => c.program_id === app.program_id) : null);
    if (!cacheItem) return app;
    return {
      ...app,
      services: cacheItem.services.map(s => ({
        name: s.name || s.service_code,
        qty: s.qty,
        unit_price: s.unit_price,
        line_total: s.line_total
      })) as ApplicationService[],
      total_amount: app.total_amount || cacheItem.total_amount,
      payment_id: app.payment_id || cacheItem.payment_id
    };
  };

  // ✅ Create synthetic applications from submission cache (when CRM hasn't synced yet)
  const getCachedAsApplications = (): StudentApplication[] => {
    const allCache = getAllCache();
    const allOfficialIds = [...pendingPayment, ...submitted, ...decided].map(a => a.id);
    const allDraftProgramIds = drafts.map(d => d.program_id);
    return allCache.filter(cached => {
      // Skip if already in official applications
      if (allOfficialIds.includes(cached.application_id)) return false;
      // Skip if still a draft (not submitted yet)
      if (allDraftProgramIds.includes(cached.program_id)) return false;
      return true;
    }).map(cached => ({
      id: cached.application_id,
      application_id: cached.application_id, // ✅ CRM application_id
      program_id: cached.program_id,
      program_name: cached.program_name || t('portal.applications.undefinedProgram'),
      university_name: cached.university_name || '',
      country: cached.country_code || null,
      city: null,
      degree_level: null,
      status: 'pending_payment' as const,
      submitted_at: cached.created_at,
      created_at: cached.created_at,
      services: cached.services.map(s => ({
        code: s.service_code,
        name: s.name || s.service_code,
        qty: s.qty,
        unit_price: s.unit_price || 0,
        line_total: s.line_total || 0
      })),
      total_amount: cached.total_amount,
      currency: cached.currency,
      payment_id: cached.payment_id,
      payment_status: 'requested' as const
    }));
  };
  const cachedApplications = getCachedAsApplications();

  // Enriched application lists (combine official + cached)
  const enrichedPendingPayment = [...pendingPayment.map(enrichApplication), ...cachedApplications // Add cached submissions that aren't in official list
  ];
  const enrichedSubmitted = submitted.map(enrichApplication);
  const enrichedDecided = decided.map(enrichApplication);

  // Scroll to target application when URL contains application_id
  useEffect(() => {
    if (!targetApplicationId || loading) return;
    const timer = setTimeout(() => {
      const el = applicationRefs.current[targetApplicationId];
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        // Add highlight effect
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [targetApplicationId, loading]);

  // ✅ Scroll to payment when URL contains payment_id
  useEffect(() => {
    if (!targetPaymentId || paymentsLoading) return;
    const timer = setTimeout(() => {
      const el = paymentRefs.current[targetPaymentId];
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [targetPaymentId, paymentsLoading]);
  
  // Handler for navigating to payments tab with payment_id
  const handleGoToPayment = (paymentId: string) => {
    if (!paymentId) {
      toast.error(t('portal.applications.noPaymentLinked'));
      return;
    }
    navigate(`/account?tab=payments&payment_id=${paymentId}`);
  };

  // Handler for navigating to case status
  const handleGoToCase = (applicationId: string) => {
    navigate(`/account?tab=case&application_id=${applicationId}`);
  };

  // ✅ Handle payment proof upload success
  const handlePaymentProofSuccess = () => {
    setUploadModalPayment(null);
    refetchPayments();
    toast.success(t('portal.applications.proofUploadSuccess'));
  };

  // Retry sending a draft application
  const handleRetryDraft = async (draft: DraftApplication) => {
    setRetryingDraftId(draft.draft_id);
    try {
      const result = await supabase.functions.invoke('student-portal-api', {
        body: {
          action: 'submit_application',
          program_id: draft.program_id,
          country_code: draft.country_code || null,
          services: draft.services.map(s => ({
            code: s.service_code,
            qty: s.qty
          }))
        }
      });

      // Handle response (support both data.ok and data.data patterns)
      const isOk = !!result.data?.ok;
      const applicationId = result.data?.data?.application_id || result.data?.application_id;
      const paymentId = result.data?.data?.payment_id || result.data?.payment_id;
      if (isOk && applicationId) {
        // Success: remove draft
        removeDraft(draft.draft_id);
        toast.success(t('portal.applications.submitSuccess'));

        // Navigate to payments if payment_id returned
        if (paymentId) {
          navigate(`/account?tab=payments&payment_id=${paymentId}`);
        }
      } else {
        toast.error(t('portal.applications.submitFailed'));
      }
    } catch (err) {
      console.error('[ApplicationsTab] Retry error:', err);
      toast.error(t('portal.applications.submitError'));
    } finally {
      setRetryingDraftId(null);
    }
  };

  // Edit a draft (navigate to services with prefill)
  const handleEditDraft = (draft: DraftApplication) => {
    navigate(`/account?tab=services&program_id=${draft.program_id}&draft_id=${draft.draft_id}`);
  };

  // Delete a draft
  const handleDeleteDraft = (draftId: string) => {
    removeDraft(draftId);
    toast.success(t('portal.applications.draftDeleted'));
  };

  // Loading state
  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }

  // Error state
  if (error) {
    return <div className="text-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('error')}</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>;
  }

  // Feature not available
  if (!featureAvailable) {
    return <div className="text-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('portal.applications.featureInDev')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {t('portal.applications.featureInDevDesc')}
        </p>
      </div>;
  }
  const totalCount = submitted.length + decided.length + pendingPayment.length;
  const hasDrafts = drafts.length > 0;

  // Empty state - show drafts if any exist, otherwise empty message
  if (totalCount === 0 && !hasDrafts) {
    return <div className="space-y-6">
        <EmptyState />
        {onTabChange && <TabNavigation currentTab="applications" onTabChange={onTabChange} />}
      </div>;
  }
  return <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-success" />
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('portal.applications.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('portal.applications.subtitle')}</p>
        </div>
      </div>

      {/* ✅ Drafts Section (Local Outbox) */}
      {hasDrafts && <Section title={t('portal.applications.drafts')} description={t('portal.applications.draftsDesc')} count={drafts.length} dotColor="bg-amber-500">
          {drafts.map(draft => <DraftCard key={draft.draft_id} draft={draft} onRetry={() => handleRetryDraft(draft)} onEdit={() => handleEditDraft(draft)} onDelete={() => handleDeleteDraft(draft.draft_id)} isRetrying={retryingDraftId === draft.draft_id} />)}
        </Section>}

      {/* ✅ Pending Payment Section (Priority) */}
      <Section title={t('portal.applications.pendingPayment')} description={t('portal.applications.pendingPaymentDesc')} count={enrichedPendingPayment.length}>
        {enrichedPendingPayment.map(app => <div key={app.id} ref={el => {
        applicationRefs.current[app.id] = el;
      }} className="transition-all duration-300">
            <ApplicationCard app={app} onGoToPayment={handleGoToPayment} onGoToCase={handleGoToCase} />
          </div>)}
      </Section>

      {/* Submitted Section */}
      <Section title={t('portal.applications.submittedApps')} description={t('portal.applications.submittedAppsDesc')} count={enrichedSubmitted.length}>
        {enrichedSubmitted.map(app => <div key={app.id} ref={el => {
        applicationRefs.current[app.id] = el;
      }} className="transition-all duration-300">
            <ApplicationCard app={app} onGoToPayment={handleGoToPayment} onGoToCase={handleGoToCase} />
          </div>)}
      </Section>

      {/* Decided Section */}
      <Section title={t('portal.applications.decisions')} description={t('portal.applications.decisionsDesc')} count={enrichedDecided.length}>
        {enrichedDecided.map(app => <div key={app.id} ref={el => {
        applicationRefs.current[app.id] = el;
      }} className="transition-all duration-300">
            <ApplicationCard app={app} onGoToCase={handleGoToCase} />
          </div>)}
      </Section>

      {/* ✅ Payments Section (Inline) */}
      {payments.length > 0 && <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div>
              <h3 className="text-lg font-bold text-foreground">{t('portal.applications.paymentsSection')} ({payments.length})</h3>
              <p className="text-sm text-muted-foreground">{t('portal.applications.paymentsDesc')}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {payments.map(payment => <div key={payment.id} ref={el => {
          paymentRefs.current[payment.id] = el;
        }}>
                
              </div>)}
          </div>
        </div>}

      {/* ── Intake Applications (direct university submissions) ── */}
      <div className="pt-4 border-t border-border">
        <StudentApplicationsPanel />
      </div>

      {/* Tab Navigation */}
      {onTabChange && <TabNavigation currentTab="applications" onTabChange={onTabChange} />}
      
      {/* ✅ Payment Proof Upload Modal */}
      {uploadModalPayment && <PaymentProofModal open={!!uploadModalPayment} onClose={() => setUploadModalPayment(null)} paymentId={uploadModalPayment.id} paymentAmount={uploadModalPayment.amount_required} paymentCurrency={uploadModalPayment.currency} onSuccess={handlePaymentProofSuccess} />}
      
      {/* ✅ Payment Evidence View Modal */}
      {evidenceModalPayment && <PaymentEvidenceModal open={!!evidenceModalPayment} onOpenChange={open => !open && setEvidenceModalPayment(null)} evidenceFileId={evidenceModalPayment.evidence_file_id || undefined} storageBucket={evidenceModalPayment.evidence_storage_bucket || evidenceModalPayment.storage_bucket || undefined} storagePath={evidenceModalPayment.evidence_storage_path || evidenceModalPayment.storage_path || undefined} />}
    </div>;
}