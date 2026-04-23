
## إشعار رسائل جديدة في الزر العائم

### المتطلبات
1. عند وصول رسالة جديدة → تشغيل صوت تنبيه
2. مؤشر بصري واضح على الزر العائم (badge + animation)
3. عند الضغط على الزر العائم → فتح اللوحة مباشرة على الرسالة الجديدة (تبويب Messages مع الـ thread المحدد)

### التحليل

**الموجود حالياً:**
- `useCommUnreadCount` يجلب عدد الرسائل غير المقروءة
- `FloatingSupportPanel` يستقبل `initialView` لتحديد التبويب الافتتاحي
- `MessagesTab` يدير حالة `selected` للـ thread المفتوح

**ما ينقص:**
1. الكشف عن وصول رسالة *جديدة* (ليس فقط العدد الحالي) — Realtime subscription على `comm_messages`
2. تشغيل صوت عند الكشف
3. تمرير `thread_id` آخر رسالة جديدة من الزر العائم → اللوحة → MessagesTab → فتح الـ thread
4. مؤشر بصري نابض على الزر العائم

### خطة التنفيذ

#### 1. Hook جديد: `useNewMessageNotifier`
ملف جديد: `src/hooks/useNewMessageNotifier.ts`
- اشتراك Realtime على `comm_messages` بـ filter للمستخدم الحالي (عبر threads التي هو participant فيها)
- عند رسالة جديدة من sender غير المستخدم نفسه:
  - تشغيل صوت تنبيه (Web Audio API — beep قصير، بدون ملف خارجي)
  - تخزين `lastNewThreadId` و `hasNew` flag
- API يرجع: `{ hasNew, lastNewThreadId, clearNew() }`

#### 2. تعديل الزر العائم (FloatingSupportButton)
أحتاج أولاً قراءة ملف الزر العائم لمعرفة موقعه واسمه.
- إضافة badge أحمر نابض عند `hasNew`
- تخزين `lastNewThreadId` في state أو ref
- عند الضغط → فتح اللوحة مع `initialView="messages"` و `initialThreadId={lastNewThreadId}` ثم `clearNew()`

#### 3. تعديل `FloatingSupportPanel`
- إضافة prop جديدة `initialThreadId?: string`
- تمريرها إلى `MessagesTab`

#### 4. تعديل `MessagesTab`
- إضافة prop `initialThreadId?: string`
- عند التحميل، إذا وُجد → `setSelected` للـ thread المطابق

#### 5. الصوت
- استخدام Web Audio API (oscillator) لإنتاج beep قصير لطيف
- لا حاجة لملف صوتي خارجي
- احترام تفضيل reduced motion / mute (اختياري — beep خفيف لمرة واحدة)

### الملفات المتأثرة
- جديد: `src/hooks/useNewMessageNotifier.ts`
- تعديل: زر العائم (سأحدد الملف بقراءة المجلد)
- تعديل: `src/components/portal/support/FloatingSupportPanel.tsx` (prop جديدة)
- تعديل: `src/components/portal/support/panel/MessagesTab.tsx` (prop + auto-open)

### ملاحظات
- المعمارية: لا تغيير في business logic، فقط UI + realtime listener
- لا hardcoded text — سأستخدم translation keys للـ aria-label
- Realtime يعتمد على Supabase channels (موجود بالمشروع)
