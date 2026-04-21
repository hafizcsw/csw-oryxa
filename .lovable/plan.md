

## إصلاح تصميم نافذة "لماذا تفعيل حسابي؟" على الشاشات الكبيرة

### المشكلة (من الصورة)
على شاشة اللابتوب النافذة تنهار إلى عمود ضيّق جداً والنص يلتفّ حرفاً حرفاً، والعناصر تتداخل بدلاً من أن تُرتَّب رأسياً.

### السبب الجذري
- في `AccountVerificationSteps.tsx` نمرّر `gap-0` و `overflow-hidden` فوق `DialogContent` الذي يحوي أصلاً `grid w-full ... max-h-[calc(100vh-2rem)] overflow-y-auto`.
- التداخل بين `overflow-hidden` على الحاوية و`overflow-y-auto` الداخلية + `max-h-[55vh]` على القائمة ينتج سلوك تخطيط سيّئ على بعض المتصفحات/الـ RTL ويُجبر العناصر على التضيّق إلى `min-content`.
- `flex` بدون `w-full` على البطاقات الداخلية يجعل أطفال الـ grid يأخذون `auto width`.

### الإصلاح

**ملف واحد فقط:** `src/components/portal/account/AccountVerificationSteps.tsx`

داخل `<Dialog>` فقط:

1. **DialogContent**: استبدال الـ className بـ:
   - `sm:max-w-[560px] w-[calc(100vw-2rem)] p-0 gap-0 border-border/60 overflow-hidden`
   - إزالة `max-w-xl` الزائد، وضمان عرض صريح على الموبايل واللابتوب.

2. **التغليف الداخلي**: لفّ المحتوى الثلاثي (هيرو + قائمة + فوتر) داخل `<div className="flex flex-col w-full">` لإجبار التكديس الرأسي بصرف النظر عن سلوك الـ grid الافتراضي للـ DialogContent.

3. **منطقة القائمة**: تغيير `max-h-[55vh] overflow-y-auto` إلى `max-h-[60vh] overflow-y-auto w-full` لمنع انهيار العرض.

4. **عناصر القائمة (`<li>`)**: إضافة `w-full` وإزالة `flex-row-reverse` اليدوي والاعتماد على `dir` الموروث من DialogContent (RTL تلقائي عبر `flex` العادي + `dir="rtl"`). الأيقونة تبقى `shrink-0`.

5. **الهيرو**: إزالة `flex-row-reverse` اليدوي والاعتماد على `dir` للترتيب البصري الصحيح.

6. **زر الإغلاق (X)**: زر الإغلاق الافتراضي في `DialogContent` يقع فوق أيقونة الهيرو في RTL — نضيف `pt-2` صغيرة على الهيرو في RTL أو نزيح الأيقونة `ms-10` لتجنّب التداخل، أو نخفي الـ X الافتراضي بإضافة `[&>button]:top-3 [&>button]:end-3` للتأكّد من أنه فوق الزاوية ولا يتعارض مع أيقونة الدرع.

### القيود المحترمة
- لا تغيير في ملفات الترجمة.
- لا تغيير في منطق العمل أو الـ state.
- لا تغيير في `dialog.tsx` العام (يستخدمه عدد من المكوّنات).
- 12-language ready: لا نصوص مكتوبة، اعتماد كامل على `dir` و `t()`.

### الملف المعدَّل
- `src/components/portal/account/AccountVerificationSteps.tsx` (تعديل block واحد بين السطرين 315–385)

