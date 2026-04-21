

## تخزين حالة التوثيق محلياً (Cache + CRM-driven invalidation)

### الهدف
عدم الاعتماد على CRM في كل تحميل صفحة لمعرفة حالة `identity_status`. تُحفظ الحالة محلياً، وتظل صالحة حتى يصل أمر صريح من CRM لتغييرها (عبر realtime/webhook → mirror table → push).

### السلوك المطلوب
1. **عند أول جلب ناجح من CRM** → خزّن `{status, updated_at, user_id}` في `localStorage` تحت مفتاح `identity_status_cache_v1`.
2. **عند تحميل الصفحة لاحقاً** → اقرأ من cache فوراً وأعرض الحالة دون انتظار CRM.
3. **CRM-driven update فقط**:
   - الـ hook الحالي `useIdentityStatus` يبقى يستمع لـ realtime على mirror table في Supabase (المصدر الموثوق للتغييرات).
   - عندما يصل تغيير حقيقي من CRM → نحدّث الـ cache.
   - لا revalidation تلقائي عند كل mount/focus.
4. **Cache مرتبط بالـ user_id** → عند تسجيل خروج أو تبديل حساب يُمسح تلقائياً.

### التغييرات
**ملف واحد فقط: `src/hooks/useIdentityStatus.ts`**
- إضافة helper `readCache(userId)` / `writeCache(userId, status)` / `clearCache()`.
- في الـ hook:
  - بدء الـ state بقراءة الـ cache (synchronous) بدل `null` → لا flicker.
  - الجلب الأول من CRM يصبح "fill if empty" بدل "always fetch".
  - الـ realtime subscription على mirror table يبقى كما هو، ويكتب في الـ cache عند كل تغيير.
  - إذا كانت الحالة في cache = `approved` → نتخطى أي polling/refetch دوري إن وُجد.
- إضافة listener على `auth.onAuthStateChange` لمسح الـ cache عند `SIGNED_OUT`.

### القيود
- لا تغيير في Supabase schema.
- لا تغيير في CRM contract.
- لا UI changes.
- الـ mirror table في Supabase يبقى المسار الوحيد للتغييرات الصادرة من CRM (هذا هو "اتصال CRM" المقصود).

### الملفات المعدّلة
- `src/hooks/useIdentityStatus.ts`

