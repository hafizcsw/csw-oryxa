

## الهدف

تحويل الـ Floating Support Panel من "lobby ثابت بأقسام منفصلة" إلى **shell موحّد للمحادثات الحقيقية**، حيث:

1. **Oryxa AI** = الشات الافتراضي عند فتح الزر العائم (أول ما يراه العميل)
2. **Messages (الصندوق)** = ثريدات حقيقية مع الإدارة، تُقرأ وتُرَدّ من نفس الـ Panel
3. **Identity** = لا تظهر إذا الحساب موثق (الاسم وحده يكفي)
4. **كل قناة = مصدر بيانات حقيقي**، لا أقسام decorative

## المنطق الجديد للـ Panel

```text
┌─────────────────────────────────┐
│  Hi {firstName}        ⤢  ✕    │  ← top bar
├─────────────────────────────────┤
│  [ Oryxa AI ]  [ Messages • 2 ] │  ← Tab switcher (default = Oryxa)
├─────────────────────────────────┤
│                                 │
│   ── محتوى التاب النشط ──       │
│                                 │
│  Oryxa tab:                     │
│   • نفس MalakChat الحالي        │
│   • messages + universities     │
│   • input bar أسفله              │
│                                 │
│  Messages tab:                  │
│   • قائمة threads حقيقية         │
│   • click → يفتح thread inline  │
│   • reply box داخل الـ Panel    │
│   • زر "افتح في صفحة كاملة"    │
│     → /messages                 │
│                                 │
├─────────────────────────────────┤
│  [ input bar حسب التاب ]        │
└─────────────────────────────────┘
```

عند **عدم وجود حساب** → Panel يعرض Oryxa فقط (بدون tabs، بدون Messages، بدون Identity).

عند **حساب غير موثق** → بانر صغير أعلى التابات: "وثّق هويتك لتفعيل المراسلة الكاملة" (chip واحد، ليس قسم كامل).

عند **حساب موثق** → لا identity badge، لا "verified" tag، فقط الاسم في الـ greeting.

## الـ Channels الحقيقية المطلوب ربطها

| Channel | المصدر الحقيقي الموجود | الربط الجديد |
|---|---|---|
| **Oryxa AI** | `MalakChatContext` + `AIChatPanel` | يصبح المحتوى الافتراضي للـ Panel (تاب 1) |
| **Messages** | `useSupportTickets` + Supabase `support_tickets` + `support_ticket_messages` | يصبح تاب 2 — قائمة + thread view + reply |
| **Identity status** | `useIdentityStatus` | يُستخدم فقط للـ gate banner، لا قسم منفصل |
| **Categories grid** | كانت 8 buttons → معظمها submit dialogs | **يُحذَف** — الإرسال يحدث طبيعياً عبر Messages tab أو Oryxa |
| **FAQ list** | static keys | **يُحذَف** — Oryxa هو الـ FAQ الذكي الحقيقي |

## هيكل الملفات

**جديد:**
- `src/components/portal/support/panel/PanelTabs.tsx` — Tab switcher (Oryxa | Messages) مع badge للرسائل غير المقروءة
- `src/components/portal/support/panel/OryxaTab.tsx` — wrapper يستدعي MalakChat (نفس messages + universities) داخل الـ Panel
- `src/components/portal/support/panel/MessagesTab.tsx` — list view + thread view + reply box + "Open in Messages" link
- `src/components/portal/support/panel/MessagesThreadView.tsx` — عرض ثريد واحد مع رسائل + إرسال رد
- `src/hooks/useSupportTicketMessages.ts` — fetch + send لرسائل ticket واحد (إذا غير موجود)

**معدّل:**
- `src/components/portal/support/FloatingSupportPanel.tsx` — إعادة كتابة كاملة: حذف Categories/FAQ/IdentityProgress/Hero الكبير → tabs + active tab content
- `src/components/portal/support/FloatingSupportLauncher.tsx` — يبقى كما هو (الزر الموحّد)
- `src/contexts/MalakChatContext.tsx` — يجب أن يقبل rendering خارج `AIChatPanel` (نستخدم نفس state بدون Sheet)
- `src/components/chat/AIChatPanel.tsx` — يصبح **legacy** (يُحذَف من App.tsx لأن المحتوى انتقل داخل Panel)

**يُحذَف من العرض (الكود يبقى للأرشفة):**
- `panel/PanelHero.tsx` — يُستبدل بـ greeting سطر واحد في TopBar
- `panel/QuickCategoriesGrid.tsx`
- `panel/FAQSuggestionsList.tsx`
- `panel/IdentityProgressCard.tsx` — يُستبدل بـ banner شرطي صغير
- `panel/PanelStickyFooter.tsx` — يُستبدل بـ input bar حسب التاب

## Messages Tab — تفاصيل السلوك

### List view (افتراضي عند فتح التاب)
- يستدعي `useSupportTickets()` (موجود)
- كل صف: subject + last message preview + unread dot + relative time
- لا chevrons decorative — click حقيقي يفتح الـ thread
- زر علوي "+ New" → يفتح `SupportSubmitDialog` (موجود)
- زر سفلي "Open Messages page →" → navigate `/messages`

### Thread view (بعد click على ticket)
- Header: back arrow + subject + status pill
- Messages list: bubbles (user يمين، admin يسار في LTR / معكوس في RTL)
- Reply input أسفله — يكتب في `support_ticket_messages` الحقيقي
- Real-time: subscribe على `support_ticket_messages` للـ ticket الحالي
- زر "View full conversation →" → navigate `/messages/{ticketId}`

### Empty state
- "No messages yet" + زر "Start a conversation" يفتح SubmitDialog

## Oryxa Tab — تفاصيل السلوك

- يعيد استخدام `MalakChatContext` بالكامل (نفس state، نفس actions)
- يعرض نفس `messages` + `universities` + `status` من الـ context
- Input bar مطابق لـ AIChatPanel input
- لا تكرار — إذا فتح المستخدم الـ Panel ثم أعاد فتحه، يجد نفس المحادثة
- زر "Clear conversation" أعلى يميناً (decorative — يحتاج تأكيد لاحق)
- `AIChatPanel` القديم يُزال من `App.tsx` لأن نفس الـ context يُعرض الآن داخل Panel

## Identity Banner (شرطي)

```tsx
{status !== 'approved' && (
  <button className="banner...">
    وثّق هويتك لتفعيل المراسلة الكاملة →
  </button>
)}
```

- يظهر فقط أعلى Messages tab
- click → يفتح `IdentityActivationDialog` (موجود)
- إذا `approved`: لا banner، لا badge، لا أي ذكر — فقط الاسم في greeting

## القواعد الحاكمة

1. **No fake threads** — Messages tab يقرأ من Supabase حصراً
2. **No duplicate Oryxa** — `AIChatPanel` Sheet يُحذَف من App.tsx
3. **No identity decoration** للحسابات الموثّقة
4. **Tab badge** = عدد الـ unread tickets الحقيقي من DB
5. **12-language** — كل المفاتيح الجديدة لكل ملفات الـ 12 لغة
6. **No hex colors** — semantic tokens فقط
7. **RTL** — bubbles تنعكس، tabs تنعكس، back arrow ينعكس
8. **Reduced motion** — tab transitions opacity فقط

## Locale keys جديدة

```
portal.support.panel.tabs.oryxa: "Oryxa AI"
portal.support.panel.tabs.messages: "Messages"
portal.support.panel.messages.empty.title: "No messages yet"
portal.support.panel.messages.empty.cta: "Start a conversation"
portal.support.panel.messages.newButton: "New"
portal.support.panel.messages.openFullPage: "Open in Messages"
portal.support.panel.messages.viewFullThread: "View full conversation"
portal.support.panel.messages.replyPlaceholder: "Type a reply…"
portal.support.panel.messages.send: "Send"
portal.support.panel.messages.back: "Back"
portal.support.panel.identityBanner: "Verify your identity to unlock full messaging"
portal.support.panel.oryxa.clear: "Clear conversation"
portal.support.panel.oryxa.placeholder: "Ask Oryxa anything…"
portal.support.panel.greeting.guest: "Welcome"
```

→ يُضاف لكل: `ar, bn, de, en, es, fr, hi, ja, ko, pt, ru, zh`

## Locale keys تُحذَف من الاستخدام (تبقى في الملفات للأرشفة)

- `portal.support.categories.*` (8 categories)
- `portal.support.faq.q1..q6`
- `portal.support.panel.kycTitle`, `kycStep`, `kycReasonChip`
- `portal.support.panel.faqTitle`, `faqViewMore`
- `portal.support.panel.welcomeTo`

## Real-time subscription (Messages tab)

- عند فتح Panel: subscribe على `support_tickets` للـ user (للـ unread badge)
- عند فتح thread: subscribe إضافية على `support_ticket_messages` للـ ticket
- عند إغلاق Panel/thread: unsubscribe لتجنّب leaks

## Width adjustment

- collapsed: 400px → **يبقى 400px** (مناسب للـ chat)
- expanded: 520px → **يبقى 520px**
- على mobile: 88vh كما هو
- لا تغيير في drag behavior للـ Launcher

## ما لا يتغيّر

- Launcher (الزر العائم نفسه)
- `SupportSubmitDialog` (يُستخدم لـ "+ New" فقط)
- `IdentityActivationDialog` (يُفتح من banner فقط)
- `useIdentityStatus`, `useExtractedIdentity` hooks
- مصدر اسم العميل (canonical-first من `useExtractedIdentity`)
- جميع routes الموجودة (`/messages`, `/about-oryxa`)

## قرار يحتاج تأكيدك قبل التنفيذ

**التاب الافتراضي عند فتح الزر العائم:**
- (أ) **Oryxa دائماً** — كما طلبت "أول شي يظهر للعميل هوا شات اوريكسا"
- (ب) **ذكي** — Oryxa للزوار، Messages للحسابات إذا فيها unread، Oryxa عدا ذلك
- (ج) **آخر تاب استخدمه العميل** (يُحفَظ في localStorage)

موصى: **(أ)** — يطابق طلبك حرفياً ويبقى متوقّعاً.

