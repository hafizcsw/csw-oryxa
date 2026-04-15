import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const CRM_URL = Deno.env.get("CRM_URL");
const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY");

// ── Canonical intake statuses with allowed transitions ──
const INTAKE_STATUSES = [
  "submitted",
  "ready_for_review",
  "info_requested",
  "docs_received",
  "under_review",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
  "closed",
] as const;

type IntakeStatus = typeof INTAKE_STATUSES[number];

const TRANSITION_RULES: Record<string, string[]> = {
  submitted: ["ready_for_review", "info_requested", "under_review", "withdrawn", "closed"],
  ready_for_review: ["under_review", "info_requested", "closed"],
  info_requested: ["docs_received", "under_review", "withdrawn", "closed"],
  docs_received: ["ready_for_review", "under_review", "info_requested", "closed"],
  under_review: ["accepted", "rejected", "waitlisted", "info_requested", "closed"],
  accepted: ["closed"],
  rejected: ["closed"],
  waitlisted: ["accepted", "rejected", "under_review", "closed"],
  withdrawn: ["closed"],
  closed: [],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return jsonResp({ error: "unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      // ════════════════════════════════════════════════
      // APPLICATION SUBMIT
      // ════════════════════════════════════════════════
      case "application.submit": {
        const { program_id, university_id } = body;
        if (!program_id || !university_id) {
          return jsonResp({ error: "program_id and university_id required" }, 400);
        }

        const authoritativeGate = await resolveAuthoritativeApplyGate(supabaseAdmin, user.id);
        if (!authoritativeGate.ok) {
          return jsonResp({ error: authoritativeGate.error, reason: authoritativeGate.reason }, 500);
        }

        if (!authoritativeGate.quality.gates.can_apply) {
          return jsonResp({
            error: "gate_blocked",
            reason: "server_authoritative_gate",
            blocked_reasons: authoritativeGate.quality.gates.apply_blocked_reasons,
            gate_truth: authoritativeGate.quality,
            route_to: "improvement",
          }, 403);
        }

        const { data: programData, error: programError } = await supabaseAdmin
          .from("programs")
          .select("id, is_active, degree_level, gpa_min, ielts_min_overall, toefl_min, accepted_certificates, teaching_language")
          .eq("id", program_id)
          .maybeSingle();

        if (programError || !programData) {
          return jsonResp({ error: "program_not_found" }, 404);
        }
        if (programData.is_active === false) {
          return jsonResp({ error: "program_inactive", route_to: "search" }, 400);
        }

        const matchResult = evaluateProgramMatch(authoritativeGate.profile, programData, authoritativeGate.quality.studentFiles ?? []);
        if (!matchResult.matched) {
          return jsonResp({
            error: "program_mismatch",
            reason: "server_authoritative_match",
            mismatch_reasons: matchResult.reasons,
            route_to: "improvement",
          }, 403);
        }

        const { data: existing } = await supabaseAdmin
          .from("intake_applications")
          .select("id")
          .eq("user_id", user.id)
          .eq("program_id", program_id)
          .maybeSingle();

        if (existing) {
          return jsonResp({ error: "already_applied", id: existing.id }, 409);
        }

        const { data, error } = await supabaseAdmin
          .from("intake_applications")
          .insert({
            user_id: user.id,
            program_id,
            university_id,
            file_quality_snapshot: authoritativeGate.quality,
            overall_score: authoritativeGate.quality.overall_score,
            verdict: authoritativeGate.quality.verdict,
            status: "submitted",
          })
          .select("id, status, submitted_at")
          .single();

        if (error) throw error;

        // Record initial status history
        await supabaseAdmin.from("intake_status_history").insert({
          application_id: data.id,
          old_status: null,
          new_status: "submitted",
          changed_by: user.id,
          note: "Application submitted",
        });

        return jsonResp({ ok: true, application: data, gate_truth: authoritativeGate.quality });
      }

      // ════════════════════════════════════════════════
      // APPLICATION LIST (operator)
      // ════════════════════════════════════════════════
      case "application.list": {
        const { university_id, status: filterStatus, search: searchTerm, sort_by, sort_order, limit = 50, offset = 0 } = body;
        if (!university_id) {
          return jsonResp({ error: "university_id required" }, 400);
        }

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, university_id);
        if (!hasAccess) {
          return jsonResp({ error: "not_authorized" }, 403);
        }

        let query = supabaseAdmin
          .from("intake_applications")
          .select("*, programs!inner(id, name_en, name_ar, degree_level)", { count: "exact" })
          .eq("university_id", university_id)
          .range(offset, offset + limit - 1);

        if (filterStatus && INTAKE_STATUSES.includes(filterStatus as IntakeStatus)) {
          query = query.eq("status", filterStatus);
        }

        // Server-side search: match against program name or applicant user_id prefix
        if (searchTerm && searchTerm.trim().length > 0) {
          const term = searchTerm.trim();
          // Search program name (en/ar) via ilike on joined table
          query = query.or(`programs.name_en.ilike.%${term}%,programs.name_ar.ilike.%${term}%`);
        }

        // Sort
        const sortCol = sort_by === "reviewed_at" ? "reviewed_at" : "submitted_at";
        const ascending = sort_order === "asc";
        query = query.order(sortCol, { ascending });

        const { data, error, count } = await query;
        if (error) throw error;

        // Enrich with applicant names from CRM if available
        const enrichedApps = data || [];
        if (enrichedApps.length > 0 && CRM_URL && CRM_SERVICE_ROLE_KEY) {
          try {
            const crm = createClient(CRM_URL, CRM_SERVICE_ROLE_KEY);
            const userIds = [...new Set(enrichedApps.map((a: any) => a.user_id))];
            const { data: profiles } = await crm
              .from("vw_student_portal_profile")
              .select("auth_user_id, full_name, email")
              .in("auth_user_id", userIds);
            if (profiles) {
              const profileMap = new Map(profiles.map((p: any) => [p.auth_user_id, p]));
              for (const app of enrichedApps) {
                const profile = profileMap.get((app as any).user_id);
                (app as any).applicant_name = profile?.full_name || null;
                (app as any).applicant_email = profile?.email || null;
              }
            }
          } catch {
            // CRM unavailable — list still works without names
          }
        }

        return jsonResp({ applications: enrichedApps, total: count ?? 0 });
      }

      // ════════════════════════════════════════════════
      // APPLICATION DETAIL (operator)
      // ════════════════════════════════════════════════
      case "application.detail": {
        const { application_id } = body;
        if (!application_id) return jsonResp({ error: "application_id required" }, 400);

        const { data: app, error: appErr } = await supabaseAdmin
          .from("intake_applications")
          .select("*")
          .eq("id", application_id)
          .single();

        if (appErr || !app) return jsonResp({ error: "application not found" }, 404);

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, app.university_id);
        if (!hasAccess) return jsonResp({ error: "not_authorized" }, 403);

        // Fetch program info
        const { data: program } = await supabaseAdmin
          .from("programs")
          .select("id, name_en, name_ar, degree_level, teaching_language, gpa_min, ielts_min_overall, toefl_min")
          .eq("id", app.program_id)
          .maybeSingle();

        // Fetch university info
        const { data: university } = await supabaseAdmin
          .from("universities")
          .select("id, name_en, name_ar, country_code, city")
          .eq("id", app.university_id)
          .maybeSingle();

        // Fetch status history
        const { data: history } = await supabaseAdmin
          .from("intake_status_history")
          .select("*")
          .eq("application_id", application_id)
          .order("created_at", { ascending: true });

        // Fetch doc requests
        const { data: docRequests } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("*")
          .eq("application_id", application_id)
          .order("created_at", { ascending: false });

        // Fetch reviewer notes
        const { data: notes } = await supabaseAdmin
          .from("intake_reviewer_notes")
          .select("*")
          .eq("application_id", application_id)
          .order("created_at", { ascending: false });

        // Fetch linked comm threads
        const { data: threads } = await supabaseAdmin
          .from("comm_threads")
          .select("id, subject, status, thread_type, last_message_at, last_message_preview")
          .eq("linked_entity_type", "intake_application")
          .eq("linked_entity_id", application_id)
          .order("last_message_at", { ascending: false });

        // Try to get applicant profile from CRM
        let applicantProfile: Record<string, unknown> | null = null;
        try {
          if (CRM_URL && CRM_SERVICE_ROLE_KEY) {
            const crm = createClient(CRM_URL, CRM_SERVICE_ROLE_KEY);
            const { data: profile } = await crm
              .from("vw_student_portal_profile")
              .select("full_name, email, phone, citizenship, country, gpa, last_education_level, preferred_degree_level, preferred_major, language_preference")
              .eq("auth_user_id", app.user_id)
              .maybeSingle();
            applicantProfile = profile;
          }
        } catch {
          // CRM unavailable — continue without
        }

        return jsonResp({
          ok: true,
          application: app,
          program: program || null,
          university: university || null,
          applicant: applicantProfile,
          history: history || [],
          doc_requests: docRequests || [],
          notes: notes || [],
          comm_threads: threads || [],
        });
      }

      // ════════════════════════════════════════════════
      // APPLICATION TRANSITION (canonical decision workflow)
      // ════════════════════════════════════════════════
      case "application.transition": {
        const { application_id, new_status, note } = body;
        if (!application_id || !new_status) {
          return jsonResp({ error: "application_id and new_status required" }, 400);
        }

        if (!INTAKE_STATUSES.includes(new_status as IntakeStatus)) {
          return jsonResp({ error: "invalid_status", valid: INTAKE_STATUSES }, 400);
        }

        const { data: app } = await supabaseAdmin
          .from("intake_applications")
          .select("id, status, university_id, user_id, program_id")
          .eq("id", application_id)
          .single();

        if (!app) return jsonResp({ error: "application not found" }, 404);

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, app.university_id);
        if (!hasAccess) return jsonResp({ error: "not_authorized" }, 403);

        // Validate transition
        const allowedNext = TRANSITION_RULES[app.status] || [];
        if (!allowedNext.includes(new_status)) {
          return jsonResp({
            error: "invalid_transition",
            current_status: app.status,
            allowed_transitions: allowedNext,
          }, 400);
        }

        // Update application
        const updatePayload: Record<string, unknown> = {
          status: new_status,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
        };
        if (note) updatePayload.reviewer_notes = note;

        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("intake_applications")
          .update(updatePayload)
          .eq("id", application_id)
          .select("id, status, reviewed_at")
          .single();

        if (updateErr) throw updateErr;

        // Insert history
        await supabaseAdmin.from("intake_status_history").insert({
          application_id,
          old_status: app.status,
          new_status,
          changed_by: user.id,
          note: note || null,
        });

        // Auto-create comm thread for info_requested transitions
        if (new_status === "info_requested" && note) {
          const { data: thread } = await supabaseAdmin
            .from("comm_threads")
            .insert({
              thread_type: "application_update",
              created_by: user.id,
              university_id: app.university_id,
              subject: "Information requested for your application",
              linked_entity_type: "intake_application",
              linked_entity_id: application_id,
              status: "open",
              priority: "normal",
              last_message_at: new Date().toISOString(),
              last_message_preview: note.slice(0, 100),
            })
            .select("id")
            .single();

          if (thread) {
            await supabaseAdmin.from("comm_thread_participants").insert([
              { thread_id: thread.id, user_id: user.id, role: "staff" },
              { thread_id: thread.id, user_id: app.user_id, role: "student" },
            ]);
            await supabaseAdmin.from("comm_messages").insert({
              thread_id: thread.id,
              sender_id: user.id,
              sender_role: "staff",
              body: note,
            });
          }
        }

        return jsonResp({ ok: true, application: updated, transition: { from: app.status, to: new_status } });
      }

      // ════════════════════════════════════════════════
      // APPLICATION REVIEW (legacy compat — wraps transition)
      // ════════════════════════════════════════════════
      case "application.review": {
        const { application_id, new_status, reviewer_notes } = body;
        if (!application_id || !new_status) {
          return jsonResp({ error: "application_id and new_status required" }, 400);
        }

        // Map legacy statuses
        const statusMap: Record<string, string> = {
          under_review: "under_review",
          accepted: "accepted",
          rejected: "rejected",
          info_requested: "info_requested",
        };
        const mappedStatus = statusMap[new_status] || new_status;

        const { data: app } = await supabaseAdmin
          .from("intake_applications")
          .select("university_id")
          .eq("id", application_id)
          .single();

        if (!app) return jsonResp({ error: "application not found" }, 404);

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, app.university_id);
        if (!hasAccess) return jsonResp({ error: "not_authorized" }, 403);

        const { data: currentApp } = await supabaseAdmin
          .from("intake_applications")
          .select("status")
          .eq("id", application_id)
          .single();

        const oldStatus = currentApp?.status || "submitted";

        const { data, error } = await supabaseAdmin
          .from("intake_applications")
          .update({
            status: mappedStatus,
            reviewer_id: user.id,
            reviewer_notes: reviewer_notes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", application_id)
          .select("id, status, reviewed_at")
          .single();

        if (error) throw error;

        await supabaseAdmin.from("intake_status_history").insert({
          application_id,
          old_status: oldStatus,
          new_status: mappedStatus,
          changed_by: user.id,
          note: reviewer_notes || null,
        });

        return jsonResp({ ok: true, application: data });
      }

      // ════════════════════════════════════════════════
      // MY APPLICATIONS (student)
      // ════════════════════════════════════════════════
      case "application.my_list": {
        const { data: apps, error } = await supabaseAdmin
          .from("intake_applications")
          .select("*")
          .eq("user_id", user.id)
          .order("submitted_at", { ascending: false });

        if (error) throw error;

        // Enrich with program + university names
        const enriched = [];
        for (const app of (apps || [])) {
          const { data: prog } = await supabaseAdmin
            .from("programs")
            .select("name_en, name_ar, degree_level")
            .eq("id", app.program_id)
            .maybeSingle();

          const { data: uni } = await supabaseAdmin
            .from("universities")
            .select("name_en, name_ar")
            .eq("id", app.university_id)
            .maybeSingle();

          // Fetch doc requests count
          const { count: docRequestCount } = await supabaseAdmin
            .from("intake_doc_requests")
            .select("id", { count: "exact", head: true })
            .eq("application_id", app.id)
            .eq("status", "requested");

          // Fetch latest comm thread
          const { data: latestThread } = await supabaseAdmin
            .from("comm_threads")
            .select("id, last_message_at, last_message_preview")
            .eq("linked_entity_type", "intake_application")
            .eq("linked_entity_id", app.id)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          enriched.push({
            ...app,
            program: prog || null,
            university: uni || null,
            pending_doc_requests: docRequestCount || 0,
            latest_comm: latestThread || null,
          });
        }

        return jsonResp({ applications: enriched });
      }

      // ════════════════════════════════════════════════
      // STUDENT APPLICATION DETAIL
      // ════════════════════════════════════════════════
      case "application.my_detail": {
        const { application_id } = body;
        if (!application_id) return jsonResp({ error: "application_id required" }, 400);

        const { data: app, error: appErr } = await supabaseAdmin
          .from("intake_applications")
          .select("*")
          .eq("id", application_id)
          .eq("user_id", user.id)
          .single();

        if (appErr || !app) return jsonResp({ error: "application not found" }, 404);

        const { data: prog } = await supabaseAdmin
          .from("programs")
          .select("name_en, name_ar, degree_level, teaching_language")
          .eq("id", app.program_id)
          .maybeSingle();

        const { data: uni } = await supabaseAdmin
          .from("universities")
          .select("name_en, name_ar")
          .eq("id", app.university_id)
          .maybeSingle();

        const { data: history } = await supabaseAdmin
          .from("intake_status_history")
          .select("new_status, created_at, note")
          .eq("application_id", application_id)
          .order("created_at", { ascending: true });

        const { data: docRequests } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id, doc_type, message, status, created_at")
          .eq("application_id", application_id)
          .order("created_at", { ascending: false });

        const { data: sharedNotes } = await supabaseAdmin
          .from("intake_reviewer_notes")
          .select("note, created_at")
          .eq("application_id", application_id)
          .eq("visibility", "shared")
          .order("created_at", { ascending: false });

        const { data: threads } = await supabaseAdmin
          .from("comm_threads")
          .select("id, subject, status, last_message_at, last_message_preview")
          .eq("linked_entity_type", "intake_application")
          .eq("linked_entity_id", application_id)
          .order("last_message_at", { ascending: false });

        return jsonResp({
          ok: true,
          application: app,
          program: prog || null,
          university: uni || null,
          history: history || [],
          doc_requests: docRequests || [],
          shared_notes: sharedNotes || [],
          comm_threads: threads || [],
        });
      }

      // ════════════════════════════════════════════════
      // DOC REQUEST (operator creates)
      // ════════════════════════════════════════════════
      case "application.request_docs": {
        const { application_id, doc_type, message } = body;
        if (!application_id || !doc_type) {
          return jsonResp({ error: "application_id and doc_type required" }, 400);
        }

        const { data: app } = await supabaseAdmin
          .from("intake_applications")
          .select("id, university_id, user_id, status")
          .eq("id", application_id)
          .single();

        if (!app) return jsonResp({ error: "application not found" }, 404);

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, app.university_id);
        if (!hasAccess) return jsonResp({ error: "not_authorized" }, 403);

        // Create comm thread for the doc request
        const threadBody = message || `Document requested: ${doc_type}`;
        const { data: thread } = await supabaseAdmin
          .from("comm_threads")
          .insert({
            thread_type: "application_update",
            created_by: user.id,
            university_id: app.university_id,
            subject: `Document request: ${doc_type}`,
            linked_entity_type: "intake_application",
            linked_entity_id: application_id,
            status: "open",
            priority: "normal",
            last_message_at: new Date().toISOString(),
            last_message_preview: threadBody.slice(0, 100),
          })
          .select("id")
          .single();

        let commThreadId: string | null = null;
        if (thread) {
          commThreadId = thread.id;
          await supabaseAdmin.from("comm_thread_participants").insert([
            { thread_id: thread.id, user_id: user.id, role: "staff" },
            { thread_id: thread.id, user_id: app.user_id, role: "student" },
          ]);
          await supabaseAdmin.from("comm_messages").insert({
            thread_id: thread.id,
            sender_id: user.id,
            sender_role: "staff",
            body: threadBody,
          });
        }

        // Create doc request record
        const { data: docReq, error: docErr } = await supabaseAdmin
          .from("intake_doc_requests")
          .insert({
            application_id,
            requested_by: user.id,
            doc_type,
            message: message || null,
            status: "requested",
            comm_thread_id: commThreadId,
          })
          .select("id, doc_type, status, created_at, comm_thread_id")
          .single();

        if (docErr) throw docErr;

        // If application is not already in info_requested, transition it
        if (app.status !== "info_requested") {
          const allowed = TRANSITION_RULES[app.status] || [];
          if (allowed.includes("info_requested")) {
            await supabaseAdmin
              .from("intake_applications")
              .update({ status: "info_requested", reviewer_id: user.id, reviewed_at: new Date().toISOString() })
              .eq("id", application_id);

            await supabaseAdmin.from("intake_status_history").insert({
              application_id,
              old_status: app.status,
              new_status: "info_requested",
              changed_by: user.id,
              note: `Document requested: ${doc_type}`,
            });
          }
        }

        return jsonResp({ ok: true, doc_request: docReq, comm_thread_id: commThreadId });
      }

      // ════════════════════════════════════════════════
      // DOC REQUEST FULFILL (student marks as received)
      // ════════════════════════════════════════════════
      case "application.fulfill_doc_request": {
        const { doc_request_id } = body;
        if (!doc_request_id) return jsonResp({ error: "doc_request_id required" }, 400);

        const { data: docReq } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id, application_id")
          .eq("id", doc_request_id)
          .single();

        if (!docReq) return jsonResp({ error: "doc_request not found" }, 404);

        // Verify student owns the application
        const { data: app } = await supabaseAdmin
          .from("intake_applications")
          .select("user_id, status, university_id")
          .eq("id", docReq.application_id)
          .single();

        if (!app || app.user_id !== user.id) {
          return jsonResp({ error: "not_authorized" }, 403);
        }

        const { data: updated, error: updErr } = await supabaseAdmin
          .from("intake_doc_requests")
          .update({ status: "received", fulfilled_at: new Date().toISOString() })
          .eq("id", doc_request_id)
          .select("id, status, fulfilled_at")
          .single();

        if (updErr) throw updErr;

        // Check if all doc requests are fulfilled, transition to docs_received
        const { count: pendingCount } = await supabaseAdmin
          .from("intake_doc_requests")
          .select("id", { count: "exact", head: true })
          .eq("application_id", docReq.application_id)
          .eq("status", "requested");

        if ((pendingCount ?? 0) === 0 && app.status === "info_requested") {
          await supabaseAdmin
            .from("intake_applications")
            .update({ status: "docs_received" })
            .eq("id", docReq.application_id);

          await supabaseAdmin.from("intake_status_history").insert({
            application_id: docReq.application_id,
            old_status: "info_requested",
            new_status: "docs_received",
            changed_by: user.id,
            note: "All requested documents received",
          });
        }

        return jsonResp({ ok: true, doc_request: updated });
      }

      // ════════════════════════════════════════════════
      // REVIEWER NOTE (operator adds)
      // ════════════════════════════════════════════════
      case "application.add_note": {
        const { application_id, note, visibility = "internal" } = body;
        if (!application_id || !note) {
          return jsonResp({ error: "application_id and note required" }, 400);
        }

        const { data: app } = await supabaseAdmin
          .from("intake_applications")
          .select("university_id")
          .eq("id", application_id)
          .single();

        if (!app) return jsonResp({ error: "application not found" }, 404);

        const hasAccess = await verifyOperatorAccess(supabaseAdmin, user.id, app.university_id);
        if (!hasAccess) return jsonResp({ error: "not_authorized" }, 403);

        const validVisibility = ["internal", "shared"].includes(visibility) ? visibility : "internal";

        const { data: noteData, error: noteErr } = await supabaseAdmin
          .from("intake_reviewer_notes")
          .insert({
            application_id,
            author_id: user.id,
            note,
            visibility: validVisibility,
          })
          .select("id, note, visibility, created_at")
          .single();

        if (noteErr) throw noteErr;
        return jsonResp({ ok: true, note: noteData });
      }

      // ════════════════════════════════════════════════
      // INTAKE STATUS MODEL (for UI consumption)
      // ════════════════════════════════════════════════
      case "intake.status_model": {
        return jsonResp({
          ok: true,
          statuses: INTAKE_STATUSES,
          transitions: TRANSITION_RULES,
        });
      }

      // ════════════════════════════════════════════════
      // INQUIRY (unchanged)
      // ════════════════════════════════════════════════
      case "inquiry.create": {
        const { university_id: inqUniId, program_id: inqProgId, subject: inqSubject, message: inqMessage } = body;
        if (!inqUniId) return jsonResp({ error: "university_id required" }, 400);
        if (!inqMessage || typeof inqMessage !== "string" || inqMessage.trim().length < 2) {
          return jsonResp({ error: "message required (min 2 chars)" }, 400);
        }

        const threadType = "university_public_inquiry";
        const { data: thread, error: threadError } = await supabaseAdmin
          .from("comm_threads")
          .insert({
            thread_type: threadType,
            created_by: user.id,
            university_id: inqUniId,
            subject: inqSubject || null,
            linked_entity_type: inqProgId ? "program" : "university",
            linked_entity_id: inqProgId || inqUniId,
            status: "open",
            priority: "normal",
            last_message_at: new Date().toISOString(),
            last_message_preview: inqMessage.trim().slice(0, 100),
          })
          .select("id")
          .single();

        if (threadError) throw threadError;

        await supabaseAdmin.from("comm_thread_participants").insert({
          thread_id: thread.id,
          user_id: user.id,
          role: "student",
        });

        const { error: msgError } = await supabaseAdmin
          .from("comm_messages")
          .insert({
            thread_id: thread.id,
            sender_id: user.id,
            sender_role: "student",
            body: inqMessage.trim(),
          });

        if (msgError) throw msgError;
        return jsonResp({ ok: true, thread_id: thread.id, type: "inquiry" });
      }

      default:
        return jsonResp({ error: `unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[intake-api]", err);
    return jsonResp({ error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

async function verifyOperatorAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  universityId: string,
): Promise<boolean> {
  try {
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (isAdmin === true) return true;
  } catch { /* RPC may not exist */ }

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

// ── Authoritative apply gate ──

type AuthoritativeProfile = {
  auth_user_id?: string | null;
  budget_usd?: number | null;
  citizenship?: string | null;
  country?: string | null;
  customer_id?: string | null;
  dob?: string | null;
  email?: string | null;
  full_name?: string | null;
  gender?: string | null;
  gpa?: string | null;
  id?: string | null;
  language_preference?: string | null;
  last_education_level?: string | null;
  passport_name?: string | null;
  phone?: string | null;
  preferred_degree_level?: string | null;
  preferred_major?: string | null;
};

type AuthoritativeFile = {
  file_kind?: string | null;
  file_name?: string | null;
};

type AuthoritativeGateResult = {
  blocking_gaps: number;
  dimensions: { academic: number; communication: number; competitive: number; documents: number; profile: number; };
  gates: { apply_blocked_reasons: string[]; can_apply: boolean; can_message_university: boolean; };
  overall_score: number;
  source: "server_authoritative";
  studentFiles?: AuthoritativeFile[];
  verified_at: string;
  verdict: "apply_ready" | "near_ready" | "needs_work" | "incomplete";
};

async function resolveAuthoritativeApplyGate(
  portalAdmin: ReturnType<typeof createClient>,
  portalUserId: string,
): Promise<
  | { ok: true; quality: AuthoritativeGateResult; profile: AuthoritativeProfile | null }
  | { ok: false; error: string; reason: string }
> {
  if (!CRM_URL || !CRM_SERVICE_ROLE_KEY) {
    return { ok: false, error: "gate_source_unavailable", reason: "crm_not_configured" };
  }

  const crm = createClient(CRM_URL, CRM_SERVICE_ROLE_KEY);
  let crmCustomerId: string | null = null;

  const { data: mapping, error: mappingError } = await portalAdmin
    .from("portal_customer_map")
    .select("crm_customer_id")
    .eq("portal_auth_user_id", portalUserId)
    .maybeSingle();

  if (mappingError) {
    return { ok: false, error: "gate_source_unavailable", reason: "portal_customer_map_lookup_failed" };
  }

  if (mapping?.crm_customer_id) crmCustomerId = mapping.crm_customer_id;

  if (!crmCustomerId) {
    try {
      const { data: authUserData, error: authUserError } = await portalAdmin.auth.admin.getUserById(portalUserId);
      if (authUserError) throw authUserError;
      const metadata = (authUserData.user?.user_metadata ?? {}) as Record<string, unknown>;
      const metaCustomerId =
        typeof metadata.crm_customer_id === "string" ? metadata.crm_customer_id
        : typeof metadata.customer_id === "string" ? metadata.customer_id
        : null;
      if (metaCustomerId) crmCustomerId = metaCustomerId;
    } catch {
      return { ok: false, error: "gate_source_unavailable", reason: "auth_metadata_lookup_failed" };
    }
  }

  const profileColumns = [
    "auth_user_id", "budget_usd", "citizenship", "country", "customer_id", "dob",
    "email", "full_name", "gender", "gpa", "id", "language_preference",
    "last_education_level", "passport_name", "phone", "preferred_degree_level", "preferred_major",
  ].join(", ");

  let profile: AuthoritativeProfile | null = null;

  if (crmCustomerId) {
    const { data: byCustomer, error: byCustomerError } = await crm
      .from("vw_student_portal_profile")
      .select(profileColumns)
      .or(`customer_id.eq.${crmCustomerId},id.eq.${crmCustomerId}`)
      .limit(1)
      .maybeSingle();
    if (byCustomerError) return { ok: false, error: "gate_source_unavailable", reason: "crm_profile_lookup_failed" };
    profile = (byCustomer as AuthoritativeProfile | null) ?? null;
  }

  if (!profile) {
    const { data: byAuthUser, error: byAuthUserError } = await crm
      .from("vw_student_portal_profile")
      .select(profileColumns)
      .eq("auth_user_id", portalUserId)
      .maybeSingle();
    if (byAuthUserError) return { ok: false, error: "gate_source_unavailable", reason: "crm_profile_lookup_failed" };
    profile = (byAuthUser as AuthoritativeProfile | null) ?? null;
    crmCustomerId = crmCustomerId ?? profile?.customer_id ?? profile?.id ?? null;
  }

  if (!profile || !crmCustomerId) {
    return { ok: true, quality: buildAuthoritativeGateResult(null, []), profile: null };
  }

  const { data: files, error: filesError } = await crm
    .from("customer_files")
    .select("file_kind, file_name")
    .eq("customer_id", crmCustomerId)
    .is("deleted_at", null)
    .eq("visibility", "student_visible")
    .not("status", "in", "(deleted,superseded)");

  if (filesError) return { ok: false, error: "gate_source_unavailable", reason: "crm_files_lookup_failed" };

  return {
    ok: true,
    quality: buildAuthoritativeGateResult(profile, (files as AuthoritativeFile[] | null) ?? []),
    profile,
  };
}

function buildAuthoritativeGateResult(profile: AuthoritativeProfile | null, files: AuthoritativeFile[]): AuthoritativeGateResult {
  if (!profile) {
    return {
      blocking_gaps: 1,
      dimensions: { academic: 0, communication: 0, competitive: 0, documents: 0, profile: 0 },
      gates: { can_apply: false, can_message_university: false, apply_blocked_reasons: ["file_quality.gate_reasons.no_profile"] },
      overall_score: 0, source: "server_authoritative", verified_at: new Date().toISOString(), verdict: "incomplete",
    };
  }

  const hasPassport = hasFile(files, "passport");
  const hasPhoto = hasFile(files, "photo", "personal_photo");
  const hasTranscript = hasFile(files, "transcript", "academic_transcript");
  const hasCertificate = hasFile(files, "certificate", "graduation_certificate", "school_certificate");
  const hasRecommendation = hasFile(files, "recommendation", "recommendation_letter");
  const hasCv = hasFile(files, "cv", "resume");
  const hasMotivation = hasFile(files, "motivation_letter", "personal_statement");

  const profileScore = scoreDimension([
    hasValue(profile.full_name), hasValue(profile.gender), hasValue(profile.dob),
    hasValue(profile.citizenship), hasValue(profile.country), hasValue(profile.preferred_major),
    hasValue(profile.preferred_degree_level), hasValue(profile.budget_usd),
    hasValue(profile.language_preference), hasValue(profile.passport_name),
  ]);
  const documentsScore = scoreDimension([hasPassport, hasPhoto, hasTranscript, hasCertificate]);
  const academicScore = scoreDimension([hasValue(profile.gpa), hasValue(profile.preferred_degree_level), hasValue(profile.last_education_level)]);
  const communicationScore = scoreDimension([hasValue(profile.phone), hasValue(profile.email), hasValue(profile.language_preference)]);
  const competitiveScore = scoreDimension([hasRecommendation, hasCv, hasMotivation]);

  const overallScore = Math.round(profileScore * 0.25 + documentsScore * 0.25 + academicScore * 0.20 + communicationScore * 0.15 + competitiveScore * 0.15);

  const applyBlockedReasons: string[] = [];
  if (profileScore < 70) applyBlockedReasons.push("file_quality.gate_reasons.profile_incomplete");
  if (documentsScore < 60) applyBlockedReasons.push("file_quality.gate_reasons.documents_incomplete");
  if (!hasPassport) applyBlockedReasons.push("file_quality.gate_reasons.passport_missing");
  if (!hasPhoto) applyBlockedReasons.push("file_quality.gate_reasons.photo_missing");

  const canApply = profileScore >= 70 && documentsScore >= 60 && hasPassport && hasPhoto;

  return {
    blocking_gaps: applyBlockedReasons.length,
    dimensions: { academic: academicScore, communication: communicationScore, competitive: competitiveScore, documents: documentsScore, profile: profileScore },
    gates: { can_apply: canApply, can_message_university: profileScore >= 40 && hasValue(profile.email), apply_blocked_reasons: applyBlockedReasons },
    overall_score: overallScore, source: "server_authoritative", studentFiles: files,
    verified_at: new Date().toISOString(), verdict: computeVerdict(overallScore, applyBlockedReasons.length),
  };
}

function computeVerdict(overallScore: number, blockingGapCount: number): "apply_ready" | "near_ready" | "needs_work" | "incomplete" {
  if (overallScore >= 80 && blockingGapCount === 0) return "apply_ready";
  if (overallScore >= 60 && blockingGapCount <= 2) return "near_ready";
  if (overallScore >= 30) return "needs_work";
  return "incomplete";
}

function scoreDimension(checks: boolean[]): number {
  if (!checks.length) return 0;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function hasFile(files: AuthoritativeFile[], ...kinds: string[]): boolean {
  const normalizedKinds = kinds.map((kind) => kind.toLowerCase());
  return files.some((file) => {
    const fileKind = (file.file_kind ?? "").toLowerCase();
    const fileName = (file.file_name ?? "").toLowerCase();
    return normalizedKinds.includes(fileKind) || normalizedKinds.some((kind) => fileName.includes(kind));
  });
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

type ProgramMatchInput = {
  id: string;
  is_active: boolean | null;
  degree_level: string | null;
  gpa_min: number | null;
  ielts_min_overall: number | null;
  toefl_min: number | null;
  accepted_certificates: string[] | null;
  teaching_language: string | null;
};

function evaluateProgramMatch(
  profile: AuthoritativeProfile | null,
  program: ProgramMatchInput,
  studentFiles: AuthoritativeFile[],
): { matched: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!profile) return { matched: false, reasons: ["match.no_profile"] };

  if (program.gpa_min != null && program.gpa_min > 0) {
    const studentGpa = parseFloat(String(profile.gpa ?? ""));
    if (isNaN(studentGpa)) reasons.push("match.gpa_missing");
    else if (studentGpa < program.gpa_min) reasons.push("match.gpa_below_minimum");
  }

  if (program.ielts_min_overall != null && program.ielts_min_overall > 0) {
    const hasIelts = studentFiles.some((f) => {
      const k = (f.file_kind ?? "").toLowerCase(); const n = (f.file_name ?? "").toLowerCase();
      return k.includes("ielts") || n.includes("ielts");
    });
    if (!hasIelts) reasons.push("match.ielts_certificate_missing");
  }

  if (program.toefl_min != null && program.toefl_min > 0) {
    const hasToefl = studentFiles.some((f) => {
      const k = (f.file_kind ?? "").toLowerCase(); const n = (f.file_name ?? "").toLowerCase();
      return k.includes("toefl") || n.includes("toefl");
    });
    if (!hasToefl) reasons.push("match.toefl_certificate_missing");
  }

  if (program.teaching_language) {
    const lang = program.teaching_language.toLowerCase();
    if (lang.includes("english") || lang === "en") {
      const requiresIelts = program.ielts_min_overall != null && program.ielts_min_overall > 0;
      const requiresToefl = program.toefl_min != null && program.toefl_min > 0;
      if (!requiresIelts && !requiresToefl) {
        const hasAnyEnglishProof = studentFiles.some((f) => {
          const k = (f.file_kind ?? "").toLowerCase(); const n = (f.file_name ?? "").toLowerCase();
          return ["ielts", "toefl", "english_proficiency", "duolingo", "pte", "cambridge"].some((t) => k.includes(t) || n.includes(t));
        });
        if (!hasAnyEnglishProof) reasons.push("match.english_proficiency_missing");
      }
    }
  }

  if (program.accepted_certificates && program.accepted_certificates.length > 0) {
    const normalizedAccepted = program.accepted_certificates.map((c) => c.toLowerCase().trim());
    const studentCertFiles = studentFiles.filter((f) => {
      const k = (f.file_kind ?? "").toLowerCase();
      return ["certificate", "graduation_certificate", "school_certificate", "diploma"].some((t) => k.includes(t));
    });
    if (studentCertFiles.length === 0) reasons.push("match.accepted_certificate_missing");
    else {
      const hasMatchingCert = studentCertFiles.some((f) => {
        const k = (f.file_kind ?? "").toLowerCase(); const n = (f.file_name ?? "").toLowerCase();
        return normalizedAccepted.some((ac) => k.includes(ac) || n.includes(ac));
      });
      if (!hasMatchingCert) reasons.push("match.certificate_type_not_accepted");
    }
  }

  if (program.degree_level && profile.preferred_degree_level) {
    const degreeHierarchy: Record<string, number> = {
      associate: 1, diploma: 1, bachelor: 2, bachelors: 2, undergraduate: 2,
      master: 3, masters: 3, msc: 3, mba: 3, graduate: 3, postgraduate: 3,
      phd: 4, doctorate: 4, doctoral: 4,
    };
    const pLevel = degreeHierarchy[program.degree_level.toLowerCase()] ?? 0;
    const sLevel = degreeHierarchy[profile.preferred_degree_level.toLowerCase()] ?? 0;
    if (pLevel > 0 && sLevel > 0 && Math.abs(pLevel - sLevel) > 1) reasons.push("match.degree_level_mismatch");
  }

  if (program.degree_level) {
    const pd = program.degree_level.toLowerCase();
    const le = (profile.last_education_level ?? "").toLowerCase();
    if (["master", "masters", "msc", "mba", "graduate", "postgraduate"].includes(pd) && le && ["high_school", "secondary", "diploma"].includes(le)) {
      reasons.push("match.insufficient_education_level");
    }
    if (["phd", "doctorate", "doctoral"].includes(pd) && le && ["high_school", "secondary", "diploma", "bachelor", "undergraduate"].includes(le)) {
      reasons.push("match.insufficient_education_level");
    }
  }

  return { matched: reasons.length === 0, reasons };
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
