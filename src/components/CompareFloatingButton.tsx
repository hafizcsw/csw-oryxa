import { useState } from "react";
import { useCompare } from "@/hooks/useCompare";
import { Button } from "@/components/ui/button";
import { GitCompare } from "lucide-react";
import { CompareDrawer } from "@/components/compare/CompareDrawer";
import { useLanguage } from "@/contexts/LanguageContext";

export function CompareFloatingButton() {
  const { count } = useCompare();
  const { t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 start-6 z-50">
        <Button
          size="lg"
          onClick={() => setDrawerOpen(true)}
          className="shadow-lg gap-2"
        >
          <GitCompare size={20} />
          {t('compare.floatingButton', { count })}
        </Button>
      </div>

      <CompareDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
