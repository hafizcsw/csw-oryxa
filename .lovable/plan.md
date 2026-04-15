

# دمج البيانات + الجاهزية + المستندات + جودة الملف في صفحة واحدة متصلة

## التصميم

صفحة واحدة بعنوان **"ملفي الدراسي"** — بدون تبويبات فرعية — كل الأقسام مرصوصة فوق بعض في scroll واحد:

```text
┌─────────────────────────────────────────────┐
│  📂 ملفي الدراسي                            │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  1. جودة الملف (Score + Gates)      │    │
│  │     FileQualityCard + Gate + Gaps   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  2. البيانات الشخصية               │    │
│  │     ProfileTab                      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  3. الجاهزية                        │    │
│  │     ReadinessTab                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  4. المستندات                       │    │
│  │     DocumentsTab                    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## التغييرات

### 1. مكون جديد: `StudyFileTab.tsx`
- صفحة واحدة متصلة (لا تبويبات فرعية)
- ترتيب عمودي: FileQuality → Profile → Readiness → Documents
- كل قسم مفصول بعنوان فرعي (h2) وفاصل بصري
- يستقبل نفس props من Account.tsx

### 2. AccountSidebar.tsx
- حذف `profile`, `readiness`, `documents` من `STUDY_ITEMS`
- إضافة عنصر واحد `study-file` بأيقونة `FolderOpen`

### 3. AccountMobileNav.tsx
- نفس التغيير: استبدال الثلاثة بعنصر واحد `study-file`

### 4. Account.tsx
- حذف `case 'profile'`, `case 'readiness'`, `case 'documents'` المنفصلة
- إضافة `case 'study-file'` يعرض `StudyFileTab`
- إعادة توجيه URLs القديمة تلقائياً إلى `?tab=study-file`

### 5. DashboardOverview.tsx
- حذف قسم File Quality بالكامل (انتقل إلى StudyFileTab)

### 6. TabNavigation.tsx
- تحديث `STUDY_ORDER`: استبدال `profile`, `readiness`, `documents` بـ `study-file`

### 7. الترجمة
- إضافة مفتاح `portal.sidebar.myStudyFile` في ملفات الـ 12 لغة

## ما لن يتغير
- محتوى ProfileTab, ReadinessTab, DocumentsTab الداخلي — يبقى كما هو
- منطق حساب FileQuality

