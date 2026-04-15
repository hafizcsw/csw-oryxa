import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, XCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SectionResult {
  status: string;
  data?: unknown;
  ignore_reason?: string;
  quarantine_reason?: string;
}

interface EvidenceSample {
  url: string;
  sample_type: string;
  entity_type: string;
  fetch_method: string;
  fetched_at: string;
  profile_tier: string;
  section_presence: Record<string, SectionResult>;
  trust_tiers: Record<string, string>;
  quarantine_reasons: string[];
  parsed_json: Record<string, unknown>;
  error?: string;
}

interface ProofRunResult {
  ok: boolean;
  summary?: {
    total_samples: number;
    successful: number;
    failed: number;
    entity_types: string[];
    sections_coverage: Record<string, Record<string, number>>;
  };
  samples?: EvidenceSample[];
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  extracted: "bg-green-500/20 text-green-700 dark:text-green-400",
  not_present: "bg-muted text-muted-foreground",
  requires_js: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  quarantined: "bg-red-500/20 text-red-700 dark:text-red-400",
  explicitly_ignored: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
};

const TRUST_COLORS: Record<string, string> = {
  fresh: "bg-green-500/20 text-green-700",
  stale: "bg-yellow-500/20 text-yellow-700",
  malformed: "bg-red-500/20 text-red-700",
};

export function QsProofRunPanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProofRunResult | null>(null);
  const [expandedSample, setExpandedSample] = useState<number | null>(null);

  const runProof = async (sampleIndex?: number) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("qs-enrichment-proof-run", {
        body: sampleIndex !== undefined ? { sample_index: sampleIndex } : {},
      });
      if (error) throw error;
      setResult(data as ProofRunResult);
      toast({
        title: data.ok ? "Proof run complete" : "Proof run failed",
        variant: data.ok ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            🔬 QS Enrichment Proof Run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => runProof()} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              تشغيل كل العينات (8)
            </Button>
            <Button variant="outline" onClick={() => runProof(0)} disabled={running} size="sm">
              Ranking فقط
            </Button>
            <Button variant="outline" onClick={() => runProof(2)} disabled={running} size="sm">
              ADU فقط
            </Button>
            <Button variant="outline" onClick={() => runProof(5)} disabled={running} size="sm">
              MIT Sloan فقط
            </Button>
          </div>

          {result?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <StatCard label="عينات" value={result.summary.total_samples} />
              <StatCard label="نجاح" value={result.summary.successful} color="text-green-600" />
              <StatCard label="فشل" value={result.summary.failed} color="text-red-600" />
              <StatCard label="أنواع كيانات" value={result.summary.entity_types.join(", ")} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Coverage Matrix */}
      {result?.summary?.sections_coverage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مصفوفة تغطية الأقسام</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-1">القسم</th>
                    <th className="p-1">extracted</th>
                    <th className="p-1">not_present</th>
                    <th className="p-1">requires_js</th>
                    <th className="p-1">quarantined</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.summary.sections_coverage).map(([section, counts]) => (
                    <tr key={section} className="border-b border-border/50">
                      <td className="p-1 font-mono text-right">{section}</td>
                      {['extracted', 'not_present', 'requires_js', 'quarantined'].map(status => (
                        <td key={status} className="p-1 text-center">
                          {(counts as Record<string, number>)[status] || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Individual Samples */}
      {result?.samples?.map((sample, idx) => (
        <Collapsible key={idx} open={expandedSample === idx} onOpenChange={(open) => setExpandedSample(open ? idx : null)}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {sample.error ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    <span className="text-sm font-medium">{sample.sample_type}</span>
                    <Badge variant="outline" className="text-xs">{sample.entity_type}</Badge>
                    <Badge variant="outline" className="text-xs">{sample.fetch_method}</Badge>
                    <Badge variant="outline" className="text-xs">{sample.profile_tier}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSample === idx ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 text-xs">
                <div className="font-mono text-muted-foreground break-all">{sample.url}</div>

                {/* Trust Tiers */}
                {Object.keys(sample.trust_tiers).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(sample.trust_tiers).map(([field, tier]) => (
                      <Badge key={field} className={TRUST_COLORS[tier] || ""}>
                        {field}: {tier}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Quarantine */}
                {sample.quarantine_reasons.length > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {sample.quarantine_reasons.join(", ")}
                  </div>
                )}

                {/* Section Presence */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                  {Object.entries(sample.section_presence).map(([section, result]) => (
                    <div key={section} className="flex items-center gap-1">
                      <Badge className={`text-[10px] ${STATUS_COLORS[result.status] || ""}`}>
                        {result.status}
                      </Badge>
                      <span className="truncate">{section}</span>
                    </div>
                  ))}
                </div>

                {/* Parsed JSON */}
                {Object.keys(sample.parsed_json).length > 0 && (
                  <pre className="bg-muted p-2 rounded overflow-auto max-h-40 text-[10px]">
                    {JSON.stringify(sample.parsed_json, null, 2)}
                  </pre>
                )}

                {sample.error && (
                  <div className="text-destructive bg-destructive/10 p-2 rounded">{sample.error}</div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${color || ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
