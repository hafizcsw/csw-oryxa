import { CRM_CONFIG } from '@/config/crm';
import { StudentProfileForCRM, ApplicationForCRM } from '@/types/crm';

/**
 * مزامنة ملف الطالب مع CRM
 * يستدعي: web-sync-student في CRM
 * 
 * @param profile - بيانات الطالب للمزامنة
 * @returns Promise<void>
 */
export async function syncStudentToCRM(profile: StudentProfileForCRM): Promise<void> {
  try {
    console.log('[CRM Sync] Syncing student profile...', { web_user_id: profile.web_user_id });

    const response = await fetch(`${CRM_CONFIG.FUNCTIONS_URL}/web-sync-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_CONFIG.API_KEY,
      },
      body: JSON.stringify({
        web_user_id: profile.web_user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        country_of_residence: profile.country_of_residence,
        preferred_destination: profile.preferred_destination,
        preferred_program_type: profile.preferred_program_type,
        budget_per_year: profile.budget_per_year,
        language_preference: profile.language_preference,
        education_level: profile.education_level,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CRM Sync] Student sync failed:', {
        status: response.status,
        error: errorText
      });
      throw new Error(`CRM sync failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[CRM Sync] Student synced successfully:', result);
  } catch (error) {
    console.error('[CRM Sync] Error syncing student:', error);
    // ⚠️ لا نرمي الخطأ لأننا لا نريد أن يفشل التسجيل إذا فشل الـ CRM sync
    // CRM sync هو عملية خلفية، لا يجب أن توقف تجربة المستخدم
  }
}

/**
 * مزامنة طلب تقديم مع CRM
 * يستدعي: web-sync-application في CRM
 * 
 * @param app - بيانات الطلب للمزامنة
 * @returns Promise<void>
 */
export async function syncApplicationToCRM(app: ApplicationForCRM): Promise<void> {
  try {
    console.log('[CRM Sync] Syncing application...', {
      web_user_id: app.web_user_id,
      web_application_id: app.web_application_id,
      university: app.university_name
    });

    const response = await fetch(`${CRM_CONFIG.FUNCTIONS_URL}/web-sync-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_CONFIG.API_KEY,
      },
      body: JSON.stringify({
        web_user_id: app.web_user_id,
        web_application_id: app.web_application_id,
        university_id: app.university_id,
        program_id: app.program_id,
        university_name: app.university_name,
        program_name: app.program_name,
        country: app.country,
        tuition_usd: app.tuition_usd,
        duration_months: app.duration_months,
        language: app.language,
        status: app.status,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CRM Sync] Application sync failed:', {
        status: response.status,
        error: errorText
      });
      throw new Error(`CRM sync failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[CRM Sync] Application synced successfully:', result);
  } catch (error) {
    console.error('[CRM Sync] Error syncing application:', error);
    // نفس السبب: لا نريد إيقاف عملية التقديم إذا فشل الـ CRM sync
  }
}

/**
 * ملاحظات مهمة:
 * 
 * 1. هذه الدوال async وغير مُعيقة (non-blocking)
 * 2. في حالة فشل CRM sync، لا نُفشل العملية الأساسية
 * 3. جميع الأخطاء يتم logging-ها للمراجعة
 * 4. CRM_CONFIG.FUNCTIONS_URL يجب أن يُحدَّث بالعنوان الحقيقي
 */
