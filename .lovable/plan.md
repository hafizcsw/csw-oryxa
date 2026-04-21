

## الهدف
تبسيط الهيرو ليشبه واجهة Lovable: عنوان واحد + صندوق شات صغير مع placeholder متحرك (typewriter)، بدون الكرة/التصميم الحالي.

## التغييرات

### 1) `src/components/home/HeroSection.tsx`
- إزالة الخلفية المتدرجة الحالية (`bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500`).
- إزالة الـ `DeepSearchLayout` wrapper المعقد للـ initial state — يبقى فقط للـ deep search mode.
- خلفية بسيطة: `bg-background` مع لمسة aurora خفيفة جدًا (radial-gradient ناعم) أو خلفية نظيفة.
- العنوان فوق الصندوق: **"Let's find the best for you"** (مفتاح ترجمة جديد، 12-language ready).
- صندوق الشات صغير ومتمركز (max-w-2xl تقريبًا)، بدون الكروت المحيطة أو suggestions الظاهرة افتراضيًا.

### 2) `src/components/chat/MalakChatInterface.tsx`
- في الحالة الفارغة (لا رسائل) يُعرض فقط: **input box** + placeholder متحرك typewriter.
- إخفاء suggested prompts/cards/quick actions في الحالة الفارغة (تظهر فقط بعد أول تفاعل أو لا تظهر مطلقًا في الواجهة المبسّطة).
- compact styling: ارتفاع أقل، حدود ناعمة، shadow خفيف يشبه Lovable.

### 3) مكوّن جديد: `src/components/chat/TypewriterPlaceholder.tsx`
- يدوّر بين عبارات (rotating placeholder) كل 3-4 ثوانٍ بتأثير type/erase.
- العبارات من ملفات الترجمة (مصفوفة 4-5 جمل):
  - "ابحث عن ما يهم مستقبلك..."
  - "اكتشف أفضل الجامعات لك..."
  - "اسأل عن منحة، تخصص، أو دولة..."
  - "ابدأ رحلتك الأكاديمية الآن..."
- يحترم `prefers-reduced-motion` (يعرض جملة ثابتة).
- يدعم RTL/LTR تلقائيًا.

### 4) ملفات الترجمة (12 لغة)
- مفتاح جديد: `home.hero.title` = "Let's find the best for you"
- مفاتيح: `home.hero.placeholders.0..4` للعبارات الدوّارة
- إضافة في كل ملفات `src/locales/*.json` المتاحة.

### 5) ما يبقى كما هو
- `DeepSearchLayout` + `SearchResultsPanel` يعملان كالعادة بعد أول بحث.
- News Ticker, Compare Drawer, Floating launchers — بدون تغيير.
- منطق `MalakChatContext` بدون تغيير.

## الملفات المتأثرة
- ✏️ `src/components/home/HeroSection.tsx`
- ✏️ `src/components/chat/MalakChatInterface.tsx` (تبسيط empty state فقط)
- ➕ `src/components/chat/TypewriterPlaceholder.tsx`
- ✏️ `src/locales/*.json` (12 ملف لغة)

## خارج النطاق
- لا تغيير على منطق الشات/الـ API/الذاكرة المؤقتة (سبق إصلاحها).
- لا إضافة مكتبات (typewriter بـ React state خام).
- لا مساس بـ Brain Visualizer (سيُحذف من الهيرو ضمنيًا بحذف التصميم الحالي).

