import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAGE_STAFF_ROLES = [
  "full_control",
  "page_admin",
  "content_publisher",
  "moderator",
  "inbox_agent",
  "analyst",
  "live_community_manager",
] as const;

const PAGE_STAFF_ROLE_SET = new Set<string>(PAGE_STAFF_ROLES);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidPageStaffRole(role: unknown): role is string {
  return typeof role === "string" && PAGE_STAFF_ROLE_SET.has(role);
}

function isProtectedPageStaffRole(role: string | null | undefined): boolean {
  return role === "full_control";
}

function getCanonicalPortalBaseUrl(): string {
  const raw = Deno.env.get("PORTAL_SITE_URL");
  if (!raw) throw new Error("PORTAL_SITE_URL_NOT_CONFIGURED");

  const url = new URL(raw);
  const pathname = url.pathname && url.pathname !== "/" ? url.pathname.replace(/\/$/, "") : "";
  return `${url.origin}${pathname}`;
}

function buildAcceptInviteUrl(token: string): string {
  return `${getCanonicalPortalBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
}

// Actions that can be accessed without authentication (public read)
const PUBLIC_ACTIONS = new Set(["posts.list", "comments.list"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json();
  const { action, university_id } = body;

  const authHeader = req.headers.get("Authorization");
  let user: { id: string; email?: string } | null = null;

  if (authHeader && authHeader !== "Bearer ") {
    const { data, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authErr && data?.user) user = data.user;
  }

  // For non-public actions, require authentication
  if (!PUBLIC_ACTIONS.has(action) && !user) {
    return json({ ok: false, error: "NO_AUTH" }, 401);
  }

  // ── Helpers ──
  async function isUserSuperAdmin(uid: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc("is_admin", { _user_id: uid });
      return data === true;
    } catch { return false; }
  }

  async function isSuperAdmin(): Promise<boolean> {
    if (!user) return false;
    return isUserSuperAdmin(user.id);
  }

  async function getStaffRole(uid: string, uniId: string): Promise<string | null> {
    const { data } = await supabase
      .from("university_page_staff")
      .select("role")
      .eq("university_id", uniId)
      .eq("user_id", uid)
      .eq("status", "active")
      .maybeSingle();
    return data?.role ?? null;
  }

  /** Map institution_claims role → page staff equivalent for permission checks.
   *  Unknown roles default to NULL (deny) — never grant access by default. */
  function mapClaimRoleToStaffRole(claimRole: string | null): string | null {
    const map: Record<string, string> = {
      owner: "full_control",
      admin: "page_admin",
      admissions: "content_publisher",
    };
    return map[claimRole ?? ""] ?? null;
  }

  async function getEffectiveRole(uid: string, uniId: string): Promise<string | null> {
    // 1. Direct page staff
    const staffRole = await getStaffRole(uid, uniId);
    if (staffRole) return staffRole;

    // 2. Approved institution claim for this university
    const { data: claims } = await supabase
      .from("institution_claims")
      .select("role")
      .eq("user_id", uid)
      .eq("institution_id", uniId)
      .eq("status", "approved")
      .limit(1);
    if (claims?.length) {
      const mapped = mapClaimRoleToStaffRole(claims[0].role);
      return mapped; // may be null for unknown roles → deny
    }

    return null;
  }

  async function hasPermission(uniId: string, allowedRoles: string[]): Promise<boolean> {
    if (!user) return false;
    if (await isSuperAdmin()) return true;
    const role = await getEffectiveRole(user.id, uniId);
    return role !== null && allowedRoles.includes(role);
  }

  async function getSettingValue(uniId: string, key: string): Promise<boolean | string | null> {
    const { data } = await supabase
      .from("university_page_settings")
      .select("value")
      .eq("university_id", uniId)
      .eq("key", key)
      .maybeSingle();
    const raw = data?.value ?? null;
    // Normalize string "true"/"false" → boolean for toggle settings
    if (raw === "true" || raw === true) return true;
    if (raw === "false" || raw === false) return false;
    return raw;
  }

  async function logActivity(uniId: string, actionType: string, targetType: string, targetId?: string, metadata?: Record<string, unknown>) {
    try {
      await supabase.from("page_activity_log").insert({
        university_id: uniId,
        actor_user_id: user!.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        metadata: metadata || {},
      });
    } catch { /* non-blocking */ }
  }

  /** Verify that a post belongs to the given university. Returns true if valid. */
  async function verifyPostOwnership(postId: string, uniId: string): Promise<boolean> {
    const { data } = await supabase
      .from("university_posts")
      .select("id")
      .eq("id", postId)
      .eq("university_id", uniId)
      .maybeSingle();
    return !!data;
  }

  // Check if user is restricted on this page
  async function isUserRestricted(uniId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from("university_user_restrictions")
      .select("id")
      .eq("university_id", uniId)
      .eq("user_id", userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1);
    return (data?.length ?? 0) > 0;
  }

  // Check keyword filters
  async function checkKeywordFilters(uniId: string, text: string): Promise<string | null> {
    const { data: filters } = await supabase
      .from("university_keyword_filters")
      .select("keyword, filter_action")
      .eq("university_id", uniId);
    if (!filters) return null;
    const lower = text.toLowerCase();
    for (const f of filters) {
      if (lower.includes(f.keyword.toLowerCase())) return f.filter_action;
    }
    return null;
  }

  try {
    switch (action) {
      // ═══════════════════════════════════════════
      // STAFF MANAGEMENT
      // ═══════════════════════════════════════════
      case "staff.my_role": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const admin = await isSuperAdmin();
        const role = await getEffectiveRole(user!.id, university_id);
        return json({ ok: true, role: admin ? "full_control" : role, is_super_admin: admin, is_staff: admin || role !== null });
      }

      case "staff.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_page_staff")
          .select("id, user_id, role, status, created_at, invited_by")
          .eq("university_id", university_id)
          .order("created_at");
        if (error) return json({ ok: false, error: error.message }, 400);

        const userIds = (data || []).map((s: any) => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        return json({ ok: true, staff: (data || []).map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) || null })) });
      }

      case "staff.invite": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { user_email, role } = body;
        if (!user_email || !role) return json({ ok: false, error: "Missing user_email or role" }, 400);

        if (!isValidPageStaffRole(role)) {
          return json({ ok: false, error: "INVALID_ROLE" }, 400);
        }

        const normalizedEmail = normalizeEmail(String(user_email));
        const currentUserIsSuperAdmin = await isSuperAdmin();

        // High-privilege roles require super admin
        if (isProtectedPageStaffRole(role) && !currentUserIsSuperAdmin)
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED_FOR_HIGH_ROLE" }, 403);

        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        // Check if already active staff by email
        const { data: existProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        if (existProfile) {
          const { data: existStaff } = await supabase
            .from("university_page_staff")
            .select("id")
            .eq("university_id", university_id)
            .eq("user_id", existProfile.user_id)
            .eq("status", "active")
            .maybeSingle();
          if (existStaff) return json({ ok: false, error: "ALREADY_STAFF" }, 409);
        }

        // Check for existing pending invitation
        const { data: existInvite } = await supabase
          .from("university_page_staff_invitations")
          .select("id")
          .eq("university_id", university_id)
          .ilike("email", normalizedEmail)
          .eq("status", "pending")
          .maybeSingle();
        if (existInvite) return json({ ok: false, error: "INVITATION_ALREADY_PENDING" }, 409);

        // Generate secure token
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const rawToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const tokenHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
        const tokenHash = Array.from(new Uint8Array(tokenHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const acceptUrl = buildAcceptInviteUrl(rawToken);

        const { data: invite, error: invErr } = await supabase
          .from("university_page_staff_invitations")
          .insert({
            university_id,
            email: normalizedEmail,
            intended_role: role,
            invited_by: user!.id,
            token_hash: tokenHash,
          })
          .select()
          .single();
        if (invErr) return json({ ok: false, error: invErr.message }, 400);

        // Get university name for email
        const { data: uniRow } = await supabase
          .from("universities")
          .select("name_ar, name_en")
          .eq("id", university_id)
          .maybeSingle();
        const uniName = uniRow?.name_en || uniRow?.name_ar || "University";

        // Get inviter name
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user!.id)
          .maybeSingle();
        const inviterName = inviterProfile ? `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() : '';

        // Send invitation email
        let emailQueued = false;
        try {
          const emailRes = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'staff-invitation',
              recipientEmail: normalizedEmail,
              idempotencyKey: `staff-invite-${invite.id}`,
              templateData: { universityName: uniName, roleName: role, inviterName, acceptUrl },
            },
          });
          emailQueued = !emailRes.error && emailRes.data?.ok !== false;
        } catch (emailErr) {
          console.error("Failed to send invite email:", emailErr);
        }

        console.log("[staff.invite] Invitation prepared", {
          invitation_id: invite.id,
          university_id,
          email: normalizedEmail,
          intended_role: role,
          accept_url_base: getCanonicalPortalBaseUrl(),
          email_queued: emailQueued,
        });

        await logActivity(university_id, "staff_invited", "invitation", invite.id, { role, user_email: normalizedEmail, email_queued: emailQueued });
        return json({ ok: true, invitation: { id: invite.id, email: normalizedEmail, role, status: 'pending' }, email_queued: emailQueued });
      }

      case "staff.accept_invite": {
        const { token } = body;
        if (!token) return json({ ok: false, error: "Missing token" }, 400);

        // Hash the provided token to match
        const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
        const hashedToken = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const { data: invite } = await supabase
          .from("university_page_staff_invitations")
          .select("*")
          .eq("token_hash", hashedToken)
          .eq("status", "pending")
          .maybeSingle();
        if (!invite) return json({ ok: false, error: "INVALID_OR_EXPIRED_TOKEN" }, 400);

        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
          await supabase.from("university_page_staff_invitations").update({ status: "expired" }).eq("id", invite.id);
          return json({ ok: false, error: "INVITATION_EXPIRED" }, 400);
        }

        if (!isValidPageStaffRole(invite.intended_role)) {
          return json({ ok: false, error: "INVALID_INVITE_ROLE" }, 400);
        }

        if (isProtectedPageStaffRole(invite.intended_role) && !(await isUserSuperAdmin(invite.invited_by))) {
          return json({ ok: false, error: "INVITER_NOT_AUTHORIZED_FOR_HIGH_ROLE" }, 403);
        }

        // Email must match: the accepting user's email must match the invited email
        const { data: acceptorProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", user!.id)
          .maybeSingle();
        const userEmail = user!.email || acceptorProfile?.email;
        if (!userEmail || normalizeEmail(userEmail) !== normalizeEmail(invite.email))
          return json({ ok: false, error: "EMAIL_MISMATCH" }, 403);

        // Check not already staff
        const { data: existStaff } = await supabase
          .from("university_page_staff")
          .select("id")
          .eq("university_id", invite.university_id)
          .eq("user_id", user!.id)
          .eq("status", "active")
          .maybeSingle();
        if (existStaff) {
          await supabase.from("university_page_staff_invitations").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by_user_id: user!.id }).eq("id", invite.id);
          return json({ ok: false, error: "ALREADY_STAFF" }, 409);
        }

        // Activate staff membership
        const { data: newStaff, error: staffErr } = await supabase
          .from("university_page_staff")
          .insert({ university_id: invite.university_id, user_id: user!.id, role: invite.intended_role, invited_by: invite.invited_by, status: "active" })
          .select()
          .single();
        if (staffErr) return json({ ok: false, error: staffErr.message }, 400);

        // Mark invitation as accepted
        await supabase.from("university_page_staff_invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by_user_id: user!.id })
          .eq("id", invite.id);

        await logActivity(invite.university_id, "staff_invite_accepted", "invitation", invite.id, { role: invite.intended_role, email: invite.email });
        return json({ ok: true, staff: newStaff });
      }

      case "staff.list_invites": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data: invites } = await supabase
          .from("university_page_staff_invitations")
          .select("id, email, intended_role, status, created_at, expires_at, accepted_at, invited_by")
          .eq("university_id", university_id)
          .order("created_at", { ascending: false });

        return json({ ok: true, invitations: invites || [] });
      }

      case "staff.revoke_invite": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { invite_id } = body;
        if (!invite_id) return json({ ok: false, error: "Missing invite_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const currentUserIsSuperAdmin = await isSuperAdmin();
        const { data: inviteRow } = await supabase
          .from("university_page_staff_invitations")
          .select("id, intended_role")
          .eq("id", invite_id)
          .eq("university_id", university_id)
          .eq("status", "pending")
          .maybeSingle();
        if (!inviteRow) return json({ ok: false, error: "INVITE_NOT_FOUND" }, 404);
        if (isProtectedPageStaffRole(inviteRow.intended_role) && !currentUserIsSuperAdmin) {
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED_FOR_HIGH_ROLE" }, 403);
        }

        const { error: revErr } = await supabase
          .from("university_page_staff_invitations")
          .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user!.id })
          .eq("id", invite_id)
          .eq("university_id", university_id)
          .eq("status", "pending");
        if (revErr) return json({ ok: false, error: revErr.message }, 400);

        await logActivity(university_id, "staff_invite_revoked", "invitation", invite_id);
        return json({ ok: true });
      }

      case "staff.resend_invite": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { invite_id } = body;
        if (!invite_id) return json({ ok: false, error: "Missing invite_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const currentUserIsSuperAdmin = await isSuperAdmin();

        // Revoke old, create new token
        const { data: oldInvite } = await supabase
          .from("university_page_staff_invitations")
          .select("*")
          .eq("id", invite_id)
          .eq("university_id", university_id)
          .eq("status", "pending")
          .maybeSingle();
        if (!oldInvite) return json({ ok: false, error: "INVITE_NOT_FOUND" }, 404);
        if (!isValidPageStaffRole(oldInvite.intended_role)) return json({ ok: false, error: "INVALID_INVITE_ROLE" }, 400);
        if (isProtectedPageStaffRole(oldInvite.intended_role) && !currentUserIsSuperAdmin) {
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED_FOR_HIGH_ROLE" }, 403);
        }

        // Revoke old
        await supabase.from("university_page_staff_invitations")
          .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user!.id })
          .eq("id", invite_id);

        // Create new
        const newTokenBytes = new Uint8Array(32);
        crypto.getRandomValues(newTokenBytes);
        const newRawToken = Array.from(newTokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const newHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(newRawToken));
        const newTokenHash = Array.from(new Uint8Array(newHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const acceptUrl2 = buildAcceptInviteUrl(newRawToken);

        const { data: newInvite } = await supabase
          .from("university_page_staff_invitations")
          .insert({
            university_id,
            email: oldInvite.email,
            intended_role: oldInvite.intended_role,
            invited_by: user!.id,
            token_hash: newTokenHash,
          })
          .select()
          .single();

        // Send email
        const { data: uniRow2 } = await supabase
          .from("universities")
          .select("name_en, name_ar")
          .eq("id", university_id)
          .maybeSingle();
        const uniName2 = uniRow2?.name_en || uniRow2?.name_ar || "University";
        let emailQueued = false;
        try {
          const emailRes = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'staff-invitation',
              recipientEmail: oldInvite.email,
              idempotencyKey: `staff-invite-${newInvite?.id}`,
              templateData: { universityName: uniName2, roleName: oldInvite.intended_role, acceptUrl: acceptUrl2 },
            },
          });
          emailQueued = !emailRes.error && emailRes.data?.ok !== false;
        } catch { /* non-blocking */ }

        console.log("[staff.resend_invite] Invitation prepared", {
          invitation_id: newInvite?.id,
          university_id,
          email: oldInvite.email,
          intended_role: oldInvite.intended_role,
          accept_url_base: getCanonicalPortalBaseUrl(),
          email_queued: emailQueued,
        });

        await logActivity(university_id, "staff_invite_resent", "invitation", newInvite?.id, { email: oldInvite.email, email_queued: emailQueued });
        return json({ ok: true, invitation: newInvite, email_queued: emailQueued });
      }

      // Legacy staff.add — redirect to invite flow
      case "staff.add": {
        // Redirect to invitation flow instead of direct add
        return json({ ok: false, error: "USE_STAFF_INVITE", message: "Direct staff addition is disabled. Use staff.invite instead." }, 400);
      }

      case "staff.update_role": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { staff_id, new_role } = body;
        if (!staff_id || !new_role) return json({ ok: false, error: "Missing staff_id or new_role" }, 400);
        if (!isValidPageStaffRole(new_role)) return json({ ok: false, error: "INVALID_ROLE" }, 400);
        if (!(await hasPermission(university_id, ["full_control"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const currentUserIsSuperAdmin = await isSuperAdmin();

        // Get old role for audit
        const { data: oldStaff } = await supabase
          .from("university_page_staff")
          .select("role, user_id")
          .eq("id", staff_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!oldStaff) return json({ ok: false, error: "STAFF_NOT_FOUND" }, 404);

        if ((isProtectedPageStaffRole(oldStaff.role) || isProtectedPageStaffRole(new_role)) && !currentUserIsSuperAdmin) {
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED_FOR_HIGH_ROLE" }, 403);
        }

        if (oldStaff.role === new_role) {
          return json({ ok: true, unchanged: true });
        }

        const { error } = await supabase
          .from("university_page_staff")
          .update({ role: new_role })
          .eq("id", staff_id)
          .eq("university_id", university_id);
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "staff_role_changed", "staff", staff_id, { old_role: oldStaff?.role, new_role });
        return json({ ok: true });
      }

      case "staff.remove": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { staff_id } = body;
        if (!staff_id) return json({ ok: false, error: "Missing staff_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const currentUserIsSuperAdmin = await isSuperAdmin();

        // Get details for audit
        const { data: removedStaff } = await supabase
          .from("university_page_staff")
          .select("user_id, role")
          .eq("id", staff_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!removedStaff) return json({ ok: false, error: "STAFF_NOT_FOUND" }, 404);
        if (isProtectedPageStaffRole(removedStaff.role) && !currentUserIsSuperAdmin) {
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED_FOR_HIGH_ROLE" }, 403);
        }

        const { error } = await supabase
          .from("university_page_staff")
          .delete()
          .eq("id", staff_id)
          .eq("university_id", university_id);
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "staff_removed", "staff", staff_id, { removed_user: removedStaff?.user_id, role: removedStaff?.role });
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // POSTS
      // ═══════════════════════════════════════════
      case "posts.create": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "content_publisher"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { post_type, title, post_body, status: postStatus, pinned, scheduled_at, attachments } = body;
        if (!post_body) return json({ ok: false, error: "Missing post_body" }, 400);

        // Respect auto_publish setting — when disabled, force draft regardless of client input
        const autoPublishSetting = await getSettingValue(university_id, "auto_publish");
        const finalStatus = autoPublishSetting === false ? "draft" : (postStatus || "published");
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from("university_posts")
          .insert({
            university_id,
            author_id: user!.id,
            post_type: post_type || "news",
            title: title || null,
            body: post_body,
            status: finalStatus,
            pinned: pinned || false,
            scheduled_at: scheduled_at || null,
            published_at: finalStatus === "published" ? now : null,
            attachments: attachments || [],
          })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "post_created", "post", data.id, { post_type, status: finalStatus });
        return json({ ok: true, post: data });
      }

      case "posts.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const isStaff = await hasPermission(university_id, [
          "full_control", "page_admin", "content_publisher", "moderator",
          "inbox_agent", "analyst", "live_community_manager"
        ]);

        // Enforce posts_visible setting for public viewers
        if (!isStaff) {
          const postsVisible = await getSettingValue(university_id, "posts_visible");
          if (postsVisible === false) {
            return json({ ok: true, posts: [], is_staff: false, setting_hidden: true });
          }
        }

        let query = supabase
          .from("university_posts")
          .select("*")
          .eq("university_id", university_id)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false });

        if (!isStaff) {
          query = query.eq("status", "published");
        }

        const { data, error } = await query.limit(50);
        if (error) return json({ ok: false, error: error.message }, 400);

        const authorIds = [...new Set((data || []).map((p: any) => p.author_id))];
        const { data: authors } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_storage_path")
          .in("user_id", authorIds);
        const authorMap = new Map((authors || []).map((a: any) => [a.user_id, a]));

        // Get reaction counts per post
        const postIds = (data || []).map((p: any) => p.id);
        const { data: reactions } = await supabase
          .from("university_post_reactions")
          .select("post_id, reaction_type")
          .in("post_id", postIds);

        // Build counts map
        const reactionCountsMap: Record<string, Record<string, number>> = {};
        for (const r of (reactions || [])) {
          if (!reactionCountsMap[r.post_id]) reactionCountsMap[r.post_id] = {};
          reactionCountsMap[r.post_id][r.reaction_type] = (reactionCountsMap[r.post_id][r.reaction_type] || 0) + 1;
        }

        // Get comment counts per post
        const { data: commentCounts } = await supabase
          .from("university_comments")
          .select("post_id")
          .in("post_id", postIds)
          .eq("visible", true);
        const commentCountMap: Record<string, number> = {};
        for (const c of (commentCounts || [])) {
          commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1;
        }

        // Get current user's reactions (only if authenticated)
        let myReactionMap = new Map<string, string>();
        if (user) {
          const { data: myReactions } = await supabase
            .from("university_post_reactions")
            .select("post_id, reaction_type")
            .eq("user_id", user.id)
            .in("post_id", postIds);
          myReactionMap = new Map((myReactions || []).map((r: any) => [r.post_id, r.reaction_type]));
        }

        return json({
          ok: true,
          posts: (data || []).map((p: any) => ({
            ...p,
            author: authorMap.get(p.author_id) || null,
            reaction_counts: reactionCountsMap[p.id] || {},
            comment_count: commentCountMap[p.id] || 0,
            my_reaction: myReactionMap.get(p.id) || null,
          })),
          is_staff: isStaff,
        });
      }

      case "posts.update": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { post_id, ...updates } = body;
        if (!post_id) return json({ ok: false, error: "Missing post_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "content_publisher"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const updateFields: Record<string, unknown> = {};
        if (updates.title !== undefined) updateFields.title = updates.title;
        if (updates.post_body !== undefined) updateFields.body = updates.post_body;
        if (updates.post_type !== undefined) updateFields.post_type = updates.post_type;
        if (updates.pinned !== undefined) updateFields.pinned = updates.pinned;
        if (updates.status !== undefined) {
          updateFields.status = updates.status;
          if (updates.status === "published") updateFields.published_at = new Date().toISOString();
          if (updates.status === "archived") updateFields.archived_at = new Date().toISOString();
        }
        if (updates.attachments !== undefined) updateFields.attachments = updates.attachments;
        if (updates.scheduled_at !== undefined) updateFields.scheduled_at = updates.scheduled_at;

        const { error } = await supabase
          .from("university_posts")
          .update(updateFields)
          .eq("id", post_id)
          .eq("university_id", university_id);
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "post_updated", "post", post_id, updateFields);
        return json({ ok: true });
      }

      case "posts.delete": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { post_id } = body;
        if (!post_id) return json({ ok: false, error: "Missing post_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { error } = await supabase
          .from("university_posts")
          .delete()
          .eq("id", post_id)
          .eq("university_id", university_id);
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "post_deleted", "post", post_id);
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // COMMENTS
      // ═══════════════════════════════════════════
      case "comments.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { post_id } = body;
        if (!post_id) return json({ ok: false, error: "Missing post_id" }, 400);

        // Verify post belongs to this university
        if (!(await verifyPostOwnership(post_id, university_id)))
          return json({ ok: false, error: "POST_UNIVERSITY_MISMATCH" }, 400);

        const isStaff = await hasPermission(university_id, ["full_control", "page_admin", "moderator", "content_publisher"]);

        let query = supabase
          .from("university_comments")
          .select("*")
          .eq("post_id", post_id)
          .order("created_at", { ascending: true });

        if (!isStaff) {
          query = query.eq("visible", true);
        }

        const { data, error } = await query.limit(100);
        if (error) return json({ ok: false, error: error.message }, 400);

        // Enrich with profile names
        const commentUserIds = [...new Set((data || []).map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_storage_path")
          .in("user_id", commentUserIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        return json({
          ok: true,
          comments: (data || []).map((c: any) => ({ ...c, profile: profileMap.get(c.user_id) || null })),
          is_staff: isStaff,
        });
      }

      case "comments.create": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { post_id, comment_body, parent_id, as_university } = body;
        if (!post_id || !comment_body) return json({ ok: false, error: "Missing post_id or comment_body" }, 400);

        // Verify post belongs to this university
        if (!(await verifyPostOwnership(post_id, university_id)))
          return json({ ok: false, error: "POST_UNIVERSITY_MISMATCH" }, 400);

        // Check if comments are enabled
        const commentsEnabled = await getSettingValue(university_id, "comments_enabled");
        if (commentsEnabled === false) return json({ ok: false, error: "COMMENTS_DISABLED" }, 403);

        // Check if user is restricted
        if (await isUserRestricted(university_id, user!.id)) {
          return json({ ok: false, error: "USER_RESTRICTED" }, 403);
        }

        // Check keyword filters
        const filterAction = await checkKeywordFilters(university_id, comment_body);
        let visible = true;
        if (filterAction === "hide" || filterAction === "block") visible = false;

        // Check if moderation is required
        const moderationRequired = await getSettingValue(university_id, "moderation_required");
        if (moderationRequired === true) visible = false;

        // Only staff can reply as university
        const replyAsUni = as_university && await hasPermission(university_id, ["full_control", "page_admin", "moderator", "content_publisher"]);

        const { data, error } = await supabase
          .from("university_comments")
          .insert({
            post_id,
            university_id,
            user_id: user!.id,
            body: comment_body,
            parent_id: parent_id || null,
            visible,
            reply_as_university: !!replyAsUni,
          })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        if (filterAction === "flag") {
          await supabase.from("university_comment_moderation").insert({
            comment_id: data.id,
            action: "flagged",
            acted_by: user!.id,
            reason: "keyword_filter",
          });
        }

        await logActivity(university_id, "comment_created", "comment", data.id, { post_id, as_university: !!replyAsUni, auto_filtered: !!filterAction });
        return json({ ok: true, comment: data, filtered: !!filterAction });
      }

      case "comments.moderate": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { comment_id, mod_action, reason } = body;
        if (!comment_id || !mod_action) return json({ ok: false, error: "Missing fields" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        if (mod_action === "hide" || mod_action === "delete") {
          await supabase.from("university_comments").update({ visible: false }).eq("id", comment_id);
        } else if (mod_action === "show") {
          await supabase.from("university_comments").update({ visible: true }).eq("id", comment_id);
        }

        await supabase.from("university_comment_moderation").insert({
          comment_id,
          action: mod_action,
          acted_by: user!.id,
          reason: reason || null,
        });

        await logActivity(university_id, "comment_moderated", "comment", comment_id, { mod_action, reason });
        return json({ ok: true });
      }

      case "comments.moderation_queue": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        // Get flagged/hidden comments for review
        const { data, error } = await supabase
          .from("university_comments")
          .select("*, university_comment_moderation(*)")
          .eq("university_id", university_id)
          .eq("visible", false)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return json({ ok: false, error: error.message }, 400);

        return json({ ok: true, queue: data || [] });
      }

      // ═══════════════════════════════════════════
      // USER RESTRICTIONS (ban/mute/restrict)
      // ═══════════════════════════════════════════
      case "moderation.restrict_user": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { target_user_id, restriction_type, reason, expires_at } = body;
        if (!target_user_id || !restriction_type) return json({ ok: false, error: "Missing fields" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_user_restrictions")
          .insert({
            university_id,
            user_id: target_user_id,
            restriction_type,
            reason: reason || null,
            expires_at: expires_at || null,
            restricted_by: user!.id,
          })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "user_restricted", "user", target_user_id, { restriction_type, reason });
        return json({ ok: true, restriction: data });
      }

      case "moderation.unrestrict_user": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { target_user_id } = body;
        if (!target_user_id) return json({ ok: false, error: "Missing target_user_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        await supabase
          .from("university_user_restrictions")
          .delete()
          .eq("university_id", university_id)
          .eq("user_id", target_user_id);

        await logActivity(university_id, "user_unrestricted", "user", target_user_id);
        return json({ ok: true });
      }

      case "moderation.list_restrictions": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_user_restrictions")
          .select("*")
          .eq("university_id", university_id)
          .order("created_at", { ascending: false });
        if (error) return json({ ok: false, error: error.message }, 400);

        return json({ ok: true, restrictions: data || [] });
      }

      // ═══════════════════════════════════════════
      // KEYWORD FILTERS
      // ═══════════════════════════════════════════
      case "moderation.keyword_filters.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data } = await supabase
          .from("university_keyword_filters")
          .select("*")
          .eq("university_id", university_id)
          .order("created_at");

        return json({ ok: true, filters: data || [] });
      }

      case "moderation.keyword_filters.add": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { keyword, filter_action } = body;
        if (!keyword) return json({ ok: false, error: "Missing keyword" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_keyword_filters")
          .insert({ university_id, keyword, filter_action: filter_action || "hide", created_by: user!.id })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "keyword_filter_added", "filter", data.id, { keyword, filter_action });
        return json({ ok: true, filter: data });
      }

      case "moderation.keyword_filters.remove": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { filter_id } = body;
        if (!filter_id) return json({ ok: false, error: "Missing filter_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "moderator"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        await supabase.from("university_keyword_filters").delete().eq("id", filter_id).eq("university_id", university_id);
        await logActivity(university_id, "keyword_filter_removed", "filter", filter_id);
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // INBOX
      // ═══════════════════════════════════════════
      case "inbox.threads": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { status: filterStatus } = body;
        let query = supabase
          .from("university_inbox_threads")
          .select("*, university_inbox_messages(id, body, sender_id, is_university_reply, created_at, read_at)")
          .eq("university_id", university_id)
          .order("updated_at", { ascending: false })
          .limit(50);

        if (filterStatus) query = query.eq("status", filterStatus);

        const { data, error } = await query;
        if (error) return json({ ok: false, error: error.message }, 400);

        // Enrich with visitor profiles
        const visitorIds = [...new Set((data || []).map((t: any) => t.visitor_user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, avatar_storage_path")
          .in("user_id", visitorIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        const enriched = (data || []).map((t: any) => ({
          ...t,
          visitor_profile: profileMap.get(t.visitor_user_id) || null,
          unread_count: (t.university_inbox_messages || []).filter((m: any) => !m.is_university_reply && !m.read_at).length,
        }));

        return json({ ok: true, threads: enriched });
      }

      case "inbox.reply": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { thread_id, message } = body;
        if (!thread_id || !message) return json({ ok: false, error: "Missing thread_id or message" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_inbox_messages")
          .insert({ thread_id, sender_id: user!.id, body: message, is_university_reply: true })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        await supabase
          .from("university_inbox_threads")
          .update({ status: "assigned", assigned_to: user!.id, updated_at: new Date().toISOString() })
          .eq("id", thread_id);

        await logActivity(university_id, "inbox_replied", "inbox", thread_id);
        return json({ ok: true, message: data });
      }

      case "inbox.update_thread": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { thread_id, status: threadStatus, assigned_to } = body;
        if (!thread_id) return json({ ok: false, error: "Missing thread_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (threadStatus) updates.status = threadStatus;
        if (assigned_to !== undefined) updates.assigned_to = assigned_to;

        const { error } = await supabase
          .from("university_inbox_threads")
          .update(updates)
          .eq("id", thread_id)
          .eq("university_id", university_id);
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "inbox_thread_updated", "inbox", thread_id, updates);
        return json({ ok: true });
      }

      case "inbox.send_as_visitor": {
        // Public: student sends a message to university
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { subject, message } = body;
        if (!message) return json({ ok: false, error: "Missing message" }, 400);

        // Check settings
        const { data: settingsData } = await supabase
          .from("university_page_settings")
          .select("value")
          .eq("university_id", university_id)
          .eq("key", "messaging_enabled")
          .maybeSingle();
        if (settingsData && settingsData.value === false) {
          return json({ ok: false, error: "MESSAGING_DISABLED" }, 403);
        }

        // Check if restricted
        if (await isUserRestricted(university_id, user!.id)) {
          return json({ ok: false, error: "USER_RESTRICTED" }, 403);
        }

        // Create thread
        const { data: thread, error: threadErr } = await supabase
          .from("university_inbox_threads")
          .insert({ university_id, visitor_user_id: user!.id, subject: subject || null, status: "open" })
          .select()
          .single();
        if (threadErr) return json({ ok: false, error: threadErr.message }, 400);

        // Create first message
        const { error: msgErr } = await supabase
          .from("university_inbox_messages")
          .insert({ thread_id: thread.id, sender_id: user!.id, body: message, is_university_reply: false });
        if (msgErr) return json({ ok: false, error: msgErr.message }, 400);

        // Check for auto-reply
        const { data: autoReply } = await supabase
          .from("university_page_settings")
          .select("value")
          .eq("university_id", university_id)
          .eq("key", "auto_reply_message")
          .maybeSingle();
        if (autoReply?.value) {
          await supabase.from("university_inbox_messages").insert({
            thread_id: thread.id,
            sender_id: user!.id,
            body: String(autoReply.value),
            is_university_reply: true,
          });
        }

        await logActivity(university_id, "inbox_message_received", "inbox", thread.id);
        return json({ ok: true, thread_id: thread.id });
      }

      // ═══════════════════════════════════════════
      // SAVED REPLIES
      // ═══════════════════════════════════════════
      case "inbox.saved_replies.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data } = await supabase
          .from("university_inbox_saved_replies")
          .select("*")
          .eq("university_id", university_id)
          .order("created_at");

        return json({ ok: true, saved_replies: data || [] });
      }

      case "inbox.saved_replies.add": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { title, reply_body } = body;
        if (!title || !reply_body) return json({ ok: false, error: "Missing title or reply_body" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("university_inbox_saved_replies")
          .insert({ university_id, title, body: reply_body, created_by: user!.id })
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 400);

        return json({ ok: true, saved_reply: data });
      }

      case "inbox.saved_replies.remove": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { reply_id } = body;
        if (!reply_id) return json({ ok: false, error: "Missing reply_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "inbox_agent"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        await supabase.from("university_inbox_saved_replies").delete().eq("id", reply_id).eq("university_id", university_id);
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // PAGE SETTINGS
      // ═══════════════════════════════════════════
      case "settings.get": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { data } = await supabase
          .from("university_page_settings")
          .select("key, value")
          .eq("university_id", university_id);

        const settings: Record<string, unknown> = {};
        for (const row of data || []) settings[row.key] = row.value;
        return json({ ok: true, settings });
      }

      case "settings.set": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { key, value } = body;
        if (!key) return json({ ok: false, error: "Missing key" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { error } = await supabase
          .from("university_page_settings")
          .upsert({ university_id, key, value: value ?? true, updated_by: user!.id }, { onConflict: "university_id,key" });
        if (error) return json({ ok: false, error: error.message }, 400);

        await logActivity(university_id, "setting_changed", "setting", key, { value });
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // ANALYTICS
      // ═══════════════════════════════════════════
      case "analytics.track": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { event_type, metadata: eventMeta, visitor_id } = body;
        if (!event_type) return json({ ok: false, error: "Missing event_type" }, 400);

        await supabase.from("university_page_analytics").insert({
          university_id,
          event_type,
          metadata: eventMeta || {},
          visitor_id: visitor_id || null,
          user_id: user?.id || null,
        });
        return json({ ok: true });
      }

      case "analytics.summary": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "analyst"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { days } = body;
        const since = new Date();
        since.setDate(since.getDate() - (days || 30));

        // Count events by type
        const { data: events } = await supabase
          .from("university_page_analytics")
          .select("event_type")
          .eq("university_id", university_id)
          .gte("created_at", since.toISOString());

        const counts: Record<string, number> = {};
        for (const e of events || []) {
          counts[e.event_type] = (counts[e.event_type] || 0) + 1;
        }

        // Also count posts, comments, threads
        const { count: postCount } = await supabase
          .from("university_posts")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id)
          .eq("status", "published");

        const { count: threadCount } = await supabase
          .from("university_inbox_threads")
          .select("id", { count: "exact", head: true })
          .eq("university_id", university_id);

        return json({
          ok: true,
          summary: {
            period_days: days || 30,
            events: counts,
            total_events: events?.length || 0,
            published_posts: postCount || 0,
            inbox_threads: threadCount || 0,
          },
        });
      }

      // ═══════════════════════════════════════════
      // ACTIVITY LOG
      // ═══════════════════════════════════════════
      case "activity.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("page_activity_log")
          .select("*")
          .eq("university_id", university_id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ ok: false, error: error.message }, 400);

        return json({ ok: true, activities: data || [] });
      }

      // ═══════════════════════════════════════════
      // PROGRAMS MANAGEMENT
      // ═══════════════════════════════════════════
      case "programs.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "content_publisher"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("programs")
          .select("id, title, degree_level, language, teaching_language, duration_months, tuition_yearly, currency_code, is_active, published, publish_status, application_deadline, apply_url, seats_total, seats_available, seats_status, study_mode, delivery_mode, city, created_at, updated_at")
          .eq("university_id", university_id)
          .order("degree_level")
          .order("title");
        if (error) return json({ ok: false, error: error.message }, 400);

        // Attach pending governed edits count per program
        const programIds = (data || []).map((p: any) => p.id);
        let pendingMap: Record<string, number> = {};
        if (programIds.length > 0) {
          const { data: pending } = await supabase
            .from("governed_field_edits")
            .select("entity_id")
            .eq("entity_type", "program")
            .eq("status", "pending")
            .in("entity_id", programIds);
          for (const p of pending || []) {
            pendingMap[p.entity_id] = (pendingMap[p.entity_id] || 0) + 1;
          }
        }

        const programs = (data || []).map((p: any) => ({ ...p, pending_edits: pendingMap[p.id] || 0 }));
        return json({ ok: true, programs });
      }

      case "programs.update": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { program_id, ...programUpdates } = body;
        if (!program_id) return json({ ok: false, error: "Missing program_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        // Verify program belongs to this university
        const { data: prog } = await supabase
          .from("programs")
          .select("id, title, degree_level, teaching_language, duration_months, tuition_yearly, currency_code")
          .eq("id", program_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!prog) return json({ ok: false, error: "PROGRAM_NOT_FOUND" }, 404);

        const DIRECT_SAFE_PROGRAM = ["is_active", "published", "publish_status",
          "application_deadline", "apply_url", "seats_total", "seats_available", "seats_status",
          "study_mode", "delivery_mode"];
        const GOVERNED_PROGRAM = ["title", "degree_level", "language", "teaching_language",
          "duration_months", "tuition_yearly", "currency_code"];

        const directFields: Record<string, unknown> = {};
        const governedFields: Record<string, unknown> = {};
        for (const k of DIRECT_SAFE_PROGRAM) {
          if (programUpdates[k] !== undefined) directFields[k] = programUpdates[k];
        }
        for (const k of GOVERNED_PROGRAM) {
          if (programUpdates[k] !== undefined) governedFields[k] = programUpdates[k];
        }

        if (Object.keys(directFields).length === 0 && Object.keys(governedFields).length === 0)
          return json({ ok: false, error: "No valid fields" }, 400);

        // Apply direct-safe fields immediately
        if (Object.keys(directFields).length > 0) {
          directFields.updated_at = new Date().toISOString();
          const { error } = await supabase
            .from("programs")
            .update(directFields)
            .eq("id", program_id)
            .eq("university_id", university_id);
          if (error) return json({ ok: false, error: error.message }, 400);
          await logActivity(university_id, "program_direct_update", "program", program_id, directFields);
        }

        // Route governed fields through review
        const governedInserts: any[] = [];
        for (const [field, value] of Object.entries(governedFields)) {
          governedInserts.push({
            entity_type: "program",
            entity_id: program_id,
            university_id,
            field_name: field,
            old_value: (prog as any)[field] ?? null,
            proposed_value: value,
            status: "pending",
            submitted_by: user!.id,
          });
        }
        if (governedInserts.length > 0) {
          const { error } = await supabase.from("governed_field_edits").insert(governedInserts);
          if (error) return json({ ok: false, error: error.message }, 400);
          await logActivity(university_id, "program_governed_submitted", "program", program_id, { fields: Object.keys(governedFields) });
        }

        return json({
          ok: true,
          direct_applied: Object.keys(directFields).filter(k => k !== "updated_at"),
          governed_pending: Object.keys(governedFields),
        });
      }

      // ═══════════════════════════════════════════
      // OFFERS MANAGEMENT (program_offers layer)
      // ═══════════════════════════════════════════
      case "offers.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const programId = body.program_id;
        let query = supabase
          .from("program_offers")
          .select("*")
          .eq("university_id", university_id)
          .order("created_at", { ascending: false });
        if (programId) query = query.eq("program_id", programId);

        const { data, error } = await query;
        if (error) return json({ ok: false, error: error.message }, 400);
        return json({ ok: true, offers: data || [] });
      }

      case "offers.create": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { program_id: offerProgId } = body;
        if (!offerProgId) return json({ ok: false, error: "Missing program_id" }, 400);

        // Verify program belongs to this university
        const { data: progCheck } = await supabase
          .from("programs")
          .select("id")
          .eq("id", offerProgId)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!progCheck) return json({ ok: false, error: "PROGRAM_NOT_FOUND" }, 404);

        const { data: newOffer, error: offerErr } = await supabase
          .from("program_offers")
          .insert({
            program_id: offerProgId,
            university_id,
            offer_status: "draft",
          })
          .select()
          .single();
        if (offerErr) return json({ ok: false, error: offerErr.message }, 400);

        await logActivity(university_id, "offer_created", "program_offer", newOffer.id, { program_id: offerProgId });
        return json({ ok: true, offer: newOffer });
      }

      case "offers.update": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { offer_id, ...offerUpdates } = body;
        if (!offer_id) return json({ ok: false, error: "Missing offer_id" }, 400);

        // Verify offer belongs to this university
        const { data: offerCheck } = await supabase
          .from("program_offers")
          .select("id")
          .eq("id", offer_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!offerCheck) return json({ ok: false, error: "OFFER_NOT_FOUND" }, 404);

        const ALLOWED_OFFER_FIELDS = [
          "intake_term", "intake_year", "teaching_language", "study_mode", "delivery_mode",
          "seats_total", "seats_available", "seats_status", "application_deadline",
          "apply_url", "offer_status", "tuition_amount", "currency_code",
          "faculty", "department", "campus",
        ];
        const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ALLOWED_OFFER_FIELDS) {
          if (offerUpdates[k] !== undefined) safeUpdates[k] = offerUpdates[k];
        }

        const { error: updateErr } = await supabase
          .from("program_offers")
          .update(safeUpdates)
          .eq("id", offer_id)
          .eq("university_id", university_id);
        if (updateErr) return json({ ok: false, error: updateErr.message }, 400);

        await logActivity(university_id, "offer_updated", "program_offer", offer_id, safeUpdates);
        return json({ ok: true });
      }

      case "offers.delete": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { offer_id: delOfferId } = body;
        if (!delOfferId) return json({ ok: false, error: "Missing offer_id" }, 400);

        const { error: delErr } = await supabase
          .from("program_offers")
          .delete()
          .eq("id", delOfferId)
          .eq("university_id", university_id);
        if (delErr) return json({ ok: false, error: delErr.message }, 400);

        await logActivity(university_id, "offer_deleted", "program_offer", delOfferId, {});
        return json({ ok: true });
      }

      // ═══════════════════════════════════════════
      // PROGRAM INGESTION (file-based)
      // ═══════════════════════════════════════════
      case "ingestion.start": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { file_path: ingFilePath, file_type: ingFileType, file_name: ingFileName } = body;
        if (!ingFilePath) return json({ ok: false, error: "Missing file_path" }, 400);

        const { data: job, error: jobErr } = await supabase
          .from("program_ingestion_jobs")
          .insert({
            university_id,
            uploaded_by: user!.id,
            file_path: ingFilePath,
            file_type: ingFileType || "pdf",
            file_name: ingFileName || ingFilePath.split("/").pop(),
            status: "pending",
          })
          .select("id")
          .single();
        if (jobErr) return json({ ok: false, error: jobErr.message }, 400);

        // Invoke the extraction function asynchronously
        await supabase.functions.invoke("program-ingestion-extract", {
          body: { job_id: job.id, university_id },
        });

        await logActivity(university_id, "ingestion_started", "ingestion_job", job.id, { file_path: ingFilePath });
        return json({ ok: true, job_id: job.id });
      }

      case "ingestion.review_proposal": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { proposal_id, decision } = body;
        if (!proposal_id) return json({ ok: false, error: "Missing proposal_id" }, 400);
        if (decision !== "approved" && decision !== "rejected") {
          return json({ ok: false, error: "INVALID_DECISION" }, 400);
        }

        const { data: proposal, error: proposalErr } = await supabase
          .from("program_ingestion_proposals")
          .select("id, job_id, review_status")
          .eq("id", proposal_id)
          .maybeSingle();
        if (proposalErr) return json({ ok: false, error: proposalErr.message }, 400);
        if (!proposal) return json({ ok: false, error: "PROPOSAL_NOT_FOUND" }, 404);

        const { data: job, error: jobCheckErr } = await supabase
          .from("program_ingestion_jobs")
          .select("id")
          .eq("id", proposal.job_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (jobCheckErr) return json({ ok: false, error: jobCheckErr.message }, 400);
        if (!job) return json({ ok: false, error: "JOB_NOT_FOUND" }, 404);

        const reviewed_at = new Date().toISOString();
        const { error: reviewErr } = await supabase
          .from("program_ingestion_proposals")
          .update({
            review_status: decision,
            reviewed_by: user!.id,
            reviewed_at,
          })
          .eq("id", proposal_id);
        if (reviewErr) return json({ ok: false, error: reviewErr.message }, 400);

        await logActivity(university_id, "ingestion_proposal_reviewed", "ingestion_proposal", proposal_id, {
          job_id: proposal.job_id,
          decision,
        });

        return json({
          ok: true,
          proposal_id,
          decision,
          reviewed_at,
        });
      }

      // ═══════════════════════════════════════════
      // INTELLIGENCE GENERATION (gated)
      // ═══════════════════════════════════════════
      case "intelligence.generate": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { program_id: intProgId, force: intForce } = body;
        if (!intProgId) return json({ ok: false, error: "Missing program_id" }, 400);

        // Verify program belongs to this university
        const { data: intProg } = await supabase
          .from("programs")
          .select("id")
          .eq("id", intProgId)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!intProg) return json({ ok: false, error: "PROGRAM_NOT_FOUND" }, 404);

        const result = await supabase.functions.invoke("program-intelligence-generate", {
          body: { program_id: intProgId, force: intForce, university_id },
        });

        return json({ ok: true, result: result.data });
      }

      // ═══════════════════════════════════════════
      // SCHOLARSHIPS MANAGEMENT
      // ═══════════════════════════════════════════
      case "scholarships.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin", "content_publisher"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data, error } = await supabase
          .from("scholarships")
          .select("id, title, status, deadline, amount, amount_value, amount_type, currency_code, coverage_type, eligibility, degree_level, study_level, description, application_url, is_active, program_id, created_at, updated_at")
          .eq("university_id", university_id)
          .order("created_at", { ascending: false });
        if (error) return json({ ok: false, error: error.message }, 400);

        // Attach pending governed edits count
        const schIds = (data || []).map((s: any) => s.id);
        let schPendingMap: Record<string, number> = {};
        if (schIds.length > 0) {
          const { data: pending } = await supabase
            .from("governed_field_edits")
            .select("entity_id")
            .eq("entity_type", "scholarship")
            .eq("status", "pending")
            .in("entity_id", schIds);
          for (const p of pending || []) {
            schPendingMap[p.entity_id] = (schPendingMap[p.entity_id] || 0) + 1;
          }
        }

        const scholarships = (data || []).map((s: any) => ({ ...s, pending_edits: schPendingMap[s.id] || 0 }));
        return json({ ok: true, scholarships });
      }

      case "scholarships.update": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { scholarship_id, ...schUpdates } = body;
        if (!scholarship_id) return json({ ok: false, error: "Missing scholarship_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { data: sch } = await supabase
          .from("scholarships")
          .select("id, title, amount, amount_value, currency_code, coverage_type, degree_level, description, eligibility")
          .eq("id", scholarship_id)
          .eq("university_id", university_id)
          .maybeSingle();
        if (!sch) return json({ ok: false, error: "SCHOLARSHIP_NOT_FOUND" }, 404);

        const DIRECT_SAFE_SCH = ["status", "deadline", "application_url", "is_active", "program_id"];
        const GOVERNED_SCH = ["title", "amount", "amount_value", "amount_type", "currency_code",
          "coverage_type", "eligibility", "degree_level", "study_level", "description"];

        const directSchFields: Record<string, unknown> = {};
        const governedSchFields: Record<string, unknown> = {};
        for (const k of DIRECT_SAFE_SCH) {
          if (schUpdates[k] !== undefined) directSchFields[k] = schUpdates[k];
        }
        for (const k of GOVERNED_SCH) {
          if (schUpdates[k] !== undefined) governedSchFields[k] = schUpdates[k];
        }

        if (Object.keys(directSchFields).length === 0 && Object.keys(governedSchFields).length === 0)
          return json({ ok: false, error: "No valid fields" }, 400);

        if (Object.keys(directSchFields).length > 0) {
          directSchFields.updated_at = new Date().toISOString();
          const { error } = await supabase
            .from("scholarships")
            .update(directSchFields)
            .eq("id", scholarship_id)
            .eq("university_id", university_id);
          if (error) return json({ ok: false, error: error.message }, 400);
          await logActivity(university_id, "scholarship_direct_update", "scholarship", scholarship_id, directSchFields);
        }

        const schGovernedInserts: any[] = [];
        for (const [field, value] of Object.entries(governedSchFields)) {
          schGovernedInserts.push({
            entity_type: "scholarship",
            entity_id: scholarship_id,
            university_id,
            field_name: field,
            old_value: (sch as any)[field] ?? null,
            proposed_value: value,
            status: "pending",
            submitted_by: user!.id,
          });
        }
        if (schGovernedInserts.length > 0) {
          const { error } = await supabase.from("governed_field_edits").insert(schGovernedInserts);
          if (error) return json({ ok: false, error: error.message }, 400);
          await logActivity(university_id, "scholarship_governed_submitted", "scholarship", scholarship_id, { fields: Object.keys(governedSchFields) });
        }

        return json({
          ok: true,
          direct_applied: Object.keys(directSchFields).filter(k => k !== "updated_at"),
          governed_pending: Object.keys(governedSchFields),
        });
      }

      // ═══════════════════════════════════════════
      // GOVERNED EDITS REVIEW
      // ═══════════════════════════════════════════
      case "governed.list": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        if (!(await hasPermission(university_id, ["full_control", "page_admin"])))
          return json({ ok: false, error: "ACCESS_DENIED" }, 403);

        const { status: filterStatus, entity_type: filterType } = body;
        let query = supabase
          .from("governed_field_edits")
          .select("*")
          .eq("university_id", university_id)
          .order("submitted_at", { ascending: false })
          .limit(200);
        if (filterStatus) query = query.eq("status", filterStatus);
        if (filterType) query = query.eq("entity_type", filterType);

        const { data, error } = await query;
        if (error) return json({ ok: false, error: error.message }, 400);
        return json({ ok: true, edits: data || [] });
      }

      case "governed.review": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { edit_id, decision, reviewer_note: revNote } = body;
        if (!edit_id || !["approved", "rejected"].includes(decision))
          return json({ ok: false, error: "Missing edit_id or invalid decision" }, 400);

        // Only super admin can approve governed truth edits
        if (!(await isSuperAdmin()))
          return json({ ok: false, error: "SUPER_ADMIN_REQUIRED" }, 403);

        const { data: edit } = await supabase
          .from("governed_field_edits")
          .select("*")
          .eq("id", edit_id)
          .eq("university_id", university_id)
          .eq("status", "pending")
          .maybeSingle();
        if (!edit) return json({ ok: false, error: "EDIT_NOT_FOUND" }, 404);

        if (decision === "approved") {
          // Apply the change to the canonical table
          const table = edit.entity_type === "program" ? "programs" : "scholarships";
          const { error: applyErr } = await supabase
            .from(table)
            .update({ [edit.field_name]: edit.proposed_value, updated_at: new Date().toISOString() })
            .eq("id", edit.entity_id);
          if (applyErr) return json({ ok: false, error: applyErr.message }, 400);

          await supabase
            .from("governed_field_edits")
            .update({ status: "approved", reviewed_by: user!.id, reviewer_note: revNote || null, reviewed_at: new Date().toISOString(), applied_at: new Date().toISOString() })
            .eq("id", edit_id);

          // Record in mutation history (proposal_id FK references institution_page_edits, so use null + store ref in payloads)
          await supabase.from("page_mutation_history").insert({
            university_id,
            mutation_type: `governed_${edit.entity_type}_${edit.field_name}`,
            before_payload: { [edit.field_name]: edit.old_value, entity_id: edit.entity_id, table, governed_edit_id: edit.id },
            after_payload: { [edit.field_name]: edit.proposed_value, entity_id: edit.entity_id, table, governed_edit_id: edit.id },
            proposal_id: null,
            actor_user_id: user!.id,
          });

          await logActivity(university_id, "governed_edit_approved", edit.entity_type, edit.entity_id, { field: edit.field_name, edit_id });
        } else {
          await supabase
            .from("governed_field_edits")
            .update({ status: "rejected", reviewed_by: user!.id, reviewer_note: revNote || null, reviewed_at: new Date().toISOString() })
            .eq("id", edit_id);
          await logActivity(university_id, "governed_edit_rejected", edit.entity_type, edit.entity_id, { field: edit.field_name, edit_id });
        }

        return json({ ok: true, decision });
      }
      // ═══════════════════════════════════════════
      // POST REACTIONS
      // ═══════════════════════════════════════════
      case "reactions.toggle": {
        if (!university_id) return json({ ok: false, error: "Missing university_id" }, 400);
        const { post_id, reaction_type } = body;
        if (!post_id) return json({ ok: false, error: "Missing post_id" }, 400);

        // Check if reactions are enabled
        const reactionsEnabled = await getSettingValue(university_id, "reactions_enabled");
        if (reactionsEnabled === false) return json({ ok: false, error: "REACTIONS_DISABLED" }, 403);

        // Verify post belongs to this university
        if (!(await verifyPostOwnership(post_id, university_id)))
          return json({ ok: false, error: "POST_UNIVERSITY_MISMATCH" }, 400);

        const validTypes = ["like", "love", "care", "haha", "wow", "sad", "angry"];
        if (reaction_type && !validTypes.includes(reaction_type))
          return json({ ok: false, error: "Invalid reaction_type" }, 400);

        // Check existing reaction
        const { data: existing } = await supabase
          .from("university_post_reactions")
          .select("id, reaction_type")
          .eq("post_id", post_id)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (existing) {
          if (!reaction_type || existing.reaction_type === reaction_type) {
            // Remove reaction (toggle off)
            await supabase.from("university_post_reactions").delete().eq("id", existing.id);
            return json({ ok: true, action: "removed", my_reaction: null });
          } else {
            // Change reaction type
            await supabase.from("university_post_reactions")
              .update({ reaction_type })
              .eq("id", existing.id);
            return json({ ok: true, action: "changed", my_reaction: reaction_type });
          }
        } else {
          // Insert new reaction
          const rt = reaction_type || "like";
          const { error } = await supabase
            .from("university_post_reactions")
            .insert({ post_id, user_id: user!.id, reaction_type: rt });
          if (error) return json({ ok: false, error: error.message }, 400);
          return json({ ok: true, action: "added", my_reaction: rt });
        }
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
