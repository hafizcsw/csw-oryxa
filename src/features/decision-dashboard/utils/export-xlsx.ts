import * as XLSX from "xlsx";
import type { DecisionDashboardData } from "../types";

/**
 * Executive Analyst Pack — XLSX Export
 * Rich, well-organized workbook with computed metrics, analysis notes, and clear structure
 */
export function exportDashboardToXlsx(data: DecisionDashboardData) {
  const wb = XLSX.utils.book_new();
  const ts = new Date(data.generated_at);
  const stamp = `${ts.getFullYear()}-${p(ts.getMonth() + 1)}-${p(ts.getDate())}-${p(ts.getHours())}-${p(ts.getMinutes())}`;
  const dateStr = ts.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // ══════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ══════════════════════════════════════
  {
    const rows: R = [];
    rows.push(
      ["═══════════════════════════════════════════════════"],
      ["    EXECUTIVE DECISION REPORT — ANALYST PACK"],
      ["═══════════════════════════════════════════════════"],
      [`    Generated: ${dateStr} at ${timeStr}`],
      [`    Traffic Filter: Known Real (Trusted Only)`],
      [`    Cutover: ${data.overview?.analytics_truth_started_at ? new Date(data.overview.analytics_truth_started_at).toLocaleDateString("en-US") : "Not set"}`],
      [],
      ["───────────────────────────────────────────────────"],
      ["  CORE KPIs", "", "", ""],
      ["───────────────────────────────────────────────────"],
      [],
      ["METRIC", "24 HOURS", "7 DAYS", "30 DAYS", "TREND NOTE"],
    );

    if (data.overview) {
      const o = data.overview;
      const vTrend = o.visitors_7d > 0 && o.visitors_24h > 0
        ? (o.visitors_24h * 7 > o.visitors_7d ? "↑ Above daily avg" : "↓ Below daily avg")
        : "";

      rows.push(
        ["Visitors",           o.visitors_24h,       o.visitors_7d,       o.visitors_30d,      vTrend],
        ["Pageviews",          o.pageviews_24h,      o.pageviews_7d,      o.pageviews_30d,     o.visitors_7d > 0 ? `${(o.pageviews_7d / o.visitors_7d).toFixed(1)} pages/visitor` : ""],
        ["Registrations",      o.registrations_24h,  o.registrations_7d,  o.registrations_30d, o.visitors_7d > 0 ? `${(o.registrations_7d / o.visitors_7d * 100).toFixed(1)}% conversion` : ""],
        ["Shortlist Adds",     o.shortlist_adds_24h, o.shortlist_adds_7d, o.shortlist_adds_30d, ""],
        ["Application Starts", o.application_starts_24h, o.application_starts_7d ?? 0, "", o.registrations_7d > 0 ? `${((o.application_starts_7d ?? 0) / o.registrations_7d * 100).toFixed(1)}% of registrations` : ""],
        ["Doc Uploads",        o.doc_uploads_24h,    "",                  "",                  ""],
        ["Chat Sessions",      o.chat_sessions_24h,  o.chat_sessions_7d,  "",                  ""],
        [],
        ["───────────────────────────────────────────────────"],
        ["  ENGAGEMENT INDICATORS"],
        ["───────────────────────────────────────────────────"],
        [],
        ["INDICATOR", "VALUE", "BENCHMARK", "ASSESSMENT"],
        ["Active Now",           o.active_now,                             "",                          o.active_now > 0 ? "Live traffic detected" : "No live visitors"],
        ["Returning Visitors",   `${o.returning_visitors_pct}%`,           "25%+ = healthy",            o.returning_visitors_pct > 25 ? "✓ Healthy retention" : "⚠ Below threshold"],
        ["Avg Engaged Time",     `${Math.round(o.avg_engaged_time_sec)}s`, "30s+ = engaged",           o.avg_engaged_time_sec > 30 ? "✓ Good engagement" : "⚠ Low engagement"],
        ["Engaged Time Source",  o.engaged_time_source,                    "heartbeat = accurate",     o.engaged_time_source === "heartbeat" ? "✓ Accurate measurement" : "Estimate only"],
        ["Pages per Visitor",    o.visitors_7d > 0 ? (o.pageviews_7d / o.visitors_7d).toFixed(2) : "—", "2.0+ = exploring", o.visitors_7d > 0 && (o.pageviews_7d / o.visitors_7d) >= 2 ? "✓ Exploring content" : "⚠ Shallow browsing"],
      );

      // Computed metrics
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  COMPUTED RATIOS"],
        ["───────────────────────────────────────────────────"],
        [],
        ["RATIO", "VALUE", "FORMULA", "INTERPRETATION"],
        ["Visitor→Registration (7d)", o.visitors_7d > 0 ? `${(o.registrations_7d / o.visitors_7d * 100).toFixed(2)}%` : "N/A", "registrations_7d / visitors_7d", "Top-of-funnel conversion"],
        ["Visitor→Shortlist (7d)", o.visitors_7d > 0 ? `${(o.shortlist_adds_7d / o.visitors_7d * 100).toFixed(2)}%` : "N/A", "shortlist_7d / visitors_7d", "Intent signal strength"],
        ["Registration→App (7d)", o.registrations_7d > 0 ? `${((o.application_starts_7d ?? 0) / o.registrations_7d * 100).toFixed(2)}%` : "N/A", "app_starts_7d / registrations_7d", "Mid-funnel conversion"],
        ["Chat Engagement (7d)", o.visitors_7d > 0 ? `${(o.chat_sessions_7d / o.visitors_7d * 100).toFixed(2)}%` : "N/A", "chat_7d / visitors_7d", "Support demand indicator"],
      );
    }

    addSheet(wb, rows, "Summary", [36, 18, 18, 18, 36]);
  }

  // ══════════════════════════════════════
  // 2. TRAFFIC TRUST
  // ══════════════════════════════════════
  if (data.overview?.truth_buckets) {
    const tb = data.overview.truth_buckets;
    const total = Math.max(tb.all_traffic?.visitors ?? 1, 1);
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    TRAFFIC QUALITY & TRUST ANALYSIS"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["This section explains which traffic data is trustworthy for business decisions."],
      [],
      ["───────────────────────────────────────────────────"],
      ["  CLASSIFICATION BREAKDOWN"],
      ["───────────────────────────────────────────────────"],
      [],
      ["CLASSIFICATION", "VISITORS", "PAGEVIEWS", "% SHARE", "IN REPORT?", "WHAT THIS MEANS"],
      ["Known Real",     tb.known_real?.visitors ?? 0,              tb.known_real?.pageviews ?? 0,              `${Math.round(((tb.known_real?.visitors ?? 0) / total) * 100)}%`, "✓ YES",  "Real verified visitors — ALL executive metrics use this"],
      ["Unknown Legacy", tb.unknown_legacy?.visitors ?? 0,          tb.unknown_legacy?.pageviews ?? 0,          `${Math.round(((tb.unknown_legacy?.visitors ?? 0) / total) * 100)}%`, "✗ NO",   "Traffic before classification system — cannot verify"],
      ["Internal/Test",  tb.known_internal_or_test?.visitors ?? 0,  tb.known_internal_or_test?.pageviews ?? 0,  `${Math.round(((tb.known_internal_or_test?.visitors ?? 0) / total) * 100)}%`, "✗ NO",   "Team, bots, dev traffic — always excluded from reports"],
      [],
      ["TOTAL",          tb.all_traffic?.visitors ?? 0,             tb.all_traffic?.pageviews ?? 0,             "100%", "—",   "Sum of all classifications"],
    ];

    if (data.overview?.analytics_truth_started_at) {
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  CUTOVER INFORMATION"],
        ["───────────────────────────────────────────────────"],
        [],
        ["FIELD", "VALUE"],
        ["Cutover Date", new Date(data.overview.analytics_truth_started_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
        ["Meaning", "Traffic before this date lacks classification and is treated as Legacy"],
        ["Impact", "Only post-cutover 'Known Real' traffic is used for executive metrics"],
      );
    }

    rows.push(
      [],
      ["───────────────────────────────────────────────────"],
      ["  TRUST DECISION GUIDE"],
      ["───────────────────────────────────────────────────"],
      [],
      ["QUESTION", "ANSWER"],
      ["Can I trust the visitor counts?", (tb.known_real?.visitors ?? 0) > 0 ? "Yes — Known Real traffic is verified and classified" : "Not yet — no verified traffic recorded"],
      ["Is legacy data reliable?", "No — legacy data predates classification and may include bots/internal traffic"],
      ["Are internal visits counted?", "No — internal and test traffic is automatically excluded from all metrics"],
    );

    addSheet(wb, rows, "Traffic Trust", [36, 18, 18, 12, 12, 56]);
  }

  // ══════════════════════════════════════
  // 3. DAILY TREND
  // ══════════════════════════════════════
  if (data.overview?.daily_trend?.length) {
    const trend = data.overview.daily_trend;
    const avgV = trend.reduce((s, d) => s + d.visitors, 0) / trend.length;
    const avgP = trend.reduce((s, d) => s + d.pageviews, 0) / trend.length;
    const maxDay = trend.reduce((a, b) => a.visitors > b.visitors ? a : b);
    const minDay = trend.reduce((a, b) => a.visitors < b.visitors ? a : b);

    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    DAILY TREND ANALYSIS"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  SUMMARY STATISTICS"],
      ["───────────────────────────────────────────────────"],
      [],
      ["STATISTIC", "VISITORS", "PAGEVIEWS"],
      ["Period", `${trend.length} days`, ""],
      ["Daily Average", Math.round(avgV), Math.round(avgP)],
      ["Peak Day", `${new Date(maxDay.day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} (${maxDay.visitors})`, maxDay.pageviews],
      ["Lowest Day", `${new Date(minDay.day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} (${minDay.visitors})`, minDay.pageviews],
      ["Total", trend.reduce((s, d) => s + d.visitors, 0), trend.reduce((s, d) => s + d.pageviews, 0)],
      [],
      ["───────────────────────────────────────────────────"],
      ["  DAILY DATA"],
      ["───────────────────────────────────────────────────"],
      [],
      ["DATE", "DAY", "VISITORS", "PAGEVIEWS", "V/P RATIO", "VS AVERAGE"],
      ...trend.map(d => {
        const dt = new Date(d.day);
        const ratio = d.visitors > 0 ? +(d.pageviews / d.visitors).toFixed(2) : 0;
        const vsAvg = avgV > 0 ? `${d.visitors > avgV ? "↑" : "↓"} ${Math.abs(Math.round(((d.visitors - avgV) / avgV) * 100))}%` : "";
        return [
          dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
          dt.toLocaleDateString("en-US", { weekday: "long" }),
          d.visitors,
          d.pageviews,
          ratio,
          vsAvg,
        ] as Cell[];
      }),
    ];
    addSheet(wb, rows, "Daily Trend", [24, 14, 14, 14, 12, 16]);
  }

  // ══════════════════════════════════════
  // 4. ENGAGEMENT
  // ══════════════════════════════════════
  if (data.engagement) {
    const e = data.engagement;
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    BEHAVIOR & ENGAGEMENT ANALYSIS"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  KEY METRICS"],
      ["───────────────────────────────────────────────────"],
      [],
      ["METRIC", "VALUE", "BENCHMARK", "STATUS"],
      ["Bounce Rate", `${e.bounce_rate}%`, "<40% excellent, 40-60% normal, >60% high", e.bounce_rate > 60 ? "⚠ NEEDS ATTENTION" : e.bounce_rate < 40 ? "✓ EXCELLENT" : "— NORMAL"],
      ["Bounce Basis", e.bounce_basis, "", "Calculation method"],
      ["Avg Engaged Time", `${Math.round(data.overview?.avg_engaged_time_sec ?? 0)}s`, ">30s = engaged", data.overview?.avg_engaged_time_sec && data.overview.avg_engaged_time_sec > 30 ? "✓ ENGAGED" : "⚠ LOW"],
    ];

    if (e.top_pages_by_views?.length) {
      const totalViews = e.top_pages_by_views.reduce((s, pg) => s + pg.views, 0);
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  TOP PAGES BY TRAFFIC"],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "PAGE", "VIEWS", "UNIQUE VISITORS", "% OF TOTAL", "VISITORS/VIEW RATIO"],
      );
      e.top_pages_by_views.forEach((pg, i) => {
        rows.push([
          i + 1,
          pg.page_route || "/ (Homepage)",
          pg.views,
          pg.unique_visitors,
          totalViews > 0 ? `${Math.round((pg.views / totalViews) * 100)}%` : "—",
          pg.views > 0 ? (pg.unique_visitors / pg.views).toFixed(2) : "—",
        ]);
      });
    }

    if (e.device_breakdown?.length) {
      const totalDev = e.device_breakdown.reduce((s, d) => s + d.visitors, 0) || 1;
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  DEVICE BREAKDOWN"],
        ["───────────────────────────────────────────────────"],
        [],
        ["DEVICE", "VISITORS", "% SHARE", "VISUAL"],
      );
      e.device_breakdown.forEach(d => {
        const pct = Math.round((d.visitors / totalDev) * 100);
        const bar = "█".repeat(Math.max(Math.round(pct / 5), 1)) + "░".repeat(Math.max(20 - Math.round(pct / 5), 0));
        rows.push([d.device || "Unknown", d.visitors, `${pct}%`, bar]);
      });
    }

    if (e.hourly_pattern?.length) {
      const maxHr = Math.max(...e.hourly_pattern.map(h => h.visitors), 1);
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  HOURLY ACTIVITY PATTERN (24h)"],
        ["───────────────────────────────────────────────────"],
        [],
        ["HOUR", "VISITORS", "% OF PEAK", "ACTIVITY LEVEL", "VISUAL"],
      );
      e.hourly_pattern.forEach(h => {
        const pct = Math.round((h.visitors / maxHr) * 100);
        const level = pct > 75 ? "PEAK" : pct > 50 ? "HIGH" : pct > 25 ? "MEDIUM" : "LOW";
        const bar = "█".repeat(Math.max(Math.round(pct / 5), 0));
        rows.push([`${String(h.hr).padStart(2, "0")}:00`, h.visitors, `${pct}%`, level, bar]);
      });

      // Peak hours summary
      const peakHours = e.hourly_pattern
        .filter(h => h.visitors >= maxHr * 0.7)
        .map(h => `${h.hr}:00`);
      if (peakHours.length) {
        rows.push([], ["Peak Hours", peakHours.join(", "), "", "70%+ of max traffic"]);
      }
    }

    if (e.top_exit_pages?.length) {
      rows.push(
        [],
        ["───────────────────────────────────────────────────"],
        ["  TOP EXIT PAGES (where visitors leave)"],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "PAGE", "EXIT COUNT", "ACTION NEEDED"],
      );
      e.top_exit_pages.forEach((pg, i) => {
        rows.push([i + 1, pg.page_route || "/", pg.exit_count, i < 3 ? "Review content and CTAs" : ""]);
      });
    }

    addSheet(wb, rows, "Engagement", [8, 44, 16, 16, 14, 24]);
  }

  // ══════════════════════════════════════
  // 5-7. FUNNELS
  // ══════════════════════════════════════
  const buildFunnelSheet = (steps: typeof data.funnel, name: string, description: string) => {
    if (!steps?.length) return;
    // Suppress if ALL visitors are zero
    const totalVisitors = steps.reduce((s, st) => s + st.visitors, 0);
    if (totalVisitors === 0) return;
    const maxV = Math.max(...steps.map(s => s.visitors), 1);

    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      [`    ${name.toUpperCase()} FUNNEL`],
      ["═══════════════════════════════════════════════════"],
      [description],
      [],
      ["───────────────────────────────────────────────────"],
      ["  FUNNEL VISUALIZATION"],
      ["───────────────────────────────────────────────────"],
      [],
    ];

    // Text-based funnel visualization
    steps.forEach((s, i) => {
      const pct = Math.round((s.visitors / maxV) * 100);
      const bar = "█".repeat(Math.max(Math.round(pct / 2), 1));
      const stepName = humanizeStep(s.step);
      rows.push([`  ${stepName}`, `${bar}  ${s.visitors.toLocaleString("en-US")} (${pct}%)`, "", ""]);
      if (i < steps.length - 1) {
        rows.push(["", "    │", "", ""]);
        const next = steps[i + 1];
        if (s.identity_domain !== next.identity_domain) {
          rows.push(["", "    ⚠ DOMAIN CHANGES HERE", "", ""]);
        } else if (s.count_source !== next.count_source) {
          rows.push(["", "    ⚠ SOURCE CHANGES HERE", "", ""]);
        } else if (s.visitors > 0) {
          rows.push(["", `    ↓ ${((next.visitors / s.visitors) * 100).toFixed(1)}% conversion`, "", ""]);
        }
      }
    });

    rows.push(
      [],
      ["───────────────────────────────────────────────────"],
      ["  DETAILED DATA"],
      ["───────────────────────────────────────────────────"],
      [],
      ["STEP", "ORDER", "COUNT", "IDENTITY DOMAIN", "DATA SOURCE", "CONVERSION", "DROP-OFF", "WARNING", "EXPLANATION"],
    );

    steps.forEach((s, i) => {
      const prev = i > 0 ? steps[i - 1] : s;
      const domainChanged = i > 0 && s.identity_domain !== prev.identity_domain;
      const sourceChanged = i > 0 && s.count_source !== prev.count_source;
      let conv = "";
      let dropoff = "";
      let warn = "";
      let explain = "";

      if (i === 0) {
        conv = "Entry";
        explain = "Funnel entry point";
      } else if (domainChanged) {
        warn = "⚠ DOMAIN CHANGED";
        conv = "N/A";
        dropoff = "N/A";
        explain = `Changed from ${prev.identity_domain} to ${s.identity_domain} — conversion math is invalid across different identity systems`;
      } else if (sourceChanged) {
        warn = "⚠ SOURCE CHANGED";
        conv = "N/A";
        dropoff = "N/A";
        explain = `Changed from ${prev.count_source || "events"} to ${s.count_source || "events"} — different data tables`;
      } else if (prev.visitors > 0) {
        const convPct = (s.visitors / prev.visitors * 100);
        conv = `${convPct.toFixed(1)}%`;
        dropoff = `${(100 - convPct).toFixed(1)}%`;
        explain = convPct > 50 ? "Strong conversion" : convPct > 20 ? "Moderate conversion" : "Low — investigate bottleneck";
      }

      rows.push([
        humanizeStep(s.step),
        s.step_order,
        s.visitors,
        s.identity_domain,
        s.count_source ?? "events",
        conv,
        dropoff,
        warn,
        explain,
      ]);
    });

    addSheet(wb, rows, `${name} Funnel`.slice(0, 31), [28, 10, 12, 18, 18, 14, 14, 22, 50]);
  };

  if (data.funnels?.length) {
    const descs: Record<string, string> = {
      discovery: "From landing to shortlist — how visitors explore and discover",
      account: "From registration to account activation — converting visitors to users",
      revenue: "From application to payment — the monetization pipeline",
    };
    for (const fg of data.funnels) {
      const name = fg.name.charAt(0).toUpperCase() + fg.name.slice(1);
      buildFunnelSheet(fg.steps, name, descs[fg.name] || "Conversion flow analysis");
    }
  } else if (data.funnel?.length) {
    buildFunnelSheet(data.funnel, "Combined", "Full conversion flow across all stages");
  }

  // ══════════════════════════════════════
  // 8. SEARCH INTELLIGENCE
  // ══════════════════════════════════════
  if (data.search_intel) {
    const s = data.search_intel;
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    SEARCH INTELLIGENCE"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  KEY METRICS"],
      ["───────────────────────────────────────────────────"],
      [],
      ["METRIC", "VALUE", "MEANING"],
      ["Total Searches (30d)", s.total_searches_30d, s.total_searches_30d === 0 ? "No search events recorded — verify tracking" : "Active search usage"],
      ["Search → Click %", `${s.search_to_click_pct}%`, "How often search results lead to clicks"],
      ["Search → Shortlist %", `${s.search_to_shortlist_pct}%`, "How often search leads to shortlisting"],
      ["Attribution", s.attribution_method, "How conversions are attributed to searches"],
    ];

    if (s.top_country_filters?.length) {
      const cleanCountries = s.top_country_filters.filter(r => r.filter_val);
      if (cleanCountries.length) {
        rows.push(
          [],
          ["───────────────────────────────────────────────────"],
          ["  MOST SEARCHED COUNTRIES"],
          ["───────────────────────────────────────────────────"],
          [],
          ["RANK", "COUNTRY", "SEARCHES", "UNIQUE USERS", "% OF TOTAL"],
        );
        const totalUses = cleanCountries.reduce((s, r) => s + r.uses, 0) || 1;
        cleanCountries.forEach((r, i) => {
          rows.push([i + 1, r.filter_val, r.uses, r.unique_users, `${Math.round((r.uses / totalUses) * 100)}%`]);
        });
      }
    }

    if (s.top_degree_filters?.length) {
      const cleanDegrees = s.top_degree_filters.filter(r => r.filter_val);
      if (cleanDegrees.length) {
        const totalDeg = cleanDegrees.reduce((s, r) => s + r.uses, 0) || 1;
        rows.push(
          [],
          ["───────────────────────────────────────────────────"],
          ["  MOST SEARCHED DEGREE LEVELS"],
          ["───────────────────────────────────────────────────"],
          [],
          ["RANK", "DEGREE", "SEARCHES", "% OF TOTAL"],
        );
        cleanDegrees.forEach((r, i) => {
          rows.push([i + 1, r.filter_val, r.uses, `${Math.round((r.uses / totalDeg) * 100)}%`]);
        });
      }
    }

    addSheet(wb, rows, "Search Intel", [8, 32, 16, 16, 14]);
  }

  // ══════════════════════════════════════
  // 9. UNIVERSITY INTELLIGENCE
  // ══════════════════════════════════════
  if (data.university_intel) {
    const u = data.university_intel;
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    UNIVERSITY INTELLIGENCE"],
      ["═══════════════════════════════════════════════════"],
      [`    Data Source: ${u.data_source.replace(/_/g, " ")}`],
      [],
    ];

    const cleanViews = (u.top_by_views || []).filter(r => r.name_ar && r.name_ar.length > 1);
    if (cleanViews.length) {
      const totalViews = cleanViews.reduce((s, r) => s + r.views, 0) || 1;
      rows.push(
        ["───────────────────────────────────────────────────"],
        ["  TOP UNIVERSITIES BY VIEWS"],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "UNIVERSITY (AR)", "UNIVERSITY (EN)", "VIEWS", "UNIQUE VISITORS", "% SHARE", "VISITOR RATIO"],
      );
      cleanViews.forEach((r, i) => {
        rows.push([
          i + 1, r.name_ar, r.name_en || "", r.views, r.unique_visitors,
          `${Math.round((r.views / totalViews) * 100)}%`,
          r.views > 0 ? (r.unique_visitors / r.views).toFixed(2) : "—",
        ]);
      });
      rows.push([]);
    }

    const cleanShortlist = (u.top_by_shortlist || []).filter(r => r.name_ar && r.name_ar.length > 1);
    if (cleanShortlist.length) {
      rows.push(
        ["───────────────────────────────────────────────────"],
        ["  TOP UNIVERSITIES BY SHORTLIST"],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "UNIVERSITY (AR)", "UNIVERSITY (EN)", "SHORTLIST ADDS", "UNIQUE USERS"],
      );
      cleanShortlist.forEach((r, i) => {
        rows.push([i + 1, r.name_ar, r.name_en || "", r.adds, r.unique_users]);
      });
      rows.push([]);
    }

    if (rows.length > 5) addSheet(wb, rows, "University Intel", [8, 34, 34, 16, 16, 12, 14]);
  }

  // ══════════════════════════════════════
  // 10. PROGRAM INTELLIGENCE
  // ══════════════════════════════════════
  const cleanPrograms = (data.university_intel?.top_programs_by_views || []).filter(r => r.program_title && r.program_title.length > 1);
  if (cleanPrograms.length) {
    const totalPV = cleanPrograms.reduce((s, r) => s + r.views, 0) || 1;
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    PROGRAM INTELLIGENCE"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["RANK", "PROGRAM", "UNIVERSITY", "VIEWS", "UNIQUE VISITORS", "% SHARE"],
      ...cleanPrograms.map((r, i) =>
        [i + 1, r.program_title, r.university_name || "", r.views, r.unique_visitors, `${Math.round((r.views / totalPV) * 100)}%`] as Cell[]),
    ];
    addSheet(wb, rows, "Program Intel", [8, 40, 34, 14, 16, 12]);
  }

  // ══════════════════════════════════════
  // 11. CONTENT GAPS
  // ══════════════════════════════════════
  if (data.content_gaps) {
    const g = data.content_gaps;
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    CONTENT QUALITY GAPS"],
      ["═══════════════════════════════════════════════════"],
      ["Issues that reduce conversion and user trust"],
      [],
    ];

    const tuition = (g.universities_missing_tuition || []).filter(r => r.name_ar);
    if (tuition.length) {
      rows.push(
        ["───────────────────────────────────────────────────"],
        [`  UNIVERSITIES MISSING TUITION (${tuition.length} found)`],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "UNIVERSITY", "PAGE VIEWS", "PRIORITY", "BUSINESS IMPACT"],
      );
      tuition.forEach((r, i) => {
        const priority = r.views > 100 ? "CRITICAL" : r.views > 30 ? "HIGH" : "MEDIUM";
        const impact = r.views > 100 ? "High-traffic page without key info" : r.views > 30 ? "Moderate traffic at risk" : "Lower priority";
        rows.push([i + 1, r.name_ar, r.views, priority, impact]);
      });
      rows.push([]);
    }

    const deadlines = (g.programs_missing_deadlines || []).filter(r => r.title);
    if (deadlines.length) {
      rows.push(
        ["───────────────────────────────────────────────────"],
        [`  PROGRAMS MISSING DEADLINES (${deadlines.length} found)`],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "PROGRAM", "UNIVERSITY", "PAGE VIEWS", "URGENCY"],
      );
      deadlines.forEach((r, i) => {
        rows.push([i + 1, r.title, r.uni_name || "", r.views, r.views > 50 ? "HIGH" : "STANDARD"]);
      });
      rows.push([]);
    }

    const incomplete = (g.high_traffic_incomplete || []).filter(r => r.name_ar);
    if (incomplete.length) {
      rows.push(
        ["───────────────────────────────────────────────────"],
        [`  HIGH TRAFFIC INCOMPLETE PROFILES (${incomplete.length} found)`],
        ["───────────────────────────────────────────────────"],
        [],
        ["RANK", "UNIVERSITY", "PAGE VIEWS", "TOTAL PROGRAMS", "WITH TUITION", "COVERAGE %", "STATUS"],
      );
      incomplete.forEach((r, i) => {
        const cov = r.published_programs > 0 ? Math.round((r.with_tuition / r.published_programs) * 100) : 0;
        const status = cov < 30 ? "⚠ CRITICAL GAP" : cov < 70 ? "PARTIAL" : "MOSTLY COMPLETE";
        rows.push([i + 1, r.name_ar, r.views, r.published_programs, r.with_tuition, `${cov}%`, status]);
      });
    }

    if (rows.length > 5) addSheet(wb, rows, "Content Gaps", [8, 34, 14, 16, 16, 14, 22]);
  }

  // ══════════════════════════════════════
  // 12. ACTION MATRIX
  // ══════════════════════════════════════
  {
    const matrix = buildActionMatrix(data);
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    ACTION MATRIX"],
      ["═══════════════════════════════════════════════════"],
      ["Strategic priorities synthesized from all sections — use as management action plan"],
      [],
      ["───────────────────────────────────────────────────"],
      [`  ${matrix.length} ACTION ITEMS IDENTIFIED`],
      ["───────────────────────────────────────────────────"],
      [],
      ["#", "AREA", "ISSUE", "WHY IT MATTERS", "IMPACT", "PRIORITY", "RECOMMENDED ACTION"],
      ...matrix.map((m, i) => [i + 1, m.area, m.issue, m.why, m.impact, m.priority, m.action] as Cell[]),
    ];

    // Priority summary
    const high = matrix.filter(m => m.priority === "HIGH").length;
    const med = matrix.filter(m => m.priority === "MEDIUM").length;
    const mon = matrix.filter(m => m.priority === "MONITOR" || m.priority === "STANDARD").length;
    rows.push(
      [],
      ["───────────────────────────────────────────────────"],
      ["  PRIORITY SUMMARY"],
      ["───────────────────────────────────────────────────"],
      [],
      ["PRIORITY", "COUNT", "MEANING"],
      ["HIGH", high, "Requires immediate action — directly impacts conversion/revenue"],
      ["MEDIUM", med, "Should be addressed in next sprint — improves quality"],
      ["MONITOR/STANDARD", mon, "Track over time — no immediate action needed"],
    );

    addSheet(wb, rows, "Action Matrix", [6, 14, 36, 42, 12, 12, 46]);
  }

  // ══════════════════════════════════════
  // 13. METADATA
  // ══════════════════════════════════════
  {
    const rows: R = [
      ["═══════════════════════════════════════════════════"],
      ["    REPORT METADATA & PROVENANCE"],
      ["═══════════════════════════════════════════════════"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  REPORT IDENTITY"],
      ["───────────────────────────────────────────────────"],
      [],
      ["FIELD", "VALUE", "DESCRIPTION"],
      ["Report Title", "Executive Decision Report — Analyst Pack", ""],
      ["Generated At", data.generated_at, "When dashboard RPC computed the data"],
      ["Exported At", new Date().toISOString(), "When this XLSX file was created"],
      ["Report Version", "3.0", ""],
      ["Traffic Filter", "Known Real", "Only verified traffic used in metrics"],
      ["Cutover Date", data.overview?.analytics_truth_started_at ?? "Not configured", "When classification began"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  DATA INTEGRITY RULES"],
      ["───────────────────────────────────────────────────"],
      [],
      ["RULE", "STATUS", "EXPLANATION"],
      ["Identity Domain Separation", "ENFORCED", "visitor_id, user_id, and application_id are never mixed in conversion calculations"],
      ["Cross-Domain Conversion", "BLOCKED", "No conversion % is shown between steps using different identity domains"],
      ["Legacy Traffic Exclusion", "ENFORCED", "Pre-cutover unclassified traffic excluded from executive metrics"],
      ["Internal Traffic Exclusion", "ENFORCED", "Team, bot, and dev traffic always excluded"],
      ["Null/UUID Filtering", "ENFORCED", "Unnamed entities and UUID-only labels removed from decision-facing sheets"],
      ["Engaged Time Method", data.overview?.engaged_time_source ?? "N/A", "How visitor engagement duration is measured"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  ACQUISITION & AUDIENCE COVERAGE"],
      ["───────────────────────────────────────────────────"],
      [],
      ["DIMENSION", "STATUS", "NOTE"],
      ["Device Type", "Available", "Tracked via device_breakdown in engagement data"],
      ["Browser", "Not yet available", "Not in current tracking baseline — planned"],
      ["Operating System", "Not yet available", "Not in current tracking baseline — planned"],
      ["Source / Channel", "Not yet available", "UTM tracking not yet implemented"],
      ["Country (Audience)", "Partial", "Available via search country filters; direct geo-IP not yet tracked"],
      [],
      ["───────────────────────────────────────────────────"],
      ["  SHEET INDEX"],
      ["───────────────────────────────────────────────────"],
      [],
      ["SHEET", "PURPOSE", "DATA QUALITY"],
      ["Summary", "Executive KPIs with computed ratios and trends", "Known Real only"],
      ["Traffic Trust", "Traffic classification breakdown and trust guide", "All classifications shown"],
      ["Daily Trend", "Day-by-day analysis with statistics and vs-average", "Known Real only"],
      ["Engagement", "Pages, devices, hourly patterns, exits with benchmarks", "Known Real only"],
      ["Discovery Funnel", "Landing to shortlist conversion with warnings", "Domain-separated"],
      ["Account Funnel", "Registration to activation flow", "Domain-separated"],
      ["Revenue Funnel", "Application to payment pipeline", "Domain-separated"],
      ["Search Intel", "Search behavior, filters, conversion rates", "Known Real only"],
      ["University Intel", "Rankings by views and shortlist (cleaned)", "No UUID/null rows"],
      ["Program Intel", "Program rankings by views (cleaned)", "No unnamed entries"],
      ["Content Gaps", "Missing data with priority and impact assessment", "Named entities only"],
      ["Action Matrix", "Strategic priorities with recommendations", "Synthesized"],
      ["Metadata", "This sheet — provenance and integrity rules", "—"],
    ];
    addSheet(wb, rows, "Metadata", [32, 52, 36]);
  }

  // ══════════════════════════════════════
  // WRITE & DOWNLOAD
  // ══════════════════════════════════════
  XLSX.writeFile(wb, `executive-analyst-pack-${stamp}.xlsx`);
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

type Cell = string | number;
type R = Cell[][];

function p(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function humanizeStep(step: string): string {
  return step.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function addSheet(wb: XLSX.WorkBook, data: Cell[][], name: string, colWidths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(data);

  if (colWidths?.length) {
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
  } else {
    const maxCols = Math.max(...data.map(r => r.length), 0);
    ws["!cols"] = Array.from({ length: maxCols }, (_, ci) => {
      let max = 10;
      data.forEach(row => {
        const len = String(row[ci] ?? "").length;
        if (len > max) max = len;
      });
      return { wch: Math.min(max + 2, 55) };
    });
  }

  // Freeze panes — use !views which works in xlsx library
  ws["!views"] = [{ state: "frozen", ySplit: 3 }];

  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ═══════════════════════════════════════
// ACTION MATRIX
// ═══════════════════════════════════════

interface ActionMatrixRow {
  area: string; issue: string; why: string; impact: string; priority: string; action: string;
}

function buildActionMatrix(data: DecisionDashboardData): ActionMatrixRow[] {
  const rows: ActionMatrixRow[] = [];
  const o = data.overview;

  if (o && o.visitors_7d > 0) {
    rows.push({
      area: "Traffic",
      issue: o.visitors_7d < 100 ? "Low traffic volume" : "Traffic baseline established",
      why: o.visitors_7d < 100 ? "Small sample makes metrics unreliable" : "Sufficient data for trend analysis",
      impact: o.visitors_7d < 100 ? "High" : "Positive",
      priority: o.visitors_7d < 100 ? "HIGH" : "MONITOR",
      action: o.visitors_7d < 100 ? "Increase acquisition channels and campaigns" : "Continue monitoring daily trends",
    });

    const regRate = o.registrations_7d / o.visitors_7d * 100;
    rows.push({
      area: "Conversion",
      issue: `Registration rate: ${regRate.toFixed(1)}%`,
      why: "Registration is the gateway to application and revenue",
      impact: regRate < 5 ? "High" : "Medium",
      priority: regRate < 5 ? "HIGH" : "MONITOR",
      action: regRate < 5 ? "Improve registration CTA visibility and value proposition" : "Maintain current registration flow",
    });
  }

  if (data.engagement?.bounce_rate > 0) {
    const br = data.engagement.bounce_rate;
    rows.push({
      area: "Engagement",
      issue: `Bounce rate: ${br}%`,
      why: "High bounce = visitors don't find what they need",
      impact: br > 60 ? "High" : "Medium",
      priority: br > 60 ? "HIGH" : "MONITOR",
      action: br > 60 ? "Review top landing pages and improve content relevance" : "Continue A/B testing",
    });
  }

  const tuition = data.content_gaps?.universities_missing_tuition?.filter(r => r.name_ar) || [];
  if (tuition.length) {
    rows.push({
      area: "Content",
      issue: `${tuition.length} universities missing tuition`,
      why: "Tuition is a top-3 student decision factor",
      impact: "High",
      priority: "HIGH",
      action: "Prioritize tuition data for top-traffic universities",
    });
  }

  const deadlines = data.content_gaps?.programs_missing_deadlines?.filter(r => r.title) || [];
  if (deadlines.length) {
    rows.push({
      area: "Content",
      issue: `${deadlines.length} programs missing deadlines`,
      why: "Missing deadlines reduce application urgency",
      impact: "Medium",
      priority: "MEDIUM",
      action: "Add deadline data for highest-traffic programs",
    });
  }

  if (data.search_intel) {
    rows.push({
      area: "Search",
      issue: data.search_intel.total_searches_30d > 0
        ? `${data.search_intel.total_searches_30d} searches in 30d`
        : "No search data recorded yet",
      why: data.search_intel.total_searches_30d > 0
        ? "Search reveals demand patterns and unmet needs"
        : "Cannot understand user intent without search data",
      impact: "Medium",
      priority: "MEDIUM",
      action: data.search_intel.total_searches_30d > 0
        ? "Map top search filters to content gaps"
        : "Verify search tracking is properly wired",
    });
  }

  if (data.funnels?.length) {
    rows.push({
      area: "Analytics",
      issue: "Multi-funnel model with domain separation",
      why: "Cross-domain conversion would produce misleading metrics",
      impact: "Informational",
      priority: "STANDARD",
      action: "Optimize each funnel (Discovery, Account, Revenue) independently",
    });
  }

  if (!rows.length) {
    rows.push({
      area: "General",
      issue: "Baseline data collecting",
      why: "System healthy, data volume building",
      impact: "Low",
      priority: "MONITOR",
      action: "Re-export when data volume increases",
    });
  }

  return rows;
}
