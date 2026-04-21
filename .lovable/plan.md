

## إضافة زر "لماذا تفعيل حسابي؟" على بطاقة تفعيل الحساب

### الهدف
إضافة زر صغير على البطاقة الأولى (تفعيل الحساب) في `/account?tab=overview` يفتح نافذة منبثقة تشرح فوائد التوثيق.

### التغييرات

**1. ملف الترجمة `src/locales/ar/common.json`**

إضافة المفاتيح التالية تحت `portal.steps`:
- `whyVerifyButton` → "لماذا تفعيل حسابي؟"
- `whyVerifyTitle` → "لماذا تفعيل الحساب مهم؟"
- `whyVerifyIntro` → فقرة تمهيدية قصيرة
- `whyVerifyPoint1Title` / `whyVerifyPoint1Body` → حماية الحساب واسترداده عبر بطاقة الهوية + جلسة فيديو مع فريق الدعم
- `whyVerifyPoint2Title` / `whyVerifyPoint2Body` → فتح مسارات المنح والبرامج الجامعية حول العالم، والجامعات هي من ترسل العروض للطالب الموثّق
- `whyVerifyPoint3Title` / `whyVerifyPoint3Body` → النشر في مجتمع CSW وفتح حملات استثمار في مشاريع الطلاب الموثقين
- `whyVerifyClose` → "حسناً، فهمت"

نفس المفاتيح في `src/locales/en/common.json` بالنسخة الإنجليزية (التزاماً بقاعدة الـ 12 لغة).

**2. مكوّن `src/components/portal/account/AccountVerificationSteps.tsx`**

داخل البطاقة الأولى فقط:
- إضافة state محلي `whyOpen` للتحكم بالنافذة
- إضافة زر صغير `variant="ghost" size="sm"` تحت وصف البطاقة وقبل زر "ابدأ التوثيق"، مع أيقونة `HelpCircle` من `lucide-react` ونص من `t('portal.steps.whyVerifyButton')`
- استخدام `Dialog` من `@/components/ui/dialog` (موجود مسبقاً في المشروع) لعرض المحتوى:
  - عنوان (`DialogTitle`)
  - فقرة تمهيدية
  - ثلاث نقاط مرقمة بأيقونات (`ShieldCheck` للحماية، `GraduationCap` للفرص الجامعية، `Users` للمجتمع)
  - زر إغلاق
- النافذة `dir={isRtl ? 'rtl' : 'ltr'}` لدعم RTL

### القيود المحترمة
- لا نصوص مكتوبة في الكود — كل شيء عبر `t()`
- لا منطق `language === 'ar'` للمحتوى، فقط لاتجاه `dir`
- لا مساس ببطاقتي المحفظة (الثانية والثالثة)
- لا تغيير في schema أو backend

### الملفات المعدّلة
- `src/components/portal/account/AccountVerificationSteps.tsx`
- `src/locales/ar/common.json`
- `src/locales/en/common.json`

