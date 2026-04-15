import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function CompareCounter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [compareList, setCompareList] = useState<string[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const updateList = () => {
      const list = (searchParams.get("compare") || "").split(",").filter(Boolean);
      setCompareList(list);
    };

    updateList();
    
    // Listen for compare updates
    window.addEventListener('compare-updated', updateList);
    return () => window.removeEventListener('compare-updated', updateList);
  }, [searchParams]);

  if (compareList.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Button
        size="lg"
        onClick={() => navigate(`/compare-universities?universities=${compareList.join(",")}`)}
        className="shadow-xl gap-2 relative"
      >
        <GitCompare size={20} />
        <span>{t("compare_view")}</span>
        <Badge className="ml-2 bg-white text-primary">{compareList.length}</Badge>
      </Button>
    </div>
  );
}
