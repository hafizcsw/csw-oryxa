

## المشكلة الحقيقية في جواز ريما

**التشخيص الفعلي** (من فحص الكود + الصورة):

التصنيف ظهر `Passport · 35%` و"بحاجة للمراجعة" بدون أي حقول هوية مُستخرجة. هذا يعني `mrzResult.found = false` رغم أن MRZ في الصورة واضح للعين البشرية. الأسباب الجذرية:

### السبب 1: `findTD3Line1` يرفض السطور الأقصر من 44 حرفاً
السطر الأول `PCSDNNOURELDAEM<ELSHIBLY<ELSHIKH<<REMA<<<<<` = **43 حرفاً** (filler واحد مفقود). الكود الحالي:
```js
if (s.length < 44) return null;  // يرفض فوراً
```
أي MRZ يفقد حرف واحد بسبب تقطيع Tesseract = فشل كامل.

### السبب 2: Tesseract يخلط `<` بأحرف أخرى
الـ OCR على صور كاميرا (خصوصاً مع reflection أصفر) يحوّل `<` إلى `K`, `(`, `«`, `[`, فراغ. `cleanMrz` يحذف فقط `[^A-Z0-9<]` → الأحرف اللاتينية (K) تبقى وتُفسد MRZ. لا يوجد **MRZ character recovery** يعيد `K` المتكررة في زون filler إلى `<`.

### السبب 3: لا توجد `tessedit_char_whitelist` لمنطقة MRZ
Tesseract يُستخدم بـ `eng+ara` بدون أي تخصيص لمنطقة OCR-B. النتيجة: يقرأ MRZ كأنه نص عادي ويستبدل `<` بأحرف لاتينية.

### السبب 4: `MRZ_PATTERN_RE` في content-classifier يتطلب `<<` مزدوج
لو OCR أبدل أي `<` بحرف، الـ `<<` المزدوج يختفي → `mrz_pattern_in_text = false` → التصنيف يبقى ضعيفاً → confidence منخفض.

---

## الحل — 4 إصلاحات حقيقية

### إصلاح 1: تليين `findTD3Line1` ليقبل 40+ حرف
**ملف**: `src/features/documents/parsers/mrz-parser.ts`
- خفض الحد الأدنى من 44 → 38 حرفاً
- pad-end تلقائي بـ `<` للوصول إلى 44
- **والأهم**: قبل محاولة `parseTD3`, تطبيق دالة `recoverMrzChars` تستبدل في نهاية السطر:
  - `K{2,}`, `R{3,}`, `<K`, `K<` → `<` (filler زون فقط)

### إصلاح 2: MRZ character recovery (heuristic post-OCR cleanup)
**ملف جديد**: `src/features/documents/parsers/mrz-recovery.ts`
- `recoverMrzLine(line, expectedLength)`:
  - استبدال `«`, `[`, `(`, `{`, `K(2+)` في نهاية السطر بـ `<`
  - استبدال `O` بـ `0` في زون السطر 2 [13:19], [21:27] (التواريخ والأرقام)
  - استبدال `I` بـ `1`, `S` بـ `5` في الزون الرقمي فقط
  - pad-end بـ `<` للطول المتوقع
- يُستدعى داخل `parseMrz` بعد `cleanMrz` وقبل `findTD3Line1`

### إصلاح 3: Tesseract MRZ-aware second pass
**ملف**: `src/features/documents/parsers/ocr-reader.ts`
- بعد الـ pass الأول `eng+ara`، لو النص يحوي filler-pattern (`<{2,}` أو `K{4,}`):
  - تشغيل pass ثانٍ على الثلث السفلي من الصورة فقط
  - إعدادات: `tessedit_char_whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'`, `tessedit_pageseg_mode = '6'` (uniform block)
  - دمج السطور المُستردّة في `full_text` (تُلحق في النهاية كسطرين منفصلين)

### إصلاح 4: تليين `MRZ_PATTERN_RE` في classifier
**ملف**: `src/features/documents/parsers/content-classifier.ts`
- النمط الحالي يتطلب `<<` (filler مزدوج) — حساس لـ OCR
- النمط الجديد: قبول إما `<<` أو `K{4,}` أو طول filler ≥ 6 من أي حرف متكرر بعد منطقة الاسم
- بديل أبسط: **رفع الثقة لـ Passport بمجرد وجود `^P[A-Z<]{4}` متبوعاً بـ 28+ حرف من `[A-Z0-9<KR(]`** (filler-tolerant)

---

### الملفات المتأثرة
| ملف | تعديل |
|-----|-------|
| `mrz-parser.ts` | تخفيف طول السطر + استدعاء recovery |
| `mrz-recovery.ts` | جديد (post-OCR character recovery) |
| `ocr-reader.ts` | Pass ثانٍ MRZ-aware على الثلث السفلي |
| `content-classifier.ts` | MRZ_PATTERN_RE filler-tolerant |

### النتيجة المتوقعة
- ✅ جواز ريما (43 حرف + reflection أصفر) يُقرأ كاملاً
- ✅ checksum_verified = true → confidence = 95%
- ✅ كل حقول الهوية تظهر في الكارت اليمين
- ✅ يعمل مع أي صورة كاميرا فيها reflection/glare/تشويش طفيف
- ✅ لا يكسر الجوازات النظيفة (PDF عالي الدقة) — كل التغييرات إضافية fallback

</lovable-plan><lov-plan>

## المشكلة الحقيقية في جواز ريما

**التشخيص الفعلي** (من فحص الكود + الصورة):

التصنيف ظهر `Passport · 35%` و"بحاجة للمراجعة" بدون أي حقول هوية مُستخرجة. هذا يعني `mrzResult.found = false` رغم أن MRZ في الصورة واضح للعين البشرية. الأسباب الجذرية:

### السبب 1: `findTD3Line1` يرفض السطور الأقصر من 44 حرفاً
السطر الأول `PCSDNNOURELDAEM<ELSHIBLY<ELSHIKH<<REMA<<<<<` = **43 حرفاً** (filler واحد ناقص). الكود الحالي:
```js
if (s.length < 44) return null;  // يرفض فوراً
```
أي MRZ يفقد حرف واحد بسبب تقطيع Tesseract = فشل كامل.

### السبب 2: Tesseract يخلط `<` بأحرف أخرى
الـ OCR على صور كاميرا (خصوصاً مع reflection أصفر مثل صورة ريما) يحوّل `<` إلى `K`, `(`, `«`, `[`, فراغ. `cleanMrz` يحذف فقط `[^A-Z0-9<]` → الأحرف اللاتينية (`K`) تبقى وتُفسد MRZ. لا يوجد **MRZ character recovery**.

### السبب 3: لا توجد `tessedit_char_whitelist` لمنطقة MRZ
Tesseract يُستخدم بـ `eng+ara` بدون أي تخصيص لمنطقة OCR-B → يقرأ MRZ كنص عادي ويستبدل `<` بأحرف لاتينية.

### السبب 4: `MRZ_PATTERN_RE` في classifier يتطلب `<<` مزدوج
لو OCR أبدل أي `<` بحرف، الـ `<<` يختفي → `mrz_pattern_in_text = false` → confidence منخفض.

---

## الحل — 4 إصلاحات

### 1. تليين `findTD3Line1` (mrz-parser.ts)
- خفض الحد الأدنى 44 → 38 حرفاً مع pad-end تلقائي بـ `<`
- نفس التليين لـ TD2 (36→32) و TD1 (30→26)

### 2. MRZ character recovery (ملف جديد: `mrz-recovery.ts`)
- استبدال `K{2,}`, `«`, `[`, `(`, `{` في نهاية السطر بـ `<` (filler زون)
- في زون السطر 2 الرقمي [13:19]، [21:27]: `O→0`, `I→1`, `S→5`, `B→8`
- يُستدعى داخل `parseMrz` بعد `cleanMrz`

### 3. Tesseract MRZ-aware second pass (ocr-reader.ts)
- بعد الـ pass الأول، لو النص يحوي filler-pattern أو `K{4,}` أو `[PI][A-Z]{3,4}`:
  - pass ثانٍ على **الثلث السفلي** من الصورة فقط
  - إعدادات: `tessedit_char_whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'`, `pageseg_mode = 6`
  - دمج السطور المُستردّة في `full_text`

### 4. تليين `MRZ_PATTERN_RE` في classifier (content-classifier.ts)
- قبول `<<` أو `K{4,}` أو filler متكرر ≥6 بعد منطقة الاسم
- يضمن `mrz_pattern_in_text = true` حتى مع OCR متوسط

---

### الملفات
| ملف | تعديل |
|-----|-------|
| `mrz-parser.ts` | تليين الأطوال + استدعاء recovery |
| `mrz-recovery.ts` | جديد (character recovery) |
| `ocr-reader.ts` | MRZ-aware second pass على الثلث السفلي |
| `content-classifier.ts` | MRZ_PATTERN_RE filler-tolerant |

### النتيجة المتوقعة
- ✅ جواز ريما (43 حرف + reflection) يُقرأ كاملاً
- ✅ `checksum_verified = true` → confidence = 95%
- ✅ كل حقول الهوية تظهر في كارت "الهوية"
- ✅ يعمل مع أي صورة كاميرا فيها glare/تشويش
- ✅ لا يكسر الجوازات النظيفة — كل التغييرات إضافية (fallback)

