/**
 * ============================================================
 * Spatial Cache — Browser-persistent IndexedDB layer
 * ============================================================
 *
 * Provides persistent browser-side caching for geo resolution data.
 * Sits between in-memory cache and backend/network in the read hierarchy:
 *
 *   1. In-memory cache (fastest, session-scoped)
 *   2. IndexedDB (persistent across tabs/sessions, this module)
 *   3. Backend geo_cache / network (source of truth)
 *
 * On successful backend/network resolve, results are written back here.
 *
 * Cache keys are versioned: if SCHEMA_VERSION changes, entire DB is wiped.
 */

import type { ResolvedLocation } from "@/lib/geoResolver";

/* ── Config ── */
const DB_NAME = "csw-spatial-cache";
const SCHEMA_VERSION = 1; // bump to invalidate all cached data
const GEO_STORE = "geo_resolutions"; // university/city/country geo data
const META_STORE = "meta"; // schema version, timestamps
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default TTL

/* ── Types ── */
export interface CachedGeoEntry {
  key: string; // normalized_query_key (e.g. "tr:istanbul" or "uni:abc-123")
  data: ResolvedLocation;
  cached_at: number; // Date.now()
  schema_version: number;
}

interface MetaEntry {
  key: string;
  value: string | number;
}

/* ── Singleton DB handle ── */
let dbPromise: Promise<IDBDatabase> | null = null;
let dbFailed = false;

function openDB(): Promise<IDBDatabase> {
  if (dbFailed) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        // Wipe old stores on version change
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore(GEO_STORE, { keyPath: "key" });
        db.createObjectStore(META_STORE, { keyPath: "key" });
      };

      req.onsuccess = () => {
        const db = req.result;
        // Write schema version marker
        try {
          const tx = db.transaction(META_STORE, "readwrite");
          tx.objectStore(META_STORE).put({
            key: "schema_version",
            value: SCHEMA_VERSION,
          } satisfies MetaEntry);
        } catch { /* non-critical */ }
        resolve(db);
      };

      req.onerror = () => {
        dbFailed = true;
        reject(req.error);
      };

      req.onblocked = () => {
        dbFailed = true;
        reject(new Error("IndexedDB blocked"));
      };
    } catch (e) {
      dbFailed = true;
      reject(e);
    }
  });

  return dbPromise;
}

/* ── Public API ── */

/**
 * Get a single geo entry from IndexedDB.
 * Returns null if missing, expired, or on error.
 */
export async function idbGet(key: string): Promise<ResolvedLocation | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(GEO_STORE, "readonly");
      const req = tx.objectStore(GEO_STORE).get(key);
      req.onsuccess = () => {
        const entry = req.result as CachedGeoEntry | undefined;
        if (!entry) return resolve(null);
        if (entry.schema_version !== SCHEMA_VERSION) return resolve(null);
        if (Date.now() - entry.cached_at > TTL_MS) return resolve(null);
        resolve(entry.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Batch get multiple geo entries.
 * Returns a Map of key -> ResolvedLocation (only hits).
 */
export async function idbBatchGet(
  keys: string[]
): Promise<Map<string, ResolvedLocation>> {
  const result = new Map<string, ResolvedLocation>();
  if (keys.length === 0) return result;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(GEO_STORE, "readonly");
      const store = tx.objectStore(GEO_STORE);
      let pending = keys.length;
      const now = Date.now();

      for (const key of keys) {
        const req = store.get(key);
        req.onsuccess = () => {
          const entry = req.result as CachedGeoEntry | undefined;
          if (
            entry &&
            entry.schema_version === SCHEMA_VERSION &&
            now - entry.cached_at <= TTL_MS
          ) {
            result.set(key, entry.data);
          }
          if (--pending === 0) resolve(result);
        };
        req.onerror = () => {
          if (--pending === 0) resolve(result);
        };
      }
    });
  } catch {
    return result;
  }
}

/**
 * Write a single geo entry to IndexedDB.
 */
export async function idbSet(
  key: string,
  data: ResolvedLocation
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(GEO_STORE, "readwrite");
    tx.objectStore(GEO_STORE).put({
      key,
      data,
      cached_at: Date.now(),
      schema_version: SCHEMA_VERSION,
    } satisfies CachedGeoEntry);
  } catch {
    // Silently fail — IDB is a performance layer, not critical
  }
}

/**
 * Batch write multiple geo entries.
 */
export async function idbBatchSet(
  entries: Map<string, ResolvedLocation>
): Promise<void> {
  if (entries.size === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(GEO_STORE, "readwrite");
    const store = tx.objectStore(GEO_STORE);
    const now = Date.now();

    for (const [key, data] of entries) {
      store.put({
        key,
        data,
        cached_at: now,
        schema_version: SCHEMA_VERSION,
      } satisfies CachedGeoEntry);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Clear all cached geo data (manual cache bust).
 */
export async function idbClearAll(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(GEO_STORE, "readwrite");
    tx.objectStore(GEO_STORE).clear();
  } catch {
    // Silently fail
  }
}

/**
 * Force-delete the entire database (nuclear option for version changes).
 */
export async function idbDeleteDatabase(): Promise<void> {
  dbPromise = null;
  dbFailed = false;
  try {
    const req = indexedDB.deleteDatabase(DB_NAME);
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Best effort
  }
}

/**
 * Get current schema version for diagnostics.
 */
export function getSpatialCacheVersion(): number {
  return SCHEMA_VERSION;
}
