// src/lib/chat/history.ts
// ✅ WEB Command Pack v4.1 - Chat history management with session mapping

type Role = "user" | "assistant";

export type HistoryMessage = {
  id: string;
  role: Role;
  text: string;
  created_at: string;
  reply_markdown?: string;
};

/**
 * Thread metadata - stores mapping between local thread and CRM sessions.
 * This ensures history doesn't fragment when CRM changes session_id.
 */
export type ThreadMetadata = {
  guest_session_id?: string;
  session_id?: string;
  customer_id?: string;
  session_type?: "guest" | "customer";
};

export type ChatThread = {
  thread_key: string;
  title: string;
  updated_at: string;
  metadata?: ThreadMetadata;
};

const LS_THREADS = "oryxa_chat_threads";
const LS_PREFIX = "oryxa_chat_thread__";
const LS_META_PREFIX = "oryxa_thread_meta__";
const MAX_THREADS = 20;
const MAX_MSGS = 200;

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * List all saved chat threads, sorted by most recent.
 */
export function listThreads(): ChatThread[] {
  return safeJson<ChatThread[]>(localStorage.getItem(LS_THREADS), []);
}

/**
 * Get a thread's metadata (session mapping).
 */
export function getThreadMetadata(thread_key: string): ThreadMetadata | null {
  return safeJson<ThreadMetadata | null>(
    localStorage.getItem(LS_META_PREFIX + thread_key),
    null
  );
}

/**
 * Update a thread's metadata (when CRM returns new session_id, etc).
 */
export function updateThreadMetadata(thread_key: string, updates: Partial<ThreadMetadata>) {
  const existing = getThreadMetadata(thread_key) || {};
  const merged = { ...existing, ...updates };
  localStorage.setItem(LS_META_PREFIX + thread_key, JSON.stringify(merged));
  console.log('[history] 📝 Updated thread metadata:', thread_key, updates);
}

/**
 * Add or update a thread in the list.
 */
export function upsertThread(thread: ChatThread) {
  const threads = listThreads();
  const idx = threads.findIndex((t) => t.thread_key === thread.thread_key);
  const next = [...threads];

  if (idx >= 0) {
    // Preserve existing metadata if not provided
    const existingMeta = next[idx].metadata;
    next[idx] = {
      ...thread,
      metadata: thread.metadata || existingMeta
    };
  } else {
    next.unshift(thread);
  }

  // Sort by updated_at desc
  next.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  localStorage.setItem(LS_THREADS, JSON.stringify(next.slice(0, MAX_THREADS)));
}

/**
 * Load messages for a specific thread.
 */
export function loadThreadMessages(thread_key: string): HistoryMessage[] {
  return safeJson<HistoryMessage[]>(
    localStorage.getItem(LS_PREFIX + thread_key),
    []
  );
}

/**
 * Save messages for a specific thread.
 */
export function saveThreadMessages(
  thread_key: string,
  messages: HistoryMessage[]
) {
  const trimmed = messages.slice(-MAX_MSGS);
  localStorage.setItem(LS_PREFIX + thread_key, JSON.stringify(trimmed));
}

/**
 * Delete a thread and its messages.
 */
export function deleteThread(thread_key: string) {
  // Remove from threads list
  const threads = listThreads().filter((t) => t.thread_key !== thread_key);
  localStorage.setItem(LS_THREADS, JSON.stringify(threads));

  // Remove messages
  localStorage.removeItem(LS_PREFIX + thread_key);
  
  // Remove metadata
  localStorage.removeItem(LS_META_PREFIX + thread_key);
}

/**
 * Derive a title from the first user message.
 */
export function deriveTitle(messages: HistoryMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user")?.text?.trim();
  return firstUser && firstUser.length > 0
    ? firstUser.slice(0, 42) + (firstUser.length > 42 ? "..." : "")
    : "محادثة جديدة";
}

/**
 * Create a new thread and return its key.
 * Also initializes metadata with current session info.
 */
export function createNewThread(sessionInfo?: ThreadMetadata): string {
  const thread_key = `thread_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  
  const thread: ChatThread = {
    thread_key,
    title: "محادثة جديدة",
    updated_at: new Date().toISOString(),
    metadata: sessionInfo
  };
  
  upsertThread(thread);
  
  // Save metadata separately for quick access
  if (sessionInfo) {
    updateThreadMetadata(thread_key, sessionInfo);
  }

  return thread_key;
}

/**
 * Find thread by session_id (useful when CRM returns existing session).
 */
export function findThreadBySessionId(session_id: string): string | null {
  const threads = listThreads();
  for (const thread of threads) {
    const meta = getThreadMetadata(thread.thread_key);
    if (meta?.session_id === session_id) {
      return thread.thread_key;
    }
  }
  return null;
}

/**
 * Clear all history (for full logout).
 */
export function clearAllHistory() {
  const threads = listThreads();
  
  // Remove all thread messages and metadata
  threads.forEach((t) => {
    localStorage.removeItem(LS_PREFIX + t.thread_key);
    localStorage.removeItem(LS_META_PREFIX + t.thread_key);
  });
  
  // Remove threads list
  localStorage.removeItem(LS_THREADS);
  
  console.log('[history] 🗑️ Cleared all chat history');
}
