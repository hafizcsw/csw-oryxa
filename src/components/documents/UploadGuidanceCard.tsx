import { motion } from "framer-motion";
import { FolderOpen, IdCard, GraduationCap, Languages, FileText, ShieldCheck, Files, HardDrive, Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function UploadGuidanceCard() {
  const { t } = useLanguage();

  const examples = [
    { icon: IdCard, key: "passport", defaultValue: "Passport / National ID" },
    { icon: GraduationCap, key: "transcripts", defaultValue: "Certificates & transcripts" },
    { icon: Languages, key: "language", defaultValue: "Language tests (IELTS, TOEFL...)" },
    { icon: FileText, key: "cv", defaultValue: "CV / recommendation letters" },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <FolderOpen className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {t("portal.uploadHub.title", { defaultValue: "Upload Documents" })}
            </h2>
            <p className="text-[12px] text-muted-foreground line-clamp-1">
              {t("portal.uploadHub.guidance.subtitle", {
                defaultValue: "Upload your academic and personal documents to auto-build your smart profile",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium whitespace-nowrap">
            {t("portal.uploadHub.guidance.secure_badge", { defaultValue: "Verified & Encrypted" })}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* What to upload */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("portal.uploadHub.guidance.what_to_upload", { defaultValue: "What you can upload" })}
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {examples.map(({ icon: Icon, key, defaultValue }) => (
              <li
                key={key}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[12px] text-foreground/90 truncate">
                  {t(`portal.uploadHub.guidance.examples.${key}`, { defaultValue })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Formats + size + tip */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-border bg-background/50">
            <Files className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("portal.uploadHub.guidance.formats_label", { defaultValue: "Supported formats" })}
              </div>
              <div className="text-[13px] font-medium text-foreground">
                {t("portal.uploadHub.guidance.formats_value", { defaultValue: "PDF · JPG · PNG · DOCX" })}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-border bg-background/50">
            <HardDrive className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("portal.uploadHub.guidance.size_label", { defaultValue: "Max size" })}
              </div>
              <div className="text-[13px] font-medium text-foreground">
                {t("portal.uploadHub.guidance.size_value", { defaultValue: "20MB per file" })}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-foreground/90 leading-snug">
              {t("portal.uploadHub.guidance.tip", {
                defaultValue: "Tip: upload an original PDF instead of a scanned image for more accurate extraction",
              })}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
