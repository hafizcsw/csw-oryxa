import { Home, Copy, Check, Wallet, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface AccountTopBarProps {
  phone?: string | null;
  walletBalance?: number;
  walletCurrency?: string;
  onWalletClick?: () => void;
  onSettingsClick?: () => void;
}

export function AccountTopBar({
  phone,
  walletBalance = 0,
  walletCurrency = "SAR",
  onWalletClick,
  onSettingsClick
}: AccountTopBarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [copied, setCopied] = useState(false);
  const displayId = phone || "---";
  
  const handleCopyId = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast({
        title: t('portal.topbar.copied'),
        description: t('portal.topbar.idCopied')
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t('portal.topbar.error'),
        description: t('portal.topbar.copyFailed'),
        variant: "destructive"
      });
    }
  };

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-4">
      {/* Home Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate("/")} 
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">{t('portal.topbar.home')}</span>
      </Button>

      {/* Wallet Badge & Student ID */}
      <div className="flex items-center gap-2">
        {/* Settings Button */}
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 hover:bg-muted px-3 py-2 rounded-lg"
          onClick={onSettingsClick}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* Wallet Balance */}
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 hover:bg-primary/10 dark:hover:bg-primary/20 px-3 py-2 rounded-lg"
          onClick={onWalletClick}
        >
          <Wallet className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">
            ${formatBalance(walletBalance)}
          </span>
        </Button>

        {/* Student ID */}
        <div className="flex items-center gap-2">
          {phone && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={handleCopyId}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
