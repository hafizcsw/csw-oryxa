/**
 * comm-api — Canonical Communication Backbone
 * Single guarded backend for ALL thread/message operations.
 * No direct client writes allowed on comm_threads, comm_messages, comm_thread_participants.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// Valid thread types
const THREAD_TYPES = [
  "csw_support",
  "file_improvement",
  "university_public_inquiry",
  "university_qualified_inquiry",
  "application_thread",
  "teacher_student",
  "security_notice",
  "system_notice",
  "peer_message",
] as const;

const THREAD_STATUSES = ["open", "awaiting_reply", "assigned", "closed", "archived"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return err("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ═══════════════════════════════════════════
    // thread.create
    // ═══════════════════════════════════════════
    if (action === "thread.create") {
      const { thread_type, subject, linked_entity_type, linked_entity_id, university_id, participants, first_message } = body;

      if (!thread_type || !THREAD_TYPES.includes(thread_type)) {
        return err("Invalid thread_type");
      }
      if (!first_message?.trim()) return err("first_message is required");

      // Determine sender role
      const senderRole = await resolveSenderRole(supabaseAdmin, user.id, university_id, thread_type);

      // Create thread
      const { data: thread, error: threadErr } = await supabaseAdmin
        .from("comm_threads")
        .insert({
          thread_type,
          subject: subject?.trim() || null,
          linked_entity_type: linked_entity_type || null,
          linked_entity_id: linked_entity_id || null,
          university_id: university_id || null,
          created_by: user.id,
          last_message_at: new Date().toISOString(),
          last_message_preview: first_message.trim().slice(0, 100),
        })
        .select("id")
        .single();

      if (threadErr) return err(threadErr.message, 500);

      // Add creator as participant
      const participantRows = [
        { thread_id: thread.id, user_id: user.id, role: senderRole },
      ];

      // Add other participants
      if (participants && Array.isArray(participants)) {
        for (const p of participants) {
          if (p.user_id && p.user_id !== user.id) {
            participantRows.push({
              thread_id: thread.id,
              user_id: p.user_id,
              role: p.role || "student",
            });
          }
        }
      }

      // For university threads, add university staff as participants
      if (university_id && ["university_public_inquiry", "university_qualified_inquiry"].includes(thread_type)) {
        const { data: staff } = await supabaseAdmin
          .from("university_page_staff")
          .select("user_id, role")
          .eq("university_id", university_id);

        if (staff) {
          for (const s of staff) {
            if (!participantRows.some(p => p.user_id === s.user_id)) {
              participantRows.push({
                thread_id: thread.id,
                user_id: s.user_id,
                role: "university_staff",
              });
            }
          }
        }
      }

      await supabaseAdmin.from("comm_thread_participants").insert(participantRows);

      // Insert first message
      await supabaseAdmin.from("comm_messages").insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_role: senderRole,
        body: first_message.trim(),
      });

      return json({ ok: true, thread_id: thread.id });
    }

    // ═══════════════════════════════════════════
    // thread.list
    // ═══════════════════════════════════════════
    if (action === "thread.list") {
      const { filter_type, filter_status, university_id: filterUniId, limit: rawLimit } = body;
      const limit = Math.min(rawLimit || 50, 100);

      // Get thread IDs user participates in
      let participantQuery = supabaseAdmin
        .from("comm_thread_participants")
        .select("thread_id")
        .eq("user_id", user.id);

      const { data: participantRows } = await participantQuery;
      const threadIds = (participantRows || []).map(p => p.thread_id);

      if (threadIds.length === 0) return json({ ok: true, threads: [] });

      let query = supabaseAdmin
        .from("comm_threads")
        .select("*")
        .in("id", threadIds)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (filter_type) {
        if (Array.isArray(filter_type)) {
          query = query.in("thread_type", filter_type);
        } else {
          query = query.eq("thread_type", filter_type);
        }
      }
      if (filter_status) query = query.eq("status", filter_status);
      if (filterUniId) query = query.eq("university_id", filterUniId);

      const { data: threads } = await query;

      // Enrich with participant info and unread counts
      const enrichedThreads = [];
      for (const thread of threads || []) {
        // Get participants
        const { data: parts } = await supabaseAdmin
          .from("comm_thread_participants")
          .select("user_id, role, last_read_at")
          .eq("thread_id", thread.id);

        const myParticipant = parts?.find(p => p.user_id === user.id);

        // Count unread
        let unreadCount = 0;
        if (myParticipant) {
          let unreadQuery = supabaseAdmin
            .from("comm_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", thread.id)
            .neq("sender_id", user.id);

          if (myParticipant.last_read_at) {
            unreadQuery = unreadQuery.gt("created_at", myParticipant.last_read_at);
          }
          const { count } = await unreadQuery;
          unreadCount = count || 0;
        }

        // Get other participants for display
        const otherParticipantIds = (parts || [])
          .filter(p => p.user_id !== user.id)
          .map(p => p.user_id);

        let displayName = thread.subject || "";
        let displayAvatar: string | null = null;

        if (otherParticipantIds.length > 0) {
          // Try profiles first
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id, full_name, avatar_storage_path")
            .in("user_id", otherParticipantIds)
            .limit(1);

          if (profiles?.[0]) {
            displayName = profiles[0].full_name || displayName;
            displayAvatar = profiles[0].avatar_storage_path;
          }

          // For university threads, show university name instead
          if (thread.university_id && ["university_public_inquiry", "university_qualified_inquiry"].includes(thread.thread_type)) {
            const { data: uni } = await supabaseAdmin
              .from("universities")
              .select("name_en, name_ar, logo_url")
              .eq("id", thread.university_id)
              .single();
            if (uni) {
              displayName = uni.name_en || uni.name_ar || displayName;
              displayAvatar = uni.logo_url;
            }
          }
        }

        enrichedThreads.push({
          ...thread,
          unread_count: unreadCount,
          display_name: displayName,
          display_avatar: displayAvatar,
          participant_count: parts?.length || 0,
        });
      }

      return json({ ok: true, threads: enrichedThreads });
    }

    // ═══════════════════════════════════════════
    // thread.messages
    // ═══════════════════════════════════════════
    if (action === "thread.messages") {
      const { thread_id, limit: rawLimit } = body;
      if (!thread_id) return err("thread_id required");

      // Verify participant
      const isParticipant = await checkParticipant(supabaseAdmin, user.id, thread_id);
      if (!isParticipant) return err("Not a participant", 403);

      const limit = Math.min(rawLimit || 200, 500);
      const { data: messages } = await supabaseAdmin
        .from("comm_messages")
        .select("*")
        .eq("thread_id", thread_id)
        .order("created_at", { ascending: true })
        .limit(limit);

      // Get sender profiles
      const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, avatar_storage_path")
        .in("user_id", senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const enrichedMessages = (messages || []).map(m => ({
        ...m,
        sender_name: profileMap.get(m.sender_id)?.full_name || null,
        sender_avatar: profileMap.get(m.sender_id)?.avatar_storage_path || null,
      }));

      return json({ ok: true, messages: enrichedMessages });
    }

    // ═══════════════════════════════════════════
    // message.send
    // ═══════════════════════════════════════════
    if (action === "message.send") {
      const { thread_id, body: msgBody, attachment_url, attachment_name, attachment_type } = body;
      if (!thread_id) return err("thread_id required");
      if (!msgBody?.trim() && !attachment_url) return err("body or attachment required");

      const isParticipant = await checkParticipant(supabaseAdmin, user.id, thread_id);
      if (!isParticipant) return err("Not a participant", 403);

      // Get thread to determine sender role
      const { data: thread } = await supabaseAdmin
        .from("comm_threads")
        .select("university_id, thread_type")
        .eq("id", thread_id)
        .single();

      const senderRole = await resolveSenderRole(supabaseAdmin, user.id, thread?.university_id, thread?.thread_type);

      const { data: msg, error: msgErr } = await supabaseAdmin
        .from("comm_messages")
        .insert({
          thread_id,
          sender_id: user.id,
          sender_role: senderRole,
          body: msgBody?.trim() || "",
          attachment_url: attachment_url || null,
          attachment_name: attachment_name || null,
          attachment_type: attachment_type || null,
        })
        .select("id")
        .single();

      if (msgErr) return err(msgErr.message, 500);

      // Update thread last_message
      await supabaseAdmin
        .from("comm_threads")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: (msgBody?.trim() || attachment_name || "").slice(0, 100),
          status: senderRole === "student" ? "open" : "awaiting_reply",
        })
        .eq("id", thread_id);

      // Update sender's last_read_at
      await supabaseAdmin
        .from("comm_thread_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("thread_id", thread_id)
        .eq("user_id", user.id);

      return json({ ok: true, message_id: msg.id });
    }

    // ═══════════════════════════════════════════
    // message.read
    // ═══════════════════════════════════════════
    if (action === "message.read") {
      const { thread_id } = body;
      if (!thread_id) return err("thread_id required");

      const isParticipant = await checkParticipant(supabaseAdmin, user.id, thread_id);
      if (!isParticipant) return err("Not a participant", 403);

      await supabaseAdmin
        .from("comm_thread_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("thread_id", thread_id)
        .eq("user_id", user.id);

      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // thread.assign
    // ═══════════════════════════════════════════
    if (action === "thread.assign") {
      const { thread_id, assign_to } = body;
      if (!thread_id) return err("thread_id required");

      // Verify caller is staff participant
      const { data: callerPart } = await supabaseAdmin
        .from("comm_thread_participants")
        .select("role")
        .eq("thread_id", thread_id)
        .eq("user_id", user.id)
        .single();

      if (!callerPart || !["university_staff", "csw_staff"].includes(callerPart.role)) {
        return err("Only staff can assign", 403);
      }

      await supabaseAdmin
        .from("comm_threads")
        .update({ assigned_to: assign_to || null, status: assign_to ? "assigned" : "open" })
        .eq("id", thread_id);

      // Add assignee as participant if not already
      if (assign_to) {
        await supabaseAdmin
          .from("comm_thread_participants")
          .upsert(
            { thread_id, user_id: assign_to, role: callerPart.role },
            { onConflict: "thread_id,user_id" }
          );
      }

      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // thread.status
    // ═══════════════════════════════════════════
    if (action === "thread.status") {
      const { thread_id, status } = body;
      if (!thread_id || !status) return err("thread_id and status required");
      if (!THREAD_STATUSES.includes(status)) return err("Invalid status");

      const isParticipant = await checkParticipant(supabaseAdmin, user.id, thread_id);
      if (!isParticipant) return err("Not a participant", 403);

      await supabaseAdmin
        .from("comm_threads")
        .update({ status })
        .eq("id", thread_id);

      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // thread.unread_counts
    // ═══════════════════════════════════════════
    if (action === "thread.unread_counts") {
      const { data: parts } = await supabaseAdmin
        .from("comm_thread_participants")
        .select("thread_id, last_read_at")
        .eq("user_id", user.id);

      let totalUnread = 0;
      for (const p of parts || []) {
        let q = supabaseAdmin
          .from("comm_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", p.thread_id)
          .neq("sender_id", user.id);
        if (p.last_read_at) q = q.gt("created_at", p.last_read_at);
        const { count } = await q;
        totalUnread += count || 0;
      }

      return json({ ok: true, total_unread: totalUnread });
    }

    // ═══════════════════════════════════════════
    // notification.emit
    // ═══════════════════════════════════════════
    if (action === "notification.emit") {
      const { target_user_id, thread_type, subject, body: notifBody, linked_entity_type, linked_entity_id } = body;
      if (!target_user_id) return err("target_user_id required");
      if (!["security_notice", "system_notice"].includes(thread_type || "")) {
        return err("thread_type must be security_notice or system_notice");
      }

      const { data: thread } = await supabaseAdmin
        .from("comm_threads")
        .insert({
          thread_type: thread_type || "system_notice",
          subject: subject || "System Notice",
          linked_entity_type: linked_entity_type || null,
          linked_entity_id: linked_entity_id || null,
          created_by: user.id,
          last_message_at: new Date().toISOString(),
          last_message_preview: (notifBody || "").slice(0, 100),
        })
        .select("id")
        .single();

      if (!thread) return err("Failed to create notification", 500);

      await supabaseAdmin.from("comm_thread_participants").insert([
        { thread_id: thread.id, user_id: target_user_id, role: "student" },
        { thread_id: thread.id, user_id: user.id, role: "system" },
      ]);

      if (notifBody) {
        await supabaseAdmin.from("comm_messages").insert({
          thread_id: thread.id,
          sender_id: user.id,
          sender_role: "system",
          body: notifBody,
        });
      }

      return json({ ok: true, thread_id: thread.id });
    }

    return err("Unknown action: " + action);
  } catch (e: any) {
    console.error("[comm-api]", e);
    return err(e.message || "Internal error", 500);
  }
});

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

async function checkParticipant(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  threadId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("comm_thread_participants")
    .select("id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function resolveSenderRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  universityId?: string | null,
  threadType?: string | null
): Promise<string> {
  // Check if user is university staff
  if (universityId) {
    const { data: staff } = await supabase
      .from("university_page_staff")
      .select("role")
      .eq("university_id", universityId)
      .eq("user_id", userId)
      .maybeSingle();
    if (staff) return "university_staff";
  }

  // Check if user is teacher (for teacher_student threads)
  if (threadType === "teacher_student") {
    const { data: teacher } = await (supabase as any)
      .from("teacher_public_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (teacher) return "teacher";
  }

  // Check if CSW staff
  const { data: cswRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "moderator"])
    .maybeSingle();
  if (cswRole) return "csw_staff";

  // Check system notices
  if (["security_notice", "system_notice"].includes(threadType || "")) {
    return "system";
  }

  return "student";
}
