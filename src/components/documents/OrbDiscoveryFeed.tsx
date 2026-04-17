// ═══════════════════════════════════════════════════════════════
// OrbDiscoveryFeed — AI discovery commentary under the AnomalyOrb
// ═══════════════════════════════════════════════════════════════
// Shows:
//   • Latest discovery as a prominent "ticker" line right below the orb
//   • A scrollable timeline of all discoveries (per-file)
// Color codes:
//   success → green, info → muted, warning → amber, error → red
// 12-language ready: takes a `t()` for labels.
// ═══════════════════════════════════════════════════════════════

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, FileSearch, Sparkles } from "lucide-react";
import type { DocumentDiscovery, DiscoverySeverity } from "@/features/documents/useDocumentDiscoveries";

interface OrbDiscoveryFeedProps {
  discoveries: DocumentDiscovery[];
  className?: string;
  /** Locale-aware labels coming from useLanguage().t */
  t: (key: string) => string;
}

const sevStyles: Record<DiscoverySeverity, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  info:    "border-border/50 bg-muted/40 text-foreground",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error:   "border-destructive/50 bg-destructive/10 text-destructive",
};

function SevIcon({ s, analyzing }: { s: DiscoverySeverity; analyzing?: boolean }) {
  if (analyzing) return <Loader2 className="w-4 h-4 animate-spin" />;
  switch (s) {
    case "success": return <CheckCircle2 className="w-4 h-4" />;
    case "warning": return <AlertTriangle className="w-4 h-4" />;
    case "error":   return <XCircle className="w-4 h-4" />;
    default:        return <FileSearch className="w-4 h-4" />;
  }
}

function fmtFileName(name: string, max = 28): string {
  if (!name) return "";
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot > 0 && name.length - dot <= 6) {
    const base = name.slice(0, dot);
    const ext  = name.slice(dot);
    return `${base.slice(0, max - ext.length - 1)}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

function buildPrimaryLine(d: DocumentDiscovery, t: (k: string) => string): string {
  if (d.state === "analyzing") {
    const tmpl = t("portal.discovery.analyzing");
    const safe = tmpl && tmpl !== "portal.discovery.analyzing" ? tmpl : "Analyzing {name}…";
    return safe.replace("{name}", fmtFileName(d.file_name));
  }
  if (d.state === "failed") {
    const tmpl = t("portal.discovery.failed");
    const safe = tmpl && tmpl !== "portal.discovery.failed" ? tmpl : "Could not analyze {name}";
    return safe.replace("{name}", fmtFileName(d.file_name));
  }
  if (!d.is_relevant) {
    const tmpl = t("portal.discovery.irrelevant");
    const safe = tmpl && tmpl !== "portal.discovery.irrelevant" ? tmpl : "{name} doesn't look like a required document";
    return safe.replace("{name}", fmtFileName(d.file_name));
  }
  if (d.quality === "poor" || d.quality === "unreadable") {
    const tmpl = t("portal.discovery.lowQuality");
    const safe = tmpl && tmpl !== "portal.discovery.lowQuality" ? tmpl : "Low quality scan: {label}";
    return safe.replace("{label}", d.document_type_label || d.document_type);
  }
  const tmpl = t("portal.discovery.detected");
  const safe = tmpl && tmpl !== "portal.discovery.detected" ? tmpl : "Detected: {label}";
  return safe.replace("{label}", d.document_type_label || d.document_type);
}

function OrbDiscoveryFeedComponent({ discoveries, className, t }: OrbDiscoveryFeedProps) {
  const sorted = useMemo(
    () => [...discoveries].sort((a, b) => b.created_at - a.created_at),
    [discoveries],
  );
  const latest = sorted[0];

  if (sorted.length === 0) return null;

  return (
    <div className={cn("w-full max-w-2xl mx-auto mt-2 space-y-2", className)}>
      {/* Primary ticker — prominent line right under the orb */}
      {latest && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border backdrop-blur-sm transition-all",
            sevStyles[latest.severity],
          )}
        >
          <SevIcon s={latest.severity} analyzing={latest.state === "analyzing"} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {buildPrimaryLine(latest, t)}
            </p>
            {latest.state === "done" && latest.summary && (
              <p className="text-xs opacity-80 truncate">{latest.summary}</p>
            )}
          </div>
          {latest.state === "done" && latest.confidence > 0 && (
            <span className="text-[10px] font-mono opacity-70 shrink-0">
              {Math.round(latest.confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Timeline log */}
      {sorted.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm divide-y divide-border/30 max-h-44 overflow-y-auto">
          {sorted.slice(1).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
            >
              <span className={cn("shrink-0", {
                "text-emerald-600 dark:text-emerald-400": d.severity === "success",
                "text-amber-600 dark:text-amber-400": d.severity === "warning",
                "text-destructive": d.severity === "error",
                "text-muted-foreground": d.severity === "info",
              })}>
                <SevIcon s={d.severity} analyzing={d.state === "analyzing"} />
              </span>
              <span className="flex-1 truncate text-foreground/80">
                {buildPrimaryLine(d, t)}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                {fmtFileName(d.file_name, 18)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Detected fields chips for latest done */}
      {latest?.state === "done" && latest.detected_fields.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          {latest.detected_fields.slice(0, 6).map((f, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const OrbDiscoveryFeed = memo(OrbDiscoveryFeedComponent);
