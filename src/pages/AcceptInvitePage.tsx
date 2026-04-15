import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("Missing token"); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate(`/auth?redirect=/accept-invite?token=${token}`); return; }
      const { data } = await supabase.functions.invoke("university-page-manage", {
        body: { action: "staff.accept_invite", token },
      });
      if (data?.ok) { setStatus("success"); }
      else { setStatus("error"); setErrorMsg(data?.error || "Unknown error"); }
    })();
  }, [token, navigate]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
        {status === "loading" && <Loader2 className="w-10 h-10 animate-spin text-primary" />}
        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h1 className="text-2xl font-bold">{t("pageOS.staff.inviteAccepted")}</h1>
            <p className="text-muted-foreground">{t("pageOS.staff.inviteAcceptedDesc")}</p>
            <Button onClick={() => navigate("/")}>{t("common.goHome")}</Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-destructive" />
            <h1 className="text-2xl font-bold">{t("pageOS.staff.inviteFailed")}</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => navigate("/")}>{t("common.goHome")}</Button>
          </>
        )}
      </div>
    </Layout>
  );
}
