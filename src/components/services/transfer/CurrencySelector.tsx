import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Currency {
  code: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  rate: number;
  type?: "fiat" | "crypto";
  usdPrice?: number;
  change24h?: number;
}

interface CurrencySelectorProps {
  currencies: Currency[];
  selected: Currency;
  onSelect: (currency: Currency) => void;
  isRTL: boolean;
  showPrices?: boolean;
}

export function CurrencySelector({ currencies, selected, onSelect, isRTL, showPrices }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);

  const isCrypto = selected.type === "crypto";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-12 min-w-[120px] justify-between gap-2 bg-muted/50 dark:bg-white/10 border-border dark:border-white/20 hover:bg-muted dark:hover:bg-white/20 hover:border-border dark:hover:border-white/30 transition-all text-foreground",
            isCrypto && "bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border-amber-500/30 dark:border-amber-500/30"
          )}
        >
          <span className={cn(
            "text-xl",
            isCrypto && "bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-bold"
          )}>
            {selected.flag}
          </span>
          <span className="font-bold">{selected.code}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[240px] p-2 bg-card dark:bg-slate-900/95 backdrop-blur-xl border-border dark:border-white/10 shadow-2xl" 
        align="end"
      >
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {currencies.map((currency) => {
            const isCryptoCurrency = currency.type === "crypto";
            const change = currency.change24h || 0;
            
            return (
              <button
                key={currency.code}
                onClick={() => {
                  onSelect(currency);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  "hover:bg-muted dark:hover:bg-white/10 text-left",
                  selected.code === currency.code && "bg-primary/20 dark:bg-violet-500/20 border border-primary/30 dark:border-violet-500/30",
                  isCryptoCurrency && "hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-orange-500/10"
                )}
              >
                <span className={cn(
                  "text-xl",
                  isCryptoCurrency && "bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-bold"
                )}>
                  {currency.flag}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{currency.code}</p>
                    {isCryptoCurrency && showPrices && currency.usdPrice && (
                      <span className="text-xs text-muted-foreground">
                        ${currency.usdPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {isRTL ? currency.nameAr : currency.nameEn}
                  </p>
                </div>
                
                {/* 24h change for crypto */}
                {isCryptoCurrency && showPrices && change !== 0 && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    change >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(change).toFixed(1)}%
                  </div>
                )}
                
                {selected.code === currency.code && (
                  <Check className="h-4 w-4 text-primary dark:text-violet-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
