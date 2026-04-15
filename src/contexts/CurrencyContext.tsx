import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", nameAr: "دولار أمريكي", nameEn: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", nameAr: "يورو", nameEn: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", nameAr: "جنيه إسترليني", nameEn: "British Pound", flag: "🇬🇧" },
  { code: "AED", symbol: "د.إ", nameAr: "درهم إماراتي", nameEn: "UAE Dirham", flag: "🇦🇪" },
  { code: "SAR", symbol: "ر.س", nameAr: "ريال سعودي", nameEn: "Saudi Riyal", flag: "🇸🇦" },
  { code: "CNY", symbol: "¥", nameAr: "يوان صيني", nameEn: "Chinese Yuan", flag: "🇨🇳" },
  { code: "TRY", symbol: "₺", nameAr: "ليرة تركية", nameEn: "Turkish Lira", flag: "🇹🇷" },
] as const;

export type SupportedCurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

// Fallback rates (approximate) in case API fails
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.67, SAR: 3.75, CNY: 7.24, TRY: 38.5,
};

type CurrencyContextType = {
  selectedCurrency: SupportedCurrencyCode;
  setSelectedCurrency: (code: SupportedCurrencyCode) => void;
  /** Convert amount from sourceCurrency to selectedCurrency */
  convert: (amount: number, sourceCurrency: string) => number;
  /** Format converted amount with selected currency symbol */
  formatPrice: (amount: number | null | undefined, sourceCurrency?: string | null) => string | null;
  rates: Record<string, number>;
  isLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const STORAGE_KEY = "preferred_currency";
const RATES_CACHE_KEY = "exchange_rates_cache";
const RATES_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<SupportedCurrencyCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) {
        return saved as SupportedCurrencyCode;
      }
    } catch {}
    return "USD";
  });

  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [isLoading, setIsLoading] = useState(false);

  const setSelectedCurrency = useCallback((code: SupportedCurrencyCode) => {
    setSelectedCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  // Fetch live exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      // Check cache first
      try {
        const cached = localStorage.getItem(RATES_CACHE_KEY);
        if (cached) {
          const { rates: cachedRates, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < RATES_CACHE_TTL && cachedRates) {
            setRates(cachedRates);
            return;
          }
        }
      } catch {}

      setIsLoading(true);
      try {
        // Use exchangerate-api (free, no key needed for USD base)
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.result === "success" && data.rates) {
          const newRates: Record<string, number> = {};
          for (const c of SUPPORTED_CURRENCIES) {
            newRates[c.code] = data.rates[c.code] || FALLBACK_RATES[c.code] || 1;
          }
          // Also store common source currencies for conversion
          const extraCurrencies = ["RUB", "KZT", "EGP", "JOD", "KWD", "QAR", "BHD", "OMR", "MAD", "MYR", "SGD", "CAD", "AUD", "JPY", "KRW", "INR", "THB"];
          for (const code of extraCurrencies) {
            if (data.rates[code]) newRates[code] = data.rates[code];
          }
          setRates(newRates);
          try {
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: newRates, timestamp: Date.now() }));
          } catch {}
        }
      } catch (err) {
        console.warn("[CurrencyContext] Failed to fetch rates, using fallback:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRates();
  }, []);

  const convert = useCallback((amount: number, sourceCurrency: string): number => {
    const src = sourceCurrency.toUpperCase();
    const dst = selectedCurrency;
    if (src === dst) return amount;

    const srcRate = rates[src];
    const dstRate = rates[dst];
    if (!srcRate || !dstRate) return amount;

    // Convert: source -> USD -> target
    const inUSD = amount / srcRate;
    return inUSD * dstRate;
  }, [selectedCurrency, rates]);

  const formatPrice = useCallback((amount: number | null | undefined, sourceCurrency?: string | null): string | null => {
    if (amount == null) return null;
    if (amount === 0) return "Free";

    const src = sourceCurrency?.toUpperCase() || "USD";
    const converted = convert(amount, src);

    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: selectedCurrency,
        maximumFractionDigits: 0,
      }).format(Math.round(converted));
    } catch {
      return `${Math.round(converted)} ${selectedCurrency}`;
    }
  }, [convert, selectedCurrency]);

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency, convert, formatPrice, rates, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
