import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildTraceHeaders } from "@/lib/workflow/tracing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Save, Loader2, ExternalLink, Shield, Award, Globe, Clock } from "lucide-react";

interface UniRanksPanelProps {
  universityId: string;
}

interface SignalsForm {
  verified: boolean;
  recognized: boolean;
  profile_url: string;
  badges: string[];
  top_buckets: string[];
  country_rank: number | null;
  region_rank: number | null;
  world_rank: number | null;
  data_quality: string;
}

const EMPTY_FORM: SignalsForm = {
  verified: false,
  recognized: false,
  profile_url: "",
  badges: [],
  top_buckets: [],
  country_rank: null,
  region_rank: null,
  world_rank: null,
  data_quality: "raw",
};

export function UniRanksPanel({ universityId }: UniRanksPanelProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SignalsForm>(EMPTY_FORM);
  const [badgeInput, setBadgeInput] = useState("");
  const [bucketInput, setBucketInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Fetch signals via RPC with x-client-trace-id header
  const { data: signals, isLoading } = useQuery({
    queryKey: ["uniranks-signals", universityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_uniranks_signals", {
        p_university_id: universityId,
      }, {
        headers: buildTraceHeaders(),
      } as any);
      if (error) throw error;
      return data as Record<string, any>;
    },
    enabled: !!universityId,
  });

  // Populate form from fetched data
  useEffect(() => {
    if (signals && signals.ok) {
      setForm({
        verified: signals.uniranks_verified ?? false,
        recognized: signals.uniranks_recognized ?? false,
        profile_url: signals.uniranks_profile_url ?? "",
        badges: signals.uniranks_badges ?? [],
        top_buckets: signals.uniranks_top_buckets ?? [],
        country_rank: signals.uniranks_country_rank ?? null,
        region_rank: signals.uniranks_region_rank ?? null,
        world_rank: signals.uniranks_world_rank ?? null,
        data_quality: signals.uniranks_data_quality ?? "raw",
      });
      setIsDirty(false);
    }
  }, [signals]);

  // Save via RPC with x-client-trace-id header
  const saveMutation = useMutation({
    mutationFn: async () => {
      const traceId = `STUDIO-UR-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_upsert_uniranks_signals", {
        p_university_id: universityId,
        p_trace_id: traceId,
        p_signals: {
          verified: form.verified,
          recognized: form.recognized,
          profile_url: form.profile_url || null,
          badges: form.badges,
          top_buckets: form.top_buckets,
          country_rank: form.country_rank,
          region_rank: form.region_rank,
          world_rank: form.world_rank,
          data_quality: form.data_quality,
        },
      }, {
        headers: {
          ...buildTraceHeaders(),
          'x-client-trace-id': traceId,
        },
      } as any);
      if (error) throw error;
      return data as Record<string, any>;
    },
    onSuccess: (result) => {
      if (result?.ok) {
        toast({ title: t("studio.uniranks.saved") });
        setIsDirty(false);
        queryClient.invalidateQueries({ queryKey: ["uniranks-signals", universityId] });
      } else {
        toast({ title: t("studio.uniranks.error"), description: result?.error, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: t("studio.uniranks.error"), description: err.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof SignalsForm>(key: K, value: SignalsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const addBadge = () => {
    const val = badgeInput.trim();
    if (val && !form.badges.includes(val)) {
      updateField("badges", [...form.badges, val]);
      setBadgeInput("");
    }
  };

  const removeBadge = (badge: string) => {
    updateField("badges", form.badges.filter((b) => b !== badge));
  };

  const addBucket = () => {
    const val = bucketInput.trim();
    if (val && !form.top_buckets.includes(val)) {
      updateField("top_buckets", [...form.top_buckets, val]);
      setBucketInput("");
    }
  };

  const removeBucket = (bucket: string) => {
    updateField("top_buckets", form.top_buckets.filter((b) => b !== bucket));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Save */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("studio.uniranks.title")}</h3>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t("studio.save")}
        </Button>
      </div>

      {/* Core Signals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("studio.uniranks.coreSignals")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("studio.uniranks.verified")}</Label>
            <Switch
              checked={form.verified}
              onCheckedChange={(v) => updateField("verified", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("studio.uniranks.recognized")}</Label>
            <Switch
              checked={form.recognized}
              onCheckedChange={(v) => updateField("recognized", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("studio.uniranks.profileUrl")}</Label>
            <div className="flex gap-2">
              <Input
                value={form.profile_url}
                onChange={(e) => updateField("profile_url", e.target.value)}
                placeholder={t("studio.uniranks.profileUrlPlaceholder")}
                dir="ltr"
              />
              {form.profile_url && (
                <Button variant="outline" size="icon" asChild>
                  <a href={form.profile_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buckets & Badges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4" />
            {t("studio.uniranks.bucketsAndBadges")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top Buckets */}
          <div className="space-y-1.5">
            <Label>{t("studio.uniranks.topBuckets")}</Label>
            <div className="flex gap-2">
              <Input
                value={bucketInput}
                onChange={(e) => setBucketInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBucket())}
                placeholder={t("studio.uniranks.bucketPlaceholder")}
                dir="ltr"
              />
              <Button variant="outline" size="sm" onClick={addBucket}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.top_buckets.map((b) => (
                <Badge key={b} variant="secondary" className="cursor-pointer" onClick={() => removeBucket(b)}>
                  {b} ×
                </Badge>
              ))}
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-1.5">
            <Label>{t("studio.uniranks.badges")}</Label>
            <div className="flex gap-2">
              <Input
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBadge())}
                placeholder={t("studio.uniranks.badgePlaceholder")}
                dir="ltr"
              />
              <Button variant="outline" size="sm" onClick={addBadge}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.badges.map((b) => (
                <Badge key={b} variant="outline" className="cursor-pointer" onClick={() => removeBadge(b)}>
                  {b} ×
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("studio.uniranks.ranks")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("studio.uniranks.countryRank")}</Label>
              <Input
                type="number"
                min={1}
                value={form.country_rank ?? ""}
                onChange={(e) => updateField("country_rank", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("studio.uniranks.regionRank")}</Label>
              <Input
                type="number"
                min={1}
                value={form.region_rank ?? ""}
                onChange={(e) => updateField("region_rank", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("studio.uniranks.worldRank")}</Label>
              <Input
                type="number"
                min={1}
                value={form.world_rank ?? ""}
                onChange={(e) => updateField("world_rank", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
          {/* Existing rank/score (read-only) */}
          {signals && (signals.uniranks_rank || signals.uniranks_score) && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <span className="font-medium">{t("studio.uniranks.crawledData")}:</span>{" "}
              {t("studio.uniranks.rankLabel")} #{signals.uniranks_rank ?? "—"} · {t("studio.uniranks.scoreLabel")} {signals.uniranks_score ?? "—"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Snapshot Preview */}
      {signals?.uniranks_snapshot && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("studio.uniranks.snapshot")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-2">
              {t("studio.uniranks.lastUpdated")}: {signals.uniranks_snapshot_at ? new Date(signals.uniranks_snapshot_at).toLocaleString("ar-SA", { timeZone: "Asia/Dubai" }) : "—"}
              {signals.uniranks_snapshot_trace_id && (
                <span className="ml-2 font-mono">trace: {signals.uniranks_snapshot_trace_id}</span>
              )}
            </div>
            <Accordion type="single" collapsible>
              <AccordionItem value="snapshot">
                <AccordionTrigger className="text-sm">{t("studio.uniranks.viewSnapshot")}</AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap" dir="ltr">
                    {JSON.stringify(signals.uniranks_snapshot, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {/* Sections Present */}
            {signals.uniranks_sections_present?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {signals.uniranks_sections_present.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Quality */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Label>{t("studio.uniranks.dataQuality")}:</Label>
        <select
          value={form.data_quality}
          onChange={(e) => updateField("data_quality", e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-background"
        >
          <option value="raw">{t("studio.uniranks.dataQualityRaw")}</option>
          <option value="partial">{t("studio.uniranks.dataQualityPartial")}</option>
          <option value="reviewed">{t("studio.uniranks.dataQualityReviewed")}</option>
        </select>
      </div>
    </div>
  );
}
