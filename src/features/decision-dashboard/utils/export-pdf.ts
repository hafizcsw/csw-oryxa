import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DecisionDashboardData, FunnelStep } from "../types";

// ─── Premium Color Palette ───
const C = {
  navy:       [12, 35, 64]   as const,
  royal:      [37, 99, 235]  as const,
  sky:        [96, 165, 250] as const,
  skyFade:    [219, 234, 254] as const,
  ink:        [15, 23, 42]   as const,
  charcoal:   [30, 41, 59]   as const,
  slate:      [71, 85, 105]  as const,
  steel:      [148, 163, 184] as const,
  fog:        [226, 232, 240] as const,
  cloud:      [241, 245, 249] as const,
  snow:       [248, 250, 252] as const,
  white:      [255, 255, 255] as const,
  emerald:    [16, 185, 129] as const,
  emeraldBg:  [209, 250, 229] as const,
  amber:      [245, 158, 11] as const,
  amberBg:    [254, 243, 199] as const,
  rose:       [225, 29, 72]  as const,
  roseBg:     [255, 228, 230] as const,
  violet:     [124, 58, 237] as const,
};

type RGB = readonly [number, number, number];

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 12;

// Track which sections were suppressed
const suppressedSections: string[] = [];

export async function exportDashboardToPdf(data: DecisionDashboardData) {
  suppressedSections.length = 0;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ts = new Date(data.generated_at);
  const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`;
  const dateStr = ts.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const cutoverDate = data.overview?.analytics_truth_started_at
    ? new Date(data.overview.analytics_truth_started_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not configured";

  // ═══════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════
  fill(doc, C.navy, 0, 0, PAGE_W, PAGE_H);
  try {
    doc.setFillColor(37, 99, 235);
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.circle(PAGE_W + 20, 60, 120, "F");
    doc.circle(-30, PAGE_H - 40, 80, "F");
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  } catch { /* GState not available */ }

  fill(doc, C.royal, 0, 0, 5, PAGE_H);

  // Badge
  fill(doc, C.royal, MARGIN + 10, 55, 58, 7, 3);
  txt(doc, "EXECUTIVE REPORT", C.white, 7, MARGIN + 13, 60.5);

  // Title
  txt(doc, "Executive", C.white, 38, MARGIN + 10, 85, "bold");
  txt(doc, "Decision Report", C.skyFade as unknown as RGB, 38, MARGIN + 10, 100, "bold");

  // Accent line
  doc.setDrawColor(...C.royal);
  doc.setLineWidth(1.2);
  doc.line(MARGIN + 10, 110, MARGIN + 80, 110);

  // Meta block
  const metas = [
    ["Report Date", `${dateStr} at ${timeStr}`],
    ["Traffic Mode", "Known Real (Trusted Only)"],
    ["Cutover Date", cutoverDate],
    ["Report Type", "Executive Decision Report v3.0"],
  ];
  metas.forEach(([label, val], i) => {
    const my = 125 + i * 10;
    txt(doc, label, C.steel, 8, MARGIN + 10, my);
    txt(doc, val, C.skyFade as unknown as RGB, 9, MARGIN + 48, my);
  });

  // Confidentiality
  doc.setDrawColor(...C.slate);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);
  txt(doc, "CONFIDENTIAL", C.rose as unknown as RGB, 9, MARGIN + 10, PAGE_H - 32, "bold");
  txt(doc, "This report contains proprietary business intelligence data.", C.steel, 7, MARGIN + 10, PAGE_H - 26);
  txt(doc, "Distribution restricted to authorized decision makers only.", C.steel, 7, MARGIN + 10, PAGE_H - 21);

  // ═══════════════════════════════════════
  // PAGE 2: EXECUTIVE SNAPSHOT
  // ═══════════════════════════════════════
  doc.addPage();
  let y = pageHeader(doc, "Executive Snapshot", "What leadership needs to know right now");

  if (data.overview) {
    const o = data.overview;

    // ── Top KPIs (6 most important) ──
    const topKpis = [
      { label: "Visitors (7d)", value: fmt(o.visitors_7d), sub: `${fmt(o.visitors_24h)} in 24h`, color: C.royal },
      { label: "Registrations (7d)", value: fmt(o.registrations_7d), sub: `${fmt(o.registrations_24h)} in 24h`, color: C.violet },
      { label: "Applications (24h)", value: fmt(o.application_starts_24h), sub: `${fmt(o.application_starts_7d || 0)} in 7d`, color: C.emerald },
      { label: "Pageviews (7d)", value: fmt(o.pageviews_7d), sub: `${fmt(o.pageviews_24h)} in 24h`, color: C.sky as unknown as RGB },
      { label: "Shortlists (7d)", value: fmt(o.shortlist_adds_7d), sub: `${fmt(o.shortlist_adds_24h)} in 24h`, color: C.amber },
      { label: "Returning %", value: `${o.returning_visitors_pct}%`, sub: `Engaged: ${Math.round(o.avg_engaged_time_sec)}s avg`, color: C.navy },
    ];

    const cols = 3;
    const gap = 4;
    const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
    const cardH = 28;

    topKpis.forEach((kpi, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = MARGIN + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      fill(doc, C.white, cx, cy, cardW, cardH, 3);
      doc.setDrawColor(...C.fog);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "S");
      fill(doc, kpi.color as RGB, cx, cy, cardW, 3, 1);
      txt(doc, kpi.label, C.slate, 7, cx + 5, cy + 11);
      txt(doc, kpi.value, C.ink, 20, cx + 5, cy + 22, "bold");
      txt(doc, kpi.sub, C.steel, 6, cx + cardW - 5, cy + 22, "normal", "right");
    });

    y += Math.ceil(topKpis.length / cols) * (cardH + gap) + 6;

    // ── Management Summary ──
    sectionLabel(doc, y, "Management Summary"); y += 8;
    const summaryLines = buildManagementSummary(data);
    summaryLines.forEach(line => {
      if (y > PAGE_H - 35) { doc.addPage(); y = pageHeader(doc, "Executive Snapshot (cont.)", ""); }
      txt(doc, line, C.charcoal, 8, MARGIN + 4, y);
      y += 5;
    });
    y += 4;

    // ── What Matters Now ──
    const mattersItems = buildWhatMattersNow(data);
    const mattersH = fillBoxHeight(mattersItems);
    if (y + mattersH < PAGE_H - 30) {
      fillBox(doc, y, "What Matters Now", mattersItems, C.royal);
      y += mattersH + 4;
    }

    // ── What Is Missing ──
    const missing = buildWhatIsMissing(data);
    if (missing.length) {
      const missingH = fillBoxHeight(missing);
      if (y + missingH < PAGE_H - 30) {
        fillBox(doc, y, "What Is Missing / Changed", missing, C.amber);
        y += missingH + 4;
      }
    }
  }

  // ═══════════════════════════════════════
  // PAGE 3: TRAFFIC QUALITY & TRUST
  // ═══════════════════════════════════════
  if (data.overview?.truth_buckets) {
    doc.addPage();
    y = pageHeader(doc, "Traffic Quality & Trust", "Which numbers you can trust for decisions");

    const tb = data.overview.truth_buckets;
    const totalV = Math.max(tb.all_traffic?.visitors ?? 1, 1);
    const buckets = [
      { name: "Known Real", desc: "Verified current traffic — basis for all decisions in this report", v: tb.known_real?.visitors ?? 0, p: tb.known_real?.pageviews ?? 0, color: C.emerald, bg: C.emeraldBg },
      { name: "Unknown Legacy", desc: "Older traffic without classification — excluded from executive metrics", v: tb.unknown_legacy?.visitors ?? 0, p: tb.unknown_legacy?.pageviews ?? 0, color: C.amber, bg: C.amberBg },
      { name: "Internal / Test", desc: "Team members, bots, development — always excluded", v: tb.known_internal_or_test?.visitors ?? 0, p: tb.known_internal_or_test?.pageviews ?? 0, color: C.rose, bg: C.roseBg },
    ];

    // Visual proportion chart
    const chartY = y;
    const chartH = 16;
    fill(doc, C.fog, MARGIN, chartY, CONTENT_W, chartH, 4);

    let xOff = MARGIN;
    buckets.forEach(b => {
      const w = (b.v / totalV) * CONTENT_W;
      if (w > 1) {
        fill(doc, b.color as RGB, xOff, chartY, w, chartH, 0);
        if (w > 20) {
          const pctLabel = `${Math.round((b.v / totalV) * 100)}%`;
          txt(doc, pctLabel, C.white, 9, xOff + w / 2, chartY + 10, "bold", "center");
        }
        xOff += w;
      }
    });
    y += chartH + 8;

    // Legend + details
    buckets.forEach((b, i) => {
      const by = y + i * 20;
      fill(doc, C.white, MARGIN, by, CONTENT_W, 16, 2);
      doc.setDrawColor(...C.fog);
      doc.roundedRect(MARGIN, by, CONTENT_W, 16, 2, 2, "S");
      fill(doc, b.color as RGB, MARGIN + 3, by + 3, 3, 10, 1);
      txt(doc, b.name, C.ink, 10, MARGIN + 10, by + 7, "bold");
      txt(doc, b.desc, C.steel, 6.5, MARGIN + 10, by + 12);
      txt(doc, `${fmt(b.v)} visitors · ${fmt(b.p)} pageviews`, C.charcoal, 8, CONTENT_W + MARGIN - 5, by + 9, "normal", "right");
    });
    y += buckets.length * 20 + 8;

    // Trust explanation
    callout(doc, y, "All executive metrics in this report use Known Real traffic only. Legacy and internal data are excluded from KPIs and conversion analysis.", C.emerald);
    y += 16;

    if (data.overview?.analytics_truth_started_at) {
      callout(doc, y, `Data quality tracking began on ${cutoverDate}. Traffic before this date is classified as Legacy.`, C.amber);
    }
  } else {
    suppressedSections.push("Traffic Quality (no truth_buckets data)");
  }

  // ═══════════════════════════════════════
  // DAILY TREND (independent of engagement)
  // ═══════════════════════════════════════
  if (data.overview?.daily_trend?.length && data.overview.daily_trend.some(d => d.visitors > 0 || d.pageviews > 0)) {
    doc.addPage();
    y = pageHeader(doc, "Daily Trend", "Visitors & pageviews over time");
    y = drawDailyTrendChart(doc, y, data.overview.daily_trend);

    // Data table below chart
    styledTable(doc, y, {
      head: [["Day", "Visitors", "Pageviews", "V/P Ratio"]],
      body: data.overview.daily_trend.map(d => [
        new Date(d.day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        fmt(d.visitors),
        fmt(d.pageviews),
        d.visitors > 0 ? (d.pageviews / d.visitors).toFixed(1) : "—",
      ]),
    });
  } else {
    suppressedSections.push("Daily Trend (no trend data available)");
  }

  // ═══════════════════════════════════════
  // BEHAVIOR & ENGAGEMENT
  // ═══════════════════════════════════════
  if (data.engagement && hasEngagementData(data.engagement)) {
    doc.addPage();
    y = pageHeader(doc, "Behavior & Engagement", "How visitors interact with your platform");
    const eng = data.engagement;

    // KPI row
    const engKpis = [
      { label: "Bounce Rate", value: `${eng.bounce_rate}%`, color: eng.bounce_rate > 60 ? C.rose : C.emerald },
      { label: "Avg Engaged Time", value: `${Math.round(data.overview?.avg_engaged_time_sec ?? 0)}s`, color: C.royal },
      { label: "Active Now", value: fmt(data.overview?.active_now ?? 0), color: C.emerald },
    ];
    y = kpiRow(doc, y, engKpis);

    // Acquisition/Audience — Device breakdown
    if (eng.device_breakdown?.length) {
      sectionLabel(doc, y, "Audience: Device Breakdown"); y += 6;
      const totalDev = eng.device_breakdown.reduce((s, d) => s + d.visitors, 0) || 1;
      eng.device_breakdown.forEach((d, i) => {
        const dy = y + i * 10;
        const pct = d.visitors / totalDev;
        txt(doc, d.device || "Unknown", C.charcoal, 8, MARGIN + 2, dy + 5);
        fill(doc, C.cloud, MARGIN + 35, dy + 1, 90, 6, 2);
        fill(doc, C.royal, MARGIN + 35, dy + 1, 90 * pct, 6, 2);
        txt(doc, `${fmt(d.visitors)} (${Math.round(pct * 100)}%)`, C.charcoal, 7, MARGIN + 130, dy + 5);
      });
      y += eng.device_breakdown.length * 10 + 6;
    }

    // Top pages
    if (eng.top_pages_by_views?.length) {
      if (y + 25 > PAGE_H - 30) { doc.addPage(); y = pageHeader(doc, "Behavior & Engagement (cont.)", ""); }
      sectionLabel(doc, y, "Top Pages by Traffic"); y += 6;
      styledTable(doc, y, {
        head: [["#", "Page", "Views", "Unique Visitors"]],
        body: eng.top_pages_by_views.slice(0, 10).map((p, i) => [
          `${i + 1}`, cleanRoute(p.page_route), fmt(p.views), fmt(p.unique_visitors),
        ]),
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Hourly pattern
    if (eng.hourly_pattern?.length) {
      if (y + 55 > PAGE_H - 30) { doc.addPage(); y = pageHeader(doc, "Activity Pattern", "Visitor distribution across 24 hours"); }
      sectionLabel(doc, y, "Hourly Activity (24h)"); y += 6;
      const maxHr = Math.max(...eng.hourly_pattern.map(h => h.visitors), 1);
      const hBarW = (CONTENT_W - 4) / 24 - 1;
      fill(doc, C.snow, MARGIN, y, CONTENT_W, 50, 3);
      eng.hourly_pattern.forEach((h, i) => {
        const pctH = h.visitors / maxHr;
        const barH = pctH * 36;
        const bx = MARGIN + 2 + i * (hBarW + 1);
        fill(doc, C.royal, bx, y + 40 - barH, hBarW, barH, 1);
        txt(doc, `${h.hr}`, C.steel, 4.5, bx + hBarW / 2, y + 47, "normal", "center");
      });
      y += 55;
    }

    // Exit pages
    if (eng.top_exit_pages?.length) {
      if (y + 25 > PAGE_H - 30) { doc.addPage(); y = pageHeader(doc, "Behavior & Engagement (cont.)", ""); }
      sectionLabel(doc, y, "Top Exit Pages"); y += 6;
      styledTable(doc, y, {
        head: [["#", "Page", "Exits"]],
        body: eng.top_exit_pages.slice(0, 8).map((p, i) => [`${i + 1}`, cleanRoute(p.page_route), fmt(p.exit_count)]),
        headColor: C.rose,
      });
    }
  } else {
    suppressedSections.push("Behavior & Engagement (insufficient data)");
  }

  // ═══════════════════════════════════════
  // DECISION FUNNELS
  // ═══════════════════════════════════════
  const renderFunnel = (steps: FunnelStep[], title: string, subtitle: string) => {
    // Suppress entire funnel if ALL meaningful visitors are zero
    const totalVisitors = steps.reduce((s, st) => s + st.visitors, 0);
    if (totalVisitors === 0) { suppressedSections.push(`Funnel: ${title} (all steps at zero)`); return; }
    const cleanSteps = steps.filter(s => s.visitors > 0);
    if (!cleanSteps.length) { suppressedSections.push(`Funnel: ${title} (no data)`); return; }

    doc.addPage();
    y = pageHeader(doc, `Decision Funnel: ${title}`, subtitle);

    const maxV = Math.max(...cleanSteps.map(s => s.visitors), 1);
    const funnelColors = [C.royal, C.sky as unknown as RGB, C.violet, C.emerald, C.amber, C.rose as unknown as RGB, C.navy, C.slate];

    // Visual funnel
    cleanSteps.forEach((step, i) => {
      const sy = y + i * 20;
      if (sy > PAGE_H - 50) return;

      const pctW = Math.max(step.visitors / maxV, 0.03);
      const barW = pctW * (CONTENT_W - 70);
      const offset = (CONTENT_W - 70 - barW) / 2;
      const clr = funnelColors[i % funnelColors.length];
      const stepName = humanizeStep(step.step);

      // Step label
      txt(doc, stepName, C.charcoal, 8, MARGIN, sy + 7, "bold");

      // Bar
      fill(doc, clr, MARGIN + 55 + offset, sy, barW, 14, 3);

      // Value inside/outside bar
      if (barW > 30) {
        txt(doc, fmt(step.visitors), C.white, 10, MARGIN + 55 + offset + 5, sy + 9, "bold");
      } else {
        txt(doc, fmt(step.visitors), C.charcoal, 9, MARGIN + 55 + offset + barW + 3, sy + 9);
      }

      // Domain badge
      const domainText = step.identity_domain.replace("_id", "");
      txt(doc, domainText, C.steel, 5.5, CONTENT_W + MARGIN - 2, sy + 5, "normal", "right");

      // Warning if domain/source changed
      if (i > 0) {
        const prev = cleanSteps[i - 1];
        if (step.identity_domain !== prev.identity_domain) {
          fill(doc, C.amberBg as unknown as RGB, CONTENT_W + MARGIN - 40, sy + 7, 40, 5, 1);
          txt(doc, "⚠ Domain changed — no conversion", C.amber, 4.5, CONTENT_W + MARGIN - 38, sy + 10.5);
        } else if (step.count_source !== prev.count_source) {
          fill(doc, C.amberBg as unknown as RGB, CONTENT_W + MARGIN - 40, sy + 7, 40, 5, 1);
          txt(doc, "⚠ Source changed", C.amber, 4.5, CONTENT_W + MARGIN - 38, sy + 10.5);
        } else if (prev.visitors > 0) {
          const conv = ((step.visitors / prev.visitors) * 100).toFixed(1);
          txt(doc, `${conv}%`, C.emerald, 7, CONTENT_W + MARGIN - 2, sy + 12, "normal", "right");
        }
      }
    });

    y += cleanSteps.length * 20 + 6;

    // Detail table
    if (y + 20 < PAGE_H - 30) {
      styledTable(doc, y, {
        head: [["Step", "Count", "Domain", "Source", "Conversion"]],
        body: cleanSteps.map((s, i) => {
          const prev = i > 0 ? cleanSteps[i - 1] : s;
          const domainChanged = i > 0 && s.identity_domain !== prev.identity_domain;
          const sourceChanged = i > 0 && s.count_source !== prev.count_source;
          let conv = "—";
          if (i === 0) conv = "Entry";
          else if (domainChanged) conv = "N/A (domain changed)";
          else if (sourceChanged) conv = "N/A (source changed)";
          else if (prev.visitors > 0) conv = `${((s.visitors / prev.visitors) * 100).toFixed(1)}%`;
          return [humanizeStep(s.step), fmt(s.visitors), s.identity_domain, s.count_source || "events", conv];
        }),
        warnCol: 4,
      });
    }
  };

  if (data.funnels?.length) {
    for (const fg of data.funnels) {
      const name = fg.name.charAt(0).toUpperCase() + fg.name.slice(1);
      const subs: Record<string, string> = {
        Discovery: "From landing to shortlist — how visitors explore",
        Account: "From registration to account activation",
        Revenue: "From application to payment completion",
      };
      renderFunnel(fg.steps, name, subs[name] || "Conversion flow analysis");
    }
  } else if (data.funnel?.length) {
    renderFunnel(data.funnel, "Combined", "Full conversion flow across all stages");
  }

  // ═══════════════════════════════════════
  // SEARCH INTELLIGENCE (suppress if weak)
  // ═══════════════════════════════════════
  if (data.search_intel) {
    const s = data.search_intel;
    const hasSearchData = s.total_searches_30d > 0 || (s.top_country_filters?.length ?? 0) > 0;

    if (hasSearchData) {
      doc.addPage();
      y = pageHeader(doc, "Search Intelligence", "What visitors are looking for");

      const skpis = [
        { label: "Total Searches (30d)", value: fmt(s.total_searches_30d), color: C.royal },
        { label: "Search → Click", value: `${s.search_to_click_pct}%`, color: C.emerald },
        { label: "Search → Shortlist", value: `${s.search_to_shortlist_pct}%`, color: C.violet },
      ];
      y = kpiRow(doc, y, skpis);

      if (s.top_country_filters?.length) {
        sectionLabel(doc, y, "Most Searched Countries"); y += 6;
        styledTable(doc, y, {
          head: [["#", "Country", "Searches", "Unique Users"]],
          body: s.top_country_filters.filter(r => r.filter_val).slice(0, 10).map((r, i) => [
            `${i + 1}`, r.filter_val, fmt(r.uses), fmt(r.unique_users),
          ]),
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      if (s.top_degree_filters?.length && y + 20 < PAGE_H - 30) {
        sectionLabel(doc, y, "Most Searched Degrees"); y += 6;
        styledTable(doc, y, {
          head: [["#", "Degree Level", "Searches"]],
          body: s.top_degree_filters.filter(r => r.filter_val).slice(0, 8).map((r, i) => [
            `${i + 1}`, r.filter_val, fmt(r.uses),
          ]),
          headColor: C.violet,
        });
      }
    } else {
      suppressedSections.push("Search Intelligence (no search events recorded yet)");
    }
  }

  // ═══════════════════════════════════════
  // ENTITY INTELLIGENCE (only if clean data)
  // ═══════════════════════════════════════
  if (data.university_intel) {
    const u = data.university_intel;
    const cleanViews = (u.top_by_views || []).filter(r => r.name_ar && r.name_ar.length > 1);
    const cleanShortlist = (u.top_by_shortlist || []).filter(r => r.name_ar && r.name_ar.length > 1);
    const cleanPrograms = (u.top_programs_by_views || []).filter(r => r.program_title && r.program_title.length > 1);

    if (cleanViews.length || cleanShortlist.length || cleanPrograms.length) {
      doc.addPage();
      y = pageHeader(doc, "Entity Intelligence", "University and program performance rankings");

      callout(doc, y, `Data Source: ${u.data_source.replace(/_/g, " ")}`, C.royal);
      y += 14;

      if (cleanViews.length) {
        sectionLabel(doc, y, "Top Universities by Views"); y += 6;
        styledTable(doc, y, {
          head: [["#", "University", "Views", "Unique Visitors"]],
          body: cleanViews.slice(0, 10).map((r, i) => [`${i + 1}`, r.name_ar, fmt(r.views), fmt(r.unique_visitors)]),
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      if (cleanShortlist.length && y + 25 < PAGE_H - 30) {
        sectionLabel(doc, y, "Top Universities by Shortlist"); y += 6;
        styledTable(doc, y, {
          head: [["#", "University", "Adds", "Unique Users"]],
          body: cleanShortlist.slice(0, 8).map((r, i) => [`${i + 1}`, r.name_ar, fmt(r.adds), fmt(r.unique_users)]),
          headColor: C.violet,
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      if (cleanPrograms.length) {
        if (y + 25 > PAGE_H - 30) { doc.addPage(); y = pageHeader(doc, "Program Intelligence", "Top programs by traffic"); }
        sectionLabel(doc, y, "Top Programs by Views"); y += 6;
        styledTable(doc, y, {
          head: [["#", "Program", "University", "Views"]],
          body: cleanPrograms.slice(0, 10).map((r, i) => [`${i + 1}`, r.program_title, r.university_name, fmt(r.views)]),
          headColor: C.emerald,
        });
      }
    } else {
      suppressedSections.push("Entity Intelligence (no human-readable entity data)");
    }
  }

  // ═══════════════════════════════════════
  // CONTENT GAPS → MANAGEMENT ACTION LIST
  // ═══════════════════════════════════════
  if (data.content_gaps) {
    const g = data.content_gaps;
    const gapActions = buildContentGapActions(g);

    if (gapActions.length) {
      doc.addPage();
      y = pageHeader(doc, "Content Quality Gaps", "Issues requiring action — sorted by business impact");

      styledTable(doc, y, {
        head: [["#", "Issue", "Impact", "Priority", "Recommended Action"]],
        body: gapActions.map((a, i) => [`${i + 1}`, a.issue, a.impact, a.priority, a.action]),
      });
    } else {
      suppressedSections.push("Content Gaps (no actionable gaps found)");
    }
  }

  // ═══════════════════════════════════════
  // ACTION MATRIX (MANDATORY)
  // ═══════════════════════════════════════
  doc.addPage();
  y = pageHeader(doc, "Action Matrix", "Strategic priorities and recommended next steps");

  // Intro
  txt(doc, "This matrix synthesizes findings from all dashboard sections into concrete management actions.", C.charcoal, 8, MARGIN, y);
  y += 8;

  const matrix = buildActionMatrix(data);

  styledTable(doc, y, {
    head: [["Area", "Issue", "Why It Matters", "Impact", "Priority", "Recommended Action"]],
    body: matrix.map(m => [m.area, m.issue, m.why, m.impact, m.priority, m.action]),
    headColor: C.navy,
  });

  // ═══════════════════════════════════════
  // APPENDIX
  // ═══════════════════════════════════════
  doc.addPage();
  y = pageHeader(doc, "Appendix", "Technical notes, caveats, and suppressed sections");

  sectionLabel(doc, y, "Data Methodology & Caveats"); y += 8;
  const caveats = [
    "• All executive metrics use 'Known Real' traffic only. Legacy and internal data are excluded.",
    "• Conversion percentages are only calculated within the same identity domain (visitor_id, user_id, or application_id).",
    "• Cross-domain conversion is explicitly blocked to prevent misleading metrics.",
    `• Engaged time is measured via ${data.overview?.engaged_time_source || "heartbeat"} method (30-second intervals).`,
    `• Report generated from live data at ${dateStr} ${timeStr}.`,
    "• Search attribution uses per-visitor-id methodology for consistency.",
  ];
  caveats.forEach(c => {
    txt(doc, c, C.charcoal, 7, MARGIN + 2, y); y += 5.5;
  });
  y += 6;

  // Acquisition/Audience data availability note
  sectionLabel(doc, y, "Acquisition & Audience Coverage"); y += 8;
  const acqNotes = [
    "• Device breakdown: Available (from current tracking baseline).",
    "• Browser / OS / Source / Channel: Not yet available in current tracking baseline.",
    "• Country (audience): Available via search filter analysis; direct geo-IP not yet tracked.",
    "• These fields will be added to the executive report as tracking coverage expands.",
  ];
  acqNotes.forEach(n => {
    txt(doc, n, C.charcoal, 7, MARGIN + 2, y); y += 5.5;
  });
  y += 6;

  if (suppressedSections.length) {
    sectionLabel(doc, y, "Suppressed Sections"); y += 8;
    txt(doc, "The following sections were removed from the main report due to insufficient or low-quality data:", C.steel, 7, MARGIN + 2, y);
    y += 6;
    suppressedSections.forEach(s => {
      txt(doc, `• ${s}`, C.charcoal, 7, MARGIN + 4, y); y += 5;
    });
    y += 6;
    txt(doc, "Full technical detail for suppressed sections is available in the XLSX Analyst Pack export.", C.steel, 7, MARGIN + 2, y);
  }

  // ═══════════════════════════════════════
  // PAGE NUMBERS & FOOTERS
  // ═══════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.fog);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y - 3, PAGE_W - MARGIN, FOOTER_Y - 3);
    txt(doc, `Executive Decision Report — ${stamp} — Confidential`, C.steel, 6, MARGIN, FOOTER_Y);
    txt(doc, `${i} / ${totalPages}`, C.steel, 7, PAGE_W - MARGIN, FOOTER_Y, "normal", "right");
  }

  doc.save(`executive-decision-report-${stamp}.pdf`);
}

// ═══════════════════════════════════════
// DESIGN SYSTEM HELPERS
// ═══════════════════════════════════════

function fill(doc: jsPDF, color: RGB, x: number, y: number, w: number, h: number, r = 0) {
  doc.setFillColor(color[0], color[1], color[2]);
  if (r > 0) doc.roundedRect(x, y, w, h, r, r, "F");
  else doc.rect(x, y, w, h, "F");
}

function txt(doc: jsPDF, t: string, color: RGB, size: number, x: number, y: number, style: "normal" | "bold" = "normal", align: "left" | "right" | "center" = "left") {
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont("helvetica", style);
  doc.text(t, x, y, { align });
}

function pageHeader(doc: jsPDF, title: string, subtitle: string): number {
  fill(doc, C.navy, 0, 0, PAGE_W, 22);
  fill(doc, C.royal, 0, 22, PAGE_W, 1.5);
  txt(doc, title, C.white, 13, MARGIN, 14, "bold");
  if (subtitle) {
    txt(doc, subtitle, C.steel, 7.5, MARGIN, 30);
    return 38;
  }
  return 32;
}

function sectionLabel(doc: jsPDF, y: number, label: string, color: RGB = C.charcoal) {
  fill(doc, color, MARGIN, y, 2.5, 5, 1);
  txt(doc, label, color, 9, MARGIN + 6, y + 4, "bold");
}

function callout(doc: jsPDF, y: number, message: string, color: RGB) {
  fill(doc, C.snow, MARGIN, y, CONTENT_W, 10, 2);
  fill(doc, color, MARGIN, y, 3, 10, 1);
  txt(doc, message, C.charcoal, 7, MARGIN + 7, y + 6.5);
}

function fillBoxHeight(items: string[]): number {
  return 7 + items.length * 5 + 3;
}

function fillBox(doc: jsPDF, y: number, title: string, items: string[], color: RGB) {
  const boxH = fillBoxHeight(items);
  fill(doc, C.snow, MARGIN, y, CONTENT_W, boxH, 3);
  fill(doc, color, MARGIN, y, CONTENT_W, 7, 1);
  txt(doc, title, C.white, 8, MARGIN + 4, y + 5, "bold");
  items.forEach((item, i) => {
    txt(doc, `• ${item}`, C.charcoal, 7, MARGIN + 4, y + 12 + i * 5);
  });
}

function kpiRow(doc: jsPDF, y: number, kpis: Array<{ label: string; value: string; color: RGB }>): number {
  const cols = kpis.length;
  const gap = 4;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 20;
  kpis.forEach((k, i) => {
    const cx = MARGIN + i * (cardW + gap);
    fill(doc, C.white, cx, y, cardW, cardH, 3);
    doc.setDrawColor(...C.fog);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, cardH, 3, 3, "S");
    fill(doc, k.color, cx, y, cardW, 2.5, 1);
    txt(doc, k.label, C.steel, 7, cx + 4, y + 9);
    txt(doc, k.value, C.ink, 14, cx + 4, y + 17, "bold");
  });
  return y + cardH + 8;
}

interface TableOpts {
  head: string[][];
  body: string[][];
  headColor?: RGB;
  warnCol?: number;
}

function styledTable(doc: jsPDF, y: number, opts: TableOpts) {
  const headColor = opts.headColor || C.navy;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: opts.head,
    body: opts.body,
    styles: {
      fontSize: 7,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: C.fog as unknown as [number, number, number],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: headColor as [number, number, number],
      textColor: C.white as unknown as [number, number, number],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: C.snow as unknown as [number, number, number],
    },
    bodyStyles: {
      textColor: C.charcoal as unknown as [number, number, number],
    },
    theme: "grid",
    ...(opts.warnCol !== undefined ? {
      columnStyles: {
        [opts.warnCol]: { fontStyle: "italic", textColor: C.amber as unknown as [number, number, number] },
      },
    } : {}),
  });
}

function drawDailyTrendChart(doc: jsPDF, y: number, trend: Array<{ day: string; visitors: number; pageviews: number }>): number {
  const maxV = Math.max(...trend.map(d => d.visitors), 1);
  const maxP = Math.max(...trend.map(d => d.pageviews), 1);
  const chartH = 45;
  const barW = Math.min((CONTENT_W - 10) / trend.length - 2, 10);

  fill(doc, C.snow, MARGIN, y, CONTENT_W, chartH + 15, 3);
  doc.setDrawColor(...C.fog);
  doc.roundedRect(MARGIN, y, CONTENT_W, chartH + 15, 3, 3, "S");

  // Grid
  doc.setDrawColor(...C.fog);
  doc.setLineWidth(0.15);
  for (let g = 0; g <= 4; g++) {
    const gy = y + 5 + (chartH - 5) * (g / 4);
    doc.line(MARGIN + 3, gy, MARGIN + CONTENT_W - 3, gy);
  }

  trend.forEach((d, i) => {
    const bx = MARGIN + 6 + i * (barW + 2);
    const vH = (d.visitors / maxV) * (chartH - 10);
    const pH = (d.pageviews / maxP) * (chartH - 10);
    fill(doc, C.skyFade as unknown as RGB, bx + barW * 0.3, y + 5 + (chartH - 10) - pH, barW * 0.7, pH, 1);
    fill(doc, C.royal, bx, y + 5 + (chartH - 10) - vH, barW * 0.7, vH, 1);
    const dayLabel = new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    txt(doc, dayLabel, C.steel, 4.5, bx + barW * 0.35, y + chartH + 6, "normal", "center");
  });

  // Legend
  const ly = y + chartH + 10;
  fill(doc, C.royal, MARGIN + 6, ly, 8, 3, 1);
  txt(doc, "Visitors", C.charcoal, 6, MARGIN + 17, ly + 2.5);
  fill(doc, C.skyFade as unknown as RGB, MARGIN + 45, ly, 8, 3, 1);
  txt(doc, "Pageviews", C.charcoal, 6, MARGIN + 56, ly + 2.5);

  return y + chartH + 20;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return "0";
  return n.toLocaleString("en-US");
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function humanizeStep(step: string): string {
  return step.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function cleanRoute(route: string): string {
  if (!route || route === "/") return "/ (Homepage)";
  return route;
}

function hasEngagementData(eng: DecisionDashboardData["engagement"]): boolean {
  if (!eng) return false;
  return !!(eng.top_pages_by_views?.length || eng.device_breakdown?.length || eng.hourly_pattern?.length || eng.bounce_rate > 0);
}

// ═══════════════════════════════════════
// INTELLIGENCE BUILDERS
// ═══════════════════════════════════════

function buildManagementSummary(data: DecisionDashboardData): string[] {
  const lines: string[] = [];
  const o = data.overview;
  if (!o) return ["Dashboard data is loading. Refresh and re-export."];

  if (o.visitors_7d > 0) {
    lines.push(`The platform received ${fmt(o.visitors_7d)} verified visitors in the past 7 days with ${fmt(o.pageviews_7d)} pageviews.`);
  }
  if (o.registrations_7d > 0) {
    lines.push(`${fmt(o.registrations_7d)} new registrations were recorded, with ${fmt(o.application_starts_24h)} applications started in the last 24 hours.`);
  }
  if (o.returning_visitors_pct > 0) {
    lines.push(`${o.returning_visitors_pct}% of visitors are returning users, indicating ${o.returning_visitors_pct > 25 ? "healthy engagement" : "room for retention improvement"}.`);
  }
  if (data.content_gaps?.universities_missing_tuition?.length) {
    lines.push(`${data.content_gaps.universities_missing_tuition.length} universities are missing tuition data — a key decision factor for prospective students.`);
  }
  if (!lines.length) lines.push("Baseline tracking is active. Data will accumulate as traffic grows.");
  return lines;
}

function buildWhatMattersNow(data: DecisionDashboardData): string[] {
  const items: string[] = [];
  const o = data.overview;
  if (o && o.visitors_24h > 0) items.push(`${fmt(o.visitors_24h)} visitors are active in the last 24 hours`);
  if (o && o.application_starts_24h > 0) items.push(`${fmt(o.application_starts_24h)} application starts today — monitor conversion`);
  if (data.engagement?.bounce_rate > 60) items.push(`Bounce rate is ${data.engagement.bounce_rate}% — needs attention`);
  if (data.content_gaps?.high_traffic_incomplete?.length) items.push(`${data.content_gaps.high_traffic_incomplete.length} high-traffic entities have incomplete profiles`);
  if (!items.length) items.push("No critical issues detected. Continue monitoring.");
  return items;
}

function buildWhatIsMissing(data: DecisionDashboardData): string[] {
  const items: string[] = [];
  if (data.content_gaps?.universities_missing_tuition?.length) items.push(`${data.content_gaps.universities_missing_tuition.length} universities missing tuition info`);
  if (data.content_gaps?.programs_missing_deadlines?.length) items.push(`${data.content_gaps.programs_missing_deadlines.length} programs missing deadline data`);
  if (!data.search_intel || data.search_intel.total_searches_30d === 0) items.push("Search tracking data not yet available");
  return items;
}

function buildContentGapActions(gaps: DecisionDashboardData["content_gaps"]): Array<{ issue: string; impact: string; priority: string; action: string }> {
  if (!gaps) return [];
  const actions: Array<{ issue: string; impact: string; priority: string; action: string }> = [];

  const tuition = (gaps.universities_missing_tuition || []).filter(r => r.name_ar);
  if (tuition.length) {
    const topViews = tuition.slice(0, 3).map(r => r.name_ar).join(", ");
    actions.push({
      issue: `${tuition.length} universities missing tuition data`,
      impact: "Students cannot compare costs — a top-3 decision factor",
      priority: "HIGH",
      action: `Add tuition info starting with: ${topViews}`,
    });
  }

  const deadlines = (gaps.programs_missing_deadlines || []).filter(r => r.title);
  if (deadlines.length) {
    actions.push({
      issue: `${deadlines.length} programs missing application deadlines`,
      impact: "Reduces urgency and application completion rates",
      priority: "HIGH",
      action: "Source and add deadline dates for top-traffic programs",
    });
  }

  const incomplete = (gaps.high_traffic_incomplete || []).filter(r => r.name_ar);
  if (incomplete.length) {
    actions.push({
      issue: `${incomplete.length} high-traffic universities with incomplete profiles`,
      impact: "Visitors leave when information is missing from popular pages",
      priority: "MEDIUM",
      action: "Complete profiles for universities with highest visitor counts",
    });
  }

  return actions;
}

interface ActionMatrixRow {
  area: string;
  issue: string;
  why: string;
  impact: string;
  priority: string;
  action: string;
}

function buildActionMatrix(data: DecisionDashboardData): ActionMatrixRow[] {
  const rows: ActionMatrixRow[] = [];
  const o = data.overview;

  // Traffic
  if (o && o.visitors_7d > 0) {
    rows.push({
      area: "Traffic",
      issue: o.visitors_7d < 100 ? "Low traffic volume" : "Traffic baseline established",
      why: o.visitors_7d < 100 ? "Small sample makes metrics unreliable" : "Sufficient data for trend analysis",
      impact: o.visitors_7d < 100 ? "High" : "Positive",
      priority: o.visitors_7d < 100 ? "HIGH" : "MONITOR",
      action: o.visitors_7d < 100 ? "Increase acquisition channels and campaigns" : "Continue monitoring daily trends",
    });
  }

  // Registration
  if (o && o.visitors_7d > 0) {
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

  // Bounce
  if (data.engagement?.bounce_rate > 0) {
    const br = data.engagement.bounce_rate;
    rows.push({
      area: "Engagement",
      issue: `Bounce rate: ${br}%`,
      why: "High bounce indicates content-visitor mismatch",
      impact: br > 60 ? "High" : br > 40 ? "Medium" : "Low",
      priority: br > 60 ? "HIGH" : "MONITOR",
      action: br > 60 ? "Review top landing pages and improve content relevance" : "Continue A/B testing landing pages",
    });
  }

  // Content gaps
  if (data.content_gaps?.universities_missing_tuition?.length) {
    rows.push({
      area: "Content",
      issue: `${data.content_gaps.universities_missing_tuition.length} universities missing tuition`,
      why: "Tuition is a top-3 decision factor for students",
      impact: "High",
      priority: "HIGH",
      action: "Prioritize tuition data collection for top-traffic universities",
    });
  }

  if (data.content_gaps?.programs_missing_deadlines?.length) {
    rows.push({
      area: "Content",
      issue: `${data.content_gaps.programs_missing_deadlines.length} programs missing deadlines`,
      why: "Missing deadlines reduce application urgency",
      impact: "Medium",
      priority: "MEDIUM",
      action: "Add deadline data for highest-traffic programs first",
    });
  }

  // Search
  if (data.search_intel) {
    if (data.search_intel.total_searches_30d > 0) {
      rows.push({
        area: "Search",
        issue: `${fmt(data.search_intel.total_searches_30d)} searches in 30 days`,
        why: "Search reveals demand patterns and unmet needs",
        impact: "Medium",
        priority: "MEDIUM",
        action: "Map top search filters to content catalog for gap identification",
      });
    } else {
      rows.push({
        area: "Search",
        issue: "No search data recorded",
        why: "Cannot understand user intent without search analytics",
        impact: "Medium",
        priority: "MEDIUM",
        action: "Verify search tracking is properly wired in production",
      });
    }
  }

  // Entity intel
  if (data.university_intel?.top_by_views?.length) {
    const topUni = data.university_intel.top_by_views[0];
    rows.push({
      area: "Entities",
      issue: `Top university: ${topUni.name_ar || topUni.name_en || "Unknown"}`,
      why: "Highest-traffic entities need the most complete and accurate data",
      impact: "Medium",
      priority: "MEDIUM",
      action: "Audit and complete profiles for top 5 universities by views",
    });
  }

  // Funnels
  if (data.funnels?.length) {
    rows.push({
      area: "Analytics",
      issue: "Multi-funnel model active with domain separation",
      why: "Cross-domain conversion would produce misleading metrics",
      impact: "Informational",
      priority: "STANDARD",
      action: "Optimize each funnel (Discovery, Account, Revenue) independently",
    });
  }

  if (!rows.length) {
    rows.push({
      area: "General",
      issue: "Dashboard operational — baseline data collecting",
      why: "System is healthy but data volume is still building",
      impact: "Low",
      priority: "MONITOR",
      action: "Continue monitoring. Re-export when data volume increases.",
    });
  }

  return rows;
}
