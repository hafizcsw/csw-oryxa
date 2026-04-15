/**
 * Retry function with exponential backoff and jitter
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { 
      return await fn(); 
    } catch (e: any) {
      lastErr = e;
      const code = e?.status ?? e?.response?.status;
      // Don't retry 4xx errors except 429 (rate limit)
      if (code !== 429 && code >= 400 && code < 500) break;
      // Exponential backoff with jitter: 300ms, ~540ms, ~972ms
      const sleep = Math.floor((300 * Math.pow(1.8, i)) + Math.random() * 200);
      await new Promise(r => setTimeout(r, sleep));
    }
  }
  throw lastErr;
}

/**
 * Process items in parallel with limited concurrency
 */
export async function mapPool<I, O>(
  items: I[], 
  limit: number, 
  worker: (item: I, idx: number) => Promise<O>
): Promise<(O | null)[]> {
  const ret: (O | null)[] = new Array(items.length).fill(null);
  let i = 0;
  const running: Promise<void>[] = [];
  
  async function runOne(idx: number) {
    ret[idx] = await worker(items[idx], idx);
  }
  
  while (i < items.length || running.length) {
    while (i < items.length && running.length < limit) {
      const p = runOne(i++)
        .catch(() => { /* swallow errors */ })
        .then(() => {
          const pos = running.indexOf(p as any);
          if (pos >= 0) running.splice(pos, 1);
        }) as any;
      running.push(p);
    }
    if (running.length) await Promise.race(running);
  }
  
  return ret;
}

/**
 * Check if image meets minimum quality requirements
 */
export function meetsMinimumRequirements(img: any, mediaType: string): boolean {
  return mediaType === 'logo'
    ? (img.width >= 800 && img.height >= 800)
    : (img.width >= 1024 && img.height >= 768);
}

/**
 * Compute SHA-256 hash of normalized URL for idempotency
 */
export async function computeImageHash(url: string): Promise<string> {
  const normalized = url.toLowerCase().trim().replace(/[?#].*$/, '');
  const buf = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Upload image to Supabase Storage and return public URL
 */
export async function uploadImageToStorage(
  supabaseClient: any,
  imageBase64: string,
  fileName: string,
  bucketName: string = 'university-media'
): Promise<string> {
  // Convert base64 to blob
  const blob = base64ToBlob(imageBase64, 'image/png');
  
  // Upload to storage
  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(fileName, blob, {
      contentType: 'image/png',
      cacheControl: '31536000', // Cache for 1 year
      upsert: true
    });

  if (error) {
    console.error('[uploadImageToStorage] Upload error:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseClient.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
