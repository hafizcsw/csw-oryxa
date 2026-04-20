import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Holds the identity fields extracted by the document reader.
 * - Saved immediately after a successful reader run (preliminary)
 * - Survives reloads (localStorage)
 * - Scoped per user id to avoid leaking between accounts
 * - Cleared on logout
 *
 * Field keys follow the canonical reader contract:
 *   full_name, nationality, date_of_birth, document_number,
 *   issuing_country, expiry_date
 */
export type ExtractedIdentityFields = Record<string, string>;

const STORAGE_PREFIX = "csw.identity.extracted.";
const EVENT_NAME = "csw:identity-extracted-updated";

function storageKey(userId: string | null) {
  return userId ? `${STORAGE_PREFIX}${userId}` : null;
}

function readFromStorage(userId: string | null): ExtractedIdentityFields {
  const key = storageKey(userId);
  if (!key || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed as ExtractedIdentityFields : {};
  } catch {
    return {};
  }
}

function writeToStorage(userId: string | null, fields: ExtractedIdentityFields) {
  const key = storageKey(userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(fields));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* noop */
  }
}

/**
 * Persist extracted identity fields for the current user.
 * Accepts the raw reader output shape and stores only non-empty string values.
 */
export async function saveExtractedIdentity(
  raw: Record<string, { value: string | null; status?: string } | undefined> | null | undefined,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return;
  const out: ExtractedIdentityFields = {};
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object") continue;
      const val = (v as { value?: unknown }).value;
      if (typeof val === "string" && val.trim().length > 0) {
        out[k] = val.trim();
      }
    }
  }
  writeToStorage(user.id, out);
}

export function useExtractedIdentity() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedIdentityFields>({});

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setFields(readFromStorage(userId));
    if (typeof window === "undefined") return;
    const onUpdate = () => setFields(readFromStorage(userId));
    window.addEventListener(EVENT_NAME, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [userId]);

  const clear = useCallback(() => {
    if (!userId) return;
    writeToStorage(userId, {});
  }, [userId]);

  return { fields, clear };
}
