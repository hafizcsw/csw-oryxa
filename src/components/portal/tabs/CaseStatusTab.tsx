import { useStudentCaseDashboardV1 } from "@/hooks/useStudentCaseDashboardV1";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PORTAL_BASE_URL } from "@/config/urls";

// Liquid Glass Components
import { LiquidGlassHeader } from "@/components/portal/case/LiquidGlassHeader";
import { AppleJourneyStepper } from "@/components/portal/case/AppleJourneyStepper";
import { QuickStatsGrid } from "@/components/portal/case/QuickStatsGrid";
import { NextActionCard } from "@/components/portal/case/NextActionCard";
import { PaymentCardsGrid } from "@/components/portal/case/PaymentCardsGrid";
import { ContractSigningCard } from "@/components/portal/case/ContractSigningCard";
import { DeliverySelectionCards } from "@/components/portal/case/DeliverySelectionCards";
import { ReadyFilesGrid } from "@/components/portal/case/ReadyFilesGrid";
import { EnhancedTimeline } from "@/components/portal/case/EnhancedTimeline";
import { EmptyStateCard } from "@/components/portal/case/EmptyStateCard";

interface CaseStatusTabProps {
  applicationId?: string;
}

export function CaseStatusTab({ applicationId }: CaseStatusTabProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, refetch, acceptContract, setDelivery } = useStudentCaseDashboardV1(applicationId);
  const [signingContract, setSigningContract] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [deliveryType, setDeliveryType] = useState<'home' | 'work' | 'pickup'>('home');
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '', city: '', country: '', postal_code: ''
  });

  // ✅ Handle Stripe redirect (paid/canceled)
  useEffect(() => {
    const paid = searchParams.get('paid');
    const canceled = searchParams.get('canceled');
    
    if (paid === '1') {
      toast.success('✅ تم الدفع بنجاح! سيتم تحديث حالة الملف تلقائياً.');
      refetch();
      // Clean URL
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.delete('paid');
        return p;
      }, { replace: true });
    } else if (canceled === '1') {
      toast.error('تم إلغاء عملية الدفع. يمكنك المحاولة مرة أخرى.');
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.delete('canceled');
        return p;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch]);

  // No application selected
  if (!applicationId) {
    return (
      <EmptyStateCard
        type="no_application"
        onNavigate={() => navigate('/account?tab=applications')}
      />
    );
  }

  // Handlers
  const handleCardPayment = async (paymentId: string) => {
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke("student-portal-api", {
        body: { 
          action: "create_card_checkout_session",
          payment_id: paymentId,
          success_url: `${PORTAL_BASE_URL}/account?tab=case&application_id=${applicationId}&paid=1`,
          cancel_url: `${PORTAL_BASE_URL}/account?tab=case&application_id=${applicationId}&canceled=1`
        }
      });
      if (fnError) throw fnError;
      if (!res?.ok) {
        toast.error(res?.message || "الدفع بالبطاقة غير متاح حالياً");
        return;
      }
      if (res.checkout_url) window.location.href = res.checkout_url;
    } catch (e) {
      toast.error("فشل الاتصال بخادم الدفع");
    }
  };

  const handleUploadProof = (paymentId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'payments');
    url.searchParams.set('payment_id', paymentId);
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSignContract = async (contractId: string) => {
    setSigningContract(true);
    try {
      await acceptContract(contractId);
      toast.success("تم توقيع العقد بنجاح");
    } finally {
      setSigningContract(false);
    }
  };

  const handleSaveDelivery = async () => {
    if (!applicationId) return toast.error("معرف الطلب غير موجود");
    setSavingDelivery(true);
    try {
      await setDelivery({ application_id: applicationId, delivery_type: deliveryType, address: deliveryAddress });
      toast.success("تم حفظ عنوان التوصيل");
    } catch { toast.error("فشل حفظ عنوان التوصيل"); }
    finally { setSavingDelivery(false); }
  };

  const handleDownloadByFileId = async (fileId: string) => {
    try {
      const { data: res } = await supabase.functions.invoke("student-portal-api", {
        body: { action: "sign_portal_file_v1", file_id: fileId }
      });
      if (res?.signed_url) window.open(res.signed_url, '_blank');
    } catch { toast.error("فشل تحميل الملف"); }
  };

  const handleDownloadByPath = async (storageBucket: string, storagePath: string) => {
    try {
      const { data: res } = await supabase.functions.invoke("student-portal-api", {
        body: { action: "sign_file", storage_bucket: storageBucket, storage_path: storagePath }
      });
      if (res?.signed_url) window.open(res.signed_url, '_blank');
    } catch { toast.error("فشل تحميل الملف"); }
  };

  useEffect(() => {
    if (data?.delivery) {
      setDeliveryType(data.delivery.delivery_type as 'home' | 'work' | 'pickup');
      if (data.delivery.address) {
        const addr = data.delivery.address as Record<string, unknown>;
        setDeliveryAddress({
          street: String(addr.street || ''), city: String(addr.city || ''),
          country: String(addr.country || ''), postal_code: String(addr.postal_code || '')
        });
      }
    }
  }, [data?.delivery]);

  // Loading
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <EmptyStateCard
        type="error"
        error={error}
        onRetry={refetch}
      />
    );
  }

  // No Data
  if (!data) {
    return (
      <EmptyStateCard
        type="no_data"
        onNavigate={() => navigate('/account?tab=shortlist')}
      />
    );
  }

  // ✅ Debug instrumentation (activate via: localStorage.setItem('debug_portal_payments', '1'))
  const debug = typeof window !== 'undefined' && localStorage.getItem('debug_portal_payments') === '1';
  const dbg = (...args: unknown[]) => debug && console.log('[CaseStatusTab]', ...args);
  
  dbg('route', window.location.pathname + window.location.search);
  dbg('build', import.meta.env?.VITE_BUILD_ID ?? 'no-build-id');
  dbg('data.payments raw =', data?.payments);
  dbg('raw type =', typeof data?.payments, 'isArray=', Array.isArray(data?.payments));

  const payments = Array.isArray(data.payments) ? data.payments : [];
  dbg('payments normalized len=', payments.length);
  
  const case_events = Array.isArray(data.case_events) ? data.case_events : [];
  const contract = data.contract;
  const delivery = data.delivery;
  const files = data.files || { ready: [], required: [] };

  // Calculate values
  const completedEvents = case_events.filter(e => e.status === 'done').length;
  const progressPercent = case_events.length > 0 ? Math.round((completedEvents / case_events.length) * 100) : 0;
  
  // ✅ Safe filter with crash logging
  let pendingPayments: typeof payments = [];
  try {
    pendingPayments = payments.filter(p => p.status === 'requested' || p.status === 'proof_rejected');
  } catch (e) {
    console.error('[CaseStatusTab] 💥 payments.filter crashed', {
      paymentsValue: payments,
      rawPayments: data?.payments,
      error: e,
    });
    throw e;
  }
  
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount_required || 0), 0);
  const currentStep = payments[0]?.status === 'fully_paid' ? 5 : contract?.status === 'signed' ? 7 : 3;

  const getNextAction = (): { action: 'payment' | 'contract' | 'delivery' | 'track'; label: string } => {
    if (pendingPayments.length > 0) return { action: 'payment', label: 'أكمل الدفع' };
    if (contract?.status === 'ready') return { action: 'contract', label: 'وقّع العقد' };
    if (!delivery || delivery.status === 'requested') return { action: 'delivery', label: 'حدد عنوان التوصيل' };
    return { action: 'track', label: 'تابع حالة ملفك' };
  };

  const nextAction = getNextAction();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <LiquidGlassHeader
        applicationId={applicationId}
        status={progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'active' : 'pending'}
        lastUpdated={case_events[0]?.created_at}
        language={language}
      />

      {/* Journey Stepper */}
      <AppleJourneyStepper currentStep={currentStep} />

      {/* Quick Stats */}
      <QuickStatsGrid
        progressPercent={progressPercent}
        pendingAmount={pendingAmount}
        currency={payments[0]?.currency || 'SAR'}
        readyFilesCount={files.ready.length}
      />

      {/* Next Action */}
      <NextActionCard
        action={nextAction.action}
        label={nextAction.label}
        onAction={() => {
          if (nextAction.action === 'payment' && pendingPayments[0]) handleCardPayment(pendingPayments[0].id);
          else if (nextAction.action === 'contract' && contract) handleSignContract(contract.id);
          else if (nextAction.action === 'delivery') document.getElementById('delivery-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Payments */}
      {payments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">المدفوعات</h2>
          <PaymentCardsGrid payments={payments} onCardPayment={handleCardPayment} onUploadProof={handleUploadProof} />
        </section>
      )}

      {/* Contract */}
      {contract && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">العقد</h2>
          <ContractSigningCard contract={contract} onSign={handleSignContract} onDownload={handleDownloadByFileId} isLoading={signingContract} />
        </section>
      )}

      {/* Delivery */}
      <section id="delivery-section" className="space-y-4">
        <h2 className="text-xl font-bold">توصيل الوثائق</h2>
        <DeliverySelectionCards
          deliveryType={deliveryType}
          onTypeChange={setDeliveryType}
          address={deliveryAddress}
          onAddressChange={setDeliveryAddress}
          currentStatus={delivery?.status}
          onSave={handleSaveDelivery}
          isLoading={savingDelivery}
        />
      </section>

      {/* Ready Files */}
      {files.ready.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">ملفات جاهزة للتحميل</h2>
          <ReadyFilesGrid files={files.ready} onDownload={handleDownloadByPath} />
        </section>
      )}

      {/* Timeline */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">سجل الأحداث</h2>
        <EnhancedTimeline events={case_events} language={language} />
      </section>
    </motion.div>
  );
}
