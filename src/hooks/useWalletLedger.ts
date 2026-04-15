import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWalletLedger } from "@/lib/portalApi";
import { supabase } from "@/integrations/supabase/client";
import type { LedgerEntry } from "@/types/portal";

interface UseWalletLedgerOptions {
  currency?: string;
  limit?: number;
}

interface UseWalletLedgerResult {
  available: number;
  pending: number;
  entries: LedgerEntry[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  error_code: string | null;
  featureAvailable: boolean;
  refetch: () => void;
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
}

export function useWalletLedger(opts?: UseWalletLedgerOptions): UseWalletLedgerResult {
  const currency = opts?.currency ?? "USD";
  const limit = opts?.limit ?? 20;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * limit;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['wallet-ledger', currency, limit, offset],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { ok: false, error: 'auth_required', error_code: 'auth_required' };
      }
      return listWalletLedger({ currency, limit, offset });
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev, // Smooth pagination
  });

  const featureAvailable = !(data?.ok === false && data?.error === 'FEATURE_NOT_AVAILABLE');
  const entries = (data as any)?.entries ?? [];
  // MVP: hasMore based on entries.length === limit (no total needed)
  const hasMore = featureAvailable && entries.length === limit;

  return {
    available: Number((data as any)?.available ?? 0),
    pending: Number((data as any)?.pending ?? 0),
    entries,
    loading: isLoading,
    fetching: isFetching,
    error: error ? String(error) : ((data as any)?.error ?? null),
    error_code: (data as any)?.error_code ?? null,
    featureAvailable,
    refetch,
    page,
    setPage,
    hasMore,
  };
}
