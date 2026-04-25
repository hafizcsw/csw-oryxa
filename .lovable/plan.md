# إعادة بناء جلسة Oryxa الحية لتليق بـ CSW World

## التشخيص الصريح لما فشل في الجلسة الحالية

1. **الشخصية عامة وسطحية**: "friendly educational assessor" بدون أي إدراك أن هذا منتج CSW World لـ **استكشاف الجامعات والبرامج عالمياً**. لا تعرف أنها أمام طالب يبحث عن دراسة في الخارج.

2. **اللغة ثنائية بدائية**: `isArabicSession` فقط — يخالف قاعدة المشروع (12 لغة). بقية الـ 10 لغات تنزل قسراً للإنجليزية.

3. **القياس وهمي**: تطلب من النموذج "اطرح سؤال لغة" بدون أي rubric، بدون مقاييس CEFR، بدون قياس فعلي. النموذج يرتجل أسئلة عشوائية.

4. **الكاميرا بلا غرض حقيقي**: تُرسل frames لكن النموذج لا يستخدمها لأي شيء قياسي (هل الطالب موجود؟ هل يكتب؟ هل يُظهر ورقة؟ هل يحل مسألة هندسية على ورقة؟).

5. **الصوت/الإلقاء سيء**: `voice: alloy` ثابت. لا اختيار صوت يناسب لغة الطالب. لا تعليمات لإيقاع/نبرة.

6. **لا سياق طالب**: لا تعرف مستواه، عمره، البلد المستهدف، التخصص المهتم به — رغم أن كل هذا موجود في portal/CRM context.

7. **لا مخرج منظَّم**: تنتهي بـ "ملخص شفهي" يضيع. لا JSON قابل للاستفادة لاحقاً.

## ما سنبنيه (هذا الباب فقط — Live Session Rebuild)

### A. شخصية Oryxa صحيحة لـ CSW World

System prompt جديد (في edge function) يتضمّن:
- هويتها: مرشدة CSW World المتخصصة في توجيه الطلاب لدراسة في الخارج (12 دولة مدعومة)
- مهمتها في هذه الجلسة: قياس **مبدئي موثَّق** قبل ترشيح برامج/جامعات
- تتكلم بلغة الطالب الـ 12 الأصلية، ليس فقط ar/en
- تعرف أن CSW World منصة عالمية — تتجنب التحيز لبلد واحد

### B. دعم الـ 12 لغة بشكل صحيح

استبدال `isArabicSession` بـ map كامل:
```ts
const VOICE_BY_LANG = {
  ar: "shimmer", en: "alloy", es: "nova", fr: "nova",
  de: "echo", pt: "nova", ru: "echo", zh: "shimmer",
  ja: "shimmer", ko: "shimmer", hi: "nova", bn: "nova"
};
const LANG_NAME = { ar:"Arabic", en:"English", es:"Spanish", ... };
```
النموذج يتلقى تعليمات صريحة: "Conduct the entire session in {LANG_NAME}. If the student switches language, follow them but note it."

### C. قياس حقيقي مُهيكل (Structured Assessment)

تعليمات داخلية للنموذج تتبع rubric واضح:

1. **Language proficiency** — مقياس CEFR تقريبي (A1→C2):
   - 3 prompts متدرجة الصعوبة بلغة الطالب
   - يقيس: نطق، استيعاب، طلاقة، مفردات
2. **Quantitative reasoning** — 2 أسئلة:
   - حسابية بسيطة (نسبة، نسبة مئوية)
   - هندسية (مساحة/محيط أو زاوية)
   - **يطلب من الطالب رفع الورقة للكاميرا** ليرى حله
3. **Logical reasoning** — سؤال واحد (تسلسل أو منطق بسيط)
4. **Background & goals** — تخصص مهتم، مستوى دراسي حالي، دول مهتم بها

### D. استخدام الكاميرا بهدف

تحديث الـ system prompt ليطلب من النموذج صراحةً:
- التحقق من حضور الطالب (ليس صورة ثابتة)
- طلب رؤية ورقة الحل في أسئلة الرياضيات
- ملاحظة بيئة الجلسة (هل الطالب في مكان مناسب؟)

تحديث `useRealtimeSession.ts`:
- خفض `FRAME_INTERVAL_MS` من 2500 → 3500 (أقل ضوضاء)
- إضافة `text` hint مع كل frame: `"[camera_frame_t={timestamp}]"` ليعرف النموذج أنها صورة سياق وليست input مستقل

### E. سياق الطالب من الـ Portal

تحديث `realtime-session-token` ليقبل اختيارياً:
```ts
{ language, studentContext?: {
    displayName?: string,
    educationLevel?: string,
    interestedCountries?: string[],
    interestedFields?: string[]
}}
```
ويُحقَن في الـ instructions: "The student's name is X. They are interested in Y in country Z."

`LiveSessionPanel` يقرأ هذا من `MalakChatContext` / canonical student file إن توفر.

### F. مخرج منظَّم في نهاية الجلسة

تعليمات للنموذج: "في نهاية الجلسة، أرسل عبر DataChannel رسالة من نوع `response.create` تحتوي tool call باسم `submit_assessment` بالـ schema التالي":
```json
{
  "language_level_estimate": "A1|A2|B1|B2|C1|C2",
  "quantitative_level": "weak|basic|solid|strong",
  "logical_level": "weak|basic|solid|strong",
  "interests_detected": ["..."],
  "countries_mentioned": ["..."],
  "recommended_next_step": "...",
  "confidence": "low|medium|high",
  "session_notes_short": "..."
}
```

النموذج يُسجَّل بـ tool definition عبر `session.update` بعد الاتصال. الـ hook يلتقطه في `response.function_call_arguments.done` ويعرضه في الـ UI كـ "Assessment Summary Card" قابل للنسخ — **بدون حفظ في DB** (نلتزم بنطاق prototype).

### G. UI أنضج

- إضافة شريط مرحلة (Phase): Greeting → Language → Math → Logic → Wrap-up
- زر "Show my work" يُعطي tip بصري للطالب لرفع الورقة
- بطاقة الملخص النهائية بعد إنهاء الجلسة (من tool call output)
- مؤشر LiveStatus أوضح (waveform بسيط للصوت الوارد)

## الملفات المتأثرة

**Edge function (rewrite):**
- `supabase/functions/realtime-session-token/index.ts` — 12-lang map، voice selection، rubric instructions، optional student context، tool registration hint

**Hook (extend):**
- `src/hooks/useRealtimeSession.ts` — قبول `studentContext`, التقاط tool call output `submit_assessment`, تتبع phase, تحسين frame loop

**UI (rewrite):**
- `src/components/chat/LiveSessionPanel.tsx` — Phase indicator، assessment summary card، 12-lang labels، work-up tip

**i18n:**
- `src/locales/{ar,en}/common.json` — مفاتيح: phases، summary card، rubric labels
- البنية جاهزة للـ 10 لغات الباقية (لا نولّد ترجمات وهمية الآن — يُترك للـ translation lane)

**Integration touch points (لا تغيير سلوكي):**
- `src/components/chat/MalakChatInterface.tsx` — يمرر studentContext إن وُجد
- `src/components/portal/support/panel/OryxaTab.tsx` — نفس الشيء

## خارج النطاق صراحةً
- لا CRM mutation ولا حفظ نتيجة الـ assessment
- لا touch لـ Order 2/3 (drafts/extraction) — الديون runtime لا تزال مفتوحة
- لا تغيير في الـ text chat
- لا توليد ترجمات للـ 10 لغات (يُترك لباب الترجمة)
- لا audio recording / transcript persistence

## معايير الإغلاق
- **code-ready** بعد التنفيذ
- **runtime-proven** يحتاج اختبارك:
  1. الجلسة تتكلم بلغة الواجهة الفعلية
  2. تطرح أسئلة من كل قسم (لغة + رياضيات + منطق)
  3. تطلب رفع الورقة للكاميرا في سؤال الهندسة
  4. تنتج Summary Card في النهاية بحقول مملوءة
  5. الصوت طبيعي ومناسب للغة

## حالة الباب الحالية
- Live Session v1 = **failed UX / superficial** — يُستبدل
- Live Session v2 = code-ready بعد موافقتك
