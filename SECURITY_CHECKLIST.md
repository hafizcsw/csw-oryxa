# ✅ قائمة التحقق الأمني - بوابة الطالب

## 🔒 التحقق من الصلاحيات

### 1. Edge Function: portal-preview-student
- ✅ يتحقق من JWT token صحيح
- ✅ يستخدم `is_admin()` للتحقق من الصلاحيات
- ✅ يستخدم SERVICE_ROLE فقط في الخادم
- ✅ يرفض الوصول لغير المشرفين

### 2. صفحة الإدارة (/admin)
- ✅ تستخدم `useIsAdmin` hook للتحقق
- ✅ تتحقق من الصلاحيات من الخادم (RPC)
- ✅ لا تعتمد على localStorage أو client-side storage
- ✅ تعرض رسالة "غير مصرح" للمستخدمين العاديين

### 3. RLS Policies
- ✅ `portal_tokens`: محمي بـ RLS
  - المشرفون فقط يمكنهم القراءة/التعديل/الحذف
  - النظام يمكنه الإدراج (للـ preview function)
- ✅ `profiles` (sandbox): محمي بـ RLS
  - المالك أو المشرف يمكنه الوصول للـ sandbox profile
  - المستخدم العادي يمكنه الوصول لـ profile الخاص به فقط

### 4. Database Functions
- ✅ `rpc_get_or_create_sandbox_customer_for_staff()`:
  - SECURITY DEFINER ✅
  - يتحقق من `is_admin()` قبل التنفيذ
  - ينشئ profiles بـ `is_sandbox = true`
  - مرتبط بـ `sandbox_owner`

## 🎯 سيناريوهات الاختبار

### A. مستخدم عادي (طالب)
1. ✅ يضغط "الحساب الشخصي" → يذهب لـ `/account`
2. ✅ يسجل الدخول بـ email/password أو magic link
3. ✅ يرى بيانات profile الخاص به فقط
4. ✅ لا يمكنه الوصول لـ `/admin` (يظهر "غير مصرح")
5. ✅ لا يمكنه استدعاء `portal-preview-student` (403 Forbidden)

### B. مشرف (Admin)
1. ✅ يضغط "الحساب الشخصي" → يستدعي `portal-preview-student`
2. ✅ ينشئ/يسترجع sandbox profile تلقائياً
3. ✅ يحصل على portal token
4. ✅ يتحول لجلسة الطالب التجريبي (sandbox)
5. ✅ يرى نفس واجهة الطالب (للاختبار)
6. ✅ يمكنه الوصول لـ `/admin`

### C. محاولات الاختراق
1. ✅ لا يمكن للمستخدم العادي:
   - تعديل `is_sandbox` أو `sandbox_owner` في profile
   - إنشاء portal_tokens يدوياً
   - الوصول لـ sandbox profiles الخاصة بمشرفين آخرين
   - استدعاء `rpc_get_or_create_sandbox_customer_for_staff()` بدون صلاحيات

## 🚨 نقاط مهمة

### ✅ تم التطبيق
- استخدام `is_admin()` function للتحقق من الصلاحيات
- RLS policies على جميع الجداول المهمة
- SECURITY DEFINER على الدوال الحساسة
- التحقق من الصلاحيات في Edge Functions
- عدم الاعتماد على client-side للتحقق الأمني

### 📝 ملاحظات
- جميع sandbox profiles لها `is_sandbox = true`
- كل مشرف له sandbox profile واحد فقط
- الـ sandbox profiles معزولة عن profiles العاديين
- portal tokens تنتهي صلاحيتها بعد 72 ساعة

## 🔧 كيفية إضافة مشرف جديد

```sql
-- إضافة دور admin للمستخدم
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## 📊 مراقبة الأمان

يجب مراقبة:
- عدد المحاولات الفاشلة للوصول إلى `portal-preview-student`
- إنشاء portal_tokens غير المتوقعة
- محاولات الوصول لـ `/admin` من مستخدمين غير مصرح لهم
- sandbox profiles المنشأة بدون `sandbox_owner`
