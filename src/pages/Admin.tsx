import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, FileText, BarChart3, Shield, Zap, UserPlus, Clock, Activity, MessageSquare, Eye, RefreshCw } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data, loading: dataLoading, error, reload } = useAdminDashboard();

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="w-16 h-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">غير مصرح</h2>
            <p className="text-muted-foreground">ليس لديك صلاحية الوصول إلى لوحة الإدارة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatLatency = (ms: number) => {
    if (!ms || ms === 0) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms: number) => {
    if (!ms || ms === 0) return 'text-muted-foreground';
    if (ms < 2000) return 'text-emerald-600 dark:text-emerald-400';
    if (ms < 5000) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">
            مرحباً في لوحة تحكم بوابة الطالب
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()} disabled={dataLoading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${dataLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">خطأ في تحميل البيانات: {error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Grid - Circular Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors Card */}
        <div className="flex flex-col items-center p-4 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-2 shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <p className="text-2xl font-bold">
            {dataLoading ? '--' : (data?.visitors_24h ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">الزوار</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{data?.active_now_5m ?? 0} الآن</span>
          </div>
        </div>

        {/* Registrations Card */}
        <div className="flex flex-col items-center p-4 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-2 shadow-lg">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <p className="text-2xl font-bold">
            {dataLoading ? '--' : (data?.registrations_24h ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">المسجلين الجدد</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {data?.registrations_7d ?? 0} هذا الأسبوع
          </p>
        </div>

        {/* Bot Speed Card */}
        <div className="flex flex-col items-center p-4 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-2 shadow-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {(data?.bot_responses_24h ?? 0) === 0 ? (
            <>
              <p className="text-lg font-medium text-muted-foreground">--</p>
              <p className="text-xs text-muted-foreground">سرعة البوت</p>
            </>
          ) : (
            <>
              <p className={`text-2xl font-bold ${getLatencyColor(data?.bot_avg_latency_ms ?? 0)}`}>
                {formatLatency(data?.bot_avg_latency_ms ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">سرعة البوت</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {data?.bot_responses_24h} رد
              </p>
            </>
          )}
        </div>

        {/* Documents Card */}
        <div className="flex flex-col items-center p-4 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-2 shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <p className="text-2xl font-bold">
            {dataLoading ? '--' : (data?.docs_pending ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">المستندات</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            قيد المراجعة
          </p>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chat Sessions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              محادثات الشات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{data?.chat_sessions_24h ?? 0}</p>
              <p className="text-sm text-muted-foreground">اليوم</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.chat_sessions_7d ?? 0} خلال الأسبوع
            </p>
          </CardContent>
        </Card>

        {/* Page Views */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              مشاهدات الصفحات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{data?.pageviews_24h ?? 0}</p>
              <p className="text-sm text-muted-foreground">اليوم</p>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              حالة النظام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-medium">متصل</p>
            </div>
            <div className="flex gap-2 mt-2">
              {(data?.outbox_pending ?? 0) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {data?.outbox_pending} بانتظار الإرسال
                </Badge>
              )}
              {(data?.contracts_draft ?? 0) > 0 && (
                <Badge variant="outline" className="text-xs">
                  {data?.contracts_draft} عقد مسودة
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Top Routes */}
      {data?.top_routes_24h && data.top_routes_24h.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أكثر الصفحات زيارة اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.top_routes_24h.map((route, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-sm font-mono text-muted-foreground">{route.route}</span>
                  <Badge variant="secondary">{route.pageviews}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
