import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// PDF page count detection using pdf-lib (PROPER library, not regex!)
async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  try {
    // Use pdf-lib for accurate page counting
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
      ignoreEncryption: true,
      updateMetadata: false 
    });
    const pageCount = pdfDoc.getPageCount();
    console.log(`pdf-lib detected ${pageCount} pages`);
    return Math.max(pageCount, 1);
  } catch (err) {
    console.error('pdf-lib parsing error, falling back to regex:', err);
    // Fallback to regex for corrupted PDFs
    try {
      const pdfString = new TextDecoder('latin1').decode(pdfBytes);
      const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/gi) || [];
      const pageCount = pageMatches.length;
      if (pageCount === 0) {
        const countMatch = pdfString.match(/\/Count\s+(\d+)/);
        if (countMatch) {
          return parseInt(countMatch[1], 10);
        }
      }
      return Math.max(pageCount, 1);
    } catch {
      return 1;
    }
  }
}

// Detect file type from bytes with proper length guards
function detectFileType(bytes: Uint8Array): 'pdf' | 'image' | 'unknown' {
  // Guard against short files
  if (!bytes || bytes.length < 12) {
    console.warn('File too short for type detection:', bytes?.length);
    return 'unknown';
  }

  // PDF magic bytes: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }
  
  // JPEG magic bytes: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image';
  }
  
  // PNG magic bytes: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image';
  }
  
  // WebP magic bytes: RIFF....WEBP (need full signature check)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image';
  }
  
  // HEIC/HEIF - ftyp box (with length guard already satisfied)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image';
  }
  
  return 'unknown';
}

// Analyze document quality and validity
async function analyzeDocument(imageData: Uint8Array, docSlot: string, fileType: 'pdf' | 'image' | 'unknown'): Promise<{
  ok: boolean;
  page_count: number;
  quality_score: number;
  quality_flags: string[];
  doc_type_guess: string;
  doc_type_confidence: number;
  rejection_code: string | null;
  rejection_reasons: string[];
  fix_tips: string[];
}> {
  const sizeKB = imageData.length / 1024;
  const quality_flags: string[] = [];
  let quality_score = 0.8;
  let page_count = 1;
  let rejection_code: string | null = null;
  let rejection_reasons: string[] = [];
  let fix_tips: string[] = [];
  
  // Calculate REAL page count
  if (fileType === 'pdf') {
    page_count = await getPdfPageCount(imageData);
    console.log(`PDF detected with ${page_count} pages`);
    
    // PDF quality checks
    if (sizeKB < 20) {
      quality_flags.push('corrupted_pdf');
      quality_score = 0.2;
      rejection_code = 'REJECTED_QUALITY';
      rejection_reasons = ['PDF file appears to be corrupted or empty'];
      fix_tips = ['Please upload a valid PDF document'];
    } else if (sizeKB < 50 * page_count) {
      // Less than 50KB per page suggests low quality scans
      quality_flags.push('low_resolution_scan');
      quality_score = 0.5;
    }
  } else if (fileType === 'image') {
    page_count = 1;
    
    // Image quality checks based on size
    if (sizeKB < 30) {
      quality_flags.push('low_resolution');
      quality_score = 0.3;
      rejection_code = 'REJECTED_QUALITY';
      rejection_reasons = ['Image resolution is too low for accurate translation'];
      fix_tips = ['Please upload a higher resolution image (at least 300 DPI)'];
    } else if (sizeKB < 100) {
      quality_flags.push('medium_resolution');
      quality_score = 0.6;
    } else if (sizeKB > 100) {
      quality_score = 0.9;
    }
  } else {
    // Unknown file type
    quality_flags.push('unknown_format');
    quality_score = 0.4;
    rejection_code = 'REJECTED_QUALITY';
    rejection_reasons = ['Unsupported file format'];
    fix_tips = ['Please upload a PDF, JPEG, or PNG file'];
  }
  
  // Multi-document detection (basic heuristic)
  if (page_count > 20) {
    quality_flags.push('possible_multi_docs');
    rejection_code = 'REJECTED_MULTI_DOCS';
    rejection_reasons = ['Document appears to contain multiple documents'];
    fix_tips = ['Please upload each document separately'];
    quality_score = Math.min(quality_score, 0.4);
  }
  
  const ok = quality_score >= 0.5 && !rejection_code;
  
  return {
    ok,
    page_count,
    quality_score,
    quality_flags,
    doc_type_guess: docSlot, // In real impl, AI would detect this
    doc_type_confidence: 0.85,
    rejection_code,
    rejection_reasons,
    fix_tips
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('notarized_translation_jobs')
      .select('id, order_id, doc_slot, original_path, original_meta, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!job.original_path) {
      return new Response(
        JSON.stringify({ error: 'No file uploaded yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file for analysis
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('notarized_originals')
      .download(job.original_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file for analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze document
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const fileType = detectFileType(fileBytes);
    
    console.log(`Analyzing file: type=${fileType}, size=${fileBytes.length} bytes, docSlot=${job.doc_slot}`);
    
    const analysis = await analyzeDocument(fileBytes, job.doc_slot, fileType);

    console.log(`Analysis result: ok=${analysis.ok}, page_count=${analysis.page_count}, quality=${analysis.quality_score}`);

    // Update job via RPC (using service role) - NOW with REAL page_count
    const { error: updateError } = await serviceClient.rpc('rpc_notarized_job_set_precheck', {
      p_job_id: job_id,
      p_ok: analysis.ok,
      p_page_count: analysis.page_count, // REAL page count now!
      p_quality_score: analysis.quality_score,
      p_quality_flags: analysis.quality_flags,
      p_doc_type_guess: analysis.doc_type_guess,
      p_doc_type_confidence: analysis.doc_type_confidence,
      p_rejection_code: analysis.rejection_code,
      p_rejection_reasons: analysis.rejection_reasons,
      p_fix_tips: analysis.fix_tips
    });

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Precheck complete for job: ${job_id}, Result: ${analysis.ok ? 'PASS' : 'REJECT'}, Pages: ${analysis.page_count}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        precheck_result: analysis.ok ? 'pass' : 'reject',
        file_type: fileType,
        page_count: analysis.page_count,
        quality_score: analysis.quality_score,
        quality_flags: analysis.quality_flags,
        doc_type_guess: analysis.doc_type_guess,
        doc_type_confidence: analysis.doc_type_confidence,
        rejection_code: analysis.rejection_code,
        rejection_reasons: analysis.rejection_reasons,
        fix_tips: analysis.fix_tips,
        ok: analysis.ok
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
