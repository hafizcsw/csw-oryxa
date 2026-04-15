import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Pipeline stages in order
const PIPELINE_STAGES = ['ocr', 'extract', 'translate', 'render'] as const;
type PipelineStage = typeof PIPELINE_STAGES[number];

// Get next stage or null if complete
function getNextStage(currentStage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STAGES.indexOf(currentStage);
  if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1];
}

// Map stage to job status
function stageToStatus(stage: PipelineStage): string {
  return `processing_${stage}`;
}

// Generate a mock draft PDF with order info
async function generateMockDraftPdf(orderInfo: {
  order_id: string;
  job_id: string;
  doc_slot: string;
  page_count: number;
  template_id: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Create a page for the mock translation
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  // Header
  page.drawText('NOTARIZED TRANSLATION', {
    x: 50,
    y: height - 80,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.5),
  });
  
  page.drawText('(MOCK DRAFT - FOR TESTING ONLY)', {
    x: 50,
    y: height - 110,
    size: 14,
    font: font,
    color: rgb(0.7, 0.1, 0.1),
  });
  
  // Order details
  const details = [
    `Order ID: ${orderInfo.order_id}`,
    `Job ID: ${orderInfo.job_id}`,
    `Document Type: ${orderInfo.doc_slot}`,
    `Page Count: ${orderInfo.page_count}`,
    `Template: ${orderInfo.template_id}`,
    `Generated: ${new Date().toISOString()}`,
  ];
  
  let yPos = height - 180;
  for (const detail of details) {
    page.drawText(detail, {
      x: 50,
      y: yPos,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPos -= 25;
  }
  
  // Mock content area
  page.drawRectangle({
    x: 50,
    y: 150,
    width: width - 100,
    height: yPos - 180,
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
  });
  
  page.drawText('[Translation content would appear here]', {
    x: 60,
    y: yPos - 30,
    size: 11,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Footer with notary stamp placeholder
  page.drawText('CERTIFIED TRANSLATION', {
    x: 50,
    y: 100,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  
  page.drawText('This is a mock document generated for testing the translation pipeline.', {
    x: 50,
    y: 80,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  return await pdfDoc.save();
}

// Process a single stage for a job
async function processStage(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  stage: PipelineStage,
  job: { order_id: string; doc_slot: string; page_count: number; template_id: string; processing_meta: Record<string, unknown> }
): Promise<{ success: boolean; error?: string; paths_json?: Record<string, unknown> }> {
  
  console.log(`[Worker] Processing job ${jobId} stage ${stage}`);
  
  // Update job status to current processing stage
  const { error: statusError } = await supabase.rpc('rpc_notarized_job_set_status', {
    p_job_id: jobId,
    p_status: stageToStatus(stage),
    p_paths_json: null,
    p_meta_json: { stage, started_at: new Date().toISOString() }
  });
  
  if (statusError) {
    console.error(`[Worker] Failed to set status for ${stage}:`, statusError);
    return { success: false, error: statusError.message };
  }
  
  // Simulate processing time (50-150ms per stage)
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  
  // Stage-specific processing
  let updatedMeta = { ...job.processing_meta };
  let extractedJsonPath: string | null = null;
  
  switch (stage) {
    case 'ocr':
      // Simulate OCR - just mark as done
      updatedMeta.ocr_complete = true;
      updatedMeta.ocr_at = new Date().toISOString();
      break;
      
    case 'extract':
      // Simulate extraction
      updatedMeta.extract_complete = true;
      extractedJsonPath = `extracts/${job.order_id}/${jobId}.json`;
      break;
      
    case 'translate':
      // Simulate translation
      updatedMeta.translate_complete = true;
      break;
      
    case 'render':
      // Generate and upload the draft PDF
      const pdfBytes = await generateMockDraftPdf({
        order_id: job.order_id,
        job_id: jobId,
        doc_slot: job.doc_slot || 'unknown',
        page_count: job.page_count || 1,
        template_id: job.template_id || 'default_v1',
      });
      
      const draftPath = `drafts/${job.order_id}/${jobId}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from('notarized_drafts')
        .upload(draftPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[Worker] Upload error:`, uploadError);
        return { success: false, error: uploadError.message };
      }
      
      updatedMeta.render_complete = true;
      updatedMeta.completed_at = new Date().toISOString();
      
      console.log(`[Worker] Uploaded draft to ${draftPath}`);
      
      return { 
        success: true, 
        processing_meta: updatedMeta, 
        draft_pdf_path: draftPath,
        extracted_json_path: extractedJsonPath 
      };
  }
  
  return { success: true, processing_meta: updatedMeta, extracted_json_path: extractedJsonPath };
}

// Complete the job after all stages
async function completeJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  orderId: string,
  draftPdfPath: string,
  processingMeta: Record<string, unknown>
): Promise<void> {
  // Update job directly with new status and paths
  const { error } = await supabase
    .from('notarized_translation_jobs')
    .update({
      status: 'draft_ready',
      draft_pdf_path: draftPdfPath,
      processing_meta: processingMeta,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
  
  if (error) {
    console.error(`[Worker] Failed to complete job ${jobId}:`, error);
    throw error;
  }
  
  // Check if all jobs for this order are complete
  const { data: incompleteJobs } = await supabase
    .from('notarized_translation_jobs')
    .select('id')
    .eq('order_id', orderId)
    .neq('status', 'draft_ready')
    .neq('status', 'failed')
    .limit(1);
  
  if (!incompleteJobs || incompleteJobs.length === 0) {
    // All jobs complete - update order status
    await supabase
      .from('notarized_translation_orders')
      .update({ status: 'draft_ready', updated_at: new Date().toISOString() })
      .eq('id', orderId);
    
    console.log(`[Worker] Order ${orderId} complete - all jobs finished`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY: Require x-worker-secret header with correct value
    const workerSecret = req.headers.get('x-worker-secret');
    const expectedSecret = Deno.env.get('TRANSLATION_WORKER_SECRET');
    
    if (!workerSecret || !expectedSecret || workerSecret !== expectedSecret) {
      console.warn('[Worker] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or missing x-worker-secret header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Worker] Authorized via x-worker-secret');

    // Use service role for all operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const workerId = body.worker_id || `mock-worker-${Date.now()}`;
    const limit = body.limit || 5;
    const targetStage = body.stage || null; // Optional: process specific stage only

    console.log(`[Worker] ${workerId} starting, limit: ${limit}, stage: ${targetStage || 'all'}`);

    // Lock jobs from queue using new RPC with stage support
    const { data: lockedJobs, error: lockError } = await supabase.rpc('rpc_notarized_queue_lock', {
      p_worker_id: workerId,
      p_limit: limit,
      p_stage: targetStage
    });

    if (lockError) {
      console.error('[Worker] Queue lock error:', lockError);
      return new Response(
        JSON.stringify({ error: lockError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockedJobs || lockedJobs.length === 0) {
      console.log('[Worker] No jobs in queue');
      return new Response(
        JSON.stringify({ ok: true, message: 'No jobs to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Worker] Locked ${lockedJobs.length} queue items`);
    
    const results = [];

    for (const queueItem of lockedJobs) {
      const { job_id: jobId, stage, attempts } = queueItem;
      
      try {
        // Get job details
        const { data: job, error: jobError } = await supabase
          .from('notarized_translation_jobs')
          .select('id, order_id, doc_slot, page_count, template_id, processing_meta')
          .eq('id', jobId)
          .single();

        if (jobError || !job) {
          console.error(`[Worker] Job ${jobId} not found:`, jobError);
          
          // Release with failure
          await supabase.rpc('rpc_notarized_queue_release', {
            p_job_id: jobId,
            p_success: false,
            p_stage: stage,
            p_error: jobError?.message || 'Job not found'
          });
          
          continue;
        }

        console.log(`[Worker] Processing job ${jobId}: stage=${stage}, doc=${job.doc_slot}, attempt=${attempts}`);

        // Process the current stage
        const result = await processStage(supabase, jobId, stage as PipelineStage, {
          order_id: job.order_id,
          doc_slot: job.doc_slot || 'unknown',
          page_count: job.page_count || 1,
          template_id: job.template_id || 'default_v1',
          processing_meta: (job.processing_meta as Record<string, unknown>) || {}
        });

        if (!result.success) {
          console.error(`[Worker] Stage ${stage} failed for job ${jobId}:`, result.error);
          
          // Release with failure - will retry if attempts < max
          await supabase.rpc('rpc_notarized_queue_release', {
            p_job_id: jobId,
            p_success: false,
            p_stage: stage,
            p_error: result.error
          });
          
          results.push({
            job_id: jobId,
            stage,
            status: 'failed',
            error: result.error,
            attempt: attempts
          });
          
          continue;
        }

        // Update processing_meta and extracted_json_path if present
        if (result.processing_meta || result.extracted_json_path) {
          const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (result.processing_meta) updateData.processing_meta = result.processing_meta;
          if (result.extracted_json_path) updateData.extracted_json_path = result.extracted_json_path;
          
          await supabase
            .from('notarized_translation_jobs')
            .update(updateData)
            .eq('id', jobId);
        }

        // Determine next stage
        const nextStage = getNextStage(stage as PipelineStage);

        if (nextStage) {
          // Release and enqueue next stage
          await supabase.rpc('rpc_notarized_queue_release', {
            p_job_id: jobId,
            p_success: true,
            p_stage: stage,
            p_next_stage: nextStage
          });
          
          results.push({
            job_id: jobId,
            stage,
            status: 'success',
            next_stage: nextStage
          });
          
          console.log(`[Worker] Job ${jobId} stage ${stage} complete, queued ${nextStage}`);
        } else {
          // Final stage complete - mark job as draft_ready
          await supabase.rpc('rpc_notarized_queue_release', {
            p_job_id: jobId,
            p_success: true,
            p_stage: stage
          });
          
          await completeJob(supabase, jobId, job.order_id, result.draft_pdf_path || '', result.processing_meta || {});
          
          results.push({
            job_id: jobId,
            stage,
            status: 'complete',
            draft_path: result.draft_pdf_path
          });
          
          console.log(`[Worker] Job ${jobId} pipeline complete!`);
        }

      } catch (err) {
        console.error(`[Worker] Error processing job ${jobId}:`, err);
        
        // Release queue with failure
        await supabase.rpc('rpc_notarized_queue_release', {
          p_job_id: jobId,
          p_success: false,
          p_stage: stage,
          p_error: String(err)
        }).catch(e => console.error('[Worker] Release error:', e));

        results.push({
          job_id: jobId,
          stage,
          status: 'error',
          error: String(err)
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success' || r.status === 'complete').length;
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'error').length;

    console.log(`[Worker] ${workerId} completed: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        worker_id: workerId,
        processed: results.length,
        success: successCount,
        failed: failedCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Worker] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
