import { Link } from "react-router-dom";
import { ADMIN_SECTIONS } from "@/config/adminConfig";
import { FileText, Key, Send, Bot, Flag, Gauge, BarChart3, AlertCircle, FileCheck, FileSignature, Image, MessageSquare, Users, Activity, Eye, Upload, GraduationCap } from "lucide-react";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useRealtimeVisitors } from "@/hooks/useRealtimeVisitors";
import { TopRoutesTable } from "@/components/admin/TopRoutesTable";
import { VisitorSparkline } from "@/components/admin/VisitorSparkline";
import { VisitorsCard } from "@/components/admin/VisitorsCard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminHome() {
  const { data, loading, error } = useAdminDashboard();
  const realtimeVisitors = useRealtimeVisitors();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  const S = data || {
    applications_new_24h: 0,
    p95_results_loaded_ms: 0,
    outbox_pending: 0,
    docs_pending: 0,
    contracts_draft: 0,
    slides_active: 0,
    slider_last_update: '',
    bot_events_24h: 0,
    visitors_24h: 0,
    visitors_7d: 0,
    active_now_5m: 0,
    pageviews_24h: 0,
    top_routes_24h: [],
    events_recent: [],
    queues: { outbox: [], docs: [], trans: [] }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(isRTL ? 'ar' : 'en');
  };

  return (
    <ProtectedRoute>
      <div dir={isRTL ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6 animate-fade-in w-full min-w-0">
        {/* Real-time Status Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card rounded-xl shadow-card border p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${loading ? 'bg-warning animate-pulse' : error ? 'bg-destructive' : 'bg-success'}`} />
            <span className="text-xs sm:text-sm font-medium">
              {loading ? t('admin.loading') : error ? t('admin.loadError') : t('admin.connectedRealtime')}
            </span>
          </div>
          {!loading && !error && (
            <span className="text-xs text-muted-foreground">{t('admin.lastUpdate')}: {formatTime(new Date())}</span>
          )}
        </div>

        {/* Material KPI Cards - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          <MaterialKpiCard 
            label={t('admin.newApplications')} 
            sublabel={t('admin.last24h')}
            value={loading ? "..." : S.applications_new_24h || 0}
            icon={FileText}
            gradient="from-primary to-primary-glow"
            iconBg="bg-primary"
          />
          <MaterialKpiCard 
            label={t('admin.performance')} 
            sublabel={t('admin.p95Results')}
            value={loading ? "..." : Math.round(S.p95_results_loaded_ms || 0)}
            icon={BarChart3}
            gradient="from-accent to-info"
            iconBg="bg-accent"
          />
          <MaterialKpiCard 
            label={t('admin.slidesActive')} 
            sublabel={t('admin.publishedSlides')}
            value={loading ? "..." : S.slides_active || 0}
            icon={Image}
            gradient="from-success to-success"
            iconBg="bg-success"
          />
          <MaterialKpiCard 
            label={t('admin.botEvents')} 
            sublabel={t('admin.last24h')}
            value={loading ? "..." : S.bot_events_24h || 0}
            icon={MessageSquare}
            gradient="from-violet-500 to-purple-500"
            iconBg="bg-violet-500"
          />
          <MaterialKpiCard 
            label={t('admin.pendingDocs')} 
            sublabel={t('admin.pending')}
            value={loading ? "..." : S.docs_pending || 0}
            icon={FileCheck}
            gradient="from-success to-success"
            iconBg="bg-success"
          />
          <MaterialKpiCard 
            label={t('admin.contracts')} 
            sublabel={t('admin.unsigned')}
            value={loading ? "..." : S.contracts_draft || 0}
            icon={FileSignature}
            gradient="from-secondary to-secondary"
            iconBg="bg-secondary"
          />
        </div>

        {/* SEO Visitors Card */}
        <VisitorsCard />

        {/* Visitor Analytics Cards - Responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-3">
            <MaterialKpiCard 
              label={t('admin.visitors24h')} 
              sublabel={t('admin.unique')}
              value={loading ? "..." : S.visitors_24h || 0}
              icon={Users}
              gradient="from-blue-500 to-cyan-500"
              iconBg="bg-blue-500"
            />
            <div className="bg-card rounded-xl p-2 sm:p-3 border hidden sm:block">
              <div className="text-xs text-muted-foreground mb-1">{t('admin.viewsActivity')} ({t('admin.lastHour')})</div>
              <VisitorSparkline hours={1} />
            </div>
          </div>
          
          <MaterialKpiCard 
            label={t('admin.visitors7d')} 
            sublabel={t('admin.unique')}
            value={loading ? "..." : S.visitors_7d || 0}
            icon={Users}
            gradient="from-indigo-500 to-blue-600"
            iconBg="bg-indigo-500"
          />
          
          <div className="relative">
            <MaterialKpiCard 
              label={t('admin.activeNow')} 
              sublabel={t('admin.liveUpdate')}
              value={realtimeVisitors.activeNow}
              icon={Activity}
              gradient="from-green-500 to-emerald-500"
              iconBg="bg-green-500"
            />
            <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'}`}>
              <div className="flex items-center gap-1 sm:gap-1.5 bg-green-500/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400">{t("admin.liveUpdate")}</span>
              </div>
            </div>
          </div>
          
          <MaterialKpiCard 
            label={t('admin.pageviews')} 
            sublabel={t('admin.last24h')}
            value={loading ? "..." : S.pageviews_24h || 0}
            icon={Eye}
            gradient="from-purple-500 to-pink-500"
            iconBg="bg-purple-500"
          />
        </div>

        {/* Top Routes Table */}
        <TopRoutesTable 
          routes={S.top_routes_24h || []} 
          loading={loading}
        />

        {/* Quick access to language course payment review */}
        <div className="bg-card rounded-xl shadow-card border p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">{language === 'ar' ? 'طلبات كورسات اللغات' : 'Language Enrollments'}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{language === 'ar' ? 'مراجعة إثباتات الدفع وتفعيل وصول الطلاب لقسم اللغات' : 'Review payment proofs and activate student access to language courses'}</p>
          </div>
          <Link to="/admin/language-enrollments" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <GraduationCap className="w-4 h-4" />
            {language === 'ar' ? 'فتح الطلبات' : 'Open Requests'}
          </Link>
        </div>

        {/* Quick Actions */}
        <QuickActionsSection t={t} language={language} />

        {/* Event Stream */}
        <EventStream events={S.events_recent} loading={loading} t={t} isRTL={isRTL} />
        
        {/* Queues */}
        <Queues data={S.queues} loading={loading} t={t} />

        {/* Admin Sections */}
        {ADMIN_SECTIONS.map((section) => (
          section.id !== "overview" && (
            <div key={section.id} className="bg-card rounded-xl sm:rounded-2xl shadow-card border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">{section.title}</h3>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="group relative overflow-hidden rounded-lg sm:rounded-xl border border-border bg-card p-4 sm:p-5 hover:shadow-lg hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative">
                      <div className="font-semibold text-sm sm:text-base text-foreground mb-1 sm:mb-2 group-hover:text-primary transition-colors">{item.title}</div>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed line-clamp-2">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </ProtectedRoute>
  );
}

function MaterialKpiCard({ label, sublabel, value, icon: Icon, gradient, iconBg }: { 
  label: string; 
  sublabel: string;
  value: any; 
  icon: any;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className="relative overflow-hidden bg-card rounded-xl sm:rounded-2xl shadow-card border group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 min-w-0">
      {/* Gradient Header */}
      <div className={`h-16 sm:h-24 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-20 sm:w-32 h-20 sm:h-32 rounded-full bg-white/10"></div>
        <div className="absolute -bottom-4 -left-4 w-16 sm:w-24 h-16 sm:h-24 rounded-full bg-white/10"></div>
        
        <div className="relative p-2 sm:p-4 flex items-start justify-between h-full">
          <div className="text-white min-w-0 flex-1">
            <p className="text-xs sm:text-sm opacity-90 font-medium truncate">{label}</p>
            <p className="text-[10px] sm:text-xs opacity-75 truncate">{sublabel}</p>
          </div>
          <div className={`${iconBg} p-1.5 sm:p-3 rounded-lg sm:rounded-xl shadow-lg backdrop-blur-sm bg-opacity-90 flex-shrink-0`}>
            <Icon className="w-3 h-3 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
      </div>
      
      {/* Value */}
      <div className="p-2 sm:p-4 bg-card">
        <div className="text-xl sm:text-3xl font-bold text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

function QuickActionsSection({ t, language }: { t: (key: string) => string; language: string }) {
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl shadow-card border p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">{t('admin.quickActions')}</h2>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
        <MaterialButton href="/admin/russian-universities-import" icon={Upload} label={t('admin.add30RussianUnis')} />
        <MaterialButton href="/admin/language-enrollments" icon={GraduationCap} label={language === "ar" ? "طلبات كورسات اللغات" : "Language Enrollments"} />
        <MaterialButton href="/admin/language-enrollments" icon={GraduationCap} label="Language Enrollments" />
        <MaterialButton href="/admin/integrations/crm" icon={Key} label={t('admin.crmKeys')} />
        <MaterialButton href="/admin/integrations/outbox" icon={Send} label={t('admin.outboxQueue')} />
        <MaterialButton href="/admin/telemetry" icon={Gauge} label={t('admin.telemetry')} />
        <MaterialButton href="/admin/feature-flags" icon={Flag} label={t('admin.featureFlags')} />
      </div>
    </div>
  );
}

function MaterialButton({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link 
      to={href}
      className="inline-flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all duration-300 hover:shadow-md text-xs sm:text-sm font-medium text-center"
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function EventStream({ events, loading, t, isRTL }: { events: any[]; loading: boolean; t: (key: string) => string; isRTL: boolean }) {
  const items = events || [];
  
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(isRTL ? 'ar' : 'en');
  };
  
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl shadow-card border overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-transparent p-3 sm:p-4 border-b">
        <h2 className="font-bold text-sm sm:text-base text-foreground">{t('admin.recentEvents')} ({t('admin.last2Hours')})</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.autoRefresh')}</p>
      </div>
      <div className="p-2 sm:p-4">
        <div className="overflow-x-auto max-h-[300px] sm:max-h-[360px]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t('admin.loading')}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t('admin.noEvents')}</div>
          ) : (
            <table className="w-full text-xs sm:text-sm min-w-[400px]">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className={`${isRTL ? 'text-right' : 'text-left'} p-2 sm:p-3 font-semibold`}>{t('admin.time')}</th>
                  <th className={`${isRTL ? 'text-right' : 'text-left'} p-2 sm:p-3 font-semibold`}>{t('admin.event')}</th>
                  <th className={`${isRTL ? 'text-right' : 'text-left'} p-2 sm:p-3 font-semibold`}>{t('admin.tabRoute')}</th>
                  <th className={`${isRTL ? 'text-right' : 'text-left'} p-2 sm:p-3 font-semibold`}>{t('admin.ms')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="p-2 sm:p-3 whitespace-nowrap">{formatTime(x.at)}</td>
                    <td className="p-2 sm:p-3">
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-primary/10 text-primary text-[10px] sm:text-xs font-medium">
                        {x.event}
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 text-muted-foreground truncate max-w-[120px]">{x.tab} / {x.route}</td>
                    <td className="p-2 sm:p-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium ${
                        (x.latency_ms > 500) ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                      }`}>
                        {x.latency_ms ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Queues({ data, loading, t }: { data: any; loading: boolean; t: (key: string) => string }) {
  const out = data?.outbox || [];
  const docs = data?.docs || [];
  const trans = data?.trans || [];
  
  return (
    <div>
      <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">{t('admin.queues')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <QueueTable 
          title={t('admin.outbox')}
          count={out?.length || 0}
          rows={out} 
          cols={["target", "event_type", "status"]} 
          loading={loading}
          color="primary"
          t={t}
        />
        <QueueTable 
          title={t('admin.pendingDocsQueue')}
          count={docs?.length || 0}
          rows={docs} 
          cols={["application_id", "doc_type"]} 
          loading={loading}
          color="warning"
          t={t}
        />
        <QueueTable 
          title={t('admin.translation')}
          count={trans?.length || 0}
          rows={trans} 
          cols={["doc_kind", "status"]} 
          loading={loading}
          color="accent"
          t={t}
        />
      </div>
    </div>
  );
}

function QueueTable({ title, count, rows, cols, loading, color, t }: { 
  title: string; 
  count: number;
  rows: any[]; 
  cols: string[]; 
  loading: boolean;
  color: string;
  t: (key: string) => string;
}) {
  const colorClasses = {
    primary: 'from-primary/10 to-transparent bg-primary/20 text-primary',
    warning: 'from-warning/10 to-transparent bg-warning/20 text-warning',
    accent: 'from-accent/10 to-transparent bg-accent/20 text-accent',
  }[color] || 'from-primary/10 to-transparent bg-primary/20 text-primary';
  
  const [gradientClass, badgeClasses] = colorClasses.split(' to-transparent ');
  
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl shadow-card border overflow-hidden">
      <div className={`bg-gradient-to-r ${gradientClass} to-transparent p-3 sm:p-4 border-b flex items-center justify-between`}>
        <h3 className="font-bold text-sm sm:text-base text-foreground">{title}</h3>
        <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${badgeClasses} text-[10px] sm:text-xs font-bold`}>
          {count}
        </span>
      </div>
      <div className="p-2 sm:p-4">
        <div className="overflow-x-auto max-h-[200px] sm:max-h-[260px]">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-xs sm:text-sm">{t('admin.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs sm:text-sm">{t('admin.noData')}</div>
          ) : (
            <table className="w-full text-xs sm:text-sm min-w-[250px]">
              <thead>
                <tr className="text-muted-foreground border-b">
                  {cols.map(c => <th key={c} className="text-right p-1.5 sm:p-2 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    {cols.map(c => (
                      <td key={c} className="p-1.5 sm:p-2 truncate max-w-[100px] sm:max-w-[150px]" title={String(r[c])}>
                        {String(r[c] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
