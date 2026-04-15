import { Button } from "@/components/ui/button";
import { GitCompare } from "lucide-react";
import { useCompare, MAX_COMPARE } from "@/hooks/useCompare";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CompareButtonProps {
  programId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

export function CompareButton({ programId, variant = "outline", size = "sm" }: CompareButtonProps) {
  const { addToCompare, removeFromCompare, isInCompare, maxReached } = useCompare();
  const { toast } = useToast();
  const { t } = useLanguage();
  const inCompare = isInCompare(programId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inCompare) {
      removeFromCompare(programId);
      toast({ title: t("compare.removed") });
      return;
    }

    if (maxReached) {
      toast({
        title: t("compare.max_reached"),
        description: t("compare.max_description", { count: MAX_COMPARE }),
        variant: "destructive",
      });
      return;
    }

    const added = addToCompare(programId);
    if (added) {
      toast({ title: t("compare.added") });
    }
  };

  return (
    <Button
      variant={inCompare ? "default" : variant}
      size={size}
      onClick={handleClick}
      className="gap-2"
    >
      <GitCompare size={16} />
      {t("program.compare")}
    </Button>
  );
}
