/**
 * useStudentSnapshot Hook
 * Unified hook for fetching student snapshot from CRM with cache + refresh triggers
 * 
 * Data Shape (from get_student_card_snapshot):
 * {
 *   ok: true,
 *   snapshot: {
 *     customer_id, stage, stage_label, profile_confirmed,
 *     documents: [{ id, file_kind, file_name, review_status, rejection_reason, admin_notes }],
 *     payments: { total_due, total_paid, currency, recent_payments: [...] },
 *     shortlist_count, applications_count, rejected_docs_count, pending_payments_count,
 *     next_actions: [{ type, priority, label, target_tab }]
 *   }
 * }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentSnapshot {
  id: string;
  file_kind: string;
  file_name: string;
  review_status: 'pending' | 'approved' | 'rejected' | 'needs_fix' | string;
  rejection_reason?: string | null;
  admin_notes?: string | null;
  uploaded_at?: string;
  // 🆕 Additional fields from CRM
  status?: string;
  student_visible_note?: string | null;
}

export interface PaymentSnapshot {
  id: string;
  amount: number;
  status: string;
  due_date?: string;
  description?: string;
}

export interface PaymentsAggregate {
  total_due: number;
  total_paid: number;
  currency: string;
  recent_payments: PaymentSnapshot[];
}

export interface NextAction {
  type: string;
  priority: 'high' | 'medium' | 'low';
  label: string;
  target_tab?: string;
}

export interface StudentSnapshot {
  customer_id: string;
  stage: string;
  stage_label?: string;
  profile_confirmed: boolean;
  documents: DocumentSnapshot[];
  payments: PaymentsAggregate;
  shortlist_count: number;
  applications_count: number;
  rejected_docs_count: number;
  pending_payments_count: number;
  next_actions: NextAction[];
  last_updated_at?: string;
}

interface UseStudentSnapshotOptions {
  enabled?: boolean;
  staleTime?: number; // ms before cache is considered stale
}

const CACHE_KEY = 'student_snapshot_cache';
const DEFAULT_STALE_TIME = 60_000; // 1 minute

export function useStudentSnapshot(options: UseStudentSnapshotOptions = {}) {
  const { enabled = true, staleTime = DEFAULT_STALE_TIME } = options;
  
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const lastFetchRef = useRef<number>(0);
  const fetchInProgressRef = useRef(false);
  
  // Load from cache on mount
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.snapshot && parsed.timestamp) {
          const age = Date.now() - parsed.timestamp;
          if (age < staleTime) {
            setSnapshot(parsed.snapshot);
            setLoading(false);
            lastFetchRef.current = parsed.timestamp;
          }
        }
      } catch (e) {
        console.warn('[useStudentSnapshot] Failed to parse cache');
      }
    }
  }, [staleTime]);
  
  const fetchSnapshot = useCallback(async (silent = false) => {
    if (fetchInProgressRef.current) return null;
    fetchInProgressRef.current = true;
    
    if (!silent) setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'get_student_card_snapshot' }
      });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }
      
      // ✅ Robust parsing: handle both { snapshot: {...} } and direct fields
      const snap = data?.snapshot ?? data;
      
      // Check if we got valid data
      if (!snap || snap.linked === false || !snap.customer_id) {
        console.log('[useStudentSnapshot] No linked profile or empty snapshot');
        setSnapshot(null);
        return null;
      }
      
      // Normalize the snapshot structure
      const normalizedSnapshot: StudentSnapshot = {
        customer_id: snap.customer_id || '',
        stage: snap.stage || 'new',
        stage_label: snap.stage_label,
        profile_confirmed: Boolean(snap.profile_confirmed),
        documents: Array.isArray(snap.documents) ? snap.documents : [],
        payments: snap.payments && typeof snap.payments === 'object' ? {
          total_due: Number(snap.payments.total_due ?? 0),
          total_paid: Number(snap.payments.total_paid ?? 0),
          currency: snap.payments.currency || 'USD',
          recent_payments: Array.isArray(snap.payments.recent_payments) ? snap.payments.recent_payments : [],
        } : {
          total_due: 0,
          total_paid: 0,
          currency: 'USD',
          recent_payments: [],
        },
        shortlist_count: Number(snap.shortlist_count ?? 0),
        applications_count: Number(snap.applications_count ?? 0),
        rejected_docs_count: Number(snap.rejected_docs_count ?? 0),
        pending_payments_count: Number(snap.pending_payments_count ?? 0),
        next_actions: Array.isArray(snap.next_actions) ? snap.next_actions : [],
        last_updated_at: snap.last_updated_at,
      };
      
      setSnapshot(normalizedSnapshot);
      lastFetchRef.current = Date.now();
      
      // Cache it
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        snapshot: normalizedSnapshot,
        timestamp: lastFetchRef.current
      }));
      
      return normalizedSnapshot;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch snapshot';
      setError(msg);
      console.error('[useStudentSnapshot] Error:', err);
      return null;
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    
    // Skip if cache is still fresh
    const age = Date.now() - lastFetchRef.current;
    if (age < staleTime && snapshot) return;
    
    fetchSnapshot();
  }, [enabled, fetchSnapshot, staleTime, snapshot]);
  
  // Listen for refresh events (from event executor)
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[useStudentSnapshot] 🔄 Refresh triggered by event');
      fetchSnapshot(true);
    };
    
    window.addEventListener('crm-refresh-data', handleRefresh);
    return () => window.removeEventListener('crm-refresh-data', handleRefresh);
  }, [fetchSnapshot]);
  
  // Refetch function for manual trigger
  const refetch = useCallback(async () => {
    return fetchSnapshot(false);
  }, [fetchSnapshot]);
  
  // Silent refetch (no loading state)
  const refetchSilent = useCallback(async () => {
    return fetchSnapshot(true);
  }, [fetchSnapshot]);
  
  // Computed helpers - using correct data structure
  const rejectedDocs = snapshot?.documents.filter(d => 
    d.review_status === 'rejected' || d.review_status === 'needs_fix'
  ) || [];
  
  // ✅ Fixed: payments is now an object with total_due, not an array
  const hasPendingPayments = (snapshot?.payments?.total_due ?? 0) > 0;
  const pendingPaymentsTotal = snapshot?.payments?.total_due ?? 0;
  const paymentsCurrency = snapshot?.payments?.currency ?? 'USD';
  
  const highPriorityActions = snapshot?.next_actions.filter(a => 
    a.priority === 'high'
  ) || [];
  
  return {
    snapshot,
    loading,
    error,
    refetch,
    refetchSilent,
    // Computed
    rejectedDocs,
    hasPendingPayments,
    pendingPaymentsTotal,
    paymentsCurrency,
    highPriorityActions,
    isProfileConfirmed: snapshot?.profile_confirmed ?? false,
    stage: snapshot?.stage ?? null
  };
}
