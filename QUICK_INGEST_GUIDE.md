# دليل Quick Ingest - الإدخال السريع للجامعات والبرامج

## نظرة عامة

نظام Quick Ingest يسمح لك بإضافة جامعات وبرامج بسرعة من خلال:
- **لصق نص** من ملفات Word/PDF/مواقع
- **رفع PDF** مباشرة

يستخدم النظام:
- ✅ **Gemini AI** (Lovable AI) للتحليل الأساسي مع استخراج الأدلة
- 🔍 **OpenAI** (اختياري) للتحقق المزدوج
- 📊 **Diff Engine** لمقارنة البيانات الجديدة مع الكتالوج الموجود
- 🛡️ **Evidence Mode** للتأكد من صحة الأسعار والبيانات الحساسة

---

## كيفية الاستخدام

### 1. الوصول إلى الصفحة

اذهب إلى: **لوحة التحكم → Unis Assistant** (`/admin/unis-assistant`)

ستجد بطاقة "Quick Ingest (Text / PDF)" في أعلى الصفحة.

---

### 2. الخيارات المتاحة

#### أ) تطبيق تلقائي (Auto-Apply)
- ☑️ **مفعّل**: سيتم تطبيق العناصر الآمنة تلقائياً (التي بدون flags)
- ☐ **معطّل** (افتراضي): ستراجع الـdiff وتطبّق يدوياً

#### ب) Evidence Mode (التحقق المزدوج)
- ☑️ **مفعّل** (افتراضي): يستخرج AI أدلة نصية لكل قيمة حساسة
- ☐ **معطّل**: استخراج عادي بدون أدلة

---

### 3. إدخال البيانات

#### خيار 1: لصق نص

```
# الولايات المتحدة

**American University**

* MSc Computer Science — ماجستير — 40,000 USD (2025) — الإنجليزية — IELTS 7.0
* MBA in Cybersecurity — ماجستير — 35,000 USD (2025) — الإنجليزية — IELTS 6.5

**Rivier University**

* MBA — ماجستير — 24,876 USD (2025) — الإنجليزية — IELTS 5.5
```

ثم اضغط: **تحليل النص**

#### خيار 2: رفع PDF

1. اختر ملف PDF من جهازك
2. اضغط: **رفع وتحليل PDF**

---

### 4. فهم النتائج (Diff)

بعد التحليل، ستظهر النتائج:

#### إحصائيات (Stats)
- **إنشاء جديد**: برامج/جامعات جديدة غير موجودة
- **تحديث**: برامج موجودة مع تغييرات
- **بدون تغيير**: بيانات مطابقة للموجود

#### البرامج

**العناصر الآمنة** (خلفية خضراء ✅):
- لا يوجد اختلاف بين AI
- توجد أدلة صالحة
- جاهزة للتطبيق

**العناصر المعلّمة** (خلفية حمراء ⚠️):
- `AI_DISAGREE`: Gemini وOpenAI لم يتفقا على القيمة
- `MISSING_EVIDENCE`: لا توجد أدلة نصية كافية
- **تحتاج مراجعة يدوية**

---

### 5. تطبيق التغييرات

#### تطبيق تلقائي
لو فعّلت "Auto-Apply"، سيتم تطبيق العناصر الآمنة فوراً.

#### تطبيق يدوي
اضغط: **تطبيق العناصر الآمنة (X)** لتطبيق البنود الخضراء فقط.

⚠️ **ملاحظة**: البنود المعلّمة (حمراء) لن يتم تطبيقها تلقائياً. راجعها يدوياً وصححها في صفحة Programs Admin.

---

## Feature Flags (التحكم في الميزة)

يمكنك التحكم في السلوك من Feature Flags:

```sql
-- تفعيل/تعطيل Quick Ingest
UPDATE feature_flags SET enabled = true WHERE key = 'unis_ingest_quick_enabled';

-- تفعيل التحقق المزدوج (Gemini + OpenAI)
UPDATE feature_flags SET enabled = true WHERE key = 'unis_dual_ai_enabled';

-- تطبيق تلقائي افتراضياً
UPDATE feature_flags SET enabled = true WHERE key = 'unis_ingest_auto_apply_default';
```

---

## أمثلة على تنسيقات مدعومة

### مثال 1: نص منظّم بسيط
```
# كندا

**University of Toronto**

* Bachelor of Computer Science — بكالوريوس — 45,000 CAD (2025) — الإنجليزية — IELTS 6.5
* Master of Engineering — ماجستير — 35,000 CAD (2025) — الإنجليزية — IELTS 7.0
```

### مثال 2: مع متطلبات تفصيلية
```
# المملكة المتحدة

**University of Greenwich**

* BSc (Hons) Finance — بكالوريوس — 17,000 GBP (2026) — الإنجليزية — IELTS 6.0 (لا يقل أي قسم عن 5.5) — متطلبات أكاديمية: 120 نقطة UCAS
```

### مثال 3: JSON مباشر
```json
[
  {
    "university_name": "Stanford University",
    "program_name": "MSc Data Science",
    "degree_level": "ماجستير",
    "tuition_fee": 55000,
    "currency": "USD",
    "academic_year": "2025",
    "language": "الإنجليزية",
    "ielts_requirement": "7.0",
    "country": "الولايات المتحدة"
  }
]
```

---

## الأمان والخصوصية

✅ **Admin-only**: متاح للمشرفين فقط  
✅ **RLS Policies**: جميع الجداول محمية بسياسات RLS  
✅ **No External Sources**: لا يتم جلب بيانات من مصادر خارجية  
✅ **Evidence-Based**: كل قيمة حساسة مرفقة بأدلة نصية  
✅ **Diff Before Apply**: تراجع التغييرات قبل تطبيقها  

---

## استكشاف الأخطاء

### المشكلة: "TEXT_TOO_SHORT"
**الحل**: تأكد أن النص المُدخل أكثر من 50 حرف

### المشكلة: "Parse failed"
**الحل**: 
- تأكد من تنسيق النص صحيح
- جرب تفعيل Evidence Mode
- راجع logs في Supabase Functions

### المشكلة: كل البرامج معلّمة (حمراء)
**الحل**:
- فعّل `unis_dual_ai_enabled` للتحقق المزدوج
- راجع النص المُدخل - قد يكون غامضاً
- طبّق يدوياً بعد المراجعة

### المشكلة: Apply فشل
**الحل**:
- راجع الـlogs في Edge Functions
- تأكد من وجود country_id صحيح
- تأكد من وجود degree_id مطابق

---

## Edge Functions المستخدمة

| Function | الوظيفة |
|----------|---------|
| `admin-unis-ingest-from-text` | استقبال النص وإنشاء job |
| `admin-unis-ingest-upload-init` | تهيئة رفع PDF |
| `admin-unis-ingest-finalize` | إتمام رفع الملف |
| `admin-unis-ingest-extract-text` | استخراج نص من PDF |
| `admin-unis-ingest-parse` | تحليل بواسطة AI |
| `admin-unis-ingest-diff` | مقارنة مع الكتالوج |
| `admin-unis-ingest-apply` | تطبيق التغييرات |

---

## الدعم

للحصول على المساعدة:
1. راجع الـlogs في Supabase Functions
2. تحقق من Feature Flags
3. راجع البيانات في جداول `ingest_jobs` و `ingest_artifacts`
4. استخدم Diff Preview للتحقق قبل التطبيق

---

**آخر تحديث**: 2025-10-25  
**الحالة**: ✅ جاهز للاستخدام (مع مراجعة يدوية للعناصر المعلّمة)
