import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Languages, FileText, GraduationCap, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TranslationCardProps {
  student: any;
}

export function TranslationCard({ student }: TranslationCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function requestTranslation(kind: string) {
    setLoading(kind);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("يجب تسجيل الدخول أولاً");
        return;
      }

      const inputPath = prompt("أدخل مسار المستند (أو اتركه فارغاً)") || "";

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            student_user_id: student.id,
            doc_kind: kind,
            input_path: inputPath,
            source_lang: "ar",
            target_lang: "en",
            provider: "simple_bot"
          })
        }
      );

      const result = await response.json();
      if (result.ok) {
        toast.success("تم إنشاء طلب الترجمة بنجاح");
      } else {
        toast.error(result.error || "فشل إنشاء طلب الترجمة");
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء إنشاء الطلب");
    } finally {
      setLoading(null);
    }
  }

  const docTypes = [
    { kind: "passport", label: "جواز السفر", icon: FileText },
    { kind: "highschool", label: "شهادة الثانوية", icon: GraduationCap },
    { kind: "residency", label: "إثبات الإقامة", icon: Home }
  ];

  return (
    <Card className="p-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Languages className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">الترجمة الاحترافية</h3>
          <p className="text-sm text-muted-foreground">
            ترجمة المستندات بقالب نوتاريوس معتمد
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {docTypes.map(({ kind, label, icon: Icon }) => (
          <Button
            key={kind}
            onClick={() => requestTranslation(kind)}
            disabled={loading === kind}
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
          >
            {loading === kind ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
            <span className="text-sm">{label}</span>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        بعد الإنشاء، قم بتشغيل معالج الترجمة لإنتاج الملف النهائي
      </p>
    </Card>
  );
}
