import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ACTIONS: Array<[string, Record<string, unknown>]> = [
  ["identity_case_get", {}],
  ["support_case_list", {}],
  ["support_case_get", { case_id: "00000000-0000-0000-0000-000000000000" }],
  ["support_messages_list", { case_id: "00000000-0000-0000-0000-000000000000" }],
  ["support_message_send", { case_id: "00000000-0000-0000-0000-000000000000", body: "probe" }],
  ["support_mark_read", { case_id: "00000000-0000-0000-0000-000000000000" }],
  ["support_case_close", { case_id: "00000000-0000-0000-0000-000000000000" }],
];

export default function Probe() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const out: string[] = [];
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const tokenPresent = !!session?.access_token;
      const line0 = `[probe] USER=${userId} TOKEN_PRESENT=${tokenPresent}`;
      console.log(line0);
      out.push(line0);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (const [action, payload] of ACTIONS) {
        const trace = `probe-${action}-${Date.now()}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey,
              "x-client-trace-id": trace,
            },
            body: JSON.stringify({ action, ...payload }),
          });
          const text = await res.text();
          const line = `[probe] action=${action} trace=${trace} status=${res.status} body=${text}`;
          console.log(line);
          out.push(line);
        } catch (e) {
          const line = `[probe] action=${action} trace=${trace} ERROR=${(e as Error).message}`;
          console.log(line);
          out.push(line);
        }
        setLogs([...out]);
      }
      console.log("[probe] DONE");
    })();
  }, []);

  return (
    <pre style={{ padding: 16, fontSize: 12, whiteSpace: "pre-wrap" }}>
      {logs.join("\n")}
    </pre>
  );
}
