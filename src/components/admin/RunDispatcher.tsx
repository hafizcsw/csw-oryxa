import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2 } from "lucide-react";

export default function RunDispatcher() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDispatch = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("outbox-dispatch-now");

      if (error) throw error;

      toast({
        title: "تم التنفيذ",
        description: `معالجة: ${data?.processed || 0} | نجح: ${data?.sent || 0} | فشل: ${data?.failed || 0}`,
      });
    } catch (error) {
      console.error("Dispatch error:", error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل التنفيذ",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDispatch}
      disabled={loading}
      size="sm"
      variant="default"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
      ) : (
        <Play className="w-4 h-4 ml-2" />
      )}
      تشغيل Dispatcher الآن
    </Button>
  );
}
