import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { germanUniversities } from "@/data/german-universities";
import { Loader2, Download } from "lucide-react";

export function ImportGermanUniversities() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to import universities",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-universities-bulk-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            universities: germanUniversities,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to import universities");
      }

      toast({
        title: "Success!",
        description: `تم إضافة ${result.count} جامعة ألمانية بنجاح`,
      });

      // Reload the page to show new universities
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل استيراد الجامعات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-card">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">استيراد الجامعات الألمانية</h3>
        <p className="text-sm text-muted-foreground">
          إضافة 120 جامعة ألمانية إلى النظام (TU9, U15, جامعات عامة، جامعات علوم تطبيقية، وجامعات خاصة)
        </p>
      </div>
      
      <Button 
        onClick={handleImport} 
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            جاري الاستيراد...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            إضافة 120 جامعة ألمانية
          </>
        )}
      </Button>
    </div>
  );
}
