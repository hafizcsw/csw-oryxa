import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ApplyPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const [universities, setUniversities] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get universities from query params
    const uniParam = params.get("universities");
    if (uniParam) {
      const uniIds = uniParam.split(",").map(s => s.trim()).filter(Boolean);
      setUniversities(uniIds);
      return;
    }

    // Or load from localStorage shortlist
    const shortlist = JSON.parse(localStorage.getItem("guest_shortlist") || "[]");
    setUniversities(shortlist);
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
      });
      return;
    }

    if (universities.length === 0) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار جامعة واحدة على الأقل",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone: phone || null,
            notes: notes || null,
            country_slug: params.get("country") || null,
            universities,
            student_id: user?.id || null,
          }),
        }
      );

      const data = await res.json();

      if (data.ok) {
        setApplicationId(data.application_id);
        
        // Log telemetry
        import("@/lib/analytics").then(({ track }) => {
          track("apply_submitted", { 
            application_id: data.application_id, 
            universities: universities.length 
          });
        });
        
        toast({
          title: "تم إرسال الطلب بنجاح ✓",
          description: "سنتواصل معك قريبًا",
        });

        // Clear shortlist
        localStorage.removeItem("guest_shortlist");
      } else {
        throw new Error(data.error || "فشل في إرسال الطلب");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الإرسال",
        description: error.message || "حدث خطأ أثناء إرسال الطلب",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (applicationId) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="p-12 text-center max-w-md">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4">تم إرسال طلبك بنجاح!</h1>
            <p className="text-muted-foreground mb-2">
              رقم الطلب: <span className="font-mono">{applicationId}</span>
            </p>
            <p className="text-muted-foreground mb-8">
              سيتواصل معك فريقنا قريبًا عبر البريد الإلكتروني أو الهاتف
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate("/")}>
                العودة للرئيسية
              </Button>
              <Button variant="outline" onClick={() => navigate("/universities?tab=programs")}>
                تصفح الجامعات
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="container mx-auto px-6 py-12 max-w-3xl">
          <Card className="p-8">
            <h1 className="text-3xl font-bold mb-2">طلب تقديم</h1>
            <p className="text-muted-foreground mb-8">
              الجامعات المختارة: {universities.length} {universities.length === 1 ? "جامعة" : "جامعات"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fullName">الاسم الكامل *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+905555555555"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">ملاحظات إضافية</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أخبرنا المزيد عن اهتماماتك أو أي أسئلة لديك..."
                  rows={4}
                />
              </div>

              {/* Legal Consent Section */}
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("legal.dataSharing.title")}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("legal.dataSharing.description")}
                </p>

                <div className="flex items-start space-x-2 space-x-reverse">
                  <Checkbox id="data_sharing_consent" required />
                  <label htmlFor="data_sharing_consent" className="text-sm leading-relaxed cursor-pointer">
                    {t("legal.dataSharing.consentLabel")}
                    <span className="text-destructive"> *</span>
                  </label>
                </div>

                <div className="flex items-start space-x-2 space-x-reverse">
                  <Checkbox id="privacy_policy_consent" required />
                  <label htmlFor="privacy_policy_consent" className="text-sm leading-relaxed cursor-pointer">
                    {t("legal.privacyConsent.label")}
                    <span className="text-destructive"> *</span>
                    {" — "}
                    <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
                      {t("legal.privacyConsent.link")}
                    </Link>
                  </label>
                </div>

                <div className="flex items-start space-x-2 space-x-reverse">
                  <Checkbox id="whatsapp_opt_in" />
                  <label htmlFor="whatsapp_opt_in" className="text-sm leading-relaxed cursor-pointer">
                    {t("legal.whatsappOptIn.label")}
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || universities.length === 0}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جارٍ الإرسال...
                    </>
                  ) : (
                    "إرسال الطلب"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => navigate("/universities?tab=programs")}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
