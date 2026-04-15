// Admin Dashboard Configuration - Single source of truth
export interface AdminItem {
  id: string;
  title: string;
  desc: string;
  to: string;
  icon: string;
  kpiKey?: string;
  quickAdd?: boolean;
}

export interface AdminSection {
  id: string;
  title: string;
  items: AdminItem[];
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: []
  },
  {
    id: "operations",
    title: "Operations",
    items: [
      {
        id: "applications",
        title: "Applications",
        desc: "طلبات الطلاب",
        to: "/admin/applications",
        icon: "inbox",
        kpiKey: "apps_pending"
      },
      {
        id: "universities",
        title: "Universities",
        desc: "إدارة الجامعات",
        to: "/admin/universities-admin",
        icon: "school",
        kpiKey: "universities_count",
        quickAdd: true
      },
      // Programs removed - now managed inside University details page
      {
        id: "scholarships",
        title: "Scholarships",
        desc: "المنح الدراسية",
        to: "/admin/scholarships-admin",
        icon: "award",
        kpiKey: "scholarships_count",
        quickAdd: true
      },
      {
        id: "events",
        title: "Events",
        desc: "الفعاليات",
        to: "/admin/events-admin",
        icon: "calendar",
        kpiKey: "events_count",
        quickAdd: true
      },
      {
        id: "language-enrollments",
        title: "Language Enrollments",
        desc: "طلبات تسجيل دورات اللغات",
        to: "/admin/language-enrollments",
        icon: "graduation-cap",
        kpiKey: "language_enrollments_pending"
      }
    ]
  },
  {
    id: "catalog",
    title: "Catalog",
    items: [
      {
        id: "countries",
        title: "Countries",
        desc: "صفحات الدول وSEO",
        to: "/admin/countries",
        icon: "flag",
        kpiKey: "countries_count"
      },
      {
        id: "tuition-monitor",
        title: "Tuition Monitor",
        desc: "مراقبة الرسوم الدراسية",
        to: "/admin/tuition-monitor",
        icon: "dollar-sign",
        kpiKey: "tuition_changes_24h"
      },
      {
        id: "tuition-proposals",
        title: "Tuition Proposals",
        desc: "مقترحات تعديل الرسوم",
        to: "/admin/tuition-proposals",
        icon: "file-check",
        kpiKey: "tuition_proposals_pending"
      },
      {
        id: "scholarships-harvest",
        title: "Scholarships Harvest",
        desc: "حصاد المنح الدراسية",
        to: "/admin/scholarships-harvest",
        icon: "trophy"
      },
      {
        id: "testimonials",
        title: "Video Testimonials",
        desc: "مراجعات فيديو",
        to: "/admin/testimonials",
        icon: "video"
      }
    ]
  },
  {
    id: "ingestion",
    title: "Data Ingestion",
    items: [
      {
        id: "import-csv",
        title: "Import CSV",
        desc: "استيراد البيانات",
        to: "/admin/import-programs",
        icon: "file-up"
      },
      {
        id: "university-bot",
        title: "University Bot",
        desc: "جمع بيانات الجامعات",
        to: "/admin/ingestion/bot",
        icon: "bot"
      },
      {
        id: "ingestion-review",
        title: "Ingestion Review",
        desc: "مراجعة البيانات المجمعة",
        to: "/admin/ingestion/review",
        icon: "shield-check",
        kpiKey: "ingestion_pending"
      },
      {
        id: "harvest-studio",
        title: "استوديو الحصاد",
        desc: "إدارة ومراقبة عمليات الحصاد",
        to: "/admin/harvest-studio",
        icon: "bot",
        kpiKey: null
      },
      {
        id: "cwur-import",
        title: "CWUR Import",
        desc: "استيراد تصنيف CWUR 2025",
        to: "/admin/cwur-import",
        icon: "globe"
      },
      {
        id: "bulk-publish",
        title: "Bulk Publish",
        desc: "نشر جماعي من ملف Excel",
        to: "/admin/bulk-publish",
        icon: "rocket"
      }
    ]
  },
  {
    id: "integrations",
    title: "Integrations",
    items: [
      {
        id: "crm-keys",
        title: "CRM Keys",
        desc: "إعدادات ربط CRM",
        to: "/admin/integrations/crm",
        icon: "key"
      },
      {
        id: "crm-outbox",
        title: "CRM Outbox",
        desc: "طابور الإرسال",
        to: "/admin/integrations/outbox",
        icon: "send",
        kpiKey: "crm_pending"
      },
      {
        id: "integrations-monitor",
        title: "Integrations Monitor",
        desc: "مراقبة التكاملات",
        to: "/admin/integrations",
        icon: "activity"
      },
      {
        id: "integration-logs",
        title: "Integration Logs",
        desc: "سجلات التكاملات",
        to: "/admin/integration-logs",
        icon: "file-text"
      }
    ]
  },
  {
    id: "analytics",
    title: "Analytics & Health",
    items: [
      {
        id: "telemetry",
        title: "Telemetry Dashboard",
        desc: "أداء وتحويل",
        to: "/admin/telemetry",
        icon: "gauge"
      },
      {
        id: "analytics",
        title: "Analytics Reports",
        desc: "زيارات وCTR",
        to: "/admin/analytics-reports",
        icon: "bar-chart-3"
      },
      {
        id: "health",
        title: "System Health",
        desc: "حالة النظام",
        to: "/admin/health",
        icon: "activity"
      }
    ]
  },
  {
    id: "config",
    title: "Configuration",
    items: [
      {
        id: "features",
        title: "Feature Flags",
        desc: "تفعيل/تعطيل الميزات",
        to: "/admin/feature-flags",
        icon: "toggle-left"
      },
      {
        id: "settings",
        title: "System Settings",
        desc: "إعدادات عامة",
        to: "/admin/settings",
        icon: "settings"
      },
      {
        id: "users",
        title: "Users & Roles",
        desc: "أذونات ورولز",
        to: "/admin/users",
        icon: "users"
      },
      {
        id: "ai-assistant",
        title: "AI Assistant",
        desc: "مساعد الذكاء للإثراء",
        to: "/admin/ai-assistant",
        icon: "sparkles"
      }
    ]
  }
];

// Flat navigation for sidebar
export const ADMIN_NAV = [
  { to: "/admin", label: "Overview", icon: "layout-dashboard" },
  { to: "/admin/applications", label: "Applications", icon: "inbox" },
  { to: "/admin/universities-admin", label: "Universities", icon: "school" },
  // Programs removed - now managed inside University details page
  { to: "/admin/scholarships-admin", label: "Scholarships", icon: "award" },
  { to: "/admin/events-admin", label: "Events", icon: "calendar" },
  { to: "/admin/tuition-monitor", label: "Tuition Monitor", icon: "dollar-sign" },
  { to: "/admin/tuition-proposals", label: "Tuition Proposals", icon: "file-check" },
  { to: "/admin/scholarships-harvest", label: "Scholarships Harvest", icon: "trophy" },
  { to: "/admin/ingestion/bot", label: "University Bot", icon: "bot" },
  { to: "/admin/ingestion/review", label: "Ingestion Review", icon: "shield-check" },
  { to: "/admin/integrations/crm", label: "CRM Keys", icon: "key" },
  { to: "/admin/integrations", label: "Integrations", icon: "activity" },
  { to: "/admin/telemetry", label: "Telemetry", icon: "gauge" },
  { to: "/admin/settings", label: "Settings", icon: "settings" },
  { to: "/admin/language-enrollments", label: "Language Enrollments", icon: "graduation-cap" }
];
