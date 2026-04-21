

# إصلاح تخطيط النصوص والأزرار في خطوتَي "الصورة الشخصية" و"الفيديو"

## المشكلة
الكاميرا في الحجم والمكان الصحيحين. المشكلة في العمود الجانبي (التعليمات + الزر):
- النصوص (العنوان + الوصف + قائمة التعليمات) تبدو متباعدة عمودياً بشكل غير منظّم.
- زر "التقاط الصورة" / "بدء التسجيل" يمتد بعرض كامل وغير محاذٍ بشكل جيد.
- لا يوجد فصل بصري واضح بين قسم التعليمات وقسم الإجراء (الزر).

## الهدف
عمود تعليمات/إجراء منظّم بهيكل واضح:
1. **رأس القسم**: أيقونة + عنوان + وصف قصير (مجمّعة بصرياً).
2. **بطاقة التعليمات**: قائمة الـ checklist داخل بطاقة خفيفة (`bg-muted/30 rounded-lg p-4`) لفصلها بصرياً.
3. **زر CTA**: بعرض مناسب (ليس بعرض كامل) ومحاذٍ لبداية العمود مع مساحة علوية واضحة.

## الخطوات (في `IdentityActivationDialog.tsx` — `SelfieStep` و `VideoStep` فقط)

### 1. رأس القسم (Header block)
تجميع الأيقونة + العنوان + الوصف في كتلة واحدة بمسافات متقاربة:
```tsx
<div className="flex items-start gap-3">
  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
    <Camera className="w-5 h-5 text-primary" />  {/* أو Video */}
  </div>
  <div className="flex flex-col">
    <h3 className="text-lg font-semibold leading-tight">{t("...title")}</h3>
    <p className="text-sm text-muted-foreground mt-1">{t("...description")}</p>
  </div>
</div>
```

### 2. بطاقة التعليمات (Checklist card)
نقل قائمة الـ checklist إلى بطاقة محدّدة بصرياً:
```tsx
<div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-2.5">
  {instructions.map(item => (
    <div className="flex items-start gap-2.5">
      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <span className="text-sm text-foreground/90">{item}</span>
    </div>
  ))}
</div>
```

### 3. زر CTA
- إزالة `w-full` على الشاشات المتوسطة فأكبر.
- وضع الزر داخل حاوية محاذية لبداية العمود (RTL: يمين، LTR: يسار).
- إضافة مسافة علوية واضحة (`pt-2`) لفصله عن بطاقة التعليمات.
```tsx
<div className="flex justify-center md:justify-start pt-2">
  <Button className="w-full md:w-auto md:min-w-[200px] h-11 ...">
    <Camera className="w-4 h-4 mr-2" />
    {t("...cta")}
  </Button>
</div>
```

### 4. تنظيم العمود ككل
العمود الجانبي يستخدم `flex flex-col gap-5 justify-center` لمحاذاة عمودية متوازنة مع ارتفاع الكاميرا.

## ASCII — قبل/بعد (العمود الجانبي)

```text
قبل:                              بعد:
┌──────────────────────┐          ┌──────────────────────┐
│ 📷                   │          │ ┌──┐ العنوان         │
│                      │          │ │📷│ وصف قصير        │
│ العنوان              │          │ └──┘                 │
│                      │          │                      │
│ وصف                  │          │ ┌──────────────────┐ │
│                      │          │ │ ✓ إضاءة جيدة     │ │
│ ✓ إضاءة              │          │ │ ✓ إطار واضح      │ │
│ ✓ إطار               │          │ │ ✓ بدون نظارات    │ │
│ ✓ بدون نظارات        │          │ └──────────────────┘ │
│                      │          │                      │
│[───── زر كامل ─────] │          │ [التقاط الصورة]      │
└──────────────────────┘          └──────────────────────┘
```

## الملفات المعدّلة
- `src/components/portal/identity/IdentityActivationDialog.tsx` فقط — العمود الجانبي في `SelfieStep` و `VideoStep`.

## بدون تغيير
- الكاميرا (الحجم والموضع)، منطق الالتقاط/التسجيل، الترجمات (نفس المفاتيح)، الهيدر، الـ stepper، باقي الخطوات.

