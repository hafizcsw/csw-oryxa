import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { DSButton } from "@/components/design-system/DSButton";
import { Upload, CheckCircle, AlertCircle, Loader2, Calendar, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { CourseProduct, CourseCohort } from "@/hooks/useCourseProducts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  products: CourseProduct[];
  cohorts: CourseCohort[];
  onSuccess: () => void;
  languageKey?: string;
}

export function CourseEnrollmentModal({ open, onClose, products, cohorts, onSuccess, languageKey = "russian" }: Props) {
  const { t, language } = useLanguage();
  const displayLocale = language || "en";

  const [step, setStep] = useState<"select" | "upload" | "done">("select");
  const [selectedProduct, setSelectedProduct] = useState<CourseProduct | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<CourseCohort | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("select");
      setSelectedProduct(null);
      setSelectedCohort(cohorts[0] || null);
      setProofFile(null);
      setProofPreview(null);
    }
  }, [open, cohorts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("languages.enrollment.fileTooLarge"));
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedCohort) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      toast.error(t("languages.enrollment.loginRequired"));
      return;
    }

    setSubmitting(true);
    try {
      let proofUrl: string | null = null;
      let proofStatus = "no_proof";

      if (proofFile) {
        const ext = proofFile.name.split(".").pop() || "png";
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, proofFile, { contentType: proofFile.type });

        if (uploadErr) throw uploadErr;
        proofUrl = path;
        proofStatus = "proof_uploaded";
      }

      const { error } = await supabase
        .from("language_course_enrollments")
        .insert({
          user_id: session.user.id,
          language_key: languageKey,
          product_id: selectedProduct.id,
          cohort_id: selectedCohort.id,
          course_type: selectedProduct.course_type,
          price_usd: selectedProduct.price_usd,
          payment_method: "bank_transfer",
          proof_url: proofUrl,
          proof_uploaded_at: proofUrl ? new Date().toISOString() : null,
          request_status: proofUrl ? "submitted" : "draft",
          payment_proof_status: proofStatus,
          activation_status: "inactive",
        } as any);

      if (error) throw error;

      setStep("done");
      onSuccess();
      toast.success(t("languages.enrollment.submitted"));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("languages.enrollment.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(displayLocale, { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("languages.enrollment.title")}</DialogTitle>
        </DialogHeader>

        {step === "done" ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-foreground">{t("languages.enrollment.successTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("languages.enrollment.successDesc")}</p>
            <DSButton onClick={onClose}>{t("languages.enrollment.close")}</DSButton>
          </div>
        ) : step === "select" ? (
          <div className="space-y-5">
            {/* Course Type Selection */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {t("languages.enrollment.selectCourse")}
              </label>
              <div className="space-y-2">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={cn(
                      "w-full text-start p-4 rounded-xl border-2 transition-all",
                      selectedProduct?.id === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground text-sm">
                        {p.display_name}
                      </span>
                      <span className="text-primary font-extrabold text-lg">${p.price_usd}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.display_description}
                    </p>
                    {p.duration_months && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <Calendar className="w-3 h-3" />
                        {p.duration_months} {t("languages.enrollment.months")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cohort Selection */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {t("languages.enrollment.selectCohort")}
              </label>
              <div className="space-y-2">
                {cohorts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCohort(c)}
                    className={cn(
                      "w-full text-start p-3 rounded-xl border-2 transition-all",
                      selectedCohort?.id === c.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground text-sm">{formatDate(c.start_date)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {t("languages.enrollment.capacity")}: {c.capacity} · {t("languages.enrollment.minGroup")}: {c.min_to_start}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <DSButton
              className="w-full"
              disabled={!selectedProduct || !selectedCohort}
              onClick={() => setStep("upload")}
            >
              {t("languages.enrollment.next")}
            </DSButton>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("languages.enrollment.courseType")}</span>
                <span className="font-semibold text-foreground">
                  {selectedProduct?.display_name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("languages.enrollment.startDate")}</span>
                <span className="font-semibold text-foreground">{selectedCohort && formatDate(selectedCohort.start_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("languages.enrollment.price")}</span>
                <span className="font-extrabold text-primary text-lg">${selectedProduct?.price_usd}</span>
              </div>
            </div>

            {/* Bank Transfer Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    {t("languages.enrollment.bankTransferOnly")}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t("languages.enrollment.bankTransferDesc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Proof */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {t("languages.enrollment.uploadProof")}
              </label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                  proofFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                )}
                onClick={() => document.getElementById("proof-input")?.click()}
              >
                <input id="proof-input" type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                {proofPreview ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                    <p className="text-sm font-medium text-foreground">{proofFile?.name}</p>
                    <p className="text-xs text-muted-foreground">{t("languages.enrollment.changeFile")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">{t("languages.enrollment.uploadHint")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <DSButton variant="outline" onClick={() => setStep("select")} className="flex-1">
                {t("languages.enrollment.back")}
              </DSButton>
              <DSButton
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {proofFile ? t("languages.enrollment.submitWithProof") : t("languages.enrollment.submitDraft")}
              </DSButton>
            </div>

            {!proofFile && (
              <p className="text-xs text-muted-foreground text-center">
                {t("languages.enrollment.canUploadLater")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
