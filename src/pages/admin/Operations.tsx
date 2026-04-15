import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, XCircle, Activity, Shield } from "lucide-react";

export default function Operations() {
  const queryClient = useQueryClient();

  // Fetch system flags
  const { data: flagsData } = useQuery({
    queryKey: ["system-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-flags-get");
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Fetch system health
  const { data: healthData } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("alerts-heartbeat");
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Toggle flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-flags-set", {
        body: { key, enabled },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.key} ${variables.enabled ? "enabled" : "disabled"}`);
      queryClient.invalidateQueries({ queryKey: ["system-flags", "system-health"] });
    },
    onError: (error) => {
      toast.error(`Failed to toggle flag: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      default:
        return <XCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const flags = flagsData?.flags || [];
  const health = healthData?.health || {};
  const alerts = healthData?.alerts || [];
  const status = healthData?.status || "unknown";

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Operations Control</h1>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
        </div>

        {/* System Health Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Harvest Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{health.harvest?.pending_jobs || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {health.harvest?.running_jobs || 0} running · {health.harvest?.failed_jobs || 0} failed
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outbox</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{health.outbox?.pending || 0}</div>
                <div className="text-xs text-muted-foreground">{health.outbox?.errors || 0} errors</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{health.alerts?.unacknowledged || 0}</div>
                <div className="text-xs text-destructive">
                  {health.alerts?.critical || 0} critical
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-success animate-pulse" />
                <span className="text-sm">Monitoring Active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Alerts */}
        {healthData?.critical_issues && healthData.critical_issues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Critical Issues Detected:</div>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {healthData.critical_issues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle>System Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {flags.map((flag: any) => (
                <div key={flag.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(enabled) =>
                        toggleFlagMutation.mutate({ key: flag.key, enabled })
                      }
                      disabled={toggleFlagMutation.isPending}
                    />
                    <div>
                      <div className="font-medium">{flag.key.replace(/_/g, " ")}</div>
                      {flag.config && Object.keys(flag.config).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {JSON.stringify(flag.config)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={flag.enabled ? "default" : "secondary"}>
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No unacknowledged alerts</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert: any) => (
                  <Alert key={alert.id} variant={alert.level === "critical" ? "destructive" : "default"}>
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{alert.source}</div>
                          <div className="text-sm">{alert.message}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(alert.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge>{alert.level}</Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
