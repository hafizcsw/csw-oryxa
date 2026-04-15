/**
 * useRussianActivation — Local-first activation check
 * 
 * Strategy:
 * 1. Check local `learning_enrollments` first
 * 2. If locally marked as "paid" → trust it, NO CRM call
 * 3. If NOT paid locally → call CRM once, sync result locally
 * 4. CRM can revoke access by updating local record (via webhook/admin)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLanguageCoursePaymentRoute } from "@/lib/languageCourseState";

// ═══ Module-level cache: survives unmount/remount across lesson navigations ═══
const activationCache = new Map<string, {
  snapshot: RussianActivationSnapshot;
  timestamp: number;
}>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type RussianActivationStatus = "unpaid" | "awaiting_payment" | "payment_pending" | "active" | "failed_or_retry";

interface RussianActivationSnapshot {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  enrollment: any | null;
  activationStatus: RussianActivationStatus;
  isActivated: boolean;
}

function normalizeEnrollmentStatus(enrollment: any | null): RussianActivationStatus {
  if (!enrollment) return "unpaid";

  const paymentStatus = String(enrollment.payment_status || "unpaid").toLowerCase();
  const enrollmentStatus = String(enrollment.enrollment_status || "exploring").toLowerCase();

  if (paymentStatus === "paid" && (enrollmentStatus === "active" || enrollmentStatus === "completed")) return "active";
  if (paymentStatus === "paid") return "active";
  if (paymentStatus === "pending") return "payment_pending";
  if (paymentStatus === "failed") return "failed_or_retry";
  if (["path_selected", "placement_done", "awaiting_payment"].includes(enrollmentStatus)) return "awaiting_payment";

  return "unpaid";
}

export function useRussianActivation(languageKey = 'russian') {
  // Initialize from cache if available
  const cachedInit = activationCache.get(languageKey);
  const hasFreshCache = cachedInit && (Date.now() - cachedInit.timestamp) < CACHE_TTL_MS;

  const [snapshot, setSnapshot] = useState<RussianActivationSnapshot>(hasFreshCache ? cachedInit.snapshot : {
    loading: true,
    isAuthenticated: false,
    userId: null,
    enrollment: null,
    activationStatus: "unpaid",
    isActivated: false,
  });

  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async (forceCrmCheck = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Don't flash loading if we have a valid cache
    const cached = activationCache.get(languageKey);
    const isCacheFresh = cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
    if (!isCacheFresh && mountedRef.current) {
      setSnapshot((prev) => ({ ...prev, loading: true }));
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id || !session.access_token) {
      if (mountedRef.current) {
        setSnapshot({
          loading: false, isAuthenticated: false, userId: null,
          enrollment: null, activationStatus: "unpaid", isActivated: false,
        });
      }
      fetchingRef.current = false;
      return;
    }

    const userId = session.user.id;

    // ═══ STEP 1: Check local enrollment first ═══
    const { data: enrollment } = await supabase
      .from("learning_enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("language", languageKey)
      .maybeSingle();

    const localStatus = normalizeEnrollmentStatus(enrollment);

    // ═══ STEP 2: If locally "active" → trust it, skip CRM ═══
    if (localStatus === "active" && !forceCrmCheck) {
      const result: RussianActivationSnapshot = {
        loading: false, isAuthenticated: true, userId,
        enrollment, activationStatus: "active", isActivated: true,
      };
      if (mountedRef.current) setSnapshot(result);
      activationCache.set(languageKey, { snapshot: result, timestamp: Date.now() });
      fetchingRef.current = false;
      return;
    }

    // ═══ STEP 3: Not active locally → check CRM once ═══
    let crmStatus: RussianActivationStatus | null = null;

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "resolve_course_access", language_key: languageKey }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload?.ok && payload?.data) {
          const crmAccess = payload.data;
          if (crmAccess.has_active_access === true) {
            crmStatus = "active";
          } else if (crmAccess.payment_status) {
            const ps = String(crmAccess.payment_status).toLowerCase();
            if (["fully_paid", "paid"].includes(ps)) crmStatus = "active";
            else if (ps === "proof_received" || ps === "pending") crmStatus = "payment_pending";
            else if (["requested"].includes(ps)) crmStatus = "awaiting_payment";
            else if (["proof_rejected", "failed"].includes(ps)) crmStatus = "failed_or_retry";
          }
        }
      }
    } catch (error) {
      console.error("[useRussianActivation] CRM check error", error);
    }

    // ═══ STEP 4: If CRM says active → persist locally so we never ask again ═══
    let finalEnrollment = enrollment;
    if (crmStatus === "active") {
      if (enrollment) {
        if (enrollment.payment_status !== "paid" || enrollment.enrollment_status !== "active") {
          const update = {
            payment_status: "paid",
            enrollment_status: enrollment.enrollment_status === "completed" ? "completed" : "active",
          };
          await supabase.from("learning_enrollments").update(update as any).eq("id", enrollment.id);
          finalEnrollment = { ...enrollment, ...update };
        }
      } else {
        // No local enrollment exists yet → create one
        const { data: created } = await supabase
          .from("learning_enrollments")
          .upsert({
            user_id: userId,
            language: languageKey,
            payment_status: "paid",
            enrollment_status: "active",
            path_key: "general",
          } as any, { onConflict: "user_id,language" })
          .select("*")
          .single();
        finalEnrollment = created || null;
      }
    }

    const activationStatus = crmStatus ?? localStatus;
    const isActivated = activationStatus === "active";

    const result: RussianActivationSnapshot = {
      loading: false, isAuthenticated: true, userId,
      enrollment: finalEnrollment, activationStatus, isActivated,
    };

    if (mountedRef.current) setSnapshot(result);
    activationCache.set(languageKey, { snapshot: result, timestamp: Date.now() });
    fetchingRef.current = false;
  }, [languageKey]);

  // Only fetch once on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      refresh();
    }
  }, [refresh]);

  const upsertEnrollmentState = useCallback(async (updates: Record<string, unknown>) => {
    if (!snapshot.userId) return null;

    const payload = {
      user_id: snapshot.userId,
      language: languageKey,
      ...updates,
    };

    const { data, error } = await supabase
      .from("learning_enrollments")
      .upsert(payload as any, { onConflict: "user_id,language" })
      .select("*")
      .single();

    if (error) {
      console.error("[useRussianActivation] upsertEnrollmentState error", error);
      return null;
    }

    await refresh(true);
    return data;
  }, [snapshot.userId, refresh, languageKey]);

  return {
    ...snapshot,
    paymentRoute: getLanguageCoursePaymentRoute(languageKey),
    refresh: () => refresh(true),
    upsertEnrollmentState,
  };
}
