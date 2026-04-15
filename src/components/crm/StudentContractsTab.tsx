import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";

export function StudentContractsTab({ studentUserId }: { studentUserId: string }) {
  const [token, setToken] = useState<string>("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";
      setToken(accessToken);

      if (accessToken) {
        // Load contracts
        const contractsRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-list?student_user_id=${studentUserId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const contractsJson = await contractsRes.json();
        setContracts(contractsJson.items || []);

        // Load translations
        const transRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-list?student_user_id=${studentUserId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const transJson = await transRes.json();
        setTranslations(transJson.items || []);
      }
    };
    loadData();
  }, [studentUserId]);

  const refetchTranslations = async () => {
    if (token) {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-list?student_user_id=${studentUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      setTranslations(json.items || []);
    }
  };

  const handleDownloadContract = async (contractId: string) => {
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
    if (json.url) window.open(json.url, "_blank");
  };

  const handleOpenTranslation = async (path: string) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-signed-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path })
      }
    );
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
  };

  const handleRunTranslations = async () => {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-run`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTimeout(() => refetchTranslations(), 2000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* العقود */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5" />
          <h3 className="text-lg font-semibold">العقود</h3>
        </div>
        
        <div className="space-y-3">
          {contracts.map((contract: any) => (
            <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge>{contract.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(contract.created_at).toLocaleDateString("ar")}
                  </span>
                </div>
              </div>
              {contract.pdf_path && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadContract(contract.id)}
                >
                  <Download className="ml-2 h-4 w-4" />
                  تنزيل
                </Button>
              )}
            </div>
          ))}
          {contracts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد عقود</p>
          )}
        </div>
      </Card>

      {/* الترجمات */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-lg font-semibold">ترجمة المستندات</h3>
          </div>
          <Button size="sm" onClick={handleRunTranslations}>
            تشغيل الترجمة للطلبات المعلقة
          </Button>
        </div>

        <div className="space-y-3">
          {translations.map((trans: any) => (
            <div key={trans.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{trans.doc_kind}</span>
                  <Badge variant={trans.status === "done" ? "default" : "secondary"}>
                    {trans.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(trans.created_at).toLocaleDateString("ar")}
                </span>
                {trans.last_error && (
                  <p className="text-sm text-destructive">خطأ: {trans.last_error}</p>
                )}
              </div>
              {trans.output_pdf_path && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenTranslation(trans.output_pdf_path)}
                >
                  فتح
                </Button>
              )}
            </div>
          ))}
          {translations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد طلبات ترجمة
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
