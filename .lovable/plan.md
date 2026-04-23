

# إعادة المحتوى الغني للصفحة الرئيسية + إعادة الكرة المتفاعلة (AnomalyOrb)

## ما سيتم استعادته (موجود في الكود وغير مستخدم حالياً)
الأقسام التالية موجودة كملفات سليمة لكن `Index.tsx` لا يستخدمها:
1. `AboutOryxaSection` — يحتوي على **AnomalyOrb** (هويتنا) + شبكة قدرات
2. `WhyChooseUsSection` — لماذا تختارنا (شبكة الخدمات)
3. `MoneyTransferSection` / `CSWCoinSection` — حسب الحاجة
4. `InstitutionsSection` — انضم كشريك
5. `OrxRankSection` — نظام التقييم ORX RANK
6. `UniversityCommunitySection` — مجتمع الطلاب والجامعات
7. `PartnersMarquee` — شريط الشركاء

## الترتيب الجديد المقترح (يدمج AG الحديث + المحتوى الغني)

```
Hero (كما هو)
─────────────────────────────────────
[غلاف AG الموحّد bg-[var(--ag-bg)]]
  1. AGStatement — بيان المهمة
  2. UniversityCommunitySection — مجتمع الطلاب والجامعات (صورة 1 أعلى)
  3. AboutOryxaSection — ★ AnomalyOrb هنا (هويتنا) + بطاقات القدرات
  4. WhyChooseUsSection — خدماتنا المميزة للطلاب (صورة 2)
  5. WorldMapSection — استكشف وجهات الدراسة (صورة 3)
  6. InstitutionsSection — انضم كشريك (صورة 2 أسفل)
  7. OrxRankSection — ORX RANK
  8. AGAnchorBand — CTA النهائي (يبقى كما هو)
```

## كيف نحترم التصميم الجديد (الثيم الموحّد)

1. **غلاف موحّد**: كل الأقسام داخل `<div className="bg-[var(--ag-bg)] text-[var(--ag-fg)]">` — لا فقفقة بين أبيض/أسود
2. **فواصل ناعمة**: `border-t border-[var(--ag-border)]` بين كل قسم بدل التباينات الحادة
3. **استبدال الخلفيات الصلبة في الأقسام المُستعادة**:
   - `bg-muted/30` و `bg-gradient-to-b from-muted/30...` → `bg-transparent` (يرث من الغلاف)
   - `text-foreground` يبقى (يستجيب للثيم تلقائياً)
   - `text-white` صريح (إن وجد) → `text-[var(--ag-fg)]`
4. **الكرة AnomalyOrb**: تعمل من `next-themes` بالفعل (تكتشف dark/light تلقائياً) — نضعها داخل `AboutOryxaSection` بحجم 220 كما كانت
5. **حركة الكشف**: الأقسام المُستعادة تستخدم `framer-motion` مع `whileInView` و`viewport={{ once: true }}` بالفعل — متوافق مع قاعدة "لا تبدأ كلها معاً"
6. **احترام `prefers-reduced-motion`**: framer-motion يحترمه افتراضياً

## الملفات التي ستتغيّر
1. **`src/pages/Index.tsx`** — تركيب جديد: استيراد lazy للأقسام المُستعادة + ترتيبها داخل غلاف AG مع فواصل
2. **`src/components/home/OrxRankSection.tsx`** — استبدال `bg-gradient-to-b from-muted/30` بـ `bg-transparent`
3. **`src/components/home/InstitutionsSection.tsx`** — استبدال `bg-muted/30` بـ `bg-transparent`
4. **`src/components/home/AboutOryxaSection.tsx`** — لا تغيير جوهري (AnomalyOrb موجود بالفعل)؛ إزالة أي خلفية محلية متعارضة إن وجدت
5. **`src/components/home/WhyChooseUsSection.tsx`**, **`UniversityCommunitySection.tsx`**, **`PartnersMarquee.tsx`** — مراجعة سريعة + إزالة خلفيات متعارضة فقط إن وُجدت

## خارج النطاق
- لا تعديل على `HeroSection`
- لا تعديل داخل `WorldMapSection` (غلاف خارجي فقط)
- لا تعديل داخل `AnomalyOrb` (يعمل بشكل صحيح مع الثيم)
- لا نصوص جديدة — كل المفاتيح موجودة بالفعل في `home.aboutOryxa.*`, `home.orx.*`, `home.institutions.*`, إلخ
- لا تغيير على `AGAnchorBand` أو الـ Footer

## معايير الإغلاق (Runtime)
- صفحة Index تعرض: مجتمع الطلاب + AnomalyOrb المتفاعلة + خدماتنا المميزة + الخريطة + ORX RANK + انضم كشريك
- التبديل بين النهاري/الليلي يلوّن كل قسم بشكل متناسق دون تداخل
- الكرة AnomalyOrb ظاهرة ومتحركة في قسم AboutOryxa
- لا حدود حادة بين الأقسام
- لا أخطاء console جديدة

