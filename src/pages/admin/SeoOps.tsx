import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Overview from "./seo-ops/Overview";
import GSCPage from "./seo-ops/GSC";
import ContentAI from "./seo-ops/ContentAI";
import Coverage from "./seo-ops/Coverage";
import BacklinksPage from "./seo-ops/Backlinks";
import ExperimentsPage from "./seo-ops/Experiments";

export default function SeoOps() {
  const { isAdmin, loading: authLoading } = useAdminAuth();

  if (authLoading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-red-600">غير مصرح</div>;
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">تحسين الظهور في محركات البحث</h1>
        <p className="text-muted-foreground">
          لوحة تحكم شاملة لمراقبة وتحسين SEO
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="gsc">Google Search Console</TabsTrigger>
          <TabsTrigger value="content-ai">الذكاء الاصطناعي</TabsTrigger>
          <TabsTrigger value="coverage">التغطية</TabsTrigger>
          <TabsTrigger value="backlinks">الروابط الخلفية</TabsTrigger>
          <TabsTrigger value="experiments">التجارب</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview />
        </TabsContent>

        <TabsContent value="gsc">
          <GSCPage />
        </TabsContent>

        <TabsContent value="content-ai">
          <ContentAI />
        </TabsContent>

        <TabsContent value="coverage">
          <Coverage />
        </TabsContent>

        <TabsContent value="backlinks">
          <BacklinksPage />
        </TabsContent>

        <TabsContent value="experiments">
          <ExperimentsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
