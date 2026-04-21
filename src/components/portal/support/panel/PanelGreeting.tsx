import { useLanguage } from "@/contexts/LanguageContext";

interface PanelGreetingProps {
  name: string | null;
}

export function PanelGreeting({ name }: PanelGreetingProps) {
  const { t } = useLanguage();
  const display = name ?? t("portal.support.panel.greetingFallback");
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
        {name ? t("portal.support.panel.greeting", { name: display }) : display}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("portal.support.panel.subtitle")}
      </p>
    </div>
  );
}
