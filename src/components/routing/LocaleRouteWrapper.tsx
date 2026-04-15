import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

/**
 * Syncs URL locale segment (currently en/ar) with i18n language state.
 * Additive: non-prefixed routes continue to work unchanged.
 */
export function LocaleRouteWrapper({ children }: { children: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>();
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const routeLocale = (locale || '').toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(routeLocale as any) && language !== routeLocale) {
      setLanguage(routeLocale as any);
    }
  }, [locale, language, setLanguage]);

  return <>{children}</>;
}
