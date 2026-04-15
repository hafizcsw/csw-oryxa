import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, BarChart3, Filter, Target, TrendingUp, Search, AlertTriangle, Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDecisionDashboard } from "./hooks/useDecisionDashboard";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DASHBOARD_SECTIONS } from "./dashboard.contract";
import { OverviewSection } from "./sections/OverviewSection";
import { FunnelSection } from "./sections/FunnelSection";
import { EngagementSection } from "./sections/EngagementSection";
import { UniversityIntelSection } from "./sections/UniversityIntelSection";
import { SearchSection } from "./sections/SearchSection";
import { ContentGapsSection } from "./sections/ContentGapsSection";
import ProtectedRoute from "@/components/admin/ProtectedRoute";

const TAB_ICONS: Record<string, React.ElementType> = {
  'bar-chart-3': BarChart3,
  'filter': Filter,
  'target': Target,
  'trending-up': TrendingUp,
  'search': Search,
  'alert-triangle': AlertTriangle,
};

export default function DecisionDashboardPage() {
  const { t } = useTranslation("common");
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data, loading, error, reload } = useDecisionDashboard();
  const [activeTab, setActiveTab] = useState("overview");
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const handleExportPdf = async () => {
    if (!data) return;
    setExporting('pdf');
    try {
      const { exportDashboardToPdf } = await import("./utils/export-pdf");
      await exportDashboardToPdf(data);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportXlsx = async () => {
    if (!data) return;
    setExporting('xlsx');
    try {
      const { exportDashboardToXlsx } = await import("./utils/export-xlsx");
      exportDashboardToXlsx(data);
    } catch (e) {
      console.error("XLSX export failed:", e);
    } finally {
      setExporting(null);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card><CardContent className="pt-6 text-center"><p className="text-destructive">{t("dashboard.unauthorized")}</p></CardContent></Card>
      </div>
    );
  }

  const enabledSections = DASHBOARD_SECTIONS.filter(s => s.enabled);

  return (
    <ProtectedRoute>
      <div className="space-y-4 animate-fade-in" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {data?.generated_at && (
              <span className="text-xs text-muted-foreground">
                {t("dashboard.lastUpdated")}: {new Date(data.generated_at).toLocaleTimeString("ar")}
              </span>
            )}

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!data || loading || !!exporting}
                  className="gap-1.5"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {t("dashboard.downloadReport")}
                  <ChevronDown className="w-3 h-3 mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
                  <FileText className="w-4 h-4 text-red-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">{t("dashboard.exportPdf")}</span>
                    <span className="text-xs text-muted-foreground">{t("dashboard.exportPdfDesc")}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXlsx} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">{t("dashboard.exportXlsx")}</span>
                    <span className="text-xs text-muted-foreground">{t("dashboard.exportXlsxDesc")}</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />
              {t("dashboard.refresh")}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-3">
              <p className="text-sm text-destructive">{t("dashboard.error")}: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
            {enabledSections.map(section => {
              const Icon = TAB_ICONS[section.icon] || BarChart3;
              return (
                <TabsTrigger key={section.key} value={section.key} className="gap-1">
                  <Icon className="w-3.5 h-3.5" />
                  {t(section.titleKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview">
            <OverviewSection data={data?.overview} loading={loading} />
          </TabsContent>

          <TabsContent value="funnel">
            <FunnelSection funnel={data?.funnel || []} funnels={data?.funnels || []} />
          </TabsContent>

          <TabsContent value="engagement">
            <EngagementSection data={data?.engagement} overview={data?.overview} />
          </TabsContent>

          <TabsContent value="universities">
            <UniversityIntelSection data={data?.university_intel} />
          </TabsContent>

          <TabsContent value="search">
            <SearchSection data={data?.search_intel} />
          </TabsContent>

          <TabsContent value="gaps">
            <ContentGapsSection data={data?.content_gaps} />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
