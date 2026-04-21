import { motion } from "framer-motion";
import { FolderOpen, ShieldCheck, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UploadGuidanceCard() {
  const { t } = useLanguage();

  const examples = [
    { key: "passport", defaultValue: "Passport / National ID" },
    { key: "transcripts", defaultValue: "Certificates & transcripts" },
    { key: "language", defaultValue: "Language tests (IELTS, TOEFL...)" },
    { key: "cv", defaultValue: "CV / recommendation letters" },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30"
    >
      {/* Left: title + inline meta */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 text-primary shrink-0">
          <FolderOpen className="h-3.5 w-3.5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <h2 className="text-[13px] font-semibold text-foreground whitespace-nowrap">
            {t("portal.uploadHub.title", { defaultValue: "Upload Documents" })}
          </h2>
          <span className="text-muted-foreground/60 text-xs">·</span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            PDF · JPG · PNG · DOCX
          </span>
          <span className="text-muted-foreground/60 text-xs">·</span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {t("portal.uploadHub.guidance.size_value", { defaultValue: "20MB per file" })}
          </span>
        </div>
      </div>

      {/* Right: info tooltip + secure badge */}
      <div className="flex items-center gap-2 shrink-0">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("portal.uploadHub.guidance.what_to_upload", { defaultValue: "What you can upload" })}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-[260px]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("portal.uploadHub.guidance.what_to_upload", { defaultValue: "What you can upload" })}
              </div>
              <ul className="space-y-1">
                {examples.map(({ key, defaultValue }) => (
                  <li key={key} className="text-[12px] text-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t(`portal.uploadHub.guidance.examples.${key}`, { defaultValue })}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground leading-snug">
                {t("portal.uploadHub.guidance.tip", {
                  defaultValue: "Tip: upload an original PDF instead of a scanned image for more accurate extraction",
                })}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3 w-3" />
          <span className="text-[10px] font-medium whitespace-nowrap">
            {t("portal.uploadHub.guidance.secure_badge", { defaultValue: "Secure" })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
