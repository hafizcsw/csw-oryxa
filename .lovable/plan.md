

## الهدف
إضافة تجربة حركة سلسة في الصفحة الرئيسية مستوحاة من **antigravity.google**:
1. **خلفية إضاءة تفاعلية (Aurora Spotlight)** تتبع الماوس بسلاسة كموجة ضوئية متعددة الألوان (Google Rainbow).
2. **حركة كشف نص هادئة** على عنوان الـ Hero (fade + slide + shimmer متدرج بألوان جوجل).
3. الحفاظ على البنية الحالية للهيرو (`HeroSection`, `MalakChatInterface`) دون كسرها.

---

## ما سيُبنى

### 1) مكوّن جديد: `src/components/home/AuroraBackground.tsx`
خلفية ثابتة (`absolute inset-0`) تحتوي:
- **طبقة Gradient Mesh** ساكنة بألوان الـ Brand + Google Rainbow (#4285F4, #EA4335, #FBBC04, #34A853) بـ `radial-gradient` ضبابية.
- **Spotlight يتبع الماوس**: عنصر `div` يتحرك عبر CSS variables `--mx` / `--my` تُحدّث من `mousemove` مع `requestAnimationFrame` + lerp (interpolation 0.08) لخلق تأثير "الموجة" المتأخرة السلسة.
- **Blob متعدد الطبقات** (3 blobs بأحجام مختلفة) يتحرك بسرعات مختلفة (parallax) لمحاكاة التموّج.
- Blur قوي (`blur-3xl`) + `mix-blend-screen` لذوبان الألوان.
- يعمل في الوضعين الفاتح والداكن.
- يحترم `prefers-reduced-motion` (يعطّل التتبع ويُبقي الخلفية الساكنة).

### 2) مكوّن جديد: `src/components/home/HeroRevealText.tsx`
- يستقبل `text` ويقسّمها حروفاً/كلمات.
- كل كلمة تظهر بـ stagger animation: `opacity 0 → 1` + `translateY 20px → 0` بمنحنى `cubic-bezier(0.22, 1, 0.36, 1)`.
- Cursor عمودي رفيع بتدرّج Google Rainbow يومض عند بداية النص (مثل antigravity تماماً).
- Shimmer خفيف يمر مرة واحدة على النص بعد ظهوره.

### 3) تعديل `src/components/home/HeroSection.tsx`
- استبدال الـ `bg-gradient` الحالي (`from-blue-500 via-purple-500 to-pink-500`) بمكوّن `<AuroraBackground />`.
- لفّ النص الترحيبي (إن وُجد فوق الشات) بـ `<HeroRevealText />`.
- الإبقاء على `MalakChatInterface` و `DeepSearchLayout` و News Ticker كما هي.
- إخفاء الخلفية التفاعلية تلقائياً عند دخول `isDeepSearchMode` لتقليل التشتيت.

### 4) ملف CSS: `src/styles/aurora.css`
- `@keyframes aurora-drift` لحركة blobs البطيئة (20s+).
- `@keyframes shimmer-sweep` لتأثير اللمعة على النص.
- `@keyframes cursor-blink-rainbow` لمؤشر العنوان.
- استيراد في `src/index.css`.

### 5) i18n
- مفاتيح ترجمة جديدة فقط إذا أُضيف نص ترحيبي جديد فوق الشات. وإلا — لا تغيير على ملفات اللغة (12-language readiness محفوظة).

---

## الجوانب التقنية الدقيقة

| الجانب | القرار |
|---|---|
| Mouse tracking | `useEffect` + `requestAnimationFrame` loop داخل `AuroraBackground`، lerp بمعامل 0.08 لتحقيق تأخر "الموجة". |
| الأداء | `will-change: transform`, `transform: translate3d`, `pointer-events: none` على كل طبقات الخلفية. |
| RTL | الخلفية لا تتأثر؛ النص في `HeroRevealText` يعكس direction بحسب `dir`. |
| Mobile | تعطيل التتبع تحت 768px (الإيماءة باللمس مكلفة)، الإبقاء على blobs المتحركة فقط. |
| الوصولية | `prefers-reduced-motion: reduce` → خلفية ساكنة، نص يظهر فوراً بدون stagger. |
| التوافق مع Theme | استخدام HSL tokens من `index.css` بجانب ألوان Google كـ accent overlays فقط. |

---

## الملفات المتأثرة
- ✏️ `src/components/home/HeroSection.tsx`
- ➕ `src/components/home/AuroraBackground.tsx`
- ➕ `src/components/home/HeroRevealText.tsx`
- ➕ `src/styles/aurora.css`
- ✏️ `src/index.css` (سطر import واحد)

لا تغييرات على: routing, contexts, API, i18n architecture, Brain Visualizer, FloatingSupportLauncher.

---

## خارج النطاق
- لن يُلمس `MalakChatInterface` أو منطق الشات.
- لن تُضاف مكتبات جديدة (لا GSAP/Three.js) — كل شيء بـ CSS + RAF خام.
- لن يُعدَّل News Ticker أو Compare Drawer.

