# جلسة فحص صوتية/مرئية حية — OpenAI Realtime مباشرة

## الفكرة
إضافة وضع "Live Session" في الشات الرئيسية (Oryxa) يربط الطالب بـ OpenAI Realtime API عبر WebRTC:
- يفتح الميكروفون والكاميرا
- AI تتحدث وتسمع
- ترى الطالب عبر frames دورية
- تطرح أسئلة لغة + رياضيات/هندسة + تفكير منطقي
- تخرج بتقييم شفهي مبدئي

**Prototype تجريبي.** لا يحفظ شيئاً، لا يلمس CRM/Portal Drafts/Order 2-3.

## المزود — OpenAI مباشرة فقط
- **لن نستخدم Lovable AI Gateway**
- نستخدم `OPENAI_API_KEY` مباشرة
- النموذج: `gpt-4o-realtime-preview-2024-12-17`
- النقل: WebRTC (latency منخفض، صوت ثنائي الاتجاه native)
- Auth: ephemeral token من `POST https://api.openai.com/v1/realtime/sessions` (لا يُسرَّب المفتاح للمتصفح)

## الفيديو
Realtime لا يستقبل stream فيديو مستمر. الحل:
- نلتقط frame من `<video>` كل ~2 ثانية
- نُرسله JPEG base64 كـ `input_image` ضمن `conversation.item.create`
- النموذج "يرى" الطالب شبه-حي

## ما سيُبنى

### 1. Secret مطلوب من المستخدم
- `OPENAI_API_KEY` (سأطلبه عبر add_secret بعد موافقتك)

### 2. Edge function: `realtime-session-token`
`supabase/functions/realtime-session-token/index.ts`
- `verify_jwt = false` (يُستدعى من الشات العام)
- يطلب من OpenAI ephemeral session مع:
  - `model: gpt-4o-realtime-preview-2024-12-17`
  - `voice: alloy` (افتراضي، قابل للتغيير)
  - `modalities: ["audio", "text"]`
  - `instructions`: شخصية Oryxa كمُقيِّمة تربوية، تتبع لغة الواجهة
- يُرجع `client_secret.value` للمتصفح

### 3. Hook: `useRealtimeSession`
`src/hooks/useRealtimeSession.ts`
- `start(language)`: يطلب token → ينشئ `RTCPeerConnection` → يضيف mic track → يفتح DataChannel → يتفاوض SDP مع `https://api.openai.com/v1/realtime?model=...`
- `attachVideo(stream)`: يبدأ frame capture loop (كل 2s)
- `stop()`: يُغلق peer + tracks
- يكشف: `status`, `transcript[]`, `isAISpeaking`, `error`

### 4. مكوّن: `LiveSessionPanel`
`src/components/chat/LiveSessionPanel.tsx`
- زر "ابدأ جلسة فحص"
- يطلب أذونات mic + camera بشرح واضح
- يعرض:
  - فيديو الطالب (self-view مصغّر)
  - waveform / مؤشر AI يتحدث
  - transcript حي
  - زر إنهاء + disclaimer (تجريبية، لا تُحفظ)
- يستخدم design tokens الموجودة

### 5. إدماج في الشات الرئيسية
- `AIChatPanel.tsx` و `OryxaTab.tsx`: tab/toggle بين "Text" و "Live"
- لا يكسر التدفق النصي

### 6. i18n (12 لغة)
مفاتيح جديدة `portal.chat.live.*` تُضاف في `en/common.json` و `ar/common.json` (rollout الحالي):
- `start, end, connecting, listening, speaking, permissionMic, permissionCamera, permissionDenied, disclaimer`
- البنية جاهزة للـ 12 لغة (لن نُولّد ترجمات وهمية للباقي)

### 7. Instructions للـ AI
prompt قصير في edge function:
- مُقيِّمة تربوية ودودة باسم Oryxa
- تطرح: قراءة/فهم لغوي، حساب/هندسة بسيطة، تفكير منطقي
- تستخدم الكاميرا للتحقق من حضور وتفاعل الطالب
- لغة الجلسة = لغة الواجهة (تُمرَّر من client)
- نهاية الجلسة: ملخص تقييم شفهي مختصر

## التدفق
```text
Browser              Edge Function              OpenAI
  |--POST /token---------->|                       |
  |                        |--POST /sessions------>|
  |                        |<--client_secret-------|
  |<--ephemeral token------|                       |
  |                                                |
  |--SDP offer + Bearer ephemeral----------------->|
  |<--SDP answer-----------------------------------|
  |======== WebRTC audio + DataChannel ===========|
  |--every 2s: frame as input_image-------------->|
  |<--audio chunks + transcript events------------|
```

## ملفات تُنشأ
- `supabase/functions/realtime-session-token/index.ts`
- `src/hooks/useRealtimeSession.ts`
- `src/components/chat/LiveSessionPanel.tsx`

## ملفات تُعدَّل
- `src/components/chat/AIChatPanel.tsx`
- `src/components/portal/support/panel/OryxaTab.tsx`
- `src/locales/en/common.json`
- `src/locales/ar/common.json`
- `supabase/config.toml` (تسجيل الدالة مع `verify_jwt = false`)

## خارج النطاق صراحةً
- لا حفظ صوت/فيديو/transcript في storage أو DB
- لا جدول جديد، لا CRM، لا Portal Drafts، لا Order 2/3
- لا avatar/lip-sync مولَّد
- لا fallback لمزودين آخرين
- لا تغيير المنطق النصي للشات الحالي

## Done criteria
- **code-ready** فور الانتهاء
- **runtime-proven** يحتاج اختبار يدوي منك (mic+camera+محادثة فعلية + التحقق من latency)

---

**أحتاج تأكيدك على:**
1. الموافقة على إضافة `OPENAI_API_KEY` كـ secret.
2. تأكيد أن الزر يظهر في الشات الرئيسية فقط (`AIChatPanel` + `OryxaTab`).
