import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StudentPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'requested' | 'proof_received' | 'fully_paid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'proof_rejected';
  payment_date: string;
  reference: string | null;
  description: string | null;
  payment_method: string | null;
  due_date?: string | null;
  service_type?: string | null;
  // Manual Proof Flow fields
  amount_required?: number;
  amount_paid?: number;
  evidence_file_id?: string | null;
  receipt_no?: string | null;
  confirmed_at?: string | null;
  installment_no?: number | null;
  service_selection_id?: string | null;
  // ✅ Storage info for viewing evidence
  storage_bucket?: string | null;
  storage_path?: string | null;
  evidence_storage_bucket?: string | null;
  evidence_storage_path?: string | null;
  // ✅ Rejection info
  rejection_reason?: string | null;
  // ✅ Application reference
  application_id?: string | null;
}

export function useStudentPayments() {
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      // ✅ Call CRM proxy action (CRM is source of truth with Portal fallback)
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_payments' }),
      });

      const result = await res.json();

      // Handle feature not available
      if (result.error === 'FEATURE_NOT_AVAILABLE') {
        console.warn('[useStudentPayments] Feature not available:', result.message);
        setFeatureAvailable(false);
        setPayments([]);
        return;
      }

      if (!res.ok || !result.ok) {
        console.error('[useStudentPayments] CRM API error:', result.error);
        setError(result.message || 'فشل تحميل المدفوعات');
        return;
      }

      const raw = result.data;
      const normalizedPayments =
        Array.isArray(raw) ? raw :
        Array.isArray((raw as any)?.payments) ? (raw as any).payments :
        Array.isArray((raw as any)?.data) ? (raw as any).data :
        [];

      // Normalize each payment: ensure `amount` is always a number
      const withAmount = normalizedPayments.map((p: any) => ({
        ...p,
        amount: Number(p.amount ?? p.amount_required ?? p.amount_paid ?? 0),
        currency: p.currency || 'USD',
        payment_date: p.payment_date || p.created_at || p.confirmed_at || null,
      }));

      setPayments(withAmount);
      setFeatureAvailable(true);

    } catch (err) {
      console.error('[useStudentPayments] Error:', err);
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  // Calculate totals - include all paid/pending status variants
  const safePayments = Array.isArray(payments) ? payments : [];

  const totalPaid = safePayments
    .filter(p => p.status === 'paid' || p.status === 'fully_paid')
    .reduce((sum, p) => sum + (p.amount_required || p.amount || 0), 0);

  const totalPending = safePayments
    .filter(p => p.status === 'pending' || p.status === 'requested' || p.status === 'proof_received' || p.status === 'proof_rejected')
    .reduce((sum, p) => sum + (p.amount_required || p.amount || 0), 0);

  const totalRequired = totalPaid + totalPending;

  // Find next due payment - include all actionable statuses
  const nextDuePayment = safePayments
    .filter(p => (p.status === 'pending' || p.status === 'requested') && p.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

  return { 
    payments, 
    loading,
    error,
    featureAvailable,
    totalPaid,
    totalPending,
    totalRequired,
    nextDuePayment,
    refetch: loadPayments,
  };
}
