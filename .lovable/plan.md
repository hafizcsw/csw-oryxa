

## تقوية المُحكّم — جوازات سفر العالم + Output Schema موحّد

### المنطق
المستخدم اقترح schema نظيف للإخراج. سأدمجه مع خطة تقوية الجواز السابقة (TD1/TD2/TD3 + check-digits + 250 دولة + OCR + multilingual).

---

### الطبقة 1: MRZ شامل مع Check-Digits
**ملف**: `src/features/documents/parsers/mrz-parser.ts` (إعادة هيكلة)
- `parseTD3()` — passport قياسي (2×44) — موجود، يُحسَّن
- `parseTD2()` — جواز/تأشيرة قديم (2×36) — جديد
- `parseTD1()` — بطاقة هوية/جواز بعض الدول (3×30) — جديد
- `verifyCheckDigit(field, checkChar)` — خوارزمية ICAO 9303 (الأوزان 7-3-1)
- التحقق من 4 check-digits: passport_number, DOB, expiry, composite
- `checksum_verified = true` فقط لو نجحت كل الفحوصات

### الطبقة 2: قاموس ISO 3166-1 كامل
**ملف جديد**: `src/features/documents/parsers/iso-country-codes.ts`
- 250+ مدخل: `{ alpha3, alpha2, name_en, name_ar }`
- helper: `lookupCountry(alpha3)` → `{ iso_code_3, iso_code_2, name }`
- استبدال `COUNTRY_CODES` المحلي

### الطبقة 3: OCR للصور والـ scanned PDFs
**ملف جديد**: `src/features/documents/parsers/image-ocr-parser.ts`
- `tesseract.js` lazy-loaded
- لغات: `eng + ara + fra + spa + rus + chi_sim` (≈85% جوازات العالم)
- API: `ocrImage(file | imageData) → { text, confidence }`

**تعديل**: `pdf-text-parser.ts`
- per-page try/catch (فشل صفحة لا يُسقط الملف)
- `renderPagesToImages()` للـ OCR fallback عند `!is_born_digital`

**تعديل**: `analysis-engine.ts`
- فرع OCR fallback: صورة أو scanned PDF → OCR → classify/extract

### الطبقة 4: تصنيف متعدد اللغات
**تعديل**: `content-classifier.ts`
- keywords للجواز بـ 6 لغات (ar/en/fr/es/ru/zh/de)
- **MRZ trust boost**: أي MRZ بـ `checksum_verified=true` → `passport_strong` تلقائياً

### الطبقة 5: Output Schema الموحّد
**ملف جديد**: `src/features/documents/passport-output-schema.ts`
- نوع `PassportOutput` مطابق لاقتراح المستخدم:
  - `personal_info` (first_name, last_name, full_name_mrz, dob{raw, formatted}, gender, nationality{name, iso_code_3}, place_of_birth)
  - `document_info` (passport_number, document_type, issuing_country, issue_date, expiry_date, is_expired, days_until_expiry)
  - `mrz_details` (line_1, line_2, checksum_verified)
  - `engine_metadata` (confidence_score, processing_time_ms, ocr_version)
- `buildPassportOutput(mrzResult, ocrMeta) → PassportOutput`
- يُحفظ في `DocumentAnalysis.extracted_fields['passport.output']` كـ structured payload

---

### الملفات
| ملف | حالة |
|-----|------|
| `mrz-parser.ts` | إعادة هيكلة كبيرة (TD1/2/3 + check-digits) |
| `iso-country-codes.ts` | جديد (250+ دولة) |
| `image-ocr-parser.ts` | جديد (Tesseract.js) |
| `pdf-text-parser.ts` | per-page errors + render-to-image |
| `content-classifier.ts` | multilingual + MRZ boost |
| `analysis-engine.ts` | OCR fallback + buildPassportOutput |
| `passport-output-schema.ts` | جديد (الـ schema الموحّد) |
| `DOCUMENT_ANALYSIS_FREEZE.md` | تحديث |

### تبعيات
- `tesseract.js` (lazy، لا يؤثر على bundle الأساسي)

### النتيجة
- ✅ MRZ يقرأ TD1/TD2/TD3 مع تحقق رياضي (checksum)
- ✅ 250+ دولة معترف بها (ISO 3166-1)
- ✅ جوازات مُصوَّرة وممسوحة تُقرأ عبر OCR
- ✅ تصنيف صحيح لجوازات بـ 6 لغات
- ✅ مخرجات بصيغة `PassportOutput` نظيفة جاهزة لأي نظام جامعة
- ✅ `is_expired` + `days_until_expiry` محسوبة تلقائياً
- ✅ `confidence_score` صادق (يجمع MRZ confidence + OCR confidence + checksum result)

