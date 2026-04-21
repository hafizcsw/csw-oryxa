import { motion } from "framer-motion";
import { ScanLine, Sparkles, UserCheck, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function PostUploadSteps() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: ScanLine,
      titleKey: "step1_title",
      titleDefault: "We read the document",
      descKey: "step1_desc",
      descDefault: "Smart OCR understands any format",
    },
    {
      icon: Sparkles,
      titleKey: "step2_title",
      titleDefault: "We extract your data",
      descKey: "step2_desc",
      descDefault: "Name, dates, grades, major",
    },
    {
      icon: UserCheck,
      titleKey: "step3_title",
      titleDefault: "We build your file",
      descKey: "step3_desc",
      descDefault: "A unified profile sent to universities",
    },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="p-4"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {t("portal.uploadHub.after_upload.title", { defaultValue: "What happens after upload?" })}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1">
        {steps.map((step, idx) => (
          <div key={step.titleKey} className="flex items-center gap-2 flex-1">
            <div className="flex items-start gap-2.5 flex-1 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-foreground leading-tight">
                  <span className="text-primary me-1">{idx + 1}.</span>
                  {t(`portal.uploadHub.after_upload.${step.titleKey}`, { defaultValue: step.titleDefault })}
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {t(`portal.uploadHub.after_upload.${step.descKey}`, { defaultValue: step.descDefault })}
                </div>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden sm:block rtl:rotate-180" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
