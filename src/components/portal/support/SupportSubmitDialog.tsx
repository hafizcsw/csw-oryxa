import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LifeBuoy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { createSupportTicket } from "@/api/identitySupportInvoke";
import { useSupportTickets } from "@/hooks/useSupportTickets";

export function SupportSubmitDialog({
  open,
  onOpenChange,
  defaultSubjectKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubjectKey?: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { refetch } = useSupportTickets();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (body.trim().length < 4) {
      toast({ title: t("portal.support.errors.bodyTooShort"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const res = await createSupportTicket({
      body: body.trim(),
      subject_key: defaultSubjectKey,
      client_trace_id: crypto.randomUUID(),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast({ title: t("portal.support.errors.submitFailed"), variant: "destructive" });
      return;
    }
    toast({ title: t("portal.support.submit.success") });
    setBody("");
    refetch();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            {t("portal.support.submit.title")}
          </DialogTitle>
          <DialogDescription>{t("portal.support.submit.subtitle")}</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={t("portal.support.submit.placeholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={5000}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("portal.support.submit.cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {t("portal.support.submit.send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
