import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

/**
 * @deprecated ❌ BLOCKED: Use University Studio → ProgramsTab for program creation
 * This component violates the Single Creation Path rule
 */
export default function ProgramForm({ universityId }: { universityId: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // ❌ BLOCKED: Redirect to University Studio
  useEffect(() => {
    toast({
      title: "⚠️ مسار محظور",
      description: "يرجى استخدام University Studio لإنشاء البرامج",
      variant: "destructive",
    });
    navigate(`/admin/university/${universityId}/studio?tab=programs`);
  }, [universityId, navigate, toast]);
  
  return (
    <div className="p-8 text-center space-y-4">
      <AlertTriangle className="w-12 h-12 mx-auto text-warning" />
      <h3 className="font-semibold text-lg">⚠️ هذا المسار محظور</h3>
      <p className="text-muted-foreground">
        يرجى استخدام <strong>University Studio → تبويب البرامج</strong> لإنشاء البرامج
      </p>
      <p className="text-sm text-muted-foreground">جاري التحويل...</p>
    </div>
  );
}
