import { Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconBox } from "@/components/ui/icon-box";
import { useLanguage } from "@/contexts/LanguageContext";

interface WalletWidgetProps {
  balanceSAR: number;
  balanceUSD?: number;
  pendingAmount?: number;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onViewDetails?: () => void;
}

export function WalletWidget({
  balanceSAR = 0,
  balanceUSD,
  pendingAmount = 0,
  onDeposit,
  onWithdraw,
  onViewDetails,
}: WalletWidgetProps) {
  const [showBalance, setShowBalance] = useState(true);
  const { t } = useLanguage();

  const formatCurrency = (amount: number, currency: string = 'SAR') => {
    if (!showBalance) return '••••••';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const calculatedUSD = balanceUSD ?? balanceSAR / 3.75;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconBox icon={Wallet} size="sm" variant="primary" />
          <span className="font-semibold text-foreground">{t('portal.wallet.estimatedBalance')}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setShowBalance(!showBalance)}
        >
          {showBalance ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-3xl font-bold text-foreground mb-1">
          {formatCurrency(balanceSAR, 'SAR')}
        </p>
        <p className="text-sm text-muted-foreground">
          ≈ {formatCurrency(calculatedUSD, 'USD')}
        </p>
      </div>

      {/* Pending */}
      {pendingAmount > 0 && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-warning/10 rounded-lg">
          <span className="text-xs text-warning">{t('portal.wallet.pending')}:</span>
          <span className="text-xs font-medium text-warning">
            {formatCurrency(pendingAmount, 'SAR')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2"
          onClick={onDeposit}
        >
          <ArrowDownToLine className="h-4 w-4" />
          {t('portal.wallet.deposit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2"
          onClick={onWithdraw}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          {t('portal.wallet.withdraw')}
        </Button>
      </div>

      {/* View details link */}
      <Button
        variant="link"
        size="sm"
        className="w-full mt-3 text-muted-foreground hover:text-foreground"
        onClick={onViewDetails}
      >
        {t('portal.wallet.viewDetails')}
      </Button>
    </div>
  );
}
