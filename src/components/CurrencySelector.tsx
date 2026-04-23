import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency, isLoading } = useCurrency();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAr = language === "ar";
  const current = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-xs font-medium"
        aria-label={`Select currency, current: ${current.code}`}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span aria-hidden="true">{current.code}</span>
        {isLoading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
      </button>

      {open && (
        <div className={cn(
          "absolute top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px]",
          isAr ? "right-0" : "left-0"
        )}>
          {SUPPORTED_CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => { setSelectedCurrency(c.code); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                c.code === selectedCurrency && "bg-muted font-semibold text-primary"
              )}
            >
              <span className="text-base">{c.flag}</span>
              <span className="font-mono text-xs">{c.code}</span>
              <span className="text-muted-foreground text-xs flex-1 text-start">
                {isAr ? c.nameAr : c.nameEn}
              </span>
              {c.code === selectedCurrency && <span className="text-primary">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
