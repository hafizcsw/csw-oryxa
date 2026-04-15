/**
 * ✅ CRM Storage Upload - Using fetch(PUT) with signed URL
 * 
 * No SDK or CRM keys needed - the signed_url contains all auth.
 * This aligns with Portal architecture: all CRM coordination via Edge Function,
 * only the binary upload goes directly to storage.
 */

export async function uploadToCrmStorage(params: {
  signed_url: string;
  file: File;
}): Promise<{ ok: boolean; error?: string; details?: string }> {
  const { signed_url, file } = params;
  
  if (!signed_url) {
    return { 
      ok: false, 
      error: 'MISSING_SIGNED_URL',
      details: 'No signed_url provided for upload'
    };
  }
  
  try {
    console.log('[uploadToCrmStorage] Uploading via fetch(PUT)...');
    
    const response = await fetch(signed_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[uploadToCrmStorage] PUT failed:', response.status, errorText);
      return { 
        ok: false, 
        error: `PUT_FAILED_${response.status}`,
        details: errorText.slice(0, 500)
      };
    }
    
    console.log('[uploadToCrmStorage] ✅ Upload successful');
    return { ok: true };
    
  } catch (err) {
    console.error('[uploadToCrmStorage] Network error:', err);
    return { 
      ok: false, 
      error: 'NETWORK_ERROR',
      details: err instanceof Error ? err.message : String(err)
    };
  }
}
