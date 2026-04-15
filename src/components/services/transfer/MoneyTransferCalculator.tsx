import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, Clock, Shield, Zap, Bell, Check, Lock, RefreshCw, TrendingUp, TrendingDown, Coins, Banknote } from "lucide-react";
import { CurrencySelector, Currency } from "./CurrencySelector";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { cn } from "@/lib/utils";

// Fiat currencies
const fiatCurrencies: Currency[] = [
  { code: "SAR", nameAr: "ريال سعودي", nameEn: "Saudi Riyal", flag: "🇸🇦", rate: 1, type: "fiat" },
  { code: "AED", nameAr: "درهم إماراتي", nameEn: "UAE Dirham", flag: "🇦🇪", rate: 0.98, type: "fiat" },
  { code: "USD", nameAr: "دولار أمريكي", nameEn: "US Dollar", flag: "🇺🇸", rate: 0.27, type: "fiat" },
  { code: "EUR", nameAr: "يورو", nameEn: "Euro", flag: "🇪🇺", rate: 0.24, type: "fiat" },
  { code: "GBP", nameAr: "جنيه إسترليني", nameEn: "British Pound", flag: "🇬🇧", rate: 0.21, type: "fiat" },
  { code: "RUB", nameAr: "روبل روسي", nameEn: "Russian Ruble", flag: "🇷🇺", rate: 24.5, type: "fiat" },
  { code: "TRY", nameAr: "ليرة تركية", nameEn: "Turkish Lira", flag: "🇹🇷", rate: 8.6, type: "fiat" },
  { code: "EGP", nameAr: "جنيه مصري", nameEn: "Egyptian Pound", flag: "🇪🇬", rate: 13.2, type: "fiat" },
  { code: "KWD", nameAr: "دينار كويتي", nameEn: "Kuwaiti Dinar", flag: "🇰🇼", rate: 0.082, type: "fiat" },
  { code: "QAR", nameAr: "ريال قطري", nameEn: "Qatari Riyal", flag: "🇶🇦", rate: 0.97, type: "fiat" },
];

// Crypto currencies
const cryptoCurrencies: Currency[] = [
  { code: "BTC", nameAr: "بيتكوين", nameEn: "Bitcoin", flag: "₿", rate: 0, type: "crypto" },
  { code: "ETH", nameAr: "إيثريوم", nameEn: "Ethereum", flag: "Ξ", rate: 0, type: "crypto" },
  { code: "USDT", nameAr: "تيذر", nameEn: "Tether USDT", flag: "₮", rate: 0, type: "crypto" },
  { code: "USDC", nameAr: "يو إس دي سي", nameEn: "USD Coin", flag: "$", rate: 0, type: "crypto" },
];

const allCurrencies = [...fiatCurrencies, ...cryptoCurrencies];

export function MoneyTransferCalculator() {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { rates, loading, getLastUpdatedText, refetch } = useExchangeRates();
  
  const [sendAmount, setSendAmount] = useState<string>("1000");
  const [sendCurrency, setSendCurrency] = useState<Currency>(fiatCurrencies[0]);
  const [receiveCurrency, setReceiveCurrency] = useState<Currency>(fiatCurrencies[5]);
  const [receiveAmount, setReceiveAmount] = useState<string>("0");
  const [currencyType, setCurrencyType] = useState<"fiat" | "crypto">("fiat");

  // Update currencies with live rates
  const getCurrenciesWithRates = (): Currency[] => {
    const updatedFiat = fiatCurrencies.map(c => ({
      ...c,
      rate: rates.fiat[c.code] || c.rate,
    }));
    
    const updatedCrypto = cryptoCurrencies.map(c => ({
      ...c,
      rate: rates.crypto[c.code]?.sar || 0,
      usdPrice: rates.crypto[c.code]?.usd,
      change24h: rates.crypto[c.code]?.usd_24h_change,
    }));
    
    return currencyType === "fiat" ? updatedFiat : updatedCrypto;
  };

  // Calculate receive amount
  useEffect(() => {
    const amount = parseFloat(sendAmount) || 0;
    
    if (sendCurrency.type === "fiat" && receiveCurrency.type === "fiat") {
      // Fiat to Fiat
      const sendRate = rates.fiat[sendCurrency.code] || sendCurrency.rate;
      const receiveRate = rates.fiat[receiveCurrency.code] || receiveCurrency.rate;
      const result = (amount * receiveRate / sendRate).toFixed(2);
      setReceiveAmount(result);
    } else if (sendCurrency.type === "fiat" && receiveCurrency.type === "crypto") {
      // Fiat to Crypto
      const sendRateInSar = sendCurrency.code === "SAR" ? amount : amount / (rates.fiat[sendCurrency.code] || 1);
      const cryptoSarPrice = rates.crypto[receiveCurrency.code]?.sar || 1;
      const result = (sendRateInSar / cryptoSarPrice).toFixed(8);
      setReceiveAmount(result);
    } else if (sendCurrency.type === "crypto" && receiveCurrency.type === "fiat") {
      // Crypto to Fiat
      const cryptoSarValue = amount * (rates.crypto[sendCurrency.code]?.sar || 0);
      const receiveRate = rates.fiat[receiveCurrency.code] || 1;
      const result = (cryptoSarValue * receiveRate).toFixed(2);
      setReceiveAmount(result);
    } else {
      // Crypto to Crypto
      const sendSarValue = amount * (rates.crypto[sendCurrency.code]?.sar || 0);
      const receiveSarPrice = rates.crypto[receiveCurrency.code]?.sar || 1;
      const result = (sendSarValue / receiveSarPrice).toFixed(8);
      setReceiveAmount(result);
    }
  }, [sendAmount, sendCurrency, receiveCurrency, rates]);

  // Get exchange rate display
  const getExchangeRateText = () => {
    if (sendCurrency.type === "fiat" && receiveCurrency.type === "fiat") {
      const sendRate = rates.fiat[sendCurrency.code] || 1;
      const receiveRate = rates.fiat[receiveCurrency.code] || 1;
      return `1 ${sendCurrency.code} = ${(receiveRate / sendRate).toFixed(4)} ${receiveCurrency.code}`;
    } else if (sendCurrency.type === "fiat" && receiveCurrency.type === "crypto") {
      const sarValue = sendCurrency.code === "SAR" ? 1 : 1 / (rates.fiat[sendCurrency.code] || 1);
      const cryptoAmount = sarValue / (rates.crypto[receiveCurrency.code]?.sar || 1);
      return `1 ${sendCurrency.code} = ${cryptoAmount.toFixed(8)} ${receiveCurrency.code}`;
    } else if (sendCurrency.type === "crypto") {
      const cryptoSarValue = rates.crypto[sendCurrency.code]?.sar || 0;
      return `1 ${sendCurrency.code} = ${cryptoSarValue.toLocaleString()} SAR`;
    }
    return "";
  };

  const getArrivalTime = () => {
    if (receiveCurrency.type === "crypto" || sendCurrency.type === "crypto") {
      return isRTL ? "يصل فوراً (10-30 دقيقة)" : "Instant (10-30 minutes)";
    }
    return isRTL ? "يصل خلال 24-48 ساعة" : "Should arrive in 24-48 hours";
  };

  return (
    <div className="relative">
      {/* Glow effect behind card */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 dark:from-violet-600/20 dark:via-purple-600/20 dark:to-indigo-600/20 blur-xl rounded-3xl" />
      
      {/* Main Card */}
      <div className="relative bg-card/80 dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-border dark:border-white/20 shadow-2xl overflow-hidden">
        
        {/* Live Crypto Ticker */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-red-500/10 border-b border-border dark:border-white/10 overflow-x-auto">
          <div className="flex items-center gap-4 text-xs">
            {Object.entries(rates.crypto).slice(0, 3).map(([code, data]) => (
              <div key={code} className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-bold text-foreground">
                  {code === "BTC" ? "₿" : code === "ETH" ? "Ξ" : "₮"} {code}
                </span>
                <span className="text-muted-foreground">${data.usd.toLocaleString()}</span>
                <span className={cn(
                  "flex items-center gap-0.5",
                  (data.usd_24h_change || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {(data.usd_24h_change || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(data.usd_24h_change || 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <button 
            onClick={refetch}
            className="p-1.5 hover:bg-muted/50 rounded-full transition-colors"
            title={isRTL ? "تحديث الأسعار" : "Refresh rates"}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>

        {/* Guaranteed Rate Badge */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
              {isRTL ? "السعر مضمون لمدة 24 ساعة" : "Guaranteed rate for 24 hours"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {getLastUpdatedText(isRTL)}
          </span>
        </div>

        <div className="p-6">
          {/* Currency Type Tabs */}
          <Tabs value={currencyType} onValueChange={(v) => setCurrencyType(v as "fiat" | "crypto")} className="mb-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 dark:bg-white/5">
              <TabsTrigger value="fiat" className="gap-2 data-[state=active]:bg-card dark:data-[state=active]:bg-white/10">
                <Banknote className="w-4 h-4" />
                {isRTL ? "عملات" : "Fiat"}
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-2 data-[state=active]:bg-card dark:data-[state=active]:bg-white/10">
                <Coins className="w-4 h-4" />
                {isRTL ? "كريبتو" : "Crypto"}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Send Section */}
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">
              {isRTL ? "أنت ترسل" : "You send"}
            </label>
            <div className="flex items-center gap-3 bg-muted/50 dark:bg-white/5 rounded-xl p-3 border border-border dark:border-white/10 focus-within:border-primary/50 dark:focus-within:border-violet-500/50 transition-colors">
              <Input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="flex-1 text-2xl md:text-3xl font-semibold h-12 border-0 bg-transparent p-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
                placeholder="0"
              />
              <CurrencySelector 
                currencies={getCurrenciesWithRates()}
                selected={sendCurrency}
                onSelect={setSendCurrency}
                isRTL={isRTL}
                showPrices={currencyType === "crypto"}
              />
            </div>
          </div>

          {/* Exchange Rate Divider */}
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 dark:bg-white/5 rounded-full border border-border dark:border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 dark:from-violet-500 dark:to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30 dark:shadow-violet-500/30">
                <ArrowDown className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">{getExchangeRateText()}</span>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">{isRTL ? "بدون رسوم" : "No fees"}</span>
              </div>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Receive Section */}
          <div className="mb-6">
            <label className="text-sm text-muted-foreground mb-2 block">
              {isRTL ? "المستلم يحصل على" : "Recipient gets"}
            </label>
            <div className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-violet-500/10 dark:to-purple-500/10 rounded-xl p-3 border border-primary/30 dark:border-violet-500/30">
              <div className="flex-1">
                <span className="text-2xl md:text-4xl font-bold text-foreground" key={receiveAmount}>
                  {receiveCurrency.type === "crypto" 
                    ? parseFloat(receiveAmount).toFixed(8)
                    : parseFloat(receiveAmount).toLocaleString()
                  }
                </span>
                {receiveCurrency.type === "crypto" && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ≈ ${(parseFloat(receiveAmount) * (rates.crypto[receiveCurrency.code]?.usd || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                  </span>
                )}
              </div>
              <CurrencySelector 
                currencies={currencyType === "fiat" ? fiatCurrencies : cryptoCurrencies}
                selected={receiveCurrency}
                onSelect={setReceiveCurrency}
                isRTL={isRTL}
                showPrices={currencyType === "crypto"}
              />
            </div>
            
            {/* Arrival time */}
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{getArrivalTime()}</span>
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            size="lg" 
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary via-primary/90 to-primary dark:from-violet-600 dark:via-purple-600 dark:to-indigo-600 hover:from-primary/90 hover:via-primary/80 hover:to-primary/90 dark:hover:from-violet-500 dark:hover:via-purple-500 dark:hover:to-indigo-500 text-primary-foreground rounded-xl gap-2 shadow-lg shadow-primary/30 dark:shadow-violet-500/30 transition-all duration-300 hover:shadow-primary/50 dark:hover:shadow-violet-500/50 hover:scale-[1.02]"
          >
            <Bell className="w-5 h-5" />
            {isRTL ? "أبلغني عند الإطلاق" : "Notify me when available"}
          </Button>

          {/* Trust badges */}
          <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-border dark:border-white/10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs">{isRTL ? "آمن ومشفر" : "Secure & encrypted"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs">{isRTL ? "تحويل سريع" : "Fast transfer"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
