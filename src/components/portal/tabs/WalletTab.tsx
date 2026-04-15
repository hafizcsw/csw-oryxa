import { Construction, Wallet } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function WalletTab() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-muted/30 p-8 flex flex-col items-center justify-center text-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t('wallet.comingSoonTitle')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('wallet.comingSoonDesc')}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <Construction className="w-4 h-4" />
          <span>{t('wallet.underDevelopment')}</span>
        </div>
      </div>
    </div>
  );
}
