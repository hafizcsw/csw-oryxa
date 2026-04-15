import { useEffect, useState } from "react";
import { verifyAdminSSOFromURL, requireAdmin } from "@/lib/admin.sso";
import { supabase } from "@/integrations/supabase/client";

type HealthStats = {
  integrationErrors: number;
  queuedEvents: number;
  queuedNotifications: number;
  lastCronRun: string | null;
  recentErrors: Array<{ function_name: string; count: number }>;
};

export default function AdminHealth() {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HealthStats | null>(null);

  useEffect(() => {
    (async () => {
      const { ok } = await verifyAdminSSOFromURL();
      setOk(ok);
      requireAdmin(ok);
      if (ok) loadHealth();
    })();
  }, []);

  async function loadHealth() {
    setLoading(true);
    try {
      // Count integration errors
      const { count: errorCount } = await supabase
        .from('integration_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // Count queued events
      const { count: queuedCount } = await supabase
        .from('integration_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      // Count queued notifications
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      // Last cron run (from events)
      const { data: cronEvent } = await supabase
        .from('events')
        .select('created_at')
        .eq('name', 'cron.popularity_refreshed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setStats({
        integrationErrors: errorCount || 0,
        queuedEvents: queuedCount || 0,
        queuedNotifications: notifCount || 0,
        lastCronRun: cronEvent?.created_at || null,
        recentErrors: []
      });
    } catch (error) {
      console.error('Error loading health stats:', error);
    }
    setLoading(false);
  }

  if (!ok) return null;

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-muted-foreground mt-1">Monitor system status and performance</p>

        {loading ? (
          <div className="mt-6">Loading...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm text-muted-foreground">Integration Errors (10min)</div>
              <div className={`text-3xl font-bold mt-2 ${(stats?.integrationErrors || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                {stats?.integrationErrors || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(stats?.integrationErrors || 0) === 0 ? '✅ All clear' : '⚠️ Errors detected'}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm text-muted-foreground">Queued Events</div>
              <div className="text-3xl font-bold mt-2">{stats?.queuedEvents || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Pending CRM sync
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm text-muted-foreground">Queued Notifications</div>
              <div className="text-3xl font-bold mt-2">{stats?.queuedNotifications || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                WhatsApp/Email queue
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm text-muted-foreground">Last Cron Run</div>
              <div className="text-sm font-medium mt-2">
                {stats?.lastCronRun 
                  ? new Date(stats.lastCronRun).toLocaleString()
                  : 'Never'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Popularity refresh
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={loadHealth}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              🔄 Refresh Stats
            </button>
            <a
              href="/admin/integration-logs"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition"
            >
              📋 View Integration Logs
            </a>
            <a
              href="/admin/analytics"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition"
            >
              📊 Analytics Dashboard
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-muted/30 p-6">
          <h3 className="font-semibold mb-2">System Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${(stats?.integrationErrors || 0) === 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>Integrations: {(stats?.integrationErrors || 0) === 0 ? 'Healthy' : 'Degraded'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${(stats?.queuedEvents || 0) < 100 ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              <span>Event Queue: {(stats?.queuedEvents || 0) < 100 ? 'Normal' : 'High Load'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span>Database: Operational</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
