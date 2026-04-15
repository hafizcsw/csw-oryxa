import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export function VisitorsCard() {
  const [visitors, setVisitors] = useState({ today: 0, week: 0 });
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  useEffect(() => {
    loadVisitors();
    const interval = setInterval(loadVisitors, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadVisitors = async () => {
    try {
      const { data, error } = await supabase.rpc('seo_overview_summary' as any);
      if (error) throw error;
      
      if (data && typeof data === 'object') {
        const summary = data as any;
        setVisitors({
          today: summary.visitors_today || 0,
          week: summary.visitors_7d || 0,
        });
      }
    } catch (error) {
      console.error('[VisitorsCard] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-20 mb-2"></div>
          <div className="h-8 bg-muted rounded w-16"></div>
        </div>
      </Card>
    );
  }

  const weekLabel = t('admin.thisWeek');

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('admin.visitors24h').split('(')[0].trim()}
          </p>
          <p className="text-3xl font-bold mb-2">
            {visitors.today.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {visitors.week.toLocaleString()} {weekLabel}
          </p>
        </div>
        <div className="bg-primary/10 p-3 rounded-lg">
          <Users className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
