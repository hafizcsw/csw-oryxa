import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ProgramFormAdvancedProps {
  universityId: string;
  onSuccess?: () => void;
}

/**
 * @deprecated ❌ BLOCKED: Use University Studio → ProgramsTab for program creation
 * This component violates the Single Creation Path rule.
 * All program creation MUST go through University Studio → ProgramsTab.
 */
export default function ProgramFormAdvanced({ universityId, onSuccess }: ProgramFormAdvancedProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // ❌ BLOCKED: Immediate redirect to University Studio - NO EXCEPTIONS
  useEffect(() => {
    toast({
      title: "⚠️ مسار محظور",
      description: "يرجى استخدام University Studio لإنشاء البرامج",
      variant: "destructive",
    });
    navigate(`/admin/university/${universityId}/studio?tab=programs`, { replace: true });
  }, [universityId, navigate, toast]);
  
  // Return minimal blocked UI - no form, no submit capability
  return (
    <div className="p-8 text-center space-y-4">
      <div className="w-12 h-12 mx-auto bg-warning/20 rounded-full flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="font-semibold text-lg">هذا المسار محظور</h3>
      <p className="text-muted-foreground">
        إنشاء البرامج متاح فقط من <strong>University Studio → تبويب البرامج</strong>
      </p>
      <p className="text-sm text-muted-foreground">جاري التحويل...</p>
    </div>
  );
}
