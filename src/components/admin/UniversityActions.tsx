import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, FileText, ImageIcon, Loader2 } from "lucide-react";

interface UniversityActionsProps {
  university: any;
  onRunStarted?: (runId: number) => void;
}

export default function UniversityActions({ university, onRunStarted }: UniversityActionsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleHarvest = async (kind: 'fees' | 'admissions' | 'media') => {
    if (!university?.country_id) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يوجد رمز دولة للجامعة",
      });
      return;
    }

    setLoading(kind);

    try {
      // Get country slug from countries table
      const { data: countryData, error: countryError } = await supabase
        .from("countries")
        .select("slug")
        .eq("id", university.country_id)
        .single();

      if (countryError) throw countryError;

      const { data, error } = await supabase.functions.invoke("harvest-start", {
        body: {
          kind,
          country_code: countryData.slug,
          university_id: university.id,
          audience: "international",
        },
      });

      if (error) throw error;

      const runId = data?.run_id;
      
      toast({
        title: "بدأ الحصاد",
        description: `تم بدء حصاد ${kind === 'fees' ? 'الرسوم' : kind === 'media' ? 'الوسائط' : 'القبول'} للجامعة`,
      });

      if (runId && onRunStarted) {
        onRunStarted(runId);
      }
    } catch (error) {
      console.error("Harvest error:", error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل الحصاد",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleHarvest("fees")}
        disabled={loading !== null}
      >
        {loading === "fees" ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <DollarSign className="w-4 h-4 ml-2" />
        )}
        حصاد الرسوم
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleHarvest("admissions")}
        disabled={loading !== null}
      >
        {loading === "admissions" ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <FileText className="w-4 h-4 ml-2" />
        )}
        حصاد القبول
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleHarvest("media")}
        disabled={loading !== null}
      >
        {loading === "media" ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <ImageIcon className="w-4 h-4 ml-2" />
        )}
        حصاد الوسائط
      </Button>
    </div>
  );
}
