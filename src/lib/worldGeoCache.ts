export type WorldGeoSource =
  | "memory"
  | "sessionStorage"
  | "indexedDB"
  | "network"
  | "service-worker";

interface SessionWorldGeoEntry {
  data: GeoJSON.FeatureCollection;
  cached_at: number;
  schema_version: number;
}

interface CachedWorldGeoEntry extends SessionWorldGeoEntry {
  key: string;
  url: string | null;
}

export const WORLD_GEO_CACHE_DB_NAME = "csw-world-geo-cache";
export const WORLD_GEO_CACHE_STORE_NAME = "world_geojson";
export const WORLD_GEO_CACHE_ENTRY_KEY = "world-geojson";
export const WORLD_GEO_CACHE_SESSION_KEY = "csw-world-geojson:v2";
export const WORLD_GEO_CACHE_LEGACY_SESSION_KEY = "csw-world-geojson";
export const WORLD_GEO_CACHE_SCHEMA_VERSION = 1;

const DB_VERSION = 1;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

let memoryCache: GeoJSON.FeatureCollection | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
let dbFailed = false;

function isValidWorldGeo(value: unknown): value is GeoJSON.FeatureCollection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as GeoJSON.FeatureCollection;
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features) && candidate.features.length > 0;
}

function readSessionValue(key: string): GeoJSON.FeatureCollection | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GeoJSON.FeatureCollection | SessionWorldGeoEntry;

    if (isValidWorldGeo(parsed)) return parsed;

    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      "schema_version" in parsed &&
      "cached_at" in parsed
    ) {
      const wrapped = parsed as SessionWorldGeoEntry;
      if (
        wrapped.schema_version === WORLD_GEO_CACHE_SCHEMA_VERSION &&
        typeof wrapped.cached_at === "number" &&
        Date.now() - wrapped.cached_at <= TTL_MS &&
        isValidWorldGeo(wrapped.data)
      ) {
        return wrapped.data;
      }
    }
  } catch {
    // Ignore parse errors and fall through to cleanup below.
  }

  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }

  return null;
}

function writeSessionValue(data: GeoJSON.FeatureCollection) {
  if (typeof window === "undefined") return;

  try {
    const entry: SessionWorldGeoEntry = {
      data,
      cached_at: Date.now(),
      schema_version: WORLD_GEO_CACHE_SCHEMA_VERSION,
    };
    sessionStorage.setItem(WORLD_GEO_CACHE_SESSION_KEY, JSON.stringify(entry));
    sessionStorage.removeItem(WORLD_GEO_CACHE_LEGACY_SESSION_KEY);
  } catch {
    // Session storage is a performance layer only.
  }
}

async function openWorldGeoDb(): Promise<IDBDatabase> {
  if (dbFailed) return Promise.reject(new Error("World Geo IndexedDB unavailable"));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(WORLD_GEO_CACHE_DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORLD_GEO_CACHE_STORE_NAME)) {
          db.createObjectStore(WORLD_GEO_CACHE_STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };

      request.onerror = () => {
        dbFailed = true;
        reject(request.error);
      };

      request.onblocked = () => {
        dbFailed = true;
        reject(new Error("World Geo IndexedDB blocked"));
      };
    } catch (error) {
      dbFailed = true;
      reject(error);
    }
  });

  return dbPromise;
}

async function readIndexedDbValue(): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const db = await openWorldGeoDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(WORLD_GEO_CACHE_STORE_NAME, "readonly");
      const request = tx.objectStore(WORLD_GEO_CACHE_STORE_NAME).get(WORLD_GEO_CACHE_ENTRY_KEY);

      request.onsuccess = () => {
        const entry = request.result as CachedWorldGeoEntry | undefined;
        if (
          !entry ||
          entry.schema_version !== WORLD_GEO_CACHE_SCHEMA_VERSION ||
          Date.now() - entry.cached_at > TTL_MS ||
          !isValidWorldGeo(entry.data)
        ) {
          return resolve(null);
        }

        resolve(entry.data);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIndexedDbValue(data: GeoJSON.FeatureCollection, url: string | null = null): Promise<void> {
  try {
    const db = await openWorldGeoDb();
    const tx = db.transaction(WORLD_GEO_CACHE_STORE_NAME, "readwrite");
    tx.objectStore(WORLD_GEO_CACHE_STORE_NAME).put({
      key: WORLD_GEO_CACHE_ENTRY_KEY,
      data,
      url,
      cached_at: Date.now(),
      schema_version: WORLD_GEO_CACHE_SCHEMA_VERSION,
    } satisfies CachedWorldGeoEntry);
  } catch {
    // IndexedDB is a performance layer only.
  }
}

export async function getCachedWorldGeo(): Promise<{
  data: GeoJSON.FeatureCollection | null;
  source: Extract<WorldGeoSource, "memory" | "sessionStorage" | "indexedDB"> | null;
}> {
  if (memoryCache && isValidWorldGeo(memoryCache)) {
    return { data: memoryCache, source: "memory" };
  }

  const sessionHit = readSessionValue(WORLD_GEO_CACHE_SESSION_KEY) ?? readSessionValue(WORLD_GEO_CACHE_LEGACY_SESSION_KEY);
  if (sessionHit) {
    memoryCache = sessionHit;
    writeSessionValue(sessionHit);
    return { data: sessionHit, source: "sessionStorage" };
  }

  const idbHit = await readIndexedDbValue();
  if (idbHit) {
    memoryCache = idbHit;
    writeSessionValue(idbHit);
    return { data: idbHit, source: "indexedDB" };
  }

  return { data: null, source: null };
}

export async function setCachedWorldGeo(data: GeoJSON.FeatureCollection, url: string | null = null): Promise<void> {
  memoryCache = data;
  writeSessionValue(data);
  await writeIndexedDbValue(data, url);
}

export async function clearWorldGeoCache(): Promise<void> {
  memoryCache = null;

  try {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(WORLD_GEO_CACHE_SESSION_KEY);
      sessionStorage.removeItem(WORLD_GEO_CACHE_LEGACY_SESSION_KEY);
    }
  } catch {
    // Ignore cleanup failures.
  }

  try {
    const db = await dbPromise;
    db?.close();
  } catch {
    // Ignore close failures.
  }

  dbPromise = null;
  dbFailed = false;

  try {
    const request = indexedDB.deleteDatabase(WORLD_GEO_CACHE_DB_NAME);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("World Geo IndexedDB delete blocked"));
    });
  } catch {
    // Best effort only.
  }
}

export async function detectWorldGeoFetchSource(
  url: string
): Promise<Extract<WorldGeoSource, "network" | "service-worker">> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller ||
    !("caches" in window)
  ) {
    return "network";
  }

  try {
    const matched = await caches.match(url);
    return matched ? "service-worker" : "network";
  } catch {
    return "network";
  }
}
