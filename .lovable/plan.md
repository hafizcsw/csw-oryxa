

## المشكلة

البنية التحتية للكاش موجودة بالفعل (`geo_cache` + edge function `geo-resolve`) لكنها تعمل فقط على **المدن** (385 مدخل). الجامعات (36,960 بدون إحداثيات) لا يتم حلها أو تخزينها أبداً. عند تصفح الخريطة، كل عميل يجلب نفس البيانات من الصفر.

## الحل: كاش دائم على مستوى السيرفر (مشترك بين جميع العملاء)

### 1. تفعيل حل إحداثيات الجامعات تلقائياً عند التصفح

**ملف: `src/hooks/useGeoCacheResolver.ts`** — توسيعه ليحل إحداثيات الجامعات أيضاً وليس المدن فقط:

- عند دخول مدينة وظهور جامعات بدون `geo_lat/geo_lon`، يتم إرسالها للـ edge function `geo-resolve` مع `entity_type: 'university'`
- النتائج تُحفظ في `geo_cache` (الجدول الموجود) — أول عميل يزور المدينة يحل الإحداثيات، كل عميل بعده يجدها جاهزة فوراً

### 2. كتابة الإحداثيات المحلولة للجامعات في جدول `universities`

**ملف: `supabase/functions/geo-resolve/index.ts`** — عند حل إحداثيات جامعة:

```
// بعد حفظها في geo_cache، أيضاً حدّث جدول universities
if (entry.entity_type === 'university' && entry.entity_id && lat !== 0) {
  await srv.from('universities').update({
    geo_lat: lat, geo_lon: lon, geo_source: source
  }).eq('id', entry.entity_id);
}
```

هذا يعني أن المرة القادمة، الـ RPC `rpc_map_city_universities` يرجع الإحداثيات مباشرة بدون الحاجة للكاش.

### 3. تمديد صلاحية كاش React Query

**ملف: `src/hooks/useMapData.ts`** — تغيير `staleTime` من `60_000` إلى `30 * 60_000` وإضافة `gcTime: 60 * 60_000`:

- البيانات تبقى في ذاكرة المتصفح 30 دقيقة بدون إعادة جلب
- تبقى في الذاكرة 60 دقيقة حتى بعد مغادرة صفحة الخريطة
- هذا كاش محلي إضافي فقط — مصدر الحقيقة هو قاعدة البيانات

### 4. إيقاف إعادة الجلب عند العودة للتبويب

**ملف: `src/App.tsx`** — إضافة `refetchOnWindowFocus: false` في إعدادات `QueryClient`

### 5. كاش GeoJSON في `sessionStorage`

**ملف: `src/components/home/WorldMapLeaflet.tsx`** — حفظ حدود الدول (GeoJSON) في `sessionStorage` بدل تحميلها كل مرة

## الخلاصة

```text
العميل الأول يزور موسكو:
  → يجلب 478 جامعة من RPC
  → 461 بدون إحداثيات → يرسلها لـ geo-resolve
  → Nominatim يحل → تُحفظ في geo_cache + universities table
  → العرض يكتمل

العميل الثاني يزور موسكو:
  → يجلب 478 جامعة من RPC → الإحداثيات موجودة مسبقاً
  → لا حاجة لـ geo-resolve → عرض فوري
```

**الملفات المتغيرة:**
- `src/hooks/useGeoCacheResolver.ts` — إضافة حل الجامعات
- `supabase/functions/geo-resolve/index.ts` — كتابة النتائج في `universities` table
- `src/hooks/useMapData.ts` — تمديد `staleTime` + `gcTime`
- `src/App.tsx` — `refetchOnWindowFocus: false`
- `src/components/home/WorldMapLeaflet.tsx` — كاش GeoJSON

**لا جداول جديدة** — كل شيء يستخدم البنية الموجودة (`geo_cache` + `universities.geo_lat/geo_lon`).

