import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const EDGE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ApplyV2() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString().toLowerCase() || "";
    const full_name = formData.get("student_name")?.toString() || "";
    const phone = formData.get("phone")?.toString() || null;
    const program_id = formData.get("program_id")?.toString() || null;

    // Track CTA click
    try {
      await fetch(`${EDGE_URL}/functions/v1/log-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "cta_apply_click",
          visitor_id: localStorage.getItem("visitor_id"),
          properties: { page: "apply-v2" },
        }),
      }).catch(() => null);
    } catch {}

    try {
      // ✅ الحصول على user_id إذا كان مُسجّل الدخول
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;

      // Call web-application-submit to create application and sync with CRM
      const res = await fetch(`${EDGE_URL}/functions/v1/web-application-submit`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          user_id: user_id || undefined,
          visitor_id: localStorage.getItem("visitor_id"),
          full_name,
          email,
          phone,
          program_ids: program_id ? [program_id] : [],
          language: 'ar',
        }),
      });

      const data = await res.json();
      setResponse(data);

      if (data?.ok && data?.action_link) {
        setSuccess(true);
        
        // Track successful submission
        try {
          await fetch(`${EDGE_URL}/functions/v1/log-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "lead_submitted",
              visitor_id: localStorage.getItem("visitor_id"),
              properties: { email, program: program_id },
            }),
          }).catch(() => null);
        } catch {}

        // Redirect to portal with magic link (session established)
        setTimeout(() => {
          window.location.href = data.action_link;
        }, 1500);
      } else {
        setSuccess(false);
      }
    } catch (err) {
      console.error("Submission error:", err);
      setResponse({ ok: false, error: String(err) });
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="p-6">
        <h1 className="text-3xl font-display font-bold mb-6 text-foreground">
          Submit Application (v2)
        </h1>

        {success && response && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              تم إرسال طلبك بنجاح! جاري تحويلك إلى بوابة الطالب...
            </AlertDescription>
          </Alert>
        )}

        {!success && response?.error && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Error: {response.error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <Input
              name="student_name"
              placeholder="Enter your full name"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Phone (Optional)
            </label>
            <Input
              name="phone"
              type="tel"
              placeholder="+1234567890"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Program ID (Optional)
            </label>
            <Input
              name="program_id"
              placeholder="Leave blank for general inquiry"
              disabled={loading}
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

            <div className="flex items-start space-x-2">
              <Checkbox id="data_sharing_consent" required disabled={loading} />
              <label htmlFor="data_sharing_consent" className="text-sm leading-relaxed cursor-pointer">
                {t("legal.dataSharing.consentLabel")}
                <span className="text-destructive"> *</span>
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="privacy_consent" name="privacy_consent" required disabled={loading} />
              <label htmlFor="privacy_consent" className="text-sm leading-relaxed cursor-pointer">
                {t("legal.privacyConsent.label")}
                <span className="text-destructive"> *</span>
                {" — "}
                <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
                  {t("legal.privacyConsent.link")}
                </Link>
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="whatsapp_opt_in" name="whatsapp_opt_in" disabled={loading} />
              <label htmlFor="whatsapp_opt_in" className="text-sm leading-relaxed cursor-pointer">
                {t("legal.whatsappOptIn.label")}
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </form>

        {response && (
          <details className="mt-6 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Debug Response
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}
