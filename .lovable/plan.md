

## الهدف

إعادة تصميم الـ Floating Support Panel ليطابق إحساس Binance في الـ screenshot، مع الحفاظ على honesty الوظيفية المتفق عليها (لا chat حي، لا fake threads).

## مرجع Binance (من الصورة)

```text
┌─────────────────────────────────┐
│  🌐  ↗                          │  ← top bar minimal (lang + expand)
│                                 │
│  Hi {name}              🟡     │  ← greeting كبير + mascot/avatar
│  Welcome To {brand} Support     │
│                                 │
│  ┌───────────────────────────┐  │
│  │  ⚡   🛡   💳   👥        │  │  ← Quick categories grid 4×2
│  │  ID   Acc  Pay  Fiat       │  │     icons فوق + label تحت
│  │  📈   👜   💼   ▦         │  │
│  │  Trade Wal  Fin  More      │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ KYC Verification        > │  │  ← status card مع carousel dots
│  │ ▓▓░░ 1/3                  │  │
│  │ Basic Verification       │  │
│  │ Unsuccessful   [Reason]  │  │
│  │     • • •                 │  │
│  └───────────────────────────┘  │
│                                 │
│  You May Want To Ask            │  ← FAQ list مرقّمة
│  1  ........................    │
│  2  ........................    │
│  ...                            │
│  View more ⌄                   │
│                                 │
├─────────────────────────────────┤
│  [ 🎧  Get Support ]            │  ← CTA full-width sticky
└─────────────────────────────────┘
```

## التغييرات الحاكمة عن النسخة الحالية

| الجانب | الحالي | الجديد (Binance-like) |
|---|---|---|
| Top bar | Header كبير + title + close + expand | Minimal: language hint icon + expand + close فقط، بدون title |
| Greeting | section صغيرة | Hero block: `text-3xl font-bold` + subtitle + decorative mascot circle |
| Categories | 4 chips أفقية بـ grid 2×2 | **Grid 4×2 = 8 عناصر**, icon فوق + label تحت، layout بطاقة واحدة بيضاء |
| Identity card | rounded card مع border accent جانبي | Card مسطّحة + progress bar صغير + chip "Reason" يميناً + carousel dots سفلية |
| FAQ | غير موجود | **قسم جديد** "You May Want To Ask" بترقيم ملوّن + "View more" |
| Recent tickets | list dots + relative time | يُنقَل تحت FAQ بشكل أكثر هدوءًا، أو يُدمَج كـ tab toggle |
| Footer CTA | زر primary | يبقى لكن مع icon headset كبير + label "Get Support" قوي |

## هيكل الملفات

**جديد:**
- `src/components/portal/support/panel/PanelHero.tsx` — greeting + mascot + welcome
- `src/components/portal/support/panel/PanelTopBar.tsx` — يحلّ محل PanelHeader (minimal)
- `src/components/portal/support/panel/QuickCategoriesGrid.tsx` — 8-cell grid يحلّ محل SupportQuickCategories
- `src/components/portal/support/panel/IdentityProgressCard.tsx` — variant جديد بـ progress + reason chip + dots
- `src/components/portal/support/panel/FAQSuggestionsList.tsx` — قائمة مرقّمة + view more
- `src/components/portal/support/panel/PanelStickyFooter.tsx` — Get Support CTA

**معدّل:**
- `src/components/portal/support/FloatingSupportPanel.tsx` — ترتيب الأقسام الجديد + إزالة sections القديمة
- `src/components/portal/support/SupportSubmitDialog.tsx` — يقبل defaultMessage إذا اخترنا FAQ → prefill

**يُحذف من العرض (لكن يبقى الكود لإعادة استخدام لاحق):**
- `PanelGreeting.tsx` (يحلّ محله PanelHero)
- `PanelHeader.tsx` (يحلّ محله PanelTopBar)
- `PanelLinksRow.tsx` (Messages/Oryxa يُدمَجان كـ 2 cells في QuickCategoriesGrid)

## القواعد الحاكمة المحفوظة

1. **No live chat illusion** — لا dots خضراء، لا "online", لا "typing"، لا agent avatar
2. **Recent tickets honesty** — لا chevrons، لا hover افتح
3. **Identity reason** — يبقى locale-mapped، لا raw codes
4. **FAQ items** — كل واحد click → يفتح SupportSubmitDialog مع subject prefilled (ليست articles مزيفة)
5. **12-language** — كل مفتاح جديد يُضاف لكل 12 ملف locale
6. **No hex colors** — `--primary`, `--warning`, `--success`, `--destructive` فقط
7. **Mascot circle** — decorative gradient blob (`bg-gradient-to-br from-primary/30 to-primary/10`) + headset icon — لا صور binary، لا mascot من Binance

## QuickCategoriesGrid — 8 عناصر

| # | Icon | Label key | Action |
|---|---|---|---|
| 1 | ShieldCheck | `categories.identity` | Submit dialog: identity |
| 2 | Lock | `categories.account_security` | Submit dialog: account |
| 3 | CreditCard | `categories.payment` | Submit dialog: payment |
| 4 | FileText | `categories.application` | Submit dialog: application |
| 5 | GraduationCap | `categories.programs` | Submit dialog: programs |
| 6 | Wrench | `categories.technical` | Submit dialog: technical |
| 7 | MessageSquare | `categories.messages` | Navigate `/messages` |
| 8 | Sparkles | `categories.oryxa` | Navigate `/about-oryxa` |

→ Messages و Oryxa يصبحان جزءًا من الشبكة بدلاً من صف منفصل (يطابق Binance "More Features").

## IdentityProgressCard

- Header: `KYC Verification` + chevron يميناً (decorative، لا navigation الآن)
- Progress: شريط رفيع `h-1.5 rounded-full bg-muted` + filled portion بلون الحالة
  - none: 0/3
  - pending: 1/3
  - reupload: 2/3
  - approved: 3/3
  - rejected: 1/3 (warning color)
- Status text: title من variant config
- Reason chip: يظهر فقط في rejected/reupload — `bg-warning/15 text-warning rounded-md px-2 py-1 text-xs font-medium` + click → opens IdentityActivationDialog
- Carousel dots: 3 dots ثابتة سفلية (decorative، تطابق Binance — تشير للـ 3 خطوات)

## FAQSuggestionsList

- Header: `text-xs uppercase text-muted-foreground` "You May Want To Ask"
- 6 items مرقّمة:
  - Number badge: `text-primary text-sm font-semibold w-5`
  - Label: من locale `faq.q1` … `faq.q6`
  - Click → `SupportSubmitDialog` مع `defaultSubjectKey` + `defaultMessage` prefilled من FAQ key
- Divider خفيف `border-b border-border/40` بين items
- "View more ⌄" button أسفله (للمرحلة الحالية: يفتح dialog "general" — لا route حقيقي)

## Motion plan

- **Hero mascot:** breathing animation `scale: [1, 1.04, 1]` بـ duration 4s infinite (reduced-motion aware)
- **Categories cells:** stagger entrance `delay: i * 0.03`
- **Identity progress bar:** width animate من 0 → target بـ duration 0.6s
- **Carousel dots:** static (decorative)
- **FAQ items:** stagger fade-in
- **No card hover scale** — فقط `bg` transition

## Locale namespace جديد

```
portal.support.panel.welcomeTo: "Welcome to {{brand}} support"
portal.support.panel.kycTitle: "KYC Verification"
portal.support.panel.kycReasonChip: "Reason"
portal.support.panel.kycStep: "{{current}}/{{total}}"
portal.support.panel.faqTitle: "You may want to ask"
portal.support.panel.faqViewMore: "View more"
portal.support.panel.getSupport: "Get support"
portal.support.categories.account_security: "Account security"
portal.support.categories.programs: "Programs & fit"
portal.support.categories.messages: "Messages"
portal.support.categories.oryxa: "Oryxa AI"
portal.support.faq.q1: "How do I verify my identity?"
portal.support.faq.q2: "How do I update my passport?"
portal.support.faq.q3: "How do I track my application?"
portal.support.faq.q4: "How do I change my address?"
portal.support.faq.q5: "What payment methods are supported?"
portal.support.faq.q6: "How do I download my documents?"
```

→ يُضاف لكل ملفات الـ 12 لغة: `ar, bn, de, en, es, fr, hi, ja, ko, pt, ru, zh`

## Visual behavior

- **Desktop width:** يبقى 400px (collapsed) / 520px (expanded) — Binance feel أكثر بـ 400
- **Mobile:** نفس bottom-sheet 88vh
- **Background sections:** كل قسم card أبيض `bg-card` على خلفية panel هادئة `bg-muted/20` — يطابق Binance المنفصل البصري بين الأقسام
- **Border radius:** `rounded-2xl` للـ cards الداخلية، `rounded-3xl` للـ panel الخارجي
- **Spacing:** `gap-3` بين cards، `p-4` داخل cards

## ما لا يتغيّر

- Launcher button نفسه (نفس badge logic)
- IdentityActivationDialog
- SupportSubmitDialog (نضيف فقط `defaultMessage` optional prop)
- useSupportTickets / useIdentityStatus
- PortalAuthFloater gating
- Recent tickets data path (لكن العرض يصبح أبسط أو يُؤجَّل لـ tab)

## قرار يحتاج تأكيدك قبل التنفيذ

**Recent tickets:** هل:
- (أ) **يُحذَف من Panel** (Binance لا يعرضها هنا، يفتحها عبر "Get Support") — الأنظف
- (ب) **يبقى تحت FAQ** كقسم هادئ بـ max 3 items
- (ج) **tab toggle** أعلى Panel بين "Home" و "My tickets"

موصى: **(أ)** — يطابق Binance + يقلّل cognitive load + الـ tickets موجودة في `/messages` route.

