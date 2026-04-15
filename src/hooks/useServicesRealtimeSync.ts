/**
 * Hook for realtime synchronization of service selections
 * 
 * FIX-3: CRM is the operational Source of Truth for selections
 * Portal reads/writes selections via student-portal-api Edge Function (to CRM)
 * Realtime subscription for instant UI updates when CRM state changes
 * state_rev is SERVER-MANAGED (not client-managed)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============= Types =============
export interface ServiceSelection {
  id: string;
  auth_user_id: string;
  country_code: string;
  selected_services: string[];
  selected_addons: string[];
  selected_package_id: string | null;
  pay_plan: 'full' | 'split';
  pricing_snapshot: Record<string, unknown>;
  pricing_version: string;
  source: 'portal' | 'crm_staff';
  status: 'draft' | 'submitted' | 'confirmed';
  state_rev: number;
  updated_at: string;
}

export interface UseServicesRealtimeSyncOptions {
  onRemoteUpdate?: (selection: ServiceSelection) => void;
  enabled?: boolean;
}

// ============= Hook =============
export function useServicesRealtimeSync(options: UseServicesRealtimeSyncOptions = {}) {
  const { onRemoteUpdate, enabled = true } = options;
  
  const [selections, setSelections] = useState<Record<string, ServiceSelection>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastStateRevRef = useRef<Record<string, number>>({});

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Load selections from CRM via student-portal-api
   */
  const loadSelections = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('student-portal-api', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'get_service_selections' },
      });

      if (error || !data?.ok) {
        console.log('[useServicesRealtimeSync] No selections:', data?.error);
        setSelections({});
        setLoading(false);
        return;
      }

      const selectionsMap: Record<string, ServiceSelection> = {};
      for (const sel of (data.selections || [])) {
        selectionsMap[sel.country_code] = sel as ServiceSelection;
        lastStateRevRef.current[sel.country_code] = sel.state_rev || 0;
      }
      
      setSelections(selectionsMap);
      console.log('[useServicesRealtimeSync] ✅ Loaded', Object.keys(selectionsMap).length, 'selections');
    } catch (err) {
      console.error('[useServicesRealtimeSync] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Sync selection to CRM via student-portal-api
   * state_rev is server-managed
   */
  const syncSelection = useCallback(async (
    countryCode: string,
    selection: {
      serviceIds: string[];
      addOnIds: string[];
      packageId: string | null;
      payPlan: 'full' | 'split';
    },
    pricingSnapshot: Record<string, unknown>,
    pricingVersion: string = 'v1'
  ): Promise<{ ok: boolean; error?: string; state_rev?: number }> => {
    if (!userId) return { ok: false, error: 'not_authenticated' };
    
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { ok: false, error: 'no_session' };
      }

      // ✅ ORDER #2: Use set_services_selection action (single writer)
      const { data, error } = await supabase.functions.invoke('student-portal-api', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'set_services_selection',
          country_code: countryCode,
          selected_services: selection.serviceIds,
          selected_addons: selection.addOnIds,
          selected_package_id: selection.packageId,
          pay_plan: selection.payPlan,
        },
      });

      if (error || !data?.ok) {
        return { ok: false, error: error?.message || data?.error };
      }

      const newStateRev = data.state_rev || 1;
      lastStateRevRef.current[countryCode] = newStateRev;
      setLastSyncTime(new Date());
      
      console.log('[useServicesRealtimeSync] ✅ Synced:', countryCode, 'rev:', newStateRev);
      return { ok: true, state_rev: newStateRev };
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  /**
   * Subscribe to realtime updates (for CRM staff changes)
   */
  useEffect(() => {
    if (!enabled || !userId) return;

    loadSelections();

    const channel = supabase
      .channel(`service-selections-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_service_selections',
          filter: `auth_user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { country_code?: string };
            if (oldRecord.country_code) {
              setSelections(prev => {
                const next = { ...prev };
                delete next[oldRecord.country_code!];
                return next;
              });
            }
            return;
          }

          const newRecord = payload.new as ServiceSelection;
          if (!newRecord.country_code) return;

          const currentRev = lastStateRevRef.current[newRecord.country_code] || 0;
          if (newRecord.state_rev < currentRev) return;

          if (newRecord.source === 'crm_staff') {
            onRemoteUpdate?.(newRecord);
          }

          lastStateRevRef.current[newRecord.country_code] = newRecord.state_rev;
          setSelections(prev => ({ ...prev, [newRecord.country_code]: newRecord }));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [enabled, userId, loadSelections, onRemoteUpdate]);

  const getSelectionForCountry = useCallback((countryCode: string): ServiceSelection | null => {
    return selections[countryCode] || null;
  }, [selections]);

  const clearSelection = useCallback(async (countryCode: string): Promise<{ ok: boolean }> => {
    if (!userId) return { ok: false };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { ok: false };

      const { data, error } = await supabase.functions.invoke('student-portal-api', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'clear_service_selection', country_code: countryCode },
      });

      if (error || !data?.ok) return { ok: false };

      setSelections(prev => {
        const next = { ...prev };
        delete next[countryCode];
        return next;
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [userId]);

  return {
    selections,
    loading,
    syncing,
    lastSyncTime,
    syncSelection,
    getSelectionForCountry,
    clearSelection,
    reload: loadSelections,
  };
}
