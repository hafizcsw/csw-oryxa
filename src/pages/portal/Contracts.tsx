import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ContractsPage() {
  const { t, language } = useLanguage();
  const [token, setToken] = useState<string>("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";
      setToken(accessToken);

      if (accessToken) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-list`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const json = await res.json();
          setContracts(json.items || []);
        } catch (err) {
          setError(t('portal.contracts.loadError'));
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [t]);

  const handleDownload = async (contractId: string) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-signed-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contract_id: contractId })
      }
    );
    const json = await res.json();
    if (json.url) {
      window.location.href = json.url;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary"> = {
      draft: "secondary",
      signed: "default",
      void: "secondary"
    };
    return <Badge variant={variants[status] || "default"}>{t(`portal.contracts.status.${status}`)}</Badge>;
  };

  const dateLocale = language === 'ar' ? 'ar' : 'en';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t('portal.contracts.title')}</h1>

      {isLoading && <p>{t('common.loading')}</p>}
      {error && <p className="text-destructive">{error}</p>}

      <div className="space-y-4">
        {contracts.map((contract: any) => (
          <Card key={contract.id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t('portal.contracts.statusLabel')}:</span>
                  {getStatusBadge(contract.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('portal.contracts.createdAt')}: {new Date(contract.created_at).toLocaleString(dateLocale)}
                </p>
                {contract.signed_at && (
                  <p className="text-sm text-muted-foreground">
                    {t('portal.contracts.signedAt')}: {new Date(contract.signed_at).toLocaleString(dateLocale)}
                  </p>
                )}
              </div>

              {contract.pdf_path && (
                <Button onClick={() => handleDownload(contract.id)} variant="outline">
                  <Download className="ml-2 h-4 w-4" />
                  {t('portal.contracts.downloadPdf')}
                </Button>
              )}
            </div>
          </Card>
        ))}

        {contracts.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{t('portal.contracts.noContracts')}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
