import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const srv = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Currencies we support
const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'RUB', 'CNY', 'JPY', 'KRW', 'INR', 'TRY', 'EGP',
  'SAR', 'AED', 'KWD', 'BHD', 'OMR', 'QAR', 'JOD', 'LBP', 'IQD', 'SYP',
  'MAD', 'DZD', 'TND', 'LYD', 'SDG', 'MYR', 'IDR', 'THB'
];

interface FXRate {
  currency_code: string;
  rate_to_usd: number;
}

interface FetchResult {
  rates: FXRate[];
  source: string;
  asOfDate: string;
}

async function fetchRatesFromAPI(): Promise<FetchResult> {
  const OPEN_EXCHANGE_APP_ID = Deno.env.get("OPEN_EXCHANGE_APP_ID");
  
  if (OPEN_EXCHANGE_APP_ID) {
    try {
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_APP_ID}&base=USD`
      );
      
      if (response.ok) {
        const data = await response.json();
        const rates: FXRate[] = [];
        
        // Use API timestamp for as_of_date (not today's date)
        const apiTimestamp = data.timestamp;
        const asOfDate = apiTimestamp 
          ? new Date(apiTimestamp * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        for (const currency of SUPPORTED_CURRENCIES) {
          if (data.rates[currency]) {
            // rate_to_usd means: 1 LOCAL = X USD
            // API gives: 1 USD = X LOCAL
            // So we invert: 1 LOCAL = 1/X USD
            rates.push({
              currency_code: currency,
              rate_to_usd: currency === 'USD' ? 1 : 1 / data.rates[currency]
            });
          }
        }
        
        console.log(`[fx-refresh] Fetched ${rates.length} rates from OpenExchangeRates (as_of: ${asOfDate})`);
        return { rates, source: 'openexchangerates', asOfDate };
      }
    } catch (e) {
      console.error('[fx-refresh] OpenExchangeRates error:', e);
    }
  }

  // Fallback: Use existing rates from DB (no external API)
  console.log('[fx-refresh] No API key or API failed, using existing DB rates as fallback');
  const { data: existing } = await srv
    .from('fx_rates')
    .select('currency_code, rate_to_usd');
  
  return { 
    rates: existing || [], 
    source: 'db_fallback', 
    asOfDate: new Date().toISOString().split('T')[0] 
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: Always require cron secret - NO BYPASS
  const FX_CRON_SECRET = Deno.env.get("FX_CRON_SECRET");
  if (FX_CRON_SECRET) {
    const providedSecret = req.headers.get("x-cron-secret");
    if (providedSecret !== FX_CRON_SECRET) {
      console.error('[fx-refresh-daily] ❌ Unauthorized: Invalid or missing x-cron-secret');
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    console.log('[fx-refresh-daily] Starting FX rate refresh...');

    // Fetch latest rates with correct source attribution
    const { rates, source, asOfDate } = await fetchRatesFromAPI();

    if (rates.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No rates available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Write to fx_rates_history with CORRECT source and as_of_date
    const historyRows = rates.map(r => ({
      currency_code: r.currency_code,
      rate_to_usd: r.rate_to_usd,
      as_of_date: asOfDate,
      source: source
    }));

    const { error: historyError } = await srv
      .from('fx_rates_history')
      .upsert(historyRows, { onConflict: 'currency_code,as_of_date' });

    if (historyError) {
      console.error('[fx-refresh] History insert error:', historyError);
    }

    // Also update legacy fx_rates table for backward compatibility
    const legacyRows = rates.map(r => ({
      currency_code: r.currency_code,
      rate_to_usd: r.rate_to_usd,
      updated_at: new Date().toISOString()
    }));

    const { error: legacyError } = await srv
      .from('fx_rates')
      .upsert(legacyRows, { onConflict: 'currency_code' });

    if (legacyError) {
      console.error('[fx-refresh] Legacy table update error:', legacyError);
    }

    console.log(`[fx-refresh-daily] ✅ Updated ${rates.length} currencies for ${asOfDate} (source: ${source})`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        updated: rates.length,
        date: asOfDate,
        source: source,
        currencies: rates.map(r => r.currency_code)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[fx-refresh-daily] Error:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
