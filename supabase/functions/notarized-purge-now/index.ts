import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY: Require x-worker-secret header with correct value
    const workerSecret = req.headers.get('x-worker-secret');
    const expectedSecret = Deno.env.get('TRANSLATION_WORKER_SECRET');
    
    if (!workerSecret || !expectedSecret || workerSecret !== expectedSecret) {
      console.warn('Purge endpoint: unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or missing x-worker-secret header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Purge endpoint: authorized via x-worker-secret');

    // Use service role for all operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting purge of expired orders...');

    // Call the purge RPC
    const { data, error } = await supabase.rpc('rpc_notarized_purge_expired');

    if (error) {
      console.error('Purge RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get list of orders that were purged for storage cleanup
    // Use paths_json as canonical source for file paths (columns may not exist)
    const { data: purgedJobs, error: listError } = await supabase
      .from('notarized_translation_jobs')
      .select('id, order_id, original_path, paths_json')
      .eq('status', 'purged');

    if (listError) {
      console.warn('Could not list purged jobs:', listError);
    }

    // Attempt to delete storage objects for purged jobs
    let storageDeleteCount = 0;
    if (purgedJobs && purgedJobs.length > 0) {
      for (const job of purgedJobs) {
        const pathsToDelete: { bucket: string; path: string }[] = [];
        
        // Original file path (direct column)
        if (job.original_path) {
          pathsToDelete.push({ bucket: 'notarized_originals', path: job.original_path });
        }
        
        // Get paths from paths_json (canonical source)
        const pathsJson = job.paths_json as Record<string, string> | null;
        if (pathsJson) {
          if (pathsJson.draft_pdf_path) {
            pathsToDelete.push({ bucket: 'notarized_drafts', path: pathsJson.draft_pdf_path });
          }
          if (pathsJson.draft_docx_path) {
            pathsToDelete.push({ bucket: 'notarized_drafts', path: pathsJson.draft_docx_path });
          }
          if (pathsJson.scan_pdf_path) {
            pathsToDelete.push({ bucket: 'notarized_scans', path: pathsJson.scan_pdf_path });
          }
        }

        for (const { bucket, path } of pathsToDelete) {
          try {
            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([path]);
            
            if (!deleteError) {
              storageDeleteCount++;
              console.log(`Deleted ${bucket}/${path}`);
            } else {
              console.warn(`Failed to delete ${bucket}/${path}:`, deleteError);
            }
          } catch (e) {
            console.warn(`Error deleting ${bucket}/${path}:`, e);
          }
        }
      }
    }

    console.log(`Purge complete. Storage objects deleted: ${storageDeleteCount}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        purged_count: data || 0,
        storage_deleted: storageDeleteCount,
        message: `Purged ${data || 0} expired orders, deleted ${storageDeleteCount} storage objects`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Purge error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
