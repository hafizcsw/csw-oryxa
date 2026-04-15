import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Download, AlertCircle } from "lucide-react";

interface PaymentEvidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidenceFileId?: string | null;
  // Portal-only V1: direct storage info (no CRM file lookup needed)
  storageBucket?: string | null;
  storagePath?: string | null;
}

export function PaymentEvidenceModal({
  open,
  onOpenChange,
  evidenceFileId,
  storageBucket,
  storagePath,
}: PaymentEvidenceModalProps) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSignedUrl(null);
      setMimeType(null);
      setError(null);
      return;
    }

    // Portal-only V1: Use direct storage path if available
    const hasDirectStorage = storageBucket && storagePath;
    
    if (!hasDirectStorage && !evidenceFileId) {
      setError("معلومات الملف غير متاحة");
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (hasDirectStorage) {
          // Portal-only: Sign directly from Portal storage
          const { data, error: fnError } = await supabase.functions.invoke(
            "student-portal-api",
            { body: { action: "sign_file", storage_bucket: storageBucket, storage_path: storagePath } }
          );
          if (fnError) throw fnError;
          if (!data?.ok) throw new Error(data?.error || "فشل تحميل الملف");
          
          const url = data?.data?.signed_url || data?.signed_url;
          const mt = data?.data?.mime_type || data?.mime_type || null;
          if (!url) throw new Error("لم يتم إرجاع رابط الملف");
          
          setSignedUrl(url);
          setMimeType(mt);
        } else if (evidenceFileId) {
          // CRM mode: Use file_id lookup
          const { data, error: fnError } = await supabase.functions.invoke(
            "student-portal-api",
            { body: { action: "sign_file", file_id: evidenceFileId } }
          );
          if (fnError) throw fnError;
          if (!data?.ok) throw new Error(data?.error || "فشل تحميل الملف");
          
          const url = data?.data?.signed_url || data?.signed_url;
          const mt = data?.data?.mime_type || data?.mime_type || null;
          if (!url) throw new Error("لم يتم إرجاع رابط الملف");
          
          setSignedUrl(url);
          setMimeType(mt);
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "فشل فتح الإثبات";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, evidenceFileId, storageBucket, storagePath]);

  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-right">إثبات الدفع</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[300px]">
          {loading && (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>جاري تحميل الإثبات...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-destructive">
              <AlertCircle className="h-12 w-12 opacity-50" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && signedUrl && (
            <div className="space-y-4">
              {/* Image Preview */}
              {isImage && (
                <div className="flex justify-center">
                  <img
                    src={signedUrl}
                    alt="إثبات الدفع"
                    className="max-w-full max-h-[400px] rounded-lg border object-contain"
                  />
                </div>
              )}

              {/* PDF Preview */}
              {isPdf && (
                <iframe
                  src={signedUrl}
                  title="إثبات الدفع"
                  className="w-full h-[400px] rounded-lg border"
                />
              )}

              {/* Other file types - no preview */}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="mb-4">لا يمكن عرض هذا النوع من الملفات</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(signedUrl, "_blank")}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح في نافذة جديدة
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a href={signedUrl} download>
                    <Download className="h-4 w-4" />
                    تحميل
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
