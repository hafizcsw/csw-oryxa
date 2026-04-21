import { motion } from "framer-motion";
import { ScanLine, Sparkles, UserCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function PostUploadSteps() {
  const { t } = useLanguage();

  const steps = [
    { icon: ScanLine, key: "step1", titleDefault: "Read", descDefault: "Smart OCR" },
    { icon: Sparkles, key: "step2", titleDefault: "Extract", descDefault: "Name, grades, major" },
    { icon: UserCheck, key: "step3", titleDefault: "Build", descDefault: "Unified profile" },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
      className="flex items-center gap-2 px-4 py-2 bg-muted/20 overflow-x-auto"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap me-1">
        {t("portal.uploadHub.after_upload.title", { defaultValue: "After upload" })}:
      </span>
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
            {idx + 1}
          </span>
          <step.icon className="h-3 w-3 text-primary/80" />
          <span className="text-[11px] font-medium text-foreground">
            {t(`portal.uploadHub.after_upload.${step.key}_title`, { defaultValue: step.titleDefault })}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({t(`portal.uploadHub.after_upload.${step.key}_desc`, { defaultValue: step.descDefault })})
          </span>
          {idx < steps.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
        </div>
      ))}
    </motion.div>
  );
}
