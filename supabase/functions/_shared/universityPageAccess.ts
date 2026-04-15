/**
 * Unified effective page access resolver (Phase 1):
 * Priority: 1) super-admin, 2) university_page_staff, 3) institution_claims
 * Returns slug for direct landing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EffectiveUniversityPageAccess = {
  granted: boolean;
  institutionId: string | null;
  universitySlug: string | null;
  accessState: string;
  role: string | null;
  isVerified: boolean;
  reason: string;
};

async function resolveSlug(
  supabase: ReturnType<typeof createClient>,
  universityId: string | null,
): Promise<string | null> {
  if (!universityId) return null;
  try {
    const { data } = await supabase
      .from("universities")
      .select("slug")
      .eq("id", universityId)
      .maybeSingle();
    return data?.slug ?? null;
  } catch {
    return null;
  }
}

export async function resolveEffectiveUniversityPageAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  targetUniversityId?: string,
): Promise<EffectiveUniversityPageAccess> {
  // ── 1. Super-admin override ──
  try {
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (isAdmin === true) {
      let resolvedInstitutionId = targetUniversityId ?? null;
      if (!resolvedInstitutionId) {
        // Try staff first, then claims
        const { data: staffRows } = await supabase
          .from("university_page_staff")
          .select("university_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (staffRows?.length) {
          resolvedInstitutionId = staffRows[0].university_id;
        } else {
          const { data: adminClaims } = await supabase
            .from("institution_claims")
            .select("institution_id")
            .eq("user_id", userId)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(1);
          if (adminClaims?.length) {
            resolvedInstitutionId = adminClaims[0].institution_id;
          }
        }
      }
      const slug = await resolveSlug(supabase, resolvedInstitutionId);
      return {
        granted: true,
        institutionId: resolvedInstitutionId,
        universitySlug: slug,
        accessState: "verified",
        role: "admin",
        isVerified: true,
        reason: "super_admin",
      };
    }
  } catch {
    // RPC may be missing
  }

  // ── 2. university_page_staff (highest priority for non-admin) ──
  const { data: staffRows } = await supabase
    .from("university_page_staff")
    .select("university_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (staffRows?.length) {
    const staff = staffRows[0];
    if (targetUniversityId && staff.university_id !== targetUniversityId) {
      const slug = await resolveSlug(supabase, staff.university_id);
      return {
        granted: false,
        institutionId: staff.university_id,
        universitySlug: slug,
        accessState: "verified",
        role: staff.role ?? null,
        isVerified: true,
        reason: "institution_mismatch",
      };
    }
    const slug = await resolveSlug(supabase, staff.university_id);
    return {
      granted: true,
      institutionId: staff.university_id,
      universitySlug: slug,
      accessState: "verified",
      role: staff.role ?? null,
      isVerified: true,
      reason: "page_staff",
    };
  }

  // ── 3. institution_claims fallback ──
  const { data: claims } = await supabase
    .from("institution_claims")
    .select("institution_id, status, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!claims?.length) {
    return {
      granted: false,
      institutionId: null,
      universitySlug: null,
      accessState: "no_institution_link",
      role: null,
      isVerified: false,
      reason: "no_institution_link",
    };
  }

  const latest = claims[0];
  const isVerified = latest.status === "approved";
  const mappedState = isVerified ? "verified" : latest.status;

  if (!isVerified) {
    return {
      granted: false,
      institutionId: latest.institution_id,
      universitySlug: null,
      accessState: mappedState,
      role: latest.role ?? null,
      isVerified,
      reason: `access_state:${mappedState}`,
    };
  }

  if (targetUniversityId && latest.institution_id !== targetUniversityId) {
    const slug = await resolveSlug(supabase, latest.institution_id);
    return {
      granted: false,
      institutionId: latest.institution_id,
      universitySlug: slug,
      accessState: mappedState,
      role: latest.role ?? null,
      isVerified,
      reason: "institution_mismatch",
    };
  }

  const slug = await resolveSlug(supabase, latest.institution_id);
  return {
    granted: true,
    institutionId: latest.institution_id,
    universitySlug: slug,
    accessState: mappedState,
    role: latest.role ?? null,
    isVerified,
    reason: "verified",
  };
}
