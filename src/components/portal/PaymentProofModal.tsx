import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileImage,
  X,
  Loader2,
  Check,
  CreditCard,
  Hash,
  DollarSign,
  Calendar,
  User,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { RTL_LANGUAGES } from "@/i18n/languages";

interface PaymentProofModalProps {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  paymentDescription?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  onSuccess: () => void;
}

export function PaymentProofModal({
  open,
  onClose,
  paymentId,
  paymentDescription,
  paymentAmount,
  paymentCurrency,
  onSuccess,
}: PaymentProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isRtl = RTL_LANGUAGES.includes(language as never);

  const checklistItems = [
    { icon: DollarSign, label: t("portal.paymentProof.checklist.amount") },
    { icon: Calendar, label: t("portal.paymentProof.checklist.date") },
    { icon: User, label: t("portal.paymentProof.checklist.sender") },
    { icon: Banknote, label: t("portal.paymentProof.checklist.currency") },
  ];

  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: t("portal.paymentProof.errors.unsupportedTypeTitle"),
        description: t("portal.paymentProof.errors.unsupportedTypeDescription"),
        variant: "destructive",
      });
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({
        title: t("portal.paymentProof.errors.fileTooLargeTitle"),
        description: t("portal.paymentProof.errors.fileTooLargeDescription"),
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: t("portal.paymentProof.errors.noFileTitle"),
        description: t("portal.paymentProof.errors.noFileDescription"),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: t("portal.paymentProof.errors.loginRequiredTitle"), variant: "destructive" });
        return;
      }

      const userId = session.user.id;
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const storagePath = `users/${userId}/payment_proof/${timestamp}_${randomId}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("student-docs").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        console.error("[PaymentProofModal] Upload error:", uploadError);
        toast({
          title: t("portal.paymentProof.errors.uploadFailedTitle"),
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      setUploadProgress(95);

      const proofResult = await supabase.functions.invoke("student-portal-api", {
        body: {
          action: "submit_payment_proof",
          payment_id: paymentId,
          evidence_storage_bucket: "student-docs",
          evidence_storage_path: storagePath,
          payment_method: "bank_transfer",
          payment_reference: reference || undefined,
        },
      });

      setUploadProgress(100);

      if (proofResult.data?.ok) {
        toast({
          title: t("portal.paymentProof.success.title"),
          description: t("portal.paymentProof.success.description"),
        });
        onSuccess();
        handleClose();
      } else {
        throw new Error(proofResult.data?.message || t("portal.paymentProof.errors.submitFailedFallback"));
      }
    } catch (err) {
      console.error("[PaymentProofModal] Error:", err);
      toast({
        title: t("portal.paymentProof.errors.genericTitle"),
        description: err instanceof Error ? err.message : t("portal.paymentProof.errors.genericDescription"),
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setReference("");
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto p-0"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <DialogHeader className={cn("bg-gradient-to-b from-primary/5 to-transparent px-6 pt-6 pb-4", isRtl ? "text-right sm:text-right" : "text-left sm:text-left")}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-4 ring-primary/5">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">{t("portal.paymentProof.title")}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("portal.paymentProof.subtitle")}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <Label className="block text-sm font-semibold">
                {t("portal.paymentProof.fileLabel")} <span className="text-destructive">*</span>
              </Label>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "relative w-full min-h-[200px] rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 cursor-pointer",
                  "flex flex-col items-center justify-center gap-4",
                  dragOver ? "border-primary bg-primary/5 scale-[1.02] shadow-lg" : "border-border hover:border-primary/50 hover:bg-muted/30",
                  file && "bg-success/5 border-success/30 border-solid",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                      <FileImage className="h-7 w-7 text-success" />
                    </div>
                    <div className="text-center min-w-0 w-full px-4">
                      <p className="truncate font-semibold text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className={cn("h-4 w-4", isRtl ? "ml-1" : "mr-1")} />
                      {t("portal.paymentProof.removeFile")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "h-16 w-16 rounded-full bg-muted flex items-center justify-center transition-transform duration-300",
                        dragOver && "scale-110",
                      )}
                    >
                      <Upload
                        className={cn(
                          "h-8 w-8 text-muted-foreground transition-all duration-300",
                          dragOver && "text-primary animate-bounce",
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{t("portal.paymentProof.dropzone.title")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("portal.paymentProof.dropzone.subtitle")}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-1.5">
                      <span>{t("portal.paymentProof.dropzone.formats")}</span>
                      <span className="text-border">•</span>
                      <span>{t("portal.paymentProof.dropzone.maxSize")}</span>
                    </div>
                  </>
                )}

                {uploading && (
                  <div className="absolute inset-x-4 bottom-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t("portal.paymentProof.uploading", { progress: uploadProgress })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {(paymentAmount || paymentDescription) && (
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 border border-primary/10">
                  <p className="text-sm text-muted-foreground mb-2">{t("portal.paymentProof.amountLabel")}</p>
                  {paymentAmount != null && (
                    <p className="text-3xl font-bold text-foreground">
                      {paymentCurrency && paymentCurrency !== "USD" ? (
                        <>
                          {paymentAmount.toLocaleString()}
                          <span className={cn("text-lg font-normal text-muted-foreground", isRtl ? "mr-2" : "ml-2")}>{paymentCurrency}</span>
                        </>
                      ) : (
                        <>${paymentAmount.toLocaleString()}</>
                      )}
                    </p>
                  )}
                  {paymentDescription && <p className="text-sm text-muted-foreground mt-2">{paymentDescription}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reference" className="flex items-center gap-2 text-sm font-semibold">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  {t("portal.paymentProof.reference.label")}
                  <span className="text-xs font-normal text-muted-foreground">({t("portal.paymentProof.reference.optional")})</span>
                </Label>
                <Input
                  id="reference"
                  placeholder={t("portal.paymentProof.reference.placeholder")}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  dir="ltr"
                  className="text-left h-11 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">{t("portal.paymentProof.reference.hint")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/30 border p-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              {t("portal.paymentProof.checklistTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 bg-background rounded-xl px-4 py-2 border shadow-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <item.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4 gap-3 flex-col-reverse sm:flex-row">
          <Button type="button" variant="outline" onClick={handleClose} disabled={uploading} className="h-11 px-6 rounded-xl">
            {t("portal.paymentProof.cancel")}
          </Button>

          <Button onClick={handleSubmit} disabled={!file || uploading} className="h-11 px-8 rounded-xl bg-success hover:bg-success/90 text-success-foreground gap-2">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("portal.paymentProof.submitting")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t("portal.paymentProof.submit")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
