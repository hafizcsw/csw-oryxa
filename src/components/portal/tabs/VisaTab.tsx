import { Plane } from "lucide-react";
import { TabNavigation } from "./TabNavigation";

interface VisaTabProps {
  onTabChange?: (tab: string) => void;
}

export function VisaTab({ onTabChange }: VisaTabProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <div>
          <h2 className="text-xl font-bold text-foreground">ملفات التأشيرة والتذاكر</h2>
        </div>
      </div>

      {/* Empty State */}
      <div className="bg-card rounded-xl border border-border p-12">
        <div className="text-center">
          <Plane className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">لا توجد ملفات تأشيرة أو تذاكر مرفوعة</p>
        </div>
      </div>

      {/* Tab Navigation */}
      {onTabChange && <TabNavigation currentTab="visa" onTabChange={onTabChange} />}
    </div>
  );
}
