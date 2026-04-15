import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, UserPlus, LogIn, ShieldCheck, Target, Save, TrendingUp } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getLanguageCourseBaseRoute, getLanguageCoursePlacementTestRoute } from "@/lib/languageCourseConfig";
import { getLanguageCourseAuthRedirect } from "@/lib/languageCourseState";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";

export default function PlacementAuth() {
  const { t, language } = useLanguage();
  const languageKey = "russian";
  const navigate = useNavigate();
  const isAr = language === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;
  const formatBenefit = (key: string) => translateLanguageCourseValue(t, `languages.placementAuth.benefits.${key}`, key);

  // If already authenticated, skip straight to test
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(getLanguageCoursePlacementTestRoute(languageKey), { replace: true });
      }
    });
  }, [navigate]);

  const benefits = [
    { icon: Target, key: "accuratePath" },
    { icon: Save, key: "saveResult" },
    { icon: TrendingUp, key: "trackProgress" },
  ];

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>

            {/* Title */}
            <h1 className="text-xl md:text-2xl font-bold text-foreground text-center mb-2">
              {t("languages.placementAuth.title")}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {t("languages.placementAuth.subtitle")}
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {benefits.map((b) => (
                <div key={b.key} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
                  <b.icon className="w-4.5 h-4.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{formatBenefit(b.key)}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <DSButton
                className="w-full gap-2"
                onClick={() => {
                  localStorage.setItem("auth_redirect", getLanguageCourseAuthRedirect(languageKey));
                  navigate("/auth?mode=signup");
                }}
              >
                <UserPlus className="w-4 h-4" />
                {t("languages.placementAuth.createAccount")}
              </DSButton>

              <DSButton
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  localStorage.setItem("auth_redirect", getLanguageCourseAuthRedirect(languageKey));
                  navigate("/auth?mode=login");
                }}
              >
                <LogIn className="w-4 h-4" />
                {t("languages.placementAuth.signIn")}
              </DSButton>

              <DSButton
                variant="ghost"
                size="sm"
                className="w-full gap-1.5 text-muted-foreground"
                onClick={() => navigate(`${getLanguageCourseBaseRoute(languageKey)}/onboarding`)}
              >
                <BackArrow className="w-4 h-4" />
                {t("languages.placementAuth.back")}
              </DSButton>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
