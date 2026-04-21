

## الهدف

إعادة هيكلة محتوى الـ Floating Support Panel ليطابق grid أزرار Binance (الذي اتفقنا عليه سابقاً)، مع ربط كل زر بسلوك حقيقي محدد بدقة:

## خريطة الأزرار (7 خانات في الـ grid)

| # | الزر | الأيقونة | السلوك |
|---|---|---|---|
| 1 | **الإعدادات** | `Settings` | navigate `/account?tab=settings` ويغلق Panel |
| 2 | **الهوية** | `ShieldCheck` (أخضر إذا موثق) | navigate `/account?tab=overview#identity` — يفتح قسم توثيق الهوية في الحساب الشخصي |
| 3 | **Oryxa AI** | `Sparkles` (gradient) | يبدّل التاب الداخلي إلى Oryxa (يفتح الشات داخل الـ Panel — لا navigate) |
| 4 | **احصل على الدعم** | `LifeBuoy` | يفتح **شاشة "احكِ لنا مشكلتك" داخل نفس Panel** (view جديد، ليس dialog) — نص افتتاحي + 4 prompts مقترحة + textarea. عند الإرسال → يُمرَّر النص لـ Oryxa عبر `addMessage` فيُجاب في تاب Oryxa (نفس backbone) |
| 5 | **الرسائل** | `MessageCircle` + badge unread | يبدّل التاب الداخلي إلى Messages (Messenger-style داخل Panel + رابط "افتح صندوق البريد كاملاً" → `/messages`) |
| 6 | **التقديم** | `FileText` | navigate `/account?tab=applications` ويغلق Panel |
| 7 | **الخدمات** | `Briefcase` (بدل CreditCard) | navigate `/services` ويغلق Panel |

## الـ Layout الجديد للـ Panel

```text
┌─────────────────────────────────┐
│  EN  ⤢  ✕                        │ TopBar (موجود)
├─────────────────────────────────┤
│  Hi {firstName}    🛡 موثّق      │ Greeting + green shield شرطي
├─────────────────────────────────┤
│  [الإعداد][الهوية][Oryxa][الدعم]│
│  [الرسائل][التقديم][الخدمات]     │ Categories grid (7 خانات)
├─────────────────────────────────┤
│                                 │
│  محتوى ديناميكي حسب الحالة:     │
│  • Default (none)               │
│    → نص ترحيب + Recent تذاكر    │
│  • activeTab=oryxa              │
│    → OryxaTab (موجود)           │
│  • activeTab=messages           │
│    → MessagesTab (موجود)        │
│  • activeView=getSupport        │
│    → GetSupportView (جديد)      │
│                                 │
└─────────────────────────────────┘
```

الـ grid يبقى ظاهراً دائماً أعلى المحتوى (حتى لو فُتح Oryxa أو Messages). للرجوع للـ default view، الضغط على الزر النشط مرة أخرى.

## الـ Get Support View (شاشة "احكِ لنا مشكلتك")

```text
┌──────────────────────────┐
│ ← رجوع                    │
│                          │
│ احكِ لنا ما هي مشكلتك      │
│ سيتولى فريقنا حلها فوراً    │
│                          │
│ [قد ترغب في السؤال:]       │
│  • كيف أوثّق هويتي؟          │
│  • مشكلة في الدفع           │
│  • سؤال عن جامعة            │
│  • تعديل بيانات الحساب       │
│                          │
│ [textarea: اكتب هنا...]   │
│                          │
│  [إرسال →]                │
└──────────────────────────┘
```

عند الإرسال:
1. يُحفَظ النص كرسالة user في `MalakChatContext` عبر `addMessage`
2. يتبدّل `activeTab` لـ `oryxa` تلقائياً
3. Oryxa ترد في نفس الشات (وأيضاً ستظهر في الشات الرئيسي `/about-oryxa` لأن الـ context مشترك — كما طلبت)

## الـ Identity Shield الأخضر

- يظهر بجوار الاسم في الـ Greeting **فقط إذا `status.identity_status === 'approved'`**
- أيقونة `ShieldCheck` بـ `text-success` (semantic token)
- أيقونة زر "الهوية" في الـ grid أيضاً تتلوّن أخضر إذا موثق

## هيكل الملفات

**جديد:**
- `src/components/portal/support/panel/PanelCategoriesGrid.tsx` — 7 أزرار بالـ mapping أعلاه (يستبدل QuickCategoriesGrid بالكامل في العرض)
- `src/components/portal/support/panel/GetSupportView.tsx` — شاشة "احكِ لنا مشكلتك" مع 4 prompts + textarea + إرسال

**معدّل:**
- `FloatingSupportPanel.tsx`:
  - حذف `<PanelTabs>` (التابات تُختار من الـ grid، لا tabs منفصلة)
  - إضافة state `activeView: 'default' | 'oryxa' | 'messages' | 'getSupport'`
  - عرض `<PanelCategoriesGrid>` دائماً + view الحالي تحته
  - إضافة green shield بجوار الاسم إذا `identityApproved`
- `PanelTabs.tsx` — يُحذَف من الاستخدام (الكود يبقى للأرشفة)

**locale keys جديدة (لكل 12 لغة):**
```
portal.support.panel.cats.settings: "الإعدادات"
portal.support.panel.cats.identity: "الهوية"
portal.support.panel.cats.oryxa: "Oryxa AI"
portal.support.panel.cats.getSupport: "احصل على الدعم"
portal.support.panel.cats.messages: "الرسائل"
portal.support.panel.cats.applications: "التقديم"
portal.support.panel.cats.services: "الخدمات"
portal.support.panel.identityVerified: "موثّق"
portal.support.panel.getSupport.title: "احكِ لنا ما هي مشكلتك"
portal.support.panel.getSupport.subtitle: "سيتولى فريقنا حلّها فوراً"
portal.support.panel.getSupport.suggestionsLabel: "قد ترغب في السؤال:"
portal.support.panel.getSupport.s1: "كيف أوثّق هويتي؟"
portal.support.panel.getSupport.s2: "مشكلة في الدفع"
portal.support.panel.getSupport.s3: "سؤال عن جامعة"
portal.support.panel.getSupport.s4: "تعديل بيانات الحساب"
portal.support.panel.getSupport.placeholder: "اكتب مشكلتك هنا..."
portal.support.panel.getSupport.send: "إرسال"
portal.support.panel.back: "رجوع"
```

## القواعد الحاكمة

1. **لا fake threads** — Messages من Supabase حصراً (موجود)
2. **Oryxa context مشترك** — رسالة "احصل على الدعم" تظهر في `/about-oryxa` أيضاً
3. **Identity green shield** فقط إذا `approved`، لا badge للحالات الأخرى
4. **زر الدفع → خدمات** — تغيير label + icon + route (`/services`)
5. **زر التقديم → `/account?tab=applications`** (لا route مستقل)
6. **زر الإعدادات → `/account?tab=settings`**
7. **زر الهوية → `/account?tab=overview` + scroll لقسم الهوية** (anchor `#identity`)
8. **12 لغة** لكل المفاتيح الجديدة
9. **semantic tokens** فقط (no hex)
10. **RTL** — الـ grid ينعكس طبيعياً عبر CSS direction

## ما لا يتغيّر

- Launcher (الزر العائم نفسه)
- TopBar (lang chip + expand + close)
- Greeting source (canonical-first من `useExtractedIdentity`)
- OryxaTab + MessagesTab (نفس السلوك الحالي بالكامل)
- IdentityActivationDialog
- مصدر unread count (`useCommUnreadCount`)
- جميع routes الموجودة

## قرار يحتاج تأكيدك قبل التنفيذ

**الـ Default view (قبل ضغط أي زر من الـ grid):**
- (أ) **Oryxa AI** فوراً (الشات يفتح تلقائياً) — كما اتفقنا سابقاً
- (ب) **شاشة hint فارغة** — "اختر من الأعلى للبدء"
- (ج) **آخر view استخدمه العميل** (يُحفَظ في localStorage)

موصى: **(أ)** — يطابق طلبك السابق "أول شي يظهر للعميل هوا شات اوريكسا".

