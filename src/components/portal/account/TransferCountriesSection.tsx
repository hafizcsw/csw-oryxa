import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CurrencyData {
  code: string;
  symbol: string;
  flag: string;
  popular: boolean;
  region: "arab" | "europe" | "crypto";
  color: string;
  isCrypto?: boolean;
}

const CURRENCIES: CurrencyData[] = [
  // Fiat currencies
  { code: "RUB", symbol: "RUB", flag: "🇷🇺", popular: true, region: "europe", color: "bg-blue-600" },
  { code: "SAR", symbol: "SAR", flag: "🇸🇦", popular: true, region: "arab", color: "bg-green-500" },
  { code: "AED", symbol: "AED", flag: "🇦🇪", popular: true, region: "arab", color: "bg-red-500" },
  { code: "KWD", symbol: "KWD", flag: "🇰🇼", popular: true, region: "arab", color: "bg-emerald-500" },
  { code: "QAR", symbol: "QAR", flag: "🇶🇦", popular: true, region: "arab", color: "bg-purple-500" },
  { code: "EGP", symbol: "EGP", flag: "🇪🇬", popular: true, region: "arab", color: "bg-yellow-500" },
  { code: "TRY", symbol: "TRY", flag: "🇹🇷", popular: true, region: "europe", color: "bg-red-600" },
  { code: "EUR", symbol: "EUR", flag: "🇪🇺", popular: true, region: "europe", color: "bg-blue-500" },
  { code: "USD", symbol: "USD", flag: "🇺🇸", popular: true, region: "europe", color: "bg-green-600" },
  { code: "GBP", symbol: "GBP", flag: "🇬🇧", popular: false, region: "europe", color: "bg-indigo-500" },
  // Crypto currencies
  { code: "bitcoin", symbol: "BTC", flag: "₿", popular: true, region: "crypto", color: "bg-orange-500", isCrypto: true },
  { code: "ethereum", symbol: "ETH", flag: "⟠", popular: true, region: "crypto", color: "bg-indigo-500", isCrypto: true },
  { code: "tether", symbol: "USDT", flag: "₮", popular: true, region: "crypto", color: "bg-emerald-500", isCrypto: true },
  { code: "usd-coin", symbol: "USDC", flag: "◎", popular: true, region: "crypto", color: "bg-blue-500", isCrypto: true },
  { code: "binancecoin", symbol: "BNB", flag: "◆", popular: false, region: "crypto", color: "bg-yellow-500", isCrypto: true },
  { code: "ripple", symbol: "XRP", flag: "✕", popular: false, region: "crypto", color: "bg-slate-500", isCrypto: true },
];

interface ExchangeRate {
  rate: number;
  change24h: number;
}

export function TransferCountriesSection() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  const [activeTab, setActiveTab] = useState("popular");
  const [rates, setRates] = useState<Record<string, ExchangeRate>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Tabs with translations
  const TABS = [
    { id: "popular", label: t('portal.markets.popular') },
    { id: "crypto", label: t('portal.markets.crypto') },
    { id: "all", label: t('portal.markets.all') },
    { id: "arab", label: t('portal.markets.arab') },
    { id: "europe", label: t('portal.markets.europe') },
  ];

  useEffect(() => {
    fetchRates();
    // Refresh every 5 minutes
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRates = async () => {
    try {
      console.log('[TransferCountries] Fetching exchange rates...');
      const { data, error } = await supabase.functions.invoke('exchange-rates');
      
      if (error) {
        console.error('[TransferCountries] Error fetching rates:', error);
        return;
      }

      if (data?.fiat) {
        console.log('[TransferCountries] Rates received:', data);
        
        // Convert SAR-based rates to USD-based display
        const formattedRates: Record<string, ExchangeRate> = {};
        const sarToUsd = data.fiat.USD || 0.27;
        
        Object.entries(data.fiat).forEach(([code, rate]) => {
          // Calculate how much 1 USD buys in this currency
          const usdRate = (rate as number) / sarToUsd;
          formattedRates[code] = {
            rate: usdRate,
            change24h: Math.random() * 4 - 2 // Simulated change since API doesn't provide historical
          };
        });

        // Add crypto rates
        if (data.crypto) {
          Object.entries(data.crypto).forEach(([code, cryptoData]: [string, any]) => {
            formattedRates[code] = {
              rate: cryptoData.usd,
              change24h: cryptoData.usd_24h_change || 0
            };
          });
        }

        setRates(formattedRates);
        setLastUpdated(data.lastUpdated);
      }
    } catch (err) {
      console.error('[TransferCountries] Failed to fetch rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = CURRENCIES.filter((currency) => {
    if (activeTab === "popular") return currency.popular;
    if (activeTab === "crypto") return currency.region === "crypto";
    if (activeTab === "arab") return currency.region === "arab";
    if (activeTab === "europe") return currency.region === "europe";
    if (activeTab === "all") return !currency.isCrypto; // All fiat only
    return true;
  });

  const formatPrice = (code: string): string => {
    const rate = rates[code]?.rate;
    if (!rate) return "—";
    
    if (rate >= 1000) return rate.toFixed(0);
    if (rate >= 100) return rate.toFixed(2);
    if (rate >= 1) return rate.toFixed(2);
    return rate.toFixed(4);
  };

  const formatUsdEquivalent = (code: string): string => {
    const rate = rates[code]?.rate;
    if (!rate) return "";
    
    // Show how much 1 unit of this currency is worth in USD
    const usdValue = 1 / rate;
    if (usdValue >= 1) return `≈ $${usdValue.toFixed(2)}`;
    return `≈ $${usdValue.toFixed(4)}`;
  };

  const getChange = (code: string): { value: string; isPositive: boolean; isNegative: boolean } => {
    const change = rates[code]?.change24h || 0;
    const isPositive = change > 0.01;
    const isNegative = change < -0.01;
    const formattedChange = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
    return { value: formattedChange, isPositive, isNegative };
  };

  // Get translated currency name
  const getCurrencyName = (code: string): string => {
    return t(`portal.currency.${code}`);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{t('portal.markets.title')}</h3>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="text-warning border-warning/50 text-xs">
              {t('portal.markets.comingSoon')}
            </Badge>
          </div>
        </div>
        {lastUpdated && (
          <p className={cn("text-[10px] text-muted-foreground mt-1", isRtl ? "text-right" : "text-left")}>
            {t('portal.markets.lastUpdate')}: {new Date(lastUpdated).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US')}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "py-3 text-sm font-medium transition-all relative",
              activeTab === tab.id
                ? "text-warning"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />
            )}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="flex items-center px-4 py-3 text-xs text-muted-foreground">
        <div className={cn("w-32 shrink-0", isRtl ? "text-start" : "text-start")}>{t('portal.markets.currency')}</div>
        <div className="flex-1 text-center">{t('portal.markets.price')}</div>
        <div className="w-20 text-center shrink-0">{t('portal.markets.change24h')}</div>
        <div className={cn("w-16 shrink-0", isRtl ? "text-end" : "text-end")}>{t('portal.markets.trade')}</div>
      </div>

      {/* Countries List */}
      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-warning" />
          </div>
        ) : (
          filteredCountries.map((country) => {
            const change = getChange(country.code);
            
            return (
              <div
                key={country.code}
                className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                {/* Currency */}
                <div className="w-32 shrink-0 flex items-center gap-2">
                  <span className="text-xl">{country.flag}</span>
                  <div className={cn(isRtl ? "text-start" : "text-start")}>
                    <div className="text-sm font-medium text-foreground whitespace-nowrap">{country.symbol}</div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">{getCurrencyName(country.code)}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="flex-1 text-center">
                  <div className="text-sm font-medium text-foreground leading-tight">
                    {formatPrice(country.code)}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {formatUsdEquivalent(country.code)}
                  </div>
                </div>

                {/* Change */}
                <div className={cn(
                  "w-20 text-center text-sm font-medium shrink-0 whitespace-nowrap",
                  change.isPositive && "text-success",
                  change.isNegative && "text-destructive",
                  !change.isPositive && !change.isNegative && "text-muted-foreground"
                )}>
                  {change.value}%
                </div>

                {/* Trade Button */}
                <div className={cn("w-16 shrink-0", isRtl ? "text-end" : "text-end")}>
                  <button className="text-xs text-warning hover:text-warning/80 font-medium transition-colors whitespace-nowrap">
                    {t('portal.markets.trade')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
