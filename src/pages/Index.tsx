import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TableStatus {
  name: string;
  count: number | null;
  ok: boolean;
  error?: string;
}

const SUPABASE_REF = "pkivavsxbvwtnkgxaufa";

const DiagnosticsPage = () => {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const targets = ["universities", "programs", "countries", "feature_flags"] as const;
      const results: TableStatus[] = [];

      for (const t of targets) {
        const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
        results.push({ name: t, count: count ?? null, ok: !error, error: error?.message });
      }

      setTables(results);
      setLoading(false);
    };
    check();
  }, []);

  const allOk = tables.every((t) => t.ok);

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Bootstrap Diagnostics</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Supabase ref</span>
            <code className="font-mono">{SUPABASE_REF}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Build status</span>
            <Badge variant={allOk && !loading ? "default" : "destructive"}>
              {loading ? "checking…" : allOk ? "OK" : "ERROR"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Table Read Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Reading…</p>
          ) : (
            <div className="divide-y">
              {tables.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-3">
                  <code className="font-mono text-sm">{t.name}</code>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t.ok ? `${t.count?.toLocaleString()} rows` : t.error}
                    </span>
                    <Badge variant={t.ok ? "default" : "destructive"}>
                      {t.ok ? "✓" : "✗"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticsPage;
