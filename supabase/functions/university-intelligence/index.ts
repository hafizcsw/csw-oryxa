import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const body = await req.json();
  const { action, university_id } = body;

  if (!university_id) return json({ error: "university_id required" }, 400);

  // Verify operator access
  const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, university_id);
  if (!hasAccess) return json({ error: "not_authorized" }, 403);

  try {
    switch (action) {
      // ════════════════════════════════════════
      // ANALYTICS SUMMARY
      // ════════════════════════════════════════
      case "analytics.summary": {
        const days = body.days || 30;
        const now = new Date();
        const since = new Date(now.getTime() - days * 86400000).toISOString();

        // 1) Page views from events table (real analytics events)
        const { count: pageViews } = await supabaseAdmin
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("name", "page_view")
          .gte("created_at", since)
          .or(`route.ilike.%${university_id}%,properties->>university_id.eq.${university_id},properties->>entity_id.eq.${university_id}`);

        // Also check analytics_events
        const { count: analyticsPageViews } = await supabaseAdmin
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event", "page_view")
          .gte("at", since)
          .ilike("route", `%${university_id}%`);

        const totalPageViews = (pageViews ?? 0) + (analyticsPageViews ?? 0);

        // 2) Inquiry volume
        const { count: inquiryCount } = await supabaseAdmin
          .from("comm_threads")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .in("thread_type", ["university_public_inquiry", "qualified_inquiry"])
          .gte("created_at", since);

        // 3) Application volume
        const { count: applicationCount } = await supabaseAdmin
          .from("intake_applications")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .gte("submitted_at", since);

        // 4) Decision counts
        const { data: decisionApps } = await supabaseAdmin
          .from("intake_applications")
          .select("status")
          .eq("university_id", university_id)
          .in("status", ["accepted", "rejected", "waitlisted"]);

        const decisionCounts = { accepted: 0, rejected: 0, waitlisted: 0 };
        for (const app of decisionApps || []) {
          if (app.status in decisionCounts) decisionCounts[app.status as keyof typeof decisionCounts]++;
        }

        // 5) All applications by status for funnel
        const { data: allApps } = await supabaseAdmin
          .from("intake_applications")
          .select("status")
          .eq("university_id", university_id);

        const statusCounts: Record<string, number> = {};
        for (const app of allApps || []) {
          statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
        }

        // 6) Top programs by application count
        const { data: programApps } = await supabaseAdmin
          .from("intake_applications")
          .select("program_id, programs!inner(name_en, name_ar, degree_level)")
          .eq("university_id", university_id);

        const programCounts: Record<string, { name_en: string; name_ar: string; degree_level: string; count: number }> = {};
        for (const app of programApps || []) {
          const prog = (app as any).programs;
          if (!prog) continue;
          if (!programCounts[app.program_id]) {
            programCounts[app.program_id] = { name_en: prog.name_en, name_ar: prog.name_ar, degree_level: prog.degree_level, count: 0 };
          }
          programCounts[app.program_id].count++;
        }
        const topPrograms = Object.entries(programCounts)
          .map(([id, v]) => ({ program_id: id, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // 7) Response times (average time from submitted to first review action)
        const { data: historyRows } = await supabaseAdmin
          .from("intake_status_history")
          .select("application_id, old_status, new_status, created_at")
          .in("old_status", ["submitted"])
          .order("created_at", { ascending: true });

        // Get submission times
        const { data: submittedApps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, submitted_at")
          .eq("university_id", university_id);

        const submissionMap = new Map((submittedApps || []).map(a => [a.id, new Date(a.submitted_at).getTime()]));
        const responseTimes: number[] = [];
        for (const h of historyRows || []) {
          const submitTime = submissionMap.get(h.application_id);
          if (submitTime) {
            const responseTime = new Date(h.created_at).getTime() - submitTime;
            if (responseTime > 0) responseTimes.push(responseTime);
          }
        }
        const avgResponseTimeHours = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length / 3600000)
          : null;

        // 8) Document request friction
        const { count: totalDocRequests } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id", { count: "exact", head: true })
          .in("application_id", (submittedApps || []).map(a => a.id));

        const { count: pendingDocRequests } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "requested")
          .in("application_id", (submittedApps || []).map(a => a.id));

        // 9) Stalled cases (apps in submitted/ready_for_review for >7 days)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        const { count: stalledCases } = await supabaseAdmin
          .from("intake_applications")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .in("status", ["submitted", "ready_for_review", "info_requested"])
          .lt("submitted_at", sevenDaysAgo);

        // 10) Threads needing reply (open threads where last message is from student)
        const { data: openThreads } = await supabaseAdmin
          .from("comm_threads")
          .select("id, last_message_at")
          .eq("university_id", university_id)
          .in("status", ["open", "active"])
          .order("last_message_at", { ascending: false })
          .limit(100);

        let threadsNeedingReply = 0;
        for (const thread of openThreads || []) {
          const { data: lastMsg } = await supabaseAdmin
            .from("comm_messages")
            .select("sender_role")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg && lastMsg.sender_role === "student") threadsNeedingReply++;
        }

        // 11) Conversion funnel
        const funnel = {
          page_views: totalPageViews,
          inquiries: inquiryCount ?? 0,
          applications: applicationCount ?? 0,
          under_review: statusCounts["under_review"] || 0,
          decisions: decisionCounts.accepted + decisionCounts.rejected + decisionCounts.waitlisted,
        };

        return json({
          ok: true,
          analytics: {
            period_days: days,
            page_views: totalPageViews,
            inquiries: inquiryCount ?? 0,
            applications: applicationCount ?? 0,
            decisions: decisionCounts,
            status_breakdown: statusCounts,
            top_programs: topPrograms,
            avg_response_time_hours: avgResponseTimeHours,
            doc_request_friction: {
              total: totalDocRequests ?? 0,
              pending: pendingDocRequests ?? 0,
            },
            stalled_cases: stalledCases ?? 0,
            threads_needing_reply: threadsNeedingReply,
            funnel,
          },
        });
      }

      // ════════════════════════════════════════
      // OPERATOR PRIORITIES (action queue)
      // ════════════════════════════════════════
      case "operator.priorities": {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

        // Overdue reviews (submitted > 3 days ago, not yet reviewed)
        const { data: overdueApps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, user_id, program_id, submitted_at, status, programs!inner(name_en, name_ar)")
          .eq("university_id", university_id)
          .in("status", ["submitted", "ready_for_review"])
          .lt("submitted_at", threeDaysAgo)
          .order("submitted_at", { ascending: true })
          .limit(20);

        // Pending doc requests (not fulfilled)
        const { data: pendingDocs } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id, application_id, doc_type, created_at, intake_applications!inner(user_id, program_id, programs!inner(name_en, name_ar))")
          .eq("status", "requested")
          .order("created_at", { ascending: true })
          .limit(20);

        // Filter pending docs to this university
        const uniPendingDocs = (pendingDocs || []).filter((d: any) => {
          return true; // Already joined through intake_applications
        });

        // Threads needing reply
        const { data: unrepliedThreads } = await supabaseAdmin
          .from("comm_threads")
          .select("id, subject, thread_type, last_message_at, last_message_preview")
          .eq("university_id", university_id)
          .in("status", ["open", "active"])
          .order("last_message_at", { ascending: true })
          .limit(50);

        const needsReply: typeof unrepliedThreads = [];
        for (const thread of unrepliedThreads || []) {
          const { data: lastMsg } = await supabaseAdmin
            .from("comm_messages")
            .select("sender_role")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg && lastMsg.sender_role === "student") needsReply.push(thread);
          if (needsReply.length >= 10) break;
        }

        // Stalled applications (info_requested > 7 days)
        const { data: stalledApps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, user_id, program_id, status, submitted_at, programs!inner(name_en, name_ar)")
          .eq("university_id", university_id)
          .eq("status", "info_requested")
          .lt("updated_at", sevenDaysAgo)
          .order("submitted_at", { ascending: true })
          .limit(10);

        // Highest score applications awaiting review
        const { data: highPriorityApps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, user_id, program_id, overall_score, submitted_at, status, programs!inner(name_en, name_ar)")
          .eq("university_id", university_id)
          .in("status", ["submitted", "ready_for_review"])
          .order("overall_score", { ascending: false })
          .limit(5);

        return json({
          ok: true,
          priorities: {
            overdue_reviews: overdueApps || [],
            pending_doc_requests: uniPendingDocs,
            threads_needing_reply: needsReply,
            stalled_cases: stalledApps || [],
            high_priority_apps: highPriorityApps || [],
          },
        });
      }

      // ════════════════════════════════════════
      // ORX GUIDANCE (read-only, no score editing)
      // ════════════════════════════════════════
      case "orx.guidance": {
        // Compute ORX-like score from real operational data
        const { data: allApps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, status, submitted_at, reviewed_at, overall_score, program_id")
          .eq("university_id", university_id);

        const apps = allApps || [];
        const totalApps = apps.length;

        // 1) Acceptance rate
        const accepted = apps.filter(a => a.status === "accepted").length;
        const rejected = apps.filter(a => a.status === "rejected").length;
        const decided = accepted + rejected;
        const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

        // 2) Average response time
        const reviewedApps = apps.filter(a => a.reviewed_at && a.submitted_at);
        const responseTimes = reviewedApps.map(a => {
          const diff = new Date(a.reviewed_at!).getTime() - new Date(a.submitted_at).getTime();
          return diff / 3600000;
        }).filter(t => t > 0);
        const avgResponseHours = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
          : null;

        // 3) Pending doc requests
        const appIds = apps.map(a => a.id);
        const { count: pendingDocs } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "requested")
          .in("application_id", appIds.length > 0 ? appIds : ["__none__"]);

        // 4) Stalled cases
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const stalledCount = apps.filter(a =>
          ["submitted", "ready_for_review", "info_requested"].includes(a.status) &&
          new Date(a.submitted_at) < sevenDaysAgo
        ).length;

        // 5) Inquiry response threads
        const { count: totalThreads } = await supabaseAdmin
          .from("comm_threads")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id);

        const { count: closedThreads } = await supabaseAdmin
          .from("comm_threads")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .eq("status", "resolved");

        const threadResolutionRate = (totalThreads ?? 0) > 0
          ? Math.round(((closedThreads ?? 0) / (totalThreads ?? 1)) * 100) : null;

        // 6) Program coverage - programs with at least 1 application
        const programsWithApps = new Set(apps.map(a => a.program_id)).size;
        const { count: totalPrograms } = await supabaseAdmin
          .from("programs")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .eq("is_active", true);

        // 7) University profile completeness
        const { data: uni } = await supabaseAdmin
          .from("universities")
          .select("name_en, name_ar, about_en, about_ar, logo_url, cover_url, website_url, city, country_code")
          .eq("id", university_id)
          .maybeSingle();

        const profileChecks = uni ? [
          !!uni.name_en, !!uni.name_ar, !!uni.about_en || !!uni.about_ar,
          !!uni.logo_url, !!uni.cover_url, !!uni.website_url, !!uni.city, !!uni.country_code,
        ] : [];
        const profileCompleteness = profileChecks.length > 0
          ? Math.round(profileChecks.filter(Boolean).length / profileChecks.length * 100) : 0;

        // Compute composite ORX score
        const factors: { name: string; score: number; weight: number; guidance: string; improvable: boolean }[] = [];

        // Response speed factor
        const responseScore = avgResponseHours === null ? 50
          : avgResponseHours <= 24 ? 100
          : avgResponseHours <= 48 ? 80
          : avgResponseHours <= 72 ? 60
          : avgResponseHours <= 168 ? 40 : 20;
        factors.push({
          name: "response_speed",
          score: responseScore,
          weight: 0.2,
          guidance: avgResponseHours === null ? "orx.guidance.no_reviews_yet"
            : responseScore >= 80 ? "orx.guidance.response_speed_good"
            : "orx.guidance.response_speed_slow",
          improvable: responseScore < 80,
        });

        // Stalled cases factor
        const stalledScore = totalApps === 0 ? 100
          : stalledCount === 0 ? 100
          : stalledCount <= 2 ? 70
          : stalledCount <= 5 ? 40 : 20;
        factors.push({
          name: "stalled_cases",
          score: stalledScore,
          weight: 0.15,
          guidance: stalledCount === 0 ? "orx.guidance.no_stalled"
            : "orx.guidance.has_stalled",
          improvable: stalledCount > 0,
        });

        // Pending docs factor
        const pendingDocsCount = pendingDocs ?? 0;
        const pendingDocsScore = pendingDocsCount === 0 ? 100
          : pendingDocsCount <= 3 ? 70
          : pendingDocsCount <= 10 ? 40 : 20;
        factors.push({
          name: "doc_request_resolution",
          score: pendingDocsScore,
          weight: 0.1,
          guidance: pendingDocsCount === 0 ? "orx.guidance.docs_clear"
            : "orx.guidance.docs_pending",
          improvable: pendingDocsCount > 0,
        });

        // Profile completeness factor
        factors.push({
          name: "profile_completeness",
          score: profileCompleteness,
          weight: 0.15,
          guidance: profileCompleteness >= 90 ? "orx.guidance.profile_complete"
            : "orx.guidance.profile_incomplete",
          improvable: profileCompleteness < 90,
        });

        // Program coverage factor
        const coverageScore = (totalPrograms ?? 0) === 0 ? 0
          : Math.round((programsWithApps / (totalPrograms ?? 1)) * 100);
        factors.push({
          name: "program_coverage",
          score: Math.min(coverageScore, 100),
          weight: 0.1,
          guidance: coverageScore >= 50 ? "orx.guidance.program_coverage_good"
            : "orx.guidance.program_coverage_low",
          improvable: coverageScore < 50,
        });

        // Thread resolution factor
        const threadScore = threadResolutionRate ?? 50;
        factors.push({
          name: "inquiry_resolution",
          score: threadScore,
          weight: 0.15,
          guidance: threadScore >= 70 ? "orx.guidance.inquiries_resolved"
            : "orx.guidance.inquiries_unresolved",
          improvable: threadScore < 70,
        });

        // Decision throughput factor
        const decisionScore = totalApps === 0 ? 50
          : decided === 0 ? 20
          : Math.min(Math.round((decided / totalApps) * 100), 100);
        factors.push({
          name: "decision_throughput",
          score: decisionScore,
          weight: 0.15,
          guidance: decisionScore >= 60 ? "orx.guidance.throughput_good"
            : "orx.guidance.throughput_low",
          improvable: decisionScore < 60,
        });

        const compositeScore = Math.round(
          factors.reduce((sum, f) => sum + f.score * f.weight, 0)
        );

        // Top actions to improve
        const improvableFactors = factors
          .filter(f => f.improvable)
          .sort((a, b) => (a.score * a.weight) - (b.score * b.weight))
          .slice(0, 3);

        return json({
          ok: true,
          orx: {
            composite_score: compositeScore,
            factors,
            top_actions: improvableFactors.map(f => ({
              factor: f.name,
              current_score: f.score,
              guidance_key: f.guidance,
            })),
            data_sources: {
              applications: totalApps,
              decisions: decided,
              threads: totalThreads ?? 0,
              programs: totalPrograms ?? 0,
              acceptance_rate: acceptanceRate,
              avg_response_hours: avgResponseHours,
              stalled_count: stalledCount,
              pending_docs: pendingDocsCount,
            },
          },
        });
      }

      // ════════════════════════════════════════
      // PERFORMANCE DIAGNOSTICS
      // ════════════════════════════════════════
      case "diagnostics": {
        const { data: apps } = await supabaseAdmin
          .from("intake_applications")
          .select("id, status, program_id, submitted_at, reviewed_at, overall_score, programs!inner(name_en, name_ar, degree_level)")
          .eq("university_id", university_id);

        const allApps = apps || [];

        // Programs with views but no applications (attention without conversion)
        // We can only check programs that have applications vs all active programs
        const programsWithApps = new Set(allApps.map(a => a.program_id));
        const { data: activePrograms } = await supabaseAdmin
          .from("programs")
          .select("id, name_en, name_ar, degree_level")
          .eq("university_id", university_id)
          .eq("is_active", true);

        const programsNoApps = (activePrograms || [])
          .filter(p => !programsWithApps.has(p.id))
          .slice(0, 10);

        // Status bottlenecks
        const statusDurations: Record<string, number[]> = {};
        const { data: allHistory } = await supabaseAdmin
          .from("intake_status_history")
          .select("application_id, old_status, new_status, created_at")
          .order("created_at", { ascending: true });

        // Group history by application
        const historyByApp: Record<string, Array<{ old_status: string; new_status: string; created_at: string }>> = {};
        for (const h of allHistory || []) {
          if (!historyByApp[h.application_id]) historyByApp[h.application_id] = [];
          historyByApp[h.application_id].push(h);
        }

        // Calculate average time in each status
        const appIds = new Set(allApps.map(a => a.id));
        for (const [appId, history] of Object.entries(historyByApp)) {
          if (!appIds.has(appId)) continue;
          for (let i = 0; i < history.length - 1; i++) {
            const status = history[i].new_status;
            const duration = new Date(history[i + 1].created_at).getTime() - new Date(history[i].created_at).getTime();
            if (duration > 0) {
              if (!statusDurations[status]) statusDurations[status] = [];
              statusDurations[status].push(duration / 3600000);
            }
          }
        }

        const avgStatusDurations: Record<string, number> = {};
        for (const [status, durations] of Object.entries(statusDurations)) {
          avgStatusDurations[status] = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
        }

        // Drop-off analysis (applications that went to withdrawn/closed without acceptance)
        const droppedOff = allApps.filter(a => ["withdrawn", "closed"].includes(a.status));
        const dropOffRate = allApps.length > 0 ? Math.round((droppedOff.length / allApps.length) * 100) : 0;

        // Overdue by program
        const now = new Date();
        const overdueByProgram: Record<string, { name_en: string; name_ar: string; count: number }> = {};
        for (const app of allApps) {
          if (["submitted", "ready_for_review"].includes(app.status)) {
            const daysSince = (now.getTime() - new Date(app.submitted_at).getTime()) / 86400000;
            if (daysSince > 3) {
              const prog = (app as any).programs;
              const pid = app.program_id;
              if (!overdueByProgram[pid]) overdueByProgram[pid] = { name_en: prog?.name_en || "", name_ar: prog?.name_ar || "", count: 0 };
              overdueByProgram[pid].count++;
            }
          }
        }

        return json({
          ok: true,
          diagnostics: {
            programs_no_applications: programsNoApps,
            avg_status_durations_hours: avgStatusDurations,
            drop_off_rate: dropOffRate,
            overdue_by_program: Object.entries(overdueByProgram).map(([id, v]) => ({ program_id: id, ...v })),
            total_applications: allApps.length,
          },
        });
      }

      // ════════════════════════════════════════
      // TEMPLATES (message macros)
      // ════════════════════════════════════════
      case "templates.list": {
        // Return canonical templates for operator actions
        return json({
          ok: true,
          templates: {
            doc_request: [
              { id: "doc_passport", label_key: "templates.doc_request.passport", message_key: "templates.doc_request.passport_msg" },
              { id: "doc_transcript", label_key: "templates.doc_request.transcript", message_key: "templates.doc_request.transcript_msg" },
              { id: "doc_certificate", label_key: "templates.doc_request.certificate", message_key: "templates.doc_request.certificate_msg" },
              { id: "doc_recommendation", label_key: "templates.doc_request.recommendation", message_key: "templates.doc_request.recommendation_msg" },
              { id: "doc_english_proof", label_key: "templates.doc_request.english_proof", message_key: "templates.doc_request.english_proof_msg" },
              { id: "doc_photo", label_key: "templates.doc_request.photo", message_key: "templates.doc_request.photo_msg" },
            ],
            decision: [
              { id: "decision_accept", label_key: "templates.decision.accept", message_key: "templates.decision.accept_msg" },
              { id: "decision_reject", label_key: "templates.decision.reject", message_key: "templates.decision.reject_msg" },
              { id: "decision_waitlist", label_key: "templates.decision.waitlist", message_key: "templates.decision.waitlist_msg" },
            ],
            follow_up: [
              { id: "follow_up_docs", label_key: "templates.follow_up.docs_reminder", message_key: "templates.follow_up.docs_reminder_msg" },
              { id: "follow_up_stalled", label_key: "templates.follow_up.stalled_case", message_key: "templates.follow_up.stalled_msg" },
            ],
          },
        });
      }

      // ════════════════════════════════════════
      // COMPUTE PROGRAM METRICS (real analytics)
      // ════════════════════════════════════════
      case "compute_program_metrics": {
        const targetPeriod = body.period || new Date().toISOString().slice(0, 7);
        const startDate = `${targetPeriod}-01`;
        const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().slice(0, 10);

        // First, get ALL program IDs belonging to this university for scoping
        const { data: uniPrograms } = await supabaseAdmin
          .from("programs")
          .select("id")
          .eq("university_id", university_id);
        const uniProgramIds = new Set((uniPrograms || []).map((p: any) => p.id));

        if (uniProgramIds.size === 0) {
          return json({ ok: true, period: targetPeriod, university_metrics: [], programs_tracked: 0 });
        }

        // Get university slug for route-based scoping
        const { data: uniInfo } = await supabaseAdmin
          .from("universities")
          .select("slug")
          .eq("id", university_id)
          .maybeSingle();
        const uniSlug = uniInfo?.slug;

        // Search impressions scoped to this university's route
        let searchImpressions = 0;
        if (uniSlug) {
          const { count } = await supabaseAdmin
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("event", "search_result_impression")
            .gte("at", startDate)
            .lt("at", endDate)
            .ilike("route", `%${uniSlug}%`);
          searchImpressions = count || 0;
        }

        // Detail views — filter by program_id in payload, then validate ownership
        const { data: detailEvents } = await supabaseAdmin
          .from("analytics_events")
          .select("payload")
          .eq("event", "program_detail_view")
          .gte("at", startDate)
          .lt("at", endDate)
          .limit(1000);

        // Shortlist adds
        const { data: saveEvents } = await supabaseAdmin
          .from("analytics_events")
          .select("payload")
          .in("event", ["shortlist_add", "compare_add"])
          .gte("at", startDate)
          .lt("at", endDate)
          .limit(1000);

        // Per-program breakdown — ONLY count events for THIS university's programs
        const programViews: Record<string, number> = {};
        const programSaves: Record<string, number> = {};
        for (const ev of detailEvents || []) {
          const pid = (ev.payload as any)?.program_id;
          if (pid && uniProgramIds.has(pid)) {
            programViews[pid] = (programViews[pid] || 0) + 1;
          }
        }
        for (const ev of saveEvents || []) {
          const pid = (ev.payload as any)?.program_id;
          if (pid && uniProgramIds.has(pid)) {
            programSaves[pid] = (programSaves[pid] || 0) + 1;
          }
        }

        // Upsert university-level metrics
        const uniMetrics = [
          { key: "search_impressions", value: searchImpressions },
          { key: "total_detail_views", value: Object.values(programViews).reduce((a, b) => a + b, 0) },
          { key: "total_saves", value: Object.values(programSaves).reduce((a, b) => a + b, 0) },
        ];

        for (const m of uniMetrics) {
          await supabaseAdmin
            .from("university_program_intelligence")
            .upsert({
              university_id,
              program_id: null,
              period: targetPeriod,
              metric_key: m.key,
              metric_value: m.value,
              computed_at: new Date().toISOString(),
            }, { onConflict: "university_id,program_id,period,metric_key" });
        }

        // Per-program metrics — only for this university's programs
        const trackedProgramIds = new Set([...Object.keys(programViews), ...Object.keys(programSaves)]);
        for (const pid of trackedProgramIds) {
          if (programViews[pid]) {
            await supabaseAdmin
              .from("university_program_intelligence")
              .upsert({
                university_id,
                program_id: pid,
                period: targetPeriod,
                metric_key: "detail_views",
                metric_value: programViews[pid],
                computed_at: new Date().toISOString(),
              }, { onConflict: "university_id,program_id,period,metric_key" });
          }
          if (programSaves[pid]) {
            await supabaseAdmin
              .from("university_program_intelligence")
              .upsert({
                university_id,
                program_id: pid,
                period: targetPeriod,
                metric_key: "saves",
                metric_value: programSaves[pid],
                computed_at: new Date().toISOString(),
              }, { onConflict: "university_id,program_id,period,metric_key" });
          }
        }

        return json({
          ok: true,
          period: targetPeriod,
          university_metrics: uniMetrics,
          programs_tracked: trackedProgramIds.size,
        });
      }

      // ════════════════════════════════════════
      // GET PROGRAM METRICS
      // ════════════════════════════════════════
      case "get_program_metrics": {
        const targetPeriod = body.period || new Date().toISOString().slice(0, 7);
        const { data: metrics } = await supabaseAdmin
          .from("university_program_intelligence")
          .select("*")
          .eq("university_id", university_id)
          .eq("period", targetPeriod)
          .order("metric_key");

        // Separate uni-level vs program-level
        const universityLevel = (metrics || []).filter((m: any) => !m.program_id);
        const programLevel = (metrics || []).filter((m: any) => !!m.program_id);

        // Group program metrics
        const byProgram: Record<string, Record<string, number>> = {};
        for (const m of programLevel) {
          if (!byProgram[m.program_id]) byProgram[m.program_id] = {};
          byProgram[m.program_id][m.metric_key] = m.metric_value;
        }

        // Sort programs by total views desc
        const topPrograms = Object.entries(byProgram)
          .map(([pid, m]) => ({ program_id: pid, ...m }))
          .sort((a, b) => ((b as any).detail_views || 0) - ((a as any).detail_views || 0));

        return json({
          ok: true,
          period: targetPeriod,
          university: Object.fromEntries(universityLevel.map((m: any) => [m.metric_key, m.metric_value])),
          top_programs: topPrograms.slice(0, 20),
        });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[university-intelligence]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Helpers ──

async function verifyOperatorAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  universityId: string,
): Promise<boolean> {
  try {
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (isAdmin === true) return true;
  } catch { /* */ }

  const { data: staffRow } = await supabase
    .from("university_page_staff")
    .select("id")
    .eq("user_id", userId)
    .eq("university_id", universityId)
    .eq("status", "active")
    .maybeSingle();
  if (staffRow) return true;

  const { data: claim } = await supabase
    .from("institution_claims")
    .select("id")
    .eq("user_id", userId)
    .eq("institution_id", universityId)
    .eq("status", "approved")
    .maybeSingle();
  return !!claim;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
