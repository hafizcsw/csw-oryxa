/**
 * CRM Webhook Handler for Applications
 * 
 * This webhook receives application events from the website/edge functions
 * and processes them within the existing CRM system.
 * 
 * Place this file in your CRM server project (e.g., server/webhooks/applications.js)
 * and register it in your Express app:
 * 
 * import applicationWebhook from './webhooks/applications.js';
 * app.use(applicationWebhook);
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /webhooks/applications
 * 
 * Receives application created events from the website
 * Creates/updates customer record and moves them through CRM stages using RPC
 */
router.post('/webhooks/applications', express.json(), async (req, res) => {
  try {
    // 1. Authentication
    const authHeader = req.headers.authorization || '';
    const expectedToken = `Bearer ${process.env.CRM_WEBHOOK_TOKEN}`;
    
    if (authHeader !== expectedToken) {
      console.warn('[CRM Webhook] Unauthorized request attempt');
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    // 2. Idempotency check
    const idempotencyKey = 
      req.headers['idempotency-key'] || 
      req.body?.application?.id || 
      '';

    if (!idempotencyKey) {
      return res.status(400).json({ ok: false, error: 'missing_idempotency_key' });
    }

    // Check if we've already processed this request
    const { data: existingInbox } = await supabase
      .from('integration_inbox')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .limit(1);

    if (existingInbox && existingInbox.length > 0) {
      console.log(`[CRM Webhook] Idempotent request: ${idempotencyKey}`);
      return res.status(209).json({ ok: true, idempotent: true });
    }

    // 3. Extract application data
    const app = req.body?.application || {};
    const email = (app.email || '').toLowerCase().trim();
    const studentName = app.student_name || app.full_name || '';
    const phone = app.phone || null;
    const programId = app.program_id || null;
    const privacyConsent = !!app.privacy_consent;
    const whatsappOptIn = !!app.whatsapp_opt_in;

    if (!email || !studentName) {
      return res.status(400).json({ 
        ok: false, 
        error: 'missing_required_fields',
        required: ['email', 'student_name']
      });
    }

    console.log(`[CRM Webhook] Processing application for: ${email}`);

    // 4. Ensure customer exists (upsert)
    let { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .limit(1);

    let customerId = existingCustomer?.[0]?.id;

    if (!customerId) {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          email,
          full_name: studentName,
          phone,
          source: 'website',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('[CRM Webhook] Customer creation error:', customerError);
        throw new Error(`Failed to create customer: ${customerError.message}`);
      }

      customerId = newCustomer.id;
      console.log(`[CRM Webhook] Created new customer: ${customerId}`);
    } else {
      // Update existing customer if needed
      await supabase
        .from('customers')
        .update({
          full_name: studentName,
          phone: phone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      console.log(`[CRM Webhook] Updated existing customer: ${customerId}`);
    }

    // 5. Create application record in CRM
    const { data: crmApplication, error: applicationError } = await supabase
      .from('applications')
      .insert({
        customer_id: customerId,
        email,
        phone,
        program_id: programId,
        privacy_consent: privacyConsent,
        whatsapp_opt_in: whatsappOptIn,
        source: 'website',
        status: 'new',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (applicationError) {
      console.error('[CRM Webhook] Application creation error:', applicationError);
      throw new Error(`Failed to create application: ${applicationError.message}`);
    }

    console.log(`[CRM Webhook] Created application: ${crmApplication.id}`);

    // 6. Move customer stage using RPC (safe, follows CRM contracts)
    const { error: rpcError } = await supabase.rpc(
      'rpc_move_customer_stage_with_source',
      {
        p_customer_id: customerId,
        p_to_slug: 'apply_received', // Update this to match your CRM stage slug
        p_source: 'website',
        p_deadline_days: 0,
        p_reason: 'application webhook',
        p_client_action_id: null,
      }
    );

    if (rpcError) {
      console.error('[CRM Webhook] Stage movement error:', rpcError);
      // Don't fail the request - log the error and continue
      // The application was created successfully
    } else {
      console.log(`[CRM Webhook] Moved customer ${customerId} to stage: apply_received`);
    }

    // 7. Record idempotency to prevent duplicate processing
    await supabase
      .from('integration_inbox')
      .insert({
        idempotency_key: idempotencyKey,
        payload: req.body,
        created_at: new Date().toISOString(),
      });

    // 8. Return success
    return res.status(200).json({
      ok: true,
      customer_id: customerId,
      application_id: crmApplication.id,
      idempotent: false,
    });

  } catch (error) {
    console.error('[CRM Webhook] Processing error:', error);
    
    return res.status(500).json({
      ok: false,
      error: error.message || 'internal_server_error',
    });
  }
});

export default router;

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create integration_inbox table (if not exists):
 * 
 * CREATE TABLE IF NOT EXISTS integration_inbox (
 *   id BIGSERIAL PRIMARY KEY,
 *   idempotency_key TEXT UNIQUE NOT NULL,
 *   payload JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * CREATE INDEX idx_inbox_idem ON integration_inbox(idempotency_key);
 * 
 * 2. Set environment variables in your CRM server:
 * 
 * SUPABASE_URL=https://your-project.supabase.co
 * SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 * CRM_WEBHOOK_TOKEN=your-secure-token-here
 * 
 * 3. Register this route in your Express app:
 * 
 * import applicationWebhook from './webhooks/applications.js';
 * app.use(applicationWebhook);
 * 
 * 4. Update the stage slug ('apply_received') to match your CRM stage
 * 
 * 5. Test with curl:
 * 
 * curl -X POST http://localhost:3000/webhooks/applications \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -H "Idempotency-Key: test-123" \
 *   -d '{"application":{"email":"test@example.com","student_name":"Test Student","phone":"+1234567890","privacy_consent":true}}'
 */
