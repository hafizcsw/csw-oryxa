import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const srv = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function replaceTokens(template: string, data: any): string {
  return template.replace(/\{\{\s*([\w\.]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data);
    return value ?? '';
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get pending translation requests
    const { data: jobs } = await srv
      .from('translation_requests')
      .select('*')
      .eq('status', 'pending')
      .limit(3);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processed = [];

    for (const job of jobs) {
      try {
        // Mark as processing
        await srv
          .from('translation_requests')
          .update({ status: 'processing' })
          .eq('id', job.id);

        // Get template
        const { data: template } = await srv
          .from('translation_templates')
          .select('body_html')
          .eq('kind', job.doc_kind)
          .eq('locale', job.target_lang)
          .eq('is_active', true)
          .single();

        if (!template) {
          throw new Error(`No template found for ${job.doc_kind} in ${job.target_lang}`);
        }

        // Get student data
        const { data: student } = await srv
          .from('profiles')
          .select('full_name, email, phone')
          .eq('user_id', job.student_user_id)
          .single();

        // Prepare model data
        const model = {
          t: {
            name: student?.full_name || 'الطالب',
            passport_number: '—',
            nationality: '—',
            birth_date: '—'
          },
          company: {
            seal_text: 'مترجم معتمد — Connect Study World'
          }
        };

        const html = replaceTokens(template.body_html, model);

        // Store HTML
        const path = `translations/${job.id}.html`;
        await srv.storage
          .from('translations')
          .upload(path, new TextEncoder().encode(html), {
            contentType: 'text/html',
            upsert: true
          });

        // Update request status
        await srv
          .from('translation_requests')
          .update({
            status: 'done',
            output_pdf_path: path
          })
          .eq('id', job.id);

        // Send to CRM
        await srv.from('integration_outbox').insert({
          target: 'crm',
          event_type: 'translation.ready',
          idempotency_key: `translation:${job.id}`,
          payload: {
            student_user_id: job.student_user_id,
            request_id: job.id,
            kind: job.doc_kind,
            path
          },
          status: 'pending',
          next_attempt_at: new Date().toISOString()
        });

        processed.push(job.id);
      } catch (e: any) {
        await srv
          .from('translation_requests')
          .update({
            status: 'error',
            last_error: String(e).slice(0, 200)
          })
          .eq('id', job.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: processed.length, ids: processed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
