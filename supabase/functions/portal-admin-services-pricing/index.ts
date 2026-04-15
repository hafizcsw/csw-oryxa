import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

console.log('[portal-admin-services-pricing] VERSION=2026-01-23_v1');

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= Validation Schema =============
interface PricingConfig {
  version: string;
  base_prices: Record<string, number>;
  services: Array<{
    id: string;
    name: string;
    desc?: string;
    note?: string;
    category: string;
    weight: number;
    hidden?: boolean;
  }>;
  packages: Array<{
    id: string;
    name: string;
    badge?: string;
    highlight?: boolean;
    includes: string[] | "ALL";
    youHandle: string;
    bullets: string[];
  }>;
  addons: Array<{
    id: string;
    name: string;
    desc?: string;
    note?: string;
    price: number;
    country_codes?: string[];
  }>;
  pay_rules?: {
    split_allowed_for?: string[];
    split_deposit_ratio?: number;
  };
  reason?: string;
}

function validateConfig(config: Partial<PricingConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.version || typeof config.version !== 'string') {
    errors.push('version is required and must be a string');
  }

  if (!config.base_prices || typeof config.base_prices !== 'object') {
    errors.push('base_prices is required and must be an object');
  } else {
    const requiredCountries = ['RU', 'CN', 'GB', 'EU'];
    for (const cc of requiredCountries) {
      if (typeof config.base_prices[cc] !== 'number') {
        errors.push(`base_prices.${cc} must be a number`);
      }
    }
  }

  if (!Array.isArray(config.services)) {
    errors.push('services must be an array');
  } else if (config.services.length === 0) {
    errors.push('services cannot be empty');
  }

  if (!Array.isArray(config.packages)) {
    errors.push('packages must be an array');
  }

  if (!Array.isArray(config.addons)) {
    errors.push('addons must be an array');
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return Response.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status, headers: corsHeaders });
    }

    // ============= GET: Return active config =============
    if (req.method === 'GET') {
      console.log('[portal-admin-services-pricing] GET active config');

      const { data: config, error } = await supabase
        .from('services_pricing_configs')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error || !config) {
        console.error('[portal-admin-services-pricing] No active config:', error);
        return Response.json({ 
          ok: false, 
          error: 'NO_ACTIVE_CONFIG',
          message: 'No active pricing configuration found'
        }, { status: 404, headers: corsHeaders });
      }

      console.log('[portal-admin-services-pricing] ✅ Returning config version:', config.version);
      return Response.json({ 
        ok: true, 
        config,
        version: config.version
      }, { headers: corsHeaders });
    }

    // ============= POST: Create new version (Admin only) =============
    if (req.method === 'POST') {
      const body = await req.json() as Partial<PricingConfig>;
      console.log('[portal-admin-services-pricing] POST new config version:', body.version);

      // Validate
      const validation = validateConfig(body);
      if (!validation.valid) {
        return Response.json({ 
          ok: false, 
          error: 'VALIDATION_FAILED',
          errors: validation.errors
        }, { status: 400, headers: corsHeaders });
      }

      // Check version doesn't exist
      const { data: existing } = await supabase
        .from('services_pricing_configs')
        .select('id')
        .eq('version', body.version)
        .single();

      if (existing) {
        return Response.json({ 
          ok: false, 
          error: 'VERSION_EXISTS',
          message: `Version ${body.version} already exists`
        }, { status: 409, headers: corsHeaders });
      }

      // Deactivate all existing configs
      await supabase
        .from('services_pricing_configs')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new config as active
      const { data: newConfig, error: insertError } = await supabase
        .from('services_pricing_configs')
        .insert({
          version: body.version,
          base_prices: body.base_prices,
          services: body.services,
          packages: body.packages,
          addons: body.addons,
          pay_rules: body.pay_rules || {},
          is_active: true,
          created_by: adminCheck.user.id,
          reason: body.reason || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[portal-admin-services-pricing] Insert error:', insertError);
        return Response.json({ 
          ok: false, 
          error: 'INSERT_FAILED',
          message: insertError.message
        }, { status: 500, headers: corsHeaders });
      }

      console.log('[portal-admin-services-pricing] ✅ Created new config:', newConfig.version);
      return Response.json({ 
        ok: true, 
        config: newConfig,
        version: newConfig.version,
        message: `Config version ${newConfig.version} is now active`
      }, { headers: corsHeaders });
    }

    // ============= PUT: Activate existing version (Admin only) =============
    if (req.method === 'PUT') {
      const { version } = await req.json() as { version: string };
      console.log('[portal-admin-services-pricing] PUT activate version:', version);

      if (!version) {
        return Response.json({ 
          ok: false, 
          error: 'VERSION_REQUIRED'
        }, { status: 400, headers: corsHeaders });
      }

      // Check version exists
      const { data: targetConfig } = await supabase
        .from('services_pricing_configs')
        .select('id, version')
        .eq('version', version)
        .single();

      if (!targetConfig) {
        return Response.json({ 
          ok: false, 
          error: 'VERSION_NOT_FOUND',
          message: `Version ${version} does not exist`
        }, { status: 404, headers: corsHeaders });
      }

      // Deactivate all, activate target
      await supabase
        .from('services_pricing_configs')
        .update({ is_active: false })
        .eq('is_active', true);

      const { error: activateError } = await supabase
        .from('services_pricing_configs')
        .update({ is_active: true })
        .eq('id', targetConfig.id);

      if (activateError) {
        return Response.json({ 
          ok: false, 
          error: 'ACTIVATE_FAILED',
          message: activateError.message
        }, { status: 500, headers: corsHeaders });
      }

      console.log('[portal-admin-services-pricing] ✅ Activated version:', version);
      return Response.json({ 
        ok: true, 
        version,
        message: `Config version ${version} is now active`
      }, { headers: corsHeaders });
    }

    return Response.json({ 
      ok: false, 
      error: 'METHOD_NOT_ALLOWED'
    }, { status: 405, headers: corsHeaders });

  } catch (err) {
    console.error('[portal-admin-services-pricing] Error:', err);
    return Response.json({ 
      ok: false, 
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500, headers: corsHeaders });
  }
});
