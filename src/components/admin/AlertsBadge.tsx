import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface Alert {
  id: number;
  level: string;
  message: string;
  meta: any;
  created_at: string;
  acknowledged: boolean;
}

export function AlertsBadge() {
  const { data: alertsResponse } = useQuery({
    queryKey: ["system-alerts-unack"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("system-alerts-list", {
        body: { acknowledged: false }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  const alerts: Alert[] = alertsResponse?.alerts || [];
  const criticalCount = alerts.filter(a => a.level === "critical").length;
  const totalCount = alerts.length;

  if (totalCount === 0) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <Badge 
            variant={criticalCount > 0 ? "destructive" : "secondary"}
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {totalCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h3 className="font-medium">التنبيهات النشطة ({totalCount})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts?.map((alert) => (
              <div 
                key={alert.id}
                className="p-3 border rounded-lg space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={alert.level === "critical" ? "destructive" : "secondary"}>
                    {alert.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {alert.meta?.category || 'system'}
                  </span>
                </div>
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
