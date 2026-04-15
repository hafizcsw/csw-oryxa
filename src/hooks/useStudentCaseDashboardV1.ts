import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// ============= Types =============
export interface CaseEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'blocked' | 'canceled';
  due_at: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export interface ServiceJob {
  id: string;
  job_type: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked' | 'canceled';
  due_at: string | null;
  completed_at: string | null;
  delivery_option: string | null;
  delivery_address: Record<string, unknown> | null;
  price_extra: number | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export interface Contract {
  id: string;
  template_key: string;
  status: 'draft' | 'ready' | 'signed';
  contract_file_id: string | null;
  signed_contract_file_id: string | null;
  signed_at: string | null;
  consent_version: string | null;
}

export interface DeliveryRequest {
  id: string;
  delivery_type: string;
  status: 'requested' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  shipping_fee_payment_id: string | null;
  address: Record<string, unknown>;
  created_at: string;
}

export interface CasePayment {
  id: string;
  application_id: string | null;
  amount_required: number;
  amount_paid: number;
  currency: string;
  status: 'requested' | 'proof_received' | 'proof_rejected' | 'fully_paid';
  receipt_no: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  provider: string | null;
  provider_status: string | null;
  provider_checkout_url: string | null;
  provider_session_id: string | null;
  created_at: string;
}

export interface CaseFile {
  id: string;
  file_kind: string;
  file_name: string;
  title: string | null;
  status: string | null;
  admin_notes: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface CaseDashboardV1 {
  ok: boolean;
  customer_id: string;
  application_id: string | null;
  application: Record<string, unknown>;
  payments: CasePayment[];
  case_events: CaseEvent[];
  service_jobs: ServiceJob[];
  contract: Contract | null;
  delivery: DeliveryRequest | null;
  files: {
    ready: CaseFile[];
    required: CaseFile[];
  };
  error?: string;
}

// ============= Hook =============
export function useStudentCaseDashboardV1(applicationId?: string) {
  const { t } = useLanguage();
  const [data, setData] = useState<CaseDashboardV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    // Early return if no applicationId - don't make API call
    if (!applicationId) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke("student-portal-api", {
        body: { action: "get_case_dashboard_v1", application_id: applicationId }
      });

      if (fnError) throw fnError;
      if (!res?.ok) {
        // Handle feature not available gracefully
        if (res?.error === 'FEATURE_NOT_AVAILABLE') {
          setData(null);
          return;
        }
        throw new Error(res?.error || t('hooks.case.loadFailed'));
      }

      // ✅ Debug instrumentation (activate via: localStorage.setItem('debug_portal_payments', '1'))
      const debug = typeof window !== 'undefined' && localStorage.getItem('debug_portal_payments') === '1';
      const dbg = (...args: unknown[]) => debug && console.log('[useStudentCaseDashboardV1]', ...args);
      
      // ✅ Normalize payments from various possible shapes
      const rawPayments =
        Array.isArray((res as Record<string, unknown>)?.payments) ? (res as Record<string, unknown>).payments :
        Array.isArray(((res as Record<string, unknown>)?.data as Record<string, unknown>)?.payments) ? ((res as Record<string, unknown>).data as Record<string, unknown>).payments :
        Array.isArray(((res as Record<string, unknown>)?.payments as Record<string, unknown>)?.items) ? ((res as Record<string, unknown>).payments as Record<string, unknown>).items :
        Array.isArray(((res as Record<string, unknown>)?.payments as Record<string, unknown>)?.data) ? ((res as Record<string, unknown>).payments as Record<string, unknown>).data :
        null;

      dbg('raw payments shape', {
        hasPaymentsKey: (res as Record<string, unknown>)?.payments !== undefined,
        type: typeof (res as Record<string, unknown>)?.payments,
        isArray: Array.isArray((res as Record<string, unknown>)?.payments),
        raw: (res as Record<string, unknown>)?.payments,
      });

      const normalizedPayments = Array.isArray(rawPayments) ? rawPayments : [];
      
      // ✅ Set data with normalized payments
      setData({
        ...res,
        payments: normalizedPayments,
      } as CaseDashboardV1);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : t('hooks.case.loadFailed');
      setError(errMsg);
      console.error('[useStudentCaseDashboardV1] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [applicationId, t]);

  const acceptContract = useCallback(async (contractId: string) => {
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke("student-portal-api", {
        body: { 
          action: "accept_contract_v1", 
          contract_id: contractId, 
          consent_version: "v1" 
        }
      });
      
      if (fnError) throw fnError;
      if (!res?.ok) throw new Error(res?.error || t('hooks.case.signFailed'));
      
      toast.success(t('hooks.case.contractSigned'));
      await fetchDashboard();
      return res;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : t('hooks.case.signFailed');
      toast.error(errMsg);
      throw e;
    }
  }, [fetchDashboard, t]);

  const setDelivery = useCallback(async (params: { 
    application_id: string; 
    delivery_type: string; 
    address: Record<string, unknown>;
  }) => {
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke("student-portal-api", {
        body: { action: "set_delivery_v1", ...params }
      });
      
      if (fnError) throw fnError;
      if (!res?.ok) throw new Error(res?.error || t('hooks.case.deliveryFailed'));
      
      toast.success(t('hooks.case.deliverySaved'));
      await fetchDashboard();
      return res;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : t('hooks.case.deliveryFailed');
      toast.error(errMsg);
      throw e;
    }
  }, [fetchDashboard, t]);

  useEffect(() => { 
    fetchDashboard(); 
  }, [fetchDashboard]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchDashboard, 
    acceptContract, 
    setDelivery 
  };
}
