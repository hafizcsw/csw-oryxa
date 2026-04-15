// src/lib/chat/session.ts
// ✅ WEB Command Pack v4.1 - Stable session identity management
// CRITICAL: threadKey (local history) is SEPARATE from session_id (CRM)

const LS_GUEST = "oryxa_guest_session_id";
const LS_WEB = "oryxa_web_session_id";
const LS_TYPE = "oryxa_session_type";
const LS_CUSTOMER_ID = "malak_customer_id";
const LS_ACTIVE_THREAD = "oryxa_active_thread_key";
const LS_FORCE_GUEST = "chat_force_guest"; // PORTAL-1: Unified flag name (was portal_force_guest)

// ============================================================
// CHANNEL CONSTANTS (Portal ↔ CRM Contract) — CANONICAL MAPPING ENABLED
// ============================================================
// ✅ CANONICAL MAPPING (2026-02-05):
//    Guest → web_chat
//    Authenticated → web_portal
// Portal is also differentiated via entry_fn="portal-chat-ui" in the envelope.
const CHANNEL_WEB_CHAT = 'web_chat' as const;
const CHANNEL_WEB_PORTAL = 'web_portal' as const;

function uuid(): string {
  // Modern browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Get or create a stable guest session ID.
 * This persists across page refreshes and is used to track guest conversations.
 */
export function getOrCreateGuestSessionId(): string {
  const existing = localStorage.getItem(LS_GUEST);
  if (existing && existing.length > 8) return existing;
  
  const id = uuid();
  localStorage.setItem(LS_GUEST, id);
  console.log('[session] 🆕 Created new guest_session_id:', id);
  return id;
}

/**
 * Get or create a stable web session ID (for CRM communication).
 * This is what we send to CRM in requests.
 */
export function getOrCreateWebSessionId(): string {
  const existing = localStorage.getItem(LS_WEB);
  if (existing && existing.length > 8) return existing;
  
  const id = uuid();
  localStorage.setItem(LS_WEB, id);
  console.log('[session] 🆕 Created new web_session_id:', id);
  return id;
}

/**
 * Get the current session ID (without creating if missing).
 */
export function getCurrentSessionId(): string | null {
  return localStorage.getItem(LS_WEB);
}

/**
 * Get or create a LOCAL thread key for history storage.
 * IMPORTANT: This is SEPARATE from session_id sent to CRM.
 * Thread key NEVER changes for a conversation thread.
 */
export function getOrCreateThreadKey(): string {
  const existing = localStorage.getItem(LS_ACTIVE_THREAD);
  if (existing && existing.length > 8) return existing;
  
  const key = `thread_${uuid()}`;
  localStorage.setItem(LS_ACTIVE_THREAD, key);
  console.log('[session] 🆕 Created new thread_key:', key);
  return key;
}

/**
 * Get the current active thread key.
 */
export function getActiveThreadKey(): string | null {
  return localStorage.getItem(LS_ACTIVE_THREAD);
}

/**
 * Set the active thread key (when switching threads).
 */
export function setActiveThreadKey(key: string) {
  localStorage.setItem(LS_ACTIVE_THREAD, key);
  console.log('[session] 📝 Set active thread_key:', key);
}

/**
 * Get the current session type.
 */
export function getSessionType(): "guest" | "customer" {
  const value = (localStorage.getItem(LS_TYPE) || "guest").toLowerCase();
  return value === "customer" ? "customer" : "guest";
}

/**
 * Set the session type.
 */
export function setSessionType(type: "guest" | "customer") {
  localStorage.setItem(LS_TYPE, type);
  console.log('[session] 📝 Set session_type:', type);
}

/**
 * Get customer ID if available.
 */
export function getCustomerId(): string | null {
  return localStorage.getItem(LS_CUSTOMER_ID);
}

/**
 * Check if a string is a valid UUID format.
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Persist identifiers from CRM response.
 * IMPORTANT: Only updates CRM-related IDs, NOT the local thread key.
 * CRITICAL: session_id is ONLY updated if:
 *   1. It's a valid UUID format
 *   2. We don't already have a session_id established
 * This prevents CRM from overwriting our stable session identity.
 * Returns true if session_id changed (caller may need to update thread metadata).
 */
export function persistIdsFromResponse(data: any): { sessionIdChanged: boolean; newSessionId?: string } {
  if (!data) return { sessionIdChanged: false };
  
  let sessionIdChanged = false;
  let newSessionId: string | undefined;
  
  // Guest session ID: always accept if valid
  if (data.guest_session_id && typeof data.guest_session_id === 'string') {
    localStorage.setItem(LS_GUEST, data.guest_session_id);
    console.log('[session] 💾 Persisted guest_session_id from response');
  }
  
  // Session ID: ONLY accept if valid UUID AND we don't have one established
  if (data.session_id && typeof data.session_id === 'string') {
    const existingSessionId = localStorage.getItem(LS_WEB);
    
    // Only update if:
    // 1. New value is a valid UUID
    // 2. We don't have an existing session_id OR existing is not a valid UUID
    const newIsValidUUID = isValidUUID(data.session_id);
    const existingIsValidUUID = existingSessionId ? isValidUUID(existingSessionId) : false;
    
    if (newIsValidUUID && !existingIsValidUUID) {
      // Accept the new UUID - we either have no session or a non-UUID session
      sessionIdChanged = existingSessionId !== data.session_id;
      newSessionId = data.session_id;
      localStorage.setItem(LS_WEB, data.session_id);
      console.log('[session] 💾 Persisted session_id from response:', data.session_id);
    } else if (!newIsValidUUID) {
      console.log('[session] ⚠️ Rejected invalid session_id from CRM:', data.session_id);
    } else {
      console.log('[session] 🔒 Keeping existing session_id, ignoring CRM value');
    }
  }
  
  if (data.session_type === "guest" || data.session_type === "customer") {
    setSessionType(data.session_type);
  }
  
  if (data.customer_id && typeof data.customer_id === 'string') {
    localStorage.setItem(LS_CUSTOMER_ID, data.customer_id);
    console.log('[session] 💾 Persisted customer_id from response');
  }
  
  return { sessionIdChanged, newSessionId };
}

/**
 * Create a new thread (new conversation).
 * Creates new thread key AND new session ID for fresh start.
 */
export function createNewConversation(): { threadKey: string; sessionId: string } {
  const threadKey = `thread_${uuid()}`;
  const sessionId = uuid();
  
  localStorage.setItem(LS_ACTIVE_THREAD, threadKey);
  localStorage.setItem(LS_WEB, sessionId);
  
  console.log('[session] 🆕 Created new conversation:', { threadKey, sessionId });
  return { threadKey, sessionId };
}

/**
 * Reset session for a fresh start (used when user wants new conversation).
 * @deprecated Use createNewConversation() instead
 */
export function resetSession(): string {
  const { threadKey } = createNewConversation();
  return threadKey;
}

/**
 * Full logout - clear all session data.
 */
export function clearAllSessionData() {
  localStorage.removeItem(LS_GUEST);
  localStorage.removeItem(LS_WEB);
  localStorage.removeItem(LS_TYPE);
  localStorage.removeItem(LS_CUSTOMER_ID);
  localStorage.removeItem(LS_ACTIVE_THREAD);
  localStorage.removeItem(LS_FORCE_GUEST); // PORTAL-ORDER-1: Clear forced guest flag
  console.log('[session] 🗑️ Cleared all session data');
}

/**
 * Get all session identifiers for API requests.
 * Always returns stable IDs to prevent session duplication.
 * 
 * CHANNEL: Always "web_chat" for ALL users (auth and guest).
 * Portal is differentiated via entry_fn="portal-chat-ui" in envelope.
 * This is temporary until CRM confirms web_portal channel support.
 */
export function getSessionIdentifiers(isAuthenticated: boolean = false) {
  return {
    guest_session_id: getOrCreateGuestSessionId(),
    session_id: getOrCreateWebSessionId(),
    session_type: getSessionType(),
    customer_id: getCustomerId(),
    channel: isAuthenticated ? CHANNEL_WEB_PORTAL : CHANNEL_WEB_CHAT,
  };
}

/**
 * Get channel based on authentication state — CANONICAL MAPPING
 * Guest → web_chat
 * Authenticated → web_portal
 */
export function getChannel(isAuthenticated: boolean): typeof CHANNEL_WEB_CHAT | typeof CHANNEL_WEB_PORTAL {
  return isAuthenticated ? CHANNEL_WEB_PORTAL : CHANNEL_WEB_CHAT;
}

/**
 * Channel constants for external use — CANONICAL MAPPING ENABLED
 */
export const CHANNELS = {
  WEB_CHAT: CHANNEL_WEB_CHAT,
  WEB_PORTAL: CHANNEL_WEB_PORTAL,
} as const;

// ============================================================
// PORTAL-ORDER-2: Centralized Session Identity (Fail-Closed)
// ============================================================

/**
 * CRITICAL: Single source of truth for session identity.
 * This MUST be used in all places: gateway, envelope, metadata.
 * 
 * Logic:
 * 1. If chat_force_guest=true → ALWAYS guest/web_chat (explicit override)
 * 2. If Supabase auth session → authenticated/web_portal
 * 3. Otherwise → guest/web_chat (Fail-Closed)
 * 
 * Returns: { session_type, channel, isForced }
 */
export function getSessionIdentity(): {
  session_type: 'guest' | 'authenticated';
  channel: typeof CHANNEL_WEB_CHAT | typeof CHANNEL_WEB_PORTAL;
  isForced: boolean; // true if forced by chat_force_guest flag
} {
  // Check for Supabase auth FIRST (this overrides forced guest)
  // PORTAL-ORDER-P1: If authenticated, auto-clear forced guest flag
  const currentSessionType = getSessionType();
  const customerId = getCustomerId();
  
  if (customerId || currentSessionType === 'customer') {
    // PORTAL-ORDER-P1: Auto-clear forced guest flag if user is authenticated
    const wasForced = localStorage.getItem(LS_FORCE_GUEST) === 'true';
    if (wasForced) {
      localStorage.removeItem(LS_FORCE_GUEST);
      console.log('[session] 🔓 PORTAL-ORDER-P1: Auto-cleared forced guest (user authenticated)');
    }
    console.log('[session] 🔑 Authenticated session detected');
    return {
      session_type: 'authenticated',
      channel: CHANNEL_WEB_PORTAL,
      isForced: false
    };
  }
  
  // Now check for forced guest flag (only if NOT authenticated)
  const forceGuest = localStorage.getItem(LS_FORCE_GUEST) === 'true';
  if (forceGuest) {
    console.log('[session] 🔒 Forced guest mode active (chat_force_guest=true)');
    return {
      session_type: 'guest',
      channel: CHANNEL_WEB_CHAT,
      isForced: true
    };
  }
  
  // Fail-Closed: Default to guest
  console.log('[session] 👤 Defaulting to guest (no auth context)');
  return {
    session_type: 'guest',
    channel: CHANNEL_WEB_CHAT,
    isForced: false
  };
}

/**
 * PORTAL-ORDER-1: Force guest mode (called by "Continue as Guest")
 * This sets an explicit flag and clears any auth context.
 */
export function setForcedGuestMode() {
  localStorage.setItem(LS_FORCE_GUEST, 'true');
  // Clear any auth tokens/IDs that might contaminate the session
  localStorage.removeItem(LS_CUSTOMER_ID);
  localStorage.removeItem(LS_TYPE);
  console.log('[session] 🚀 PORTAL-ORDER-1: Forced guest mode enabled');
}

/**
 * Clear the forced guest flag (used when user logs in)
 */
export function clearForcedGuestMode() {
  localStorage.removeItem(LS_FORCE_GUEST);
  console.log('[session] 🔓 Forced guest mode cleared');
}
