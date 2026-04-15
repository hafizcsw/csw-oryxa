import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FiatRates {
  [key: string]: number;
}

export interface CryptoRate {
  usd: number;
  sar: number;
  usd_24h_change?: number;
}

export interface CryptoRates {
  [key: string]: CryptoRate;
}

export interface ExchangeRates {
  fiat: FiatRates;
  crypto: CryptoRates;
  lastUpdated: string;
  baseCurrency: string;
}

// Fallback rates in case API fails
const FALLBACK_RATES: ExchangeRates = {
  fiat: {
    SAR: 1,
    AED: 0.98,
    USD: 0.27,
    EUR: 0.24,
    GBP: 0.21,
    RUB: 24.5,
    TRY: 8.6,
    EGP: 13.2,
    KWD: 0.082,
    QAR: 0.97,
  },
  crypto: {
    BTC: { usd: 97000, sar: 363750, usd_24h_change: 2.3 },
    ETH: { usd: 3400, sar: 12750, usd_24h_change: -0.8 },
    USDT: { usd: 1, sar: 3.75, usd_24h_change: 0 },
    USDC: { usd: 1, sar: 3.75, usd_24h_change: 0 },
  },
  lastUpdated: new Date().toISOString(),
  baseCurrency: 'SAR',
};

export function useExchangeRates(refreshInterval = 60000) {
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('exchange-rates');
      
      if (fnError) throw fnError;
      
      if (data) {
        setRates(data);
        setLastFetched(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('[useExchangeRates] Error fetching rates:', err);
      setError('Failed to fetch exchange rates');
      // Keep using fallback or last known rates
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchRates();

    // Set up interval for refresh
    const interval = setInterval(fetchRates, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchRates, refreshInterval]);

  // Helper to get fiat rate
  const getFiatRate = useCallback((from: string, to: string): number => {
    const fromRate = rates.fiat[from] || 1;
    const toRate = rates.fiat[to] || 1;
    return toRate / fromRate;
  }, [rates.fiat]);

  // Helper to get crypto price in SAR
  const getCryptoInSAR = useCallback((crypto: string): number => {
    return rates.crypto[crypto]?.sar || 0;
  }, [rates.crypto]);

  // Helper to convert SAR to crypto
  const sarToCrypto = useCallback((sarAmount: number, crypto: string): number => {
    const cryptoSarPrice = rates.crypto[crypto]?.sar || 1;
    return sarAmount / cryptoSarPrice;
  }, [rates.crypto]);

  // Helper to convert crypto to SAR
  const cryptoToSar = useCallback((cryptoAmount: number, crypto: string): number => {
    const cryptoSarPrice = rates.crypto[crypto]?.sar || 1;
    return cryptoAmount * cryptoSarPrice;
  }, [rates.crypto]);

  // Get formatted last updated time
  const getLastUpdatedText = useCallback((isRTL: boolean): string => {
    if (!lastFetched) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - lastFetched.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return isRTL ? 'الآن' : 'Just now';
    } else if (diffMins === 1) {
      return isRTL ? 'منذ دقيقة' : '1 min ago';
    } else {
      return isRTL ? `منذ ${diffMins} دقائق` : `${diffMins} mins ago`;
    }
  }, [lastFetched]);

  return {
    rates,
    loading,
    error,
    lastFetched,
    refetch: fetchRates,
    getFiatRate,
    getCryptoInSAR,
    sarToCrypto,
    cryptoToSar,
    getLastUpdatedText,
  };
}
