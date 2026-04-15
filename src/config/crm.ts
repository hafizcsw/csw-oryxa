/**
 * CRM Integration Configuration
 * هذا الملف يحتوي على جميع إعدادات الربط مع CSW AI CRM
 */

export const CRM_CONFIG = {
  // ✅ التكامل الأساسي - CSW AI CRM (Supabase Project)
  FUNCTIONS_URL: 'https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1',
  API_KEY: 'csw_web_to_crm_5f2f3c9d9e3b4a0a87f142ec71d328a4',
  
  // ⚠️ تكامل اختياري - Webhooks (للاستخدام المستقبلي فقط)
  WEBHOOK_SECRET: 'csw_crm_webhook_9d83f74c21a04b89bc1273f64e1d0a3c',
  WEBHOOK_URL: 'https://csw-portal.com/api/crm-webhook',
} as const;

/**
 * ملاحظات مهمة:
 * - FUNCTIONS_URL + API_KEY = التكامل الأساسي (مستخدم حالياً)
 * - WEBHOOK_* = للاستقبال من CRM فقط (اختياري مستقبلاً)
 * - التكامل عبر crm_webhook_url (template قديم) غير مستخدم
 * - web_user_id هو الجسر بين النظامين (نفسه user_id من profiles)
 */
