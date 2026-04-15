import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
      setCheckingSession(false);
    });

    // Also check URL hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecoveryMode(true);
    }

    // Timeout fallback
    const timer = setTimeout(() => setCheckingSession(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: t("auth.error"),
        description: t("auth.error.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("auth.error"),
        description: t("auth.error.passwordTooShort"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: t("auth.passwordResetSuccess"),
        description: t("auth.passwordResetSuccessDesc"),
      });

      setTimeout(() => navigate("/"), 2000);
    } catch (error: any) {
      toast({
        title: t("auth.error"),
        description: error.message || t("auth.error.unexpected"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isRecoveryMode) {
    return (
      <Layout>
        <section className="max-w-md mx-auto px-4 py-12">
          <div className="rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">{t("auth.invalidResetLink")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.invalidResetLinkDesc")}
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              {t("auth.backToHome")}
            </Button>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold mb-2">{t("auth.resetPassword")}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {t("auth.resetPasswordDesc")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("auth.newPassword")}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                className="text-left"
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("auth.confirmNewPassword")}
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                className="text-left"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t("auth.processing")}
                </>
              ) : (
                t("auth.updatePassword")
              )}
            </Button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
