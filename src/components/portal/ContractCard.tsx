import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ContractCardProps {
  student: any;
  program?: any;
  payment?: any;
  policy?: any;
  company?: any;
}

export function ContractCard({ student, program, payment, policy, company }: ContractCardProps) {
  const [html, setHtml] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    };
  }

  async function prepareContract() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-prepare`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            student_user_id: student.id,
            program: program || { name: "البرنامج الأكاديمي", country: "الدولة" },
            payment: payment || { amount: "0", currency: "USD" },
            policy: policy || { refund: "حسب السياسة المعتمدة" },
            company: company || { name: "Connect Study World" }
          })
        }
      );

      const result = await response.json();
      if (result.ok) {
        setHtml(result.html);
        setContractId(result.contract_id);
        toast.success("تم إنشاء العقد بنجاح");
      } else if (result.error === 'unauthorized' || result.error === 'invalid_token') {
        toast.error("يرجى تسجيل الدخول أولاً");
      } else if (result.error === 'forbidden') {
        toast.error("ليس لديك صلاحية لإنشاء هذا العقد");
      } else {
        toast.error("فشل إنشاء العقد");
      }
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("يرجى تسجيل الدخول أولاً");
      } else {
        toast.error("حدث خطأ أثناء إنشاء العقد");
      }
    } finally {
      setLoading(false);
    }
  }

  async function signContract() {
    setSigning(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-sign`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            contract_id: contractId,
            method: "clickwrap"
          })
        }
      );

      const result = await response.json();
      if (result.ok) {
        toast.success("تم التوقيع على العقد بنجاح");
      } else if (result.error === 'unauthorized' || result.error === 'invalid_token') {
        toast.error("يرجى تسجيل الدخول أولاً");
      } else if (result.error === 'forbidden') {
        toast.error("ليس لديك صلاحية للتوقيع على هذا العقد");
      } else if (result.error === 'contract_already_signed') {
        toast.error("تم التوقيع على هذا العقد مسبقاً");
      } else {
        toast.error("فشل التوقيع على العقد");
      }
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("يرجى تسجيل الدخول أولاً");
      } else {
        toast.error("حدث خطأ أثناء التوقيع");
      }
    } finally {
      setSigning(false);
    }
  }

  return (
    <Card className="p-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">العقد الإلكتروني</h3>
          <p className="text-sm text-muted-foreground">
            قم بمراجعة والتوقيع على العقد
          </p>
        </div>
      </div>

      {!contractId && (
        <Button
          onClick={prepareContract}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري إنشاء العقد...
            </>
          ) : (
            "إنشاء عقد جديد"
          )}
        </Button>
      )}

      {html && (
        <div className="space-y-4">
          <div
            id="contract-preview"
            className="bg-white border rounded-lg p-6 max-h-96 overflow-y-auto"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['p', 'div', 'span', 'b', 'i', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'strong', 'em', 'hr'],
                ALLOWED_ATTR: ['class', 'style', 'dir', 'align']
              })
            }}
          />

          <Button
            onClick={signContract}
            disabled={signing}
            className="w-full"
          >
            {signing ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التوقيع...
              </>
            ) : (
              <>
                <CheckCircle className="ml-2 h-4 w-4" />
                أُقِرّ وأوقّع
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
