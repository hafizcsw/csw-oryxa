import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Upload } from "lucide-react";

export default function BacklinksPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("seo_backlinks")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    try {
      const res = await supabase.functions.invoke('backlinks-import', {
        body: { rows: [] }
      });
      if (res.error) throw res.error;
      const data = res.data;
      if (data?.ok) {
        toast.success(`Imported ${data.inserted} backlinks`);
        load();
      } else {
        toast.error(data?.error || "Import failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Backlinks</h1>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleImport} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No backlinks yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Source Domain</th>
                  <th className="text-left p-3 font-medium">Target URL</th>
                  <th className="text-left p-3 font-medium">Anchor Text</th>
                  <th className="text-left p-3 font-medium">Rel</th>
                  <th className="text-left p-3 font-medium">DA</th>
                  <th className="text-left p-3 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <a 
                        className="text-primary hover:underline" 
                        href={r.source_url} 
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.source_domain}
                      </a>
                    </td>
                    <td className="p-3 truncate max-w-[300px]">{r.target_url}</td>
                    <td className="p-3">{r.anchor || '—'}</td>
                    <td className="p-3">{r.rel || '—'}</td>
                    <td className="p-3">{r.domain_rating ?? '—'}</td>
                    <td className="p-3">{r.last_seen ? new Date(r.last_seen).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
