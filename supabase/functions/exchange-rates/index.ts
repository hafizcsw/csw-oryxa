import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for rates (5 minutes TTL)
let cachedRates: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface FiatRates {
  [key: string]: number;
}

interface CryptoRate {
  usd: number;
  sar: number;
  usd_24h_change?: number;
}

interface CryptoRates {
  [key: string]: CryptoRate;
}

interface ExchangeRatesResponse {
  fiat: FiatRates;
  crypto: CryptoRates;
  lastUpdated: string;
  baseCurrency: string;
}

async function fetchFiatRates(): Promise<FiatRates> {
  try {
    // Using exchangerate-api (free, no key required)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/SAR');
    if (!response.ok) throw new Error('Failed to fetch fiat rates');
    
    const data = await response.json();
    
    // Return rates for supported currencies
    return {
      SAR: 1,
      AED: data.rates.AED || 0.98,
      USD: data.rates.USD || 0.27,
      EUR: data.rates.EUR || 0.24,
      GBP: data.rates.GBP || 0.21,
      RUB: data.rates.RUB || 24.5,
      TRY: data.rates.TRY || 8.6,
      EGP: data.rates.EGP || 13.2,
      KWD: data.rates.KWD || 0.082,
      QAR: data.rates.QAR || 0.97,
    };
  } catch (error) {
    console.error('[exchange-rates] Fiat API error:', error);
    // Return fallback rates
    return {
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
    };
  }
}

async function fetchCryptoRates(): Promise<CryptoRates> {
  try {
    // Using CoinGecko API (free)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin&vs_currencies=usd,sar&include_24hr_change=true'
    );
    if (!response.ok) throw new Error('Failed to fetch crypto rates');
    
    const data = await response.json();
    
    return {
      BTC: {
        usd: data.bitcoin?.usd || 97000,
        sar: data.bitcoin?.sar || 363750,
        usd_24h_change: data.bitcoin?.usd_24h_change || 0,
      },
      ETH: {
        usd: data.ethereum?.usd || 3400,
        sar: data.ethereum?.sar || 12750,
        usd_24h_change: data.ethereum?.usd_24h_change || 0,
      },
      USDT: {
        usd: data.tether?.usd || 1,
        sar: data.tether?.sar || 3.75,
        usd_24h_change: data.tether?.usd_24h_change || 0,
      },
      USDC: {
        usd: data['usd-coin']?.usd || 1,
        sar: data['usd-coin']?.sar || 3.75,
        usd_24h_change: data['usd-coin']?.usd_24h_change || 0,
      },
    };
  } catch (error) {
    console.error('[exchange-rates] Crypto API error:', error);
    // Return fallback rates
    return {
      BTC: { usd: 97000, sar: 363750, usd_24h_change: 2.3 },
      ETH: { usd: 3400, sar: 12750, usd_24h_change: -0.8 },
      USDT: { usd: 1, sar: 3.75, usd_24h_change: 0 },
      USDC: { usd: 1, sar: 3.75, usd_24h_change: 0 },
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    
    // Return cached rates if still valid
    if (cachedRates && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('[exchange-rates] Returning cached rates');
      return new Response(JSON.stringify(cachedRates), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[exchange-rates] Fetching fresh rates...');
    
    // Fetch both fiat and crypto rates in parallel
    const [fiatRates, cryptoRates] = await Promise.all([
      fetchFiatRates(),
      fetchCryptoRates(),
    ]);

    const response: ExchangeRatesResponse = {
      fiat: fiatRates,
      crypto: cryptoRates,
      lastUpdated: new Date().toISOString(),
      baseCurrency: 'SAR',
    };

    // Update cache
    cachedRates = response;
    cacheTimestamp = now;

    console.log('[exchange-rates] Rates fetched successfully');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[exchange-rates] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch exchange rates' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
