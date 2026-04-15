import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  CreditCard, RefreshCw, AlertCircle, Calendar, ArrowUpRight, 
  Wallet, CheckCircle2, XCircle, Clock, ArrowDownLeft, Upload, 
  FileText, Eye, RotateCcw, FolderOpen, Bitcoin, Banknote
} from "lucide-react";
import { useStudentPayments, StudentPayment } from "@/hooks/useStudentPayments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaymentChannelsModal } from "@/components/portal/PaymentChannelsModal";
import { PaymentProofModal } from "@/components/portal/PaymentProofModal";
import { PaymentEvidenceModal } from "@/components/portal/payments/PaymentEvidenceModal";
import { cn } from "@/lib/utils";
import { PORTAL_BASE_URL } from "@/config/urls";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackPaymentStart, trackPaymentComplete, trackPaymentFailed } from "@/lib/decisionTracking";

type PaymentStatus = 'all' | 'paid' | 'pending' | 'failed' | 'refunded' | 'requested' | 'proof_received' | 'fully_paid' | 'proof_rejected';

export function PaymentsTab() {
  const { t } = useLanguage();
  const { 
    payments, 
    loading, 
    error, 
    featureAvailable, 
    totalPaid, 
    totalPending, 
    totalRequired,
    nextDuePayment,
    refetch 
  } = useStudentPayments();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetPaymentId = searchParams.get('payment_id');
  const paymentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all');
  const [selectedPayment, setSelectedPayment] = useState<StudentPayment | null>(null);
  const [showChannelsModal, setShowChannelsModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidencePayment, setEvidencePayment] = useState<StudentPayment | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { toast } = useToast();

  // Handle Card Payment - calls CRM to get checkout URL
  const handleCardPayment = async (paymentId: string) => {
    setCheckoutLoading(true);
    // ✅ Decision tracking: payment started
    trackPaymentStart();
    try {
      const result = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'create_card_checkout_session',
          payment_id: paymentId,
          success_url: `${PORTAL_BASE_URL}/account?tab=payments&payment_id=${paymentId}&paid=1`,
          cancel_url: `${PORTAL_BASE_URL}/account?tab=payments&payment_id=${paymentId}&canceled=1`
        }
      });

      if (result.data?.ok && result.data?.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = result.data.checkout_url;
      } else {
        toast({ 
          title: t('portal.payments.notAvailable'), 
          description: result.data?.message || t('portal.payments.cardNotEnabled'), 
          variant: "destructive" 
        });
      }
    } catch (err) {
      console.error('Card checkout error:', err);
      toast({ 
        title: t('error'), 
        description: t('portal.payments.connectionFailed'), 
        variant: "destructive" 
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ✅ Handle success/cancel from Stripe redirect
  useEffect(() => {
    const paid = searchParams.get('paid');
    const canceled = searchParams.get('canceled');
    
    if (paid === '1') {
      toast({ title: t('portal.payments.paymentSuccess'), description: t('portal.payments.paymentSuccessDesc') });
      // ✅ Decision tracking: payment completed
      trackPaymentComplete();
      refetch();
      // Clean up URL
      navigate('/account?tab=payments', { replace: true });
    } else if (canceled === '1') {
      toast({ title: t('portal.payments.paymentCanceled'), description: t('portal.payments.paymentCanceledDesc'), variant: "destructive" });
      // ✅ Decision tracking: payment failed/canceled
      trackPaymentFailed('user_canceled');
      navigate('/account?tab=payments', { replace: true });
    }
  }, [searchParams, navigate, refetch, toast]);

  useEffect(() => {
    if (!targetPaymentId || loading) return;
    const timer = setTimeout(() => {
      const el = paymentRefs.current[targetPaymentId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const payment = payments.find(p => p.id === targetPaymentId);
        if (payment && (payment.status === 'requested' || payment.status === 'pending')) {
          setSelectedPayment(payment);
          setShowProofModal(true);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [targetPaymentId, payments, loading]);

  // Ensure payments is always an array
  const safePayments = Array.isArray(payments) ? payments : [];

  const paidPayments = safePayments.filter(p => p.status === 'paid' || p.status === 'fully_paid');
  const pendingPayments = safePayments.filter(p => p.status === 'pending' || p.status === 'requested');
  const proofReceivedPayments = safePayments.filter(p => p.status === 'proof_received');
  const refundedPayments = safePayments.filter(p => p.status === 'refunded');

  const filteredPayments = statusFilter === 'all' 
    ? safePayments 
    : safePayments.filter(p => {
        if (statusFilter === 'paid') return p.status === 'paid' || p.status === 'fully_paid';
        if (statusFilter === 'pending') return p.status === 'pending' || p.status === 'requested';
        return p.status === statusFilter;
      });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'requested':
        return { icon: Clock, label: t('portal.payments.status.requested'), color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      case 'proof_received':
        return { icon: Eye, label: t('portal.payments.status.proofReceived'), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
      case 'fully_paid':
      case 'paid':
        return { icon: CheckCircle2, label: t('portal.payments.status.paid'), color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' };
      case 'pending':
        return { icon: Clock, label: t('portal.payments.status.pending'), color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      case 'failed':
        return { icon: XCircle, label: t('portal.payments.status.failed'), color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' };
      case 'refunded':
        return { icon: ArrowDownLeft, label: t('portal.payments.status.refunded'), color: 'text-info', bg: 'bg-info/10', border: 'border-info/30' };
      case 'proof_rejected':
        return { icon: XCircle, label: t('portal.payments.status.proofRejected'), color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' };
      default:
        return { icon: CreditCard, label: status, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' };
    }
  };

  const openReceipt = async (paymentId: string) => {
    try {
      const result = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'get_payment_receipt', payment_id: paymentId }
      });
      if (result.data?.ok && result.data?.data?.html) {
        const receiptWindow = window.open('', '_blank');
        if (receiptWindow) {
          receiptWindow.document.write(result.data.data.html);
          receiptWindow.document.close();
        }
      } else {
        toast({ title: "خطأ", description: result.data?.message || "فشل تحميل الإيصال", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "خطأ", description: "فشل الاتصال بالخادم", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted/30 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('portal.payments.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('portal.payments.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('portal.payments.refresh')}
        </Button>
      </div>

      {/* Summary Cards - Compact 3-column layout */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">{t('portal.payments.pendingPayments')}</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">${totalPending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{pendingPayments.length} {t('portal.payments.transactions')}</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-medium">{t('portal.payments.totalPaid')}</span>
            </div>
            <p className="text-2xl font-bold text-success">${totalPaid.toLocaleString()}</p>
            {totalRequired > 0 && (
              <p className="text-xs text-muted-foreground">{Math.round((totalPaid / totalRequired) * 100)}% {t('portal.payments.ofRequired')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">{t('portal.payments.totalRequired')}</span>
            </div>
            <p className="text-2xl font-bold">${totalRequired.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Payment Card */}
      {nextDuePayment && (
        <Card className="border-info/30 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10">
                  <Calendar className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('portal.payments.nextPayment')}</p>
                  <p className="text-xl font-bold text-info">${nextDuePayment.amount.toLocaleString()}</p>
                </div>
              </div>
              {nextDuePayment.due_date && (
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">{t('portal.payments.dueDate')}</p>
                  <p className="text-sm font-medium">{new Date(nextDuePayment.due_date).toLocaleDateString('ar-SA')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods Section */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-primary" />
            {t('portal.payments.paymentMethods')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Card Payment - ✅ Now Active */}
            <div 
              className={cn(
                "p-4 rounded-xl border transition-all group",
                pendingPayments.length > 0 && !checkoutLoading 
                  ? "border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-lg hover:border-primary/50 cursor-pointer" 
                  : "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed"
              )}
              onClick={() => {
                if (pendingPayments.length > 0 && !checkoutLoading) {
                  handleCardPayment(pendingPayments[0].id);
                }
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  pendingPayments.length > 0 ? "bg-primary/20 group-hover:bg-primary/30" : "bg-muted"
                )}>
                  {checkoutLoading ? (
                    <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">{t('portal.payments.card')}</p>
                  {pendingPayments.length > 0 ? (
                    <Badge variant="secondary" className="text-[10px] mt-0.5 bg-primary/20 text-primary dark:bg-primary/30">
                      {t('portal.payments.payNow')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] mt-0.5 bg-muted text-muted-foreground">
                      {t('portal.payments.noDues')}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('portal.payments.cardDesc')}</p>
              {pendingPayments.length > 0 && (
                <p className="text-xs font-medium text-primary mt-2">
                  ${pendingPayments[0].amount?.toLocaleString() || pendingPayments[0].amount_required?.toLocaleString()}
                </p>
              )}
            </div>

            {/* Crypto Payment */}
            <div 
              className="p-4 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent opacity-60 cursor-not-allowed group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Bitcoin className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t('portal.payments.crypto')}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {t('portal.payments.comingSoon')}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('portal.payments.cryptoDesc')}</p>
            </div>

            {/* Bank Transfer */}
            <div 
              className="p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setShowChannelsModal(true)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t('portal.payments.bankTransfer')}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {t('portal.payments.available')}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('portal.payments.bankDesc')}</p>
            </div>
          </div>

          {/* Bank Details - Collapsible */}
          <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{t('portal.payments.bankInfo')}:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <p><span className="text-muted-foreground">{t('portal.payments.bank')}:</span> <span className="font-mono">Sberbank</span></p>
                    <p><span className="text-muted-foreground">SWIFT:</span> <span className="font-mono">SABRRUMM</span></p>
                  </div>
                  <div className="space-y-1">
                    <p><span className="text-muted-foreground">IBAN:</span> <span className="font-mono text-[10px]">RU12 3456 7890 1234</span></p>
                    <p><span className="text-muted-foreground">{t('portal.payments.recipient')}:</span> <span className="font-mono">CSW Education</span></p>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowChannelsModal(true)} className="shrink-0 gap-1.5 text-xs">
                <Wallet className="h-3 w-3" />
                {t('portal.payments.more')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {!featureAvailable ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-amber-500/50 mx-auto mb-3" />
              <p className="text-muted-foreground">{t('portal.payments.noPayments')}</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-destructive/50 mx-auto mb-3" />
              <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="mt-3 gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('retry')}
            </Button>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('portal.payments.noTransactions')}</p>
          </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <div className="border-b border-border px-4 overflow-x-auto">
                <TabsList className="h-11 w-full justify-start gap-1 bg-transparent p-0">
                  <TabsTrigger value="all" onClick={() => setStatusFilter('all')} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-t-lg rounded-b-none text-xs px-3">
                    {t('portal.payments.tabs.all')} ({payments.length})
                  </TabsTrigger>
                  <TabsTrigger value="paid" onClick={() => setStatusFilter('paid')} className="data-[state=active]:bg-success data-[state=active]:text-success-foreground rounded-t-lg rounded-b-none text-xs px-3">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    {t('portal.payments.tabs.paid')} ({paidPayments.length})
                  </TabsTrigger>
                  <TabsTrigger value="pending" onClick={() => setStatusFilter('pending')} className="data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 rounded-t-lg rounded-b-none text-xs px-3">
                    <Clock className="h-3 w-3 ml-1" />
                    {t('portal.payments.tabs.required')} ({pendingPayments.length})
                  </TabsTrigger>
                  {proofReceivedPayments.length > 0 && (
                    <TabsTrigger value="proof_received" onClick={() => setStatusFilter('proof_received')} className="data-[state=active]:bg-info data-[state=active]:text-info-foreground rounded-t-lg rounded-b-none text-xs px-3">
                      <Eye className="h-3 w-3 ml-1" />
                      {t('portal.payments.tabs.inReview')} ({proofReceivedPayments.length})
                    </TabsTrigger>
                  )}
                  {refundedPayments.length > 0 && (
                    <TabsTrigger value="refunded" onClick={() => setStatusFilter('refunded')} className="data-[state=active]:bg-info data-[state=active]:text-info-foreground rounded-t-lg rounded-b-none text-xs px-3">
                      <ArrowDownLeft className="h-3 w-3 ml-1" />
                      {t('portal.payments.tabs.refunded')} ({refundedPayments.length})
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {filteredPayments.map((payment, index) => {
                    const config = getStatusConfig(payment.status);
                    const StatusIcon = config.icon;
                    const isActionable = payment.status === 'requested' || payment.status === 'pending';
                    const isProofReceived = payment.status === 'proof_received';
                    const isPaid = payment.status === 'fully_paid' || payment.status === 'paid';
                    
                    return (
                      <motion.div
                        key={payment.id}
                        ref={(el) => { paymentRefs.current[payment.id] = el; }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "flex flex-col lg:flex-row lg:items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-3",
                          targetPaymentId === payment.id && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg bg-primary/5"
                        )}
                      >
                        {/* Payment Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg ${config.bg} ${config.border} border shrink-0`}>
                            <StatusIcon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {payment.description || payment.service_type || 'دفعة'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${config.bg} ${config.color} border-0`}>
                                {config.label}
                              </Badge>
                              {payment.reference && (
                                <span className="text-[10px] text-muted-foreground">#{payment.reference}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions & Amount */}
                        <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                          {isActionable && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleCardPayment(payment.id)}
                                disabled={checkoutLoading}
                                className="gap-1.5 text-xs h-8"
                              >
                                {checkoutLoading ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CreditCard className="h-3 w-3" />
                                )}
                                ادفع بالبطاقة
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setShowProofModal(true);
                                }}
                                className="gap-1.5 text-xs h-8"
                              >
                                <Upload className="h-3 w-3" />
                                رفع إثبات
                              </Button>
                            </div>
                          )}

                          {isProofReceived && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-500 text-white text-[10px]">
                                <Clock className="h-3 w-3 ml-1" />
                                قيد المراجعة
                              </Badge>
                              {(payment.storage_path || payment.evidence_storage_path || payment.evidence_file_id) && (
                                <Button size="sm" variant="outline" onClick={() => { setEvidencePayment(payment); setShowEvidenceModal(true); }} className="gap-1.5 text-xs h-8">
                                  <Eye className="h-3 w-3" />
                                  عرض
                                </Button>
                              )}
                            </div>
                          )}

                          {payment.status === 'proof_rejected' && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-destructive text-destructive-foreground text-[10px]">مرفوض</Badge>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedPayment(payment); setShowProofModal(true); }} className="gap-1.5 text-xs h-8 border-destructive/50 text-destructive">
                                <RotateCcw className="h-3 w-3" />
                                إعادة الرفع
                              </Button>
                            </div>
                          )}

                          {isPaid && (
                            <div className="flex gap-2">
                              {payment.receipt_no && (
                                <Button size="sm" variant="outline" onClick={() => openReceipt(payment.id)} className="gap-1.5 text-xs h-8">
                                  <FileText className="h-3 w-3" />
                                  الإيصال
                                </Button>
                              )}
                              {payment.application_id && (
                                <Button size="sm" variant="default" onClick={() => navigate(`/account?tab=case&application_id=${payment.application_id}`)} className="gap-1.5 text-xs h-8">
                                  <FolderOpen className="h-3 w-3" />
                                  حالة الملف
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Amount */}
                          <div className="text-left min-w-[90px]">
                            <p className={`text-base font-bold ${
                              payment.status === 'refunded' ? 'text-info' :
                              isPaid ? 'text-success' :
                              payment.status === 'failed' ? 'text-destructive' :
                              'text-foreground'
                            }`}>
                              {payment.status === 'refunded' ? '-' : ''}${payment.amount.toLocaleString()}
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">{payment.currency}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(payment.payment_date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <PaymentChannelsModal open={showChannelsModal} onClose={() => setShowChannelsModal(false)} />
      {selectedPayment && (
        <PaymentProofModal
          open={showProofModal}
          onClose={() => { setShowProofModal(false); setSelectedPayment(null); }}
          paymentId={selectedPayment.id}
          paymentDescription={selectedPayment.description || undefined}
          paymentAmount={selectedPayment.amount}
          paymentCurrency={selectedPayment.currency}
          onSuccess={() => { refetch(); setSelectedPayment(null); }}
        />
      )}
      <PaymentEvidenceModal
        open={showEvidenceModal}
        onOpenChange={(open) => { setShowEvidenceModal(open); if (!open) setEvidencePayment(null); }}
        evidenceFileId={evidencePayment?.evidence_file_id}
        storageBucket={evidencePayment?.storage_bucket || evidencePayment?.evidence_storage_bucket}
        storagePath={evidencePayment?.storage_path || evidencePayment?.evidence_storage_path}
      />
    </div>
  );
}
