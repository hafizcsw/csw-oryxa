import { requireAdmin } from "../_shared/adminGuard.ts";
import { getSetting } from "../_shared/settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Metadata for all secrets with categories and descriptions
    const secretsMetadata: Record<string, any> = {
      crm_url: {
        category: 'core',
        required: false,
        description: 'رابط واجهة الـ CRM الرئيسية (لوحة التحكم / dashboard) - اختياري، فقط لروابط إعادة التوجيه',
        usage: 'لم يُستخدم بعد في الكود - محجوز للمستقبل'
      },
      crm_functions_url: {
        category: 'core',
        required: true,
        description: 'الـ Base URL لاستدعاء Edge Functions الخاصة بمشروع الـ CRM (مثلاً: https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1)',
        usage: 'يُستخدم في assistant-process/index.ts لاستدعاء /web-chat-malak'
      },
      portal_site_url: {
        category: 'core',
        required: false,
        description: 'رابط بوابة الطلاب (الموقع الذي يدخل منه الطالب لحسابه)',
        usage: 'لم يُستخدم بعد - محجوز لروابط إعادة التوجيه'
      },
      crm_api_key: {
        category: 'core',
        required: true,
        description: 'مفتاح API الذي تستخدمه الخدمات الخارجية (الموقع، التكاملات) لاستدعاء Edge Functions في الـ CRM عبر هيدر x-api-key. هذا المفتاح مهم جداً ويجب أن يكون سرياً',
        usage: 'يُستخدم في assistant-process/index.ts كـ x-api-key header'
      },
      integration_enabled: {
        category: 'core',
        required: true,
        description: 'فلاغ (true/false) لتفعيل أو تعطيل التكامل مع الموقع/الخدمات الخارجية. إطفاؤه يجعل كل Edge Functions التي تتعامل مع الموقع ترجع خطأ',
        usage: 'لم يُستخدم بعد في الكود - يُفترض فحصه في Edge Functions'
      },
      openai_api_key: {
        category: 'ai',
        required: true,
        description: 'مفتاح OpenAI الذي يستخدمه البوت "ملاك" داخلياً عند الحاجة إلى LLM. مهم لعمل البوت وتحليل الصور',
        usage: 'يُستخدم في analyze-university-image و search-university-images'
      },
      crm_jwt_secret: {
        category: 'advanced',
        required: false,
        description: 'السر المستخدم لتوقيع الـ JWT الخاصة بالـ Portal / البوابة للـ Admin SSO',
        usage: 'يُستخدم في _shared/auth.ts في دالة verifyAdminJWT'
      },
      hmac_shared_secret: {
        category: 'advanced',
        required: false,
        description: 'سر مشترك للتحقق من Webhooks (التوقيع HMAC) بين الـ CRM وأي خدمة خارجية',
        usage: 'يُستخدم في admin-integration-retry و bridge-flush لتوقيع الطلبات'
      },
      firecrawl_api_key: {
        category: 'advanced',
        required: false,
        description: 'مفتاح Firecrawl API - غير مستخدم حالياً في النظام',
        usage: 'غير مستخدم - اختياري للمستقبل'
      },
      google_search_api_key: {
        category: 'advanced',
        required: false,
        description: 'مفتاح Google Search API - غير مستخدم حالياً',
        usage: 'غير مستخدم - اختياري للمستقبل'
      },
      google_search_engine_id: {
        category: 'advanced',
        required: false,
        description: 'معرّف محرك البحث المخصص من Google - غير مستخدم حالياً',
        usage: 'غير مستخدم - اختياري للمستقبل'
      }
    };

    // Read settings from database first, fallback to environment
    const settingsMap: Record<string, any> = {};
    
    for (const [key, meta] of Object.entries(secretsMetadata)) {
      const envKey = key.toUpperCase();
      const value = await getSetting(g.srv, key, envKey);
      
      // Determine source based on where value was found
      let source = "database";
      if (!value) {
        source = "secrets";
      } else {
        // Check if it exists in database
        const { data } = await g.srv
          .from('feature_settings')
          .select('key')
          .eq('key', key)
          .single();
        
        if (!data) {
          source = "secrets"; // Value came from env fallback
        }
      }
      
      settingsMap[key] = {
        key,
        value: value || null,
        source,
        category: meta.category,
        required: meta.required,
        description: meta.description,
        usage: meta.usage
      };
    }

    // Keys to read from feature_settings (DB) - additional webhook/payment settings
    const dbKeys = [
      "crm_webhook_url",
      "crm_bearer_token",
      "payment_provider",
      "payment_link_base"
    ];

    // Read additional DB settings
    const { data } = await g.srv
      .from("feature_settings")
      .select("key, value")
      .in("key", dbKeys);

    // Add DB values
    (data || []).forEach((item: any) => {
      settingsMap[item.key] = {
        key: item.key,
        value: item.value,
        source: 'database',
        category: item.key.startsWith('payment_') ? 'payment' : 'webhook',
        required: false,
        description: '',
        usage: ''
      };
    });

    // Convert to array format
    const settings = Object.values(settingsMap);

    return new Response(JSON.stringify({ 
      ok: true, 
      settings,
      metadata: secretsMetadata
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[admin-settings-get] Exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
