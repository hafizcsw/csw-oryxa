

## الفهم
نبني `BrainIngestionVisualizer` كنظام بصري stateful متكامل (ليس loader) يعبّر عن رحلة الملف: Upload → Scan → Extract → Transfer عبر القنوات الخارجية → Brain fill-up → Complete. الأصل: `src/assets/brain-anatomical.svg` الموجود فعلياً، نعيد تفكيكه لطبقات قابلة للتحكم.

## استكشاف مطلوب قبل التنفيذ
1. قراءة `src/assets/brain-anatomical.svg` لفهم بنيته (هل paths منفصلة قابلة للتجميع semantic؟ أم مسار واحد؟).
2. قراءة `src/components/documents/AIDataFlowHero.tsx` الحالي لفهم نقاط الربط مع upload pipeline (`files`, `status`, `lobeForFileName`).
3. تحديد كيف يُستدعى `AIDataFlowHero` (props الحالية) ليبقى التكامل سلساً.

## التصميم المعماري

### 1. هيكل الملفات الجديد
```
src/components/intelligence/
  BrainIngestionVisualizer.tsx       (المكوّن الرئيسي — inline SVG كامل)
  BrainIngestionVisualizer.types.ts  (الأنواع: Stage, Props)
  useBrainIngestionAnimation.ts      (hook يحول stage+progress → motion values)
  brain-ingestion.css                (CSS vars + keyframes للأداء)
src/utils/
  mapUploadPipelineToBrainStage.ts   (adapter من upload state → BrainIngestionStage)
```

### 2. State machine (7 حالات)
```ts
type BrainIngestionStage = 
  'idle' | 'uploading' | 'scanning' | 'extracting' 
  | 'interpreting' | 'complete' | 'error';
```

### 3. بنية الـ SVG المعاد تنظيمها (inline داخل المكوّن)
```
<svg>
  <defs>
    - linearGradient: stream-gradient (cool→warm)
    - radialGradient: brain-fill-gradient
    - radialGradient: completion-aura
    - filter: soft-glow (feGaussianBlur محسوب)
    - clipPath: brain-silhouette (المسار الخارجي للعقل)
    - mask: brain-region-masks (6 segments)
  </defs>

  <g id="layer-1-base-geometry">       — العقل الشفاف الأساسي (دائماً مرئي)
  <g id="layer-2-branch-skeleton">     — الفروع الخارجية باهتة (دائماً)
  <g id="layer-3-active-streams">      — الفروع المضيئة (stroke-dashoffset animated)
    <g id="branches-tier-outer">
    <g id="branches-tier-mid">
    <g id="branches-tier-terminal">
  <g id="layer-4-nodes">               — العقد المضيئة sequential
  <g id="layer-5-inflow-bridges">      — جسور دخول العقل
  <g id="layer-6-brain-fill" clip-path="url(#brain-silhouette)">
    <g id="region-left-lower">
    <g id="region-left-mid">
    <g id="region-left-upper">
    <g id="region-right-lower">
    <g id="region-right-mid">
    <g id="region-right-upper">
    <g id="region-core-seam">
  <g id="layer-7-completion-glow">     — هالة الاكتمال
  <g id="file-node">                   — بطاقة الملف + pulse
</svg>
```

### 4. منطق التحريك (CSS vars driven للأداء)
```ts
// useBrainIngestionAnimation.ts
{
  branchActivation: 0..1,   // كم فرع مضيء
  streamIntensity: 0..1,    // سرعة/سطوع التدفق
  brainFill: 0..1,          // نسبة fill داخل العقل
  stableGlow: 0|1,          // هالة الاكتمال
  errorDampening: 0|1,      // وضع الخطأ
}
```
تُحقن كـ CSS custom properties على root → keyframes تستهلكها بدون React re-renders.

### 5. Progress mapping (segment thresholds)
```
0–10%   : file wake-up + outer nodes تستيقظ
10–35%  : outer + mid branches تضيء بالتتابع
35–65%  : terminal branches + bridges تنقل البيانات
65–90%  : brain regions تمتلئ (lower→mid→upper, left&right متوازيين)
90–100% : core seam + completion glow stable
```

### 6. Adapter للربط مع upload pipeline الحالي
```ts
// mapUploadPipelineToBrainStage.ts
mapPipelineToBrainStage({ uploadStatus, parseStatus, progress })
  → { stage, progress }
```
يقرأ من نفس مصدر `files[]` الحالي في `AIDataFlowHero` (status: 'idle'|'active'|'done'|'failed') ويحوّله للـ 7 stages.

### 7. التكامل مع `AIDataFlowHero`
- نُبقي `AIDataFlowHero` كـ orchestrator (يعرض البطاقات + الموصلات).
- نستبدل البلوك الحالي للعقل (`<image brain-anatomical.svg>` + الطبقات الداخلية) بـ `<BrainIngestionVisualizer stage={derivedStage} progress={derivedProgress} />`.
- نشتق `stage`/`progress` من `files[]` عبر الـ adapter.

### 8. الألوان (من design tokens فقط)
- cool: `hsl(var(--primary))` (أزرق سماوي)
- warm: `hsl(var(--accent))` أو tone ذهبي من النظام
- error: desaturated amber (لا أحمر صاخب)
- لا hex hardcoded — كل شيء عبر CSS vars الموجودة في `index.css`.

### 9. i18n + a11y
- صفر نص hardcoded داخل المكوّن. `fileLabel` يأتي من خارج (parent يستخدم `t()`).
- `aria-hidden="true"` على SVG (decorative).
- `prefers-reduced-motion` → تعطيل keyframes، يبقى static visualization مع stage indication بصرية بسيطة (opacity step فقط).
- 12-language ready: لا strings داخل المكوّن.

### 10. الأداء
- `memo` على المكوّن.
- CSS vars بدلاً من Framer Motion لكل path (نستخدم Framer فقط للـ orchestration على مستوى الطبقات، ~7 motion elements لا أكثر).
- `will-change` محدود على الطبقات النشطة فقط.
- Staged activation: لا نحدّث كل path كل frame.

### 11. Error state
- خفض opacity العام إلى 0.6 تدريجياً (transition 600ms).
- تجميد brainFill عند قيمته الحالية (لا يكتمل).
- إضافة amber tint خفيف على completion-glow layer (desaturated، opacity 0.3 max).
- بعض nodes تنطفئ بالتتابع (stagger 80ms).

## ملفات سنعدّلها
| ملف | الإجراء |
|---|---|
| `src/components/intelligence/BrainIngestionVisualizer.tsx` | جديد |
| `src/components/intelligence/BrainIngestionVisualizer.types.ts` | جديد |
| `src/components/intelligence/useBrainIngestionAnimation.ts` | جديد |
| `src/components/intelligence/brain-ingestion.css` | جديد |
| `src/utils/mapUploadPipelineToBrainStage.ts` | جديد |
| `src/components/documents/AIDataFlowHero.tsx` | استبدال بلوك العقل بالمكوّن الجديد + استدعاء الـ adapter |
| `src/assets/brain-anatomical.svg` | يبقى كما هو (مرجع بصري للـ silhouette) |

## معايير القبول (QA)
1. Idle: عقل شفاف، فروع باهتة، صفر تدفق.
2. Uploading: file node ينبض، outer nodes تستيقظ.
3. Scanning: outer+mid branches تحمل تدفقات لونية واضحة الاتجاه inward.
4. Extracting: terminal branches + bridges مضيئة، أول regions تبدأ تمتلئ.
5. Interpreting: brain fill ينتشر من lower→upper بشكل region-by-region.
6. Complete: full luminous state + هالة مستقرة + خفوت الحركة السريعة.
7. Error: خفوت محترم، لا اكتمال، tint محدود.
8. تغيير `progress` من 0→100 يعكس fill حقيقي (ليس cosmetic).
9. `prefers-reduced-motion` → static gracefully.
10. صفر hardcoded text، 12-language ready.
11. لا regression في `AIDataFlowHero` (البطاقات والموصلات تعمل).

## ملاحظة حول الـ SVG الأصلي
الـ `brain-anatomical.svg` الحالي قد يكون paths كثيرة غير مصنفة. الخطة: نستخدمه كـ **base layer** فقط (مرجع silhouette + تفاصيل تشريحية باهتة)، ونبني فوقه الطبقات 2–7 يدوياً بـ paths/shapes منظمة semantic. هذا أسرع وأنظف من محاولة auto-classify كل path في الأصل.

