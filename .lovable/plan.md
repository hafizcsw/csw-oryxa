

# نقل العنوان والـ Stepper إلى أعلى نافذة التوثيق (خطوات doc/selfie/video)

## المشكلة (من اللقطة)
في نافذة "توثيق الحساب" خلال خطوات الرفع (doc/selfie/video):
- العنوان "توثيق الحساب" + أيقونة الدرع + شريط التقدّم (Stepper: الفيديو ← الصورة الشخصية ← الوثيقة) يظهرون **على يمين** المحتوى الرئيسي ("اختر نوع الوثيقة" + شبكة البطاقات + منطقة الرفع) في نفس الصف الأفقي.
- زر X في الأعلى يسار.
- النتيجة: تخطيط ثنائي العمود مزدحم — الهيدر يبدو منفصلاً عن المحتوى ويأخذ مساحة جانبية كبيرة.

المطلوب: جعل الهيدر (العنوان + الوصف + Stepper) يحتلّ **شريطاً علوياً عرضياً كاملاً**، ثم محتوى الخطوة ("اختر نوع الوثيقة" + الشبكة + الرفع) أسفله.

## السبب الجذري (متوقّع)
في `IdentityActivationDialog.tsx` فرع `!isResultStep`، الـ `DialogContent` يستخدم `grid` بدون تحديد `grid-template-rows`، ومحتوى الـ DialogHeader يحوي تخطيطاً داخلياً (`flex` صف) يضع العنوان والأيقونة بجانب الـ Stepper. يجب التأكد من:
1. الحاوية الرئيسية للـ Dialog تستخدم `flex flex-col` (تكديس عمودي).
2. الهيدر (`DialogHeader`) يستخدم `flex-col` ويحتوي صفّاً علوياً (X + العنوان + الأيقونة) ثم `Stepper` تحته بعرض كامل.
3. منطقة المحتوى (`StepBody`) أسفل الهيدر بعرض كامل.

## الخطوات

### 1. `IdentityActivationDialog.tsx` — فرع `!isResultStep` للهيدر (~ السطور 240–290)
إعادة هيكلة الهيدر إلى عمودين رأسيين:

```tsx
<DialogHeader className="flex flex-col gap-3 px-5 sm:px-8 pt-4 pb-4 border-b border-border/40 bg-card/30">
  {/* الصفّ العلوي: X + العنوان + الأيقونة */}
  <div className="relative flex items-center justify-center w-full">
    <button
      onClick={() => onOpenChange(false)}
      className="absolute top-0 ltr:left-0 rtl:right-0 rounded-full p-1.5 hover:bg-muted/60"
    >
      <X className="w-4 h-4" />
    </button>
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <ShieldCheck className="w-4 h-4 text-primary" />
      </div>
      <div className="flex flex-col items-center text-center">
        <DialogTitle className="text-base font-semibold leading-tight">
          {t("portal.identity.title")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
          {t("portal.identity.subtitle")}
        </DialogDescription>
      </div>
    </div>
  </div>

  {/* الصف السفلي: Stepper بعرض كامل */}
  <div className="w-full pt-1">
    <Stepper currentStep={currentStep} steps={stepDefinitions} />
  </div>
</DialogHeader>
```

### 2. `DialogContent` (~ السطور 212–222)
ضمان التكديس العمودي للحاوية الكبيرة:
- إضافة `flex flex-col` بدلاً من `grid` للحاوية في فرع غير النتيجة (أو `grid-rows-[auto_1fr]`).
- ضمان أن المحتوى تحت الهيدر يأخذ العرض الكامل.

### 3. منطقة المحتوى (`StepBody`)
- إزالة أي `max-width` جانبي يدفع المحتوى ليسار/يمين.
- الحفاظ على `overflow-y-auto` للسكروول الداخلي.

## ASCII — قبل/بعد

```text
قبل:                                     بعد:
┌────────────────────────────────────┐    ┌────────────────────────────────────┐
│ X    [اختر نوع الوثيقة]   🛡 توثيق │    │ X        🛡 توثيق الحساب           │
│      [بطاقة] [بطاقة] [بطاقة]   ⓥ─ⓢ─ⓓ│   │          أكد هويتك...               │
│      [منطقة الرفع]                 │    │      ⓥ ────── ⓢ ────── ⓓ           │
│                                    │    ├────────────────────────────────────┤
└────────────────────────────────────┘    │      اختر نوع الوثيقة               │
                                          │   [بطاقة] [بطاقة] [بطاقة]          │
                                          │      [منطقة الرفع]                  │
                                          └────────────────────────────────────┘
```

## الملفات المعدّلة
- `src/components/portal/identity/IdentityActivationDialog.tsx` فقط — فرع `!isResultStep` من الهيدر + className الخاص بـ DialogContent عند الحاجة.

## بدون تغيير
- ResultStep (الهيدر المبسّط الذي صُمّم سابقاً).
- منطق الـ flow، API، الترجمات.
- الخطوات selfie/video/summary — نفس الهيكل الجديد ينطبق عليها لأن الهيدر مشترك.

