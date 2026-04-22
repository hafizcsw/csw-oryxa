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
  const [logs, setLogs] = useState<string[]>(["[probe] starting..."]);

  useEffect(() => {
    let mounted = true;

    const push = (line: string) => {
      console.log(line);
      if (mounted) {
        setLogs((prev) => [...prev, line]);
      }
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const tokenPresent = !!session?.access_token;
      push(`[probe] USER=${userId} TOKEN_PRESENT=${tokenPresent}`);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (const [action, payload] of ACTIONS) {
        const trace = `probe-${action}-${Date.now()}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
              apikey,
              "x-client-trace-id": trace,
            },
            body: JSON.stringify({ action, ...payload }),
          });
          const text = await res.text();
          push(`[probe] action=${action} trace=${trace} status=${res.status} body=${text}`);
        } catch (e) {
          push(`[probe] action=${action} trace=${trace} ERROR=${(e as Error).message}`);
        }
      }

      push("[probe] DONE");
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff", color: "#111111", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, marginBottom: 16, fontFamily: "monospace" }}>/__probe</h1>
        <pre
          style={{
            margin: 0,
            padding: 16,
            border: "1px solid #d4d4d8",
            background: "#f8fafc",
            color: "#111111",
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            minHeight: 320,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {logs.join("\n")}
        </pre>
      </div>
    </main>
  );
}
