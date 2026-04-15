// ============================================================================
// LEGACY: This integration monitor is currently NOT USED.
// ============================================================================
// The primary CRM integration is done via Supabase Functions:
//   - CRM_FUNCTIONS_URL: https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1
//   - CRM_API_KEY: csw_web_to_crm_xxx
//   - crmClient.ts: web-sync-student / web-sync-application / orchestrate-chat
//
// This page monitors the legacy integration_outbox table which is not
// actively used in the current CSW AI CRM integration architecture.
// ============================================================================

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, PlayCircle, XCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OutboxItem {
  id: number;
  event_type: string;
  status: string;
  attempts: number;
  created_at: string;
  next_attempt_at: string;
  last_error: string | null;
  payload: any;
}

interface Stats {
  pending: number;
  sent: number;
  error: number;
}

export default function IntegrationsMonitor() {
  const [activeTab, setActiveTab] = useState<"crm" | "whatsapp">("crm");
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, sent: 0, error: 0 });
  const [loading, setLoading] = useState(false);
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    loadFlags();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadFlags = async () => {
    const { data } = await supabase
      .from("feature_flags")
      .select("key,enabled,payload")
      .in("key", ["crm_enabled", "whatsapp_enabled"]);

    const crm = data?.find((f) => f.key === "crm_enabled");
    const wa = data?.find((f) => f.key === "whatsapp_enabled");

    const crmPayload = crm?.payload as any;
    const waPayload = wa?.payload as any;

    setCrmEnabled(crm?.enabled === true || crmPayload?.enabled === true);
    setWhatsappEnabled(wa?.enabled === true || waPayload?.enabled === true);
  };

  const loadData = async () => {
    setLoading(true);

    // Load stats
    const { data: allItems } = await supabase
      .from("integration_outbox")
      .select("status")
      .order("created_at", { ascending: false });

    if (allItems) {
      const pending = allItems.filter((i) => i.status === "pending").length;
      const sent = allItems.filter((i) => i.status === "sent").length;
      const error = allItems.filter((i) => i.status === "error").length;
      setStats({ pending, sent, error });
    }

    // Load recent items for active tab
    const { data: recentItems } = await supabase
      .from("integration_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    setItems(recentItems || []);
    setLoading(false);
  };

  const handleDispatch = async (type: "crm" | "whatsapp") => {
    setLoading(true);
    try {
      const functionName = type === "crm" ? "crm-dispatch" : "whatsapp-dispatch";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { manual_trigger: true },
      });

      if (error) throw error;

      toast({
        title: "Dispatch Triggered",
        description: `${type.toUpperCase()} dispatch processed ${data?.processed || 0} items`,
      });

      await loadData();
    } catch (error) {
      console.error("Dispatch error:", error);
      toast({
        title: "Error",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await supabase
        .from("integration_outbox")
        .update({
          status: "pending",
          next_attempt_at: new Date().toISOString(),
        })
        .eq("id", id);

      toast({
        title: "Retry Scheduled",
        description: "Item will be retried on next dispatch",
      });

      await loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleSkip = async (id: number) => {
    try {
      await supabase
        .from("integration_outbox")
        .update({ status: "error" })
        .eq("id", id);

      toast({
        title: "Item Skipped",
        description: "Item marked as error",
      });

      await loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-red-50"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integrations Monitor</h1>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sent</p>
              <p className="text-2xl font-bold">{stats.sent}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold">{stats.error}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("crm")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "crm"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          CRM Integration
          {crmEnabled && <Badge className="ml-2 bg-green-500">Enabled</Badge>}
          {!crmEnabled && <Badge className="ml-2" variant="outline">Disabled</Badge>}
        </button>

        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "whatsapp"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          WhatsApp Integration
          {whatsappEnabled && <Badge className="ml-2 bg-green-500">Enabled</Badge>}
          {!whatsappEnabled && <Badge className="ml-2" variant="outline">Disabled</Badge>}
        </button>
      </div>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => handleDispatch(activeTab)}
            disabled={loading || (activeTab === "crm" ? !crmEnabled : !whatsappEnabled)}
            className="bg-primary hover:bg-primary/90"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Trigger {activeTab === "crm" ? "CRM" : "WhatsApp"} Dispatch
          </Button>

          <p className="text-sm text-muted-foreground">
            Manually trigger dispatch for pending items
          </p>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Items (Last 50)</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">ID</th>
                <th className="text-left py-2 px-4">Event Type</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Attempts</th>
                <th className="text-left py-2 px-4">Created</th>
                <th className="text-left py-2 px-4">Next Attempt</th>
                <th className="text-left py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-4 text-xs font-mono">
                    {String(item.id)}
                  </td>
                  <td className="py-2 px-4">{item.event_type}</td>
                  <td className="py-2 px-4">{getStatusBadge(item.status)}</td>
                  <td className="py-2 px-4">{item.attempts}</td>
                  <td className="py-2 px-4 text-sm">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-sm">
                    {item.next_attempt_at
                      ? new Date(item.next_attempt_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex gap-2">
                      {item.status === "error" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(item.id)}
                        >
                          Retry
                        </Button>
                      )}
                      {item.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSkip(item.id)}
                        >
                          Skip
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items found
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
