

# تحسينات ثلاثة على رحلة التوثيق

## 1. نقل زر الإغلاق (X) إلى الجهة المعاكسة
**الملف:** `src/components/ui/dialog.tsx` — لكن التعديل سيكون **محصوراً داخل** `IdentityActivationDialog` فقط لتجنّب التأثير على باقي الـ Dialogs في الموقع.

**الطريقة:** إخفاء الـ X الافتراضي في `IdentityActivationDialog` عبر CSS، وإضافة زر إغلاق مخصّص في الـ `DialogHeader` على الجهة المقابلة لأيقونة الدرع:
- في RTL (عربي): الدرع على اليمين → X على اليسار  
- في LTR (إنجليزي): الدرع على اليسار → X على اليمين

```tsx
// IdentityActivationDialog.tsx
<DialogContent className="... [&>button]:hidden">
  <DialogHeader>
    <div className="flex items-start justify-between gap-3">
      <DialogTitle>...</DialogTitle>
      <button onClick={() => onOpenChange(false)} 
              className="rounded-full p-1.5 hover:bg-muted">
        <X className="w-4 h-4" />
      </button>
    </div>
  </DialogHeader>
```

## 2. تصغير بطاقات المعلومات والخط (SummaryStep)
**الملف:** `src/components/portal/identity/IdentityActivationDialog.tsx` — مكوّن `SummaryStep`

تعديلات على بطاقات الحقول المستخرجة لتتناسق على الموبايل واللابتوب:
- `min-h-[110px]` → `min-h-[88px]`
- `p-4` → `p-3`
- `gap-3` → `gap-2`
- أيقونة: `h-8 w-8` → `h-7 w-7`، الأيقونة الداخلية `w-4 h-4` → `w-3.5 h-3.5`
- نص الحقل: `text-sm` → `text-[13px]`
- الاسم الكامل: `text-base leading-7` → `text-sm leading-6`
- البانر العلوي: `p-5` → `p-4`، أيقونة `h-11 w-11` → `h-10 w-10`، عنوان `text-base` → `text-sm`، نص الوصف `text-sm` → `text-xs`
- المسافات بين البطاقات: `gap-3` → `gap-2.5`

النتيجة: كثافة معلومات أعلى، أقل تمدّد عمودي، تناسق بين الموبايل (390px) واللابتوب الكبير.

## 3. إخفاء زر "بدء التسجيل" فور انتهاء التسجيل
**المشكلة الحالية:** في `VideoStep`، عند انتهاء العدّاد، يستدعي `recorderRef.current?.stop()` ثم `setRecording(false)` فوراً. لكن `onCaptured` (الذي يحوّل الخطوة عبر `setStep`) لا يُستدعى إلا داخل `mr.onstop` بعد مرور ~1-2 ثانية. خلال هذه الفجوة:
- `recording = false` → الزر يعود لحالته الافتراضية "بدء التسجيل" ✗
- يبقى مرئياً → المستخدم يظنّ أن عليه الضغط مجدداً

**الإصلاح:** إضافة state جديد `processing` يبقى `true` من لحظة `onstop` حتى انتقال الخطوة، ودمجه في حالة الزر:

```tsx
const [processing, setProcessing] = useState(false);

// عند انتهاء العدّاد:
recorderRef.current?.stop();
setRecording(false);
setProcessing(true);  // ← فوراً

// زر:
<Button disabled={!ready || recording || processing || !!err}>
  {recording ? "جاري التسجيل..." 
   : processing ? <><Loader2 className="animate-spin"/> جاري المعالجة...</>
   : "بدء التسجيل"}
</Button>
```

كذلك سنُخفي الزر بالكامل عند `processing` (`hidden`) بدلاً من تعطيله فقط، لمنع أي توهّم بأنّه ينتظر ضغطة.

## نطاق التعديل
- ملف واحد فقط: `src/components/portal/identity/IdentityActivationDialog.tsx`
- لا تغيير في API، الترجمات، أو منطق الرفع

