import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Experiments() {
  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">تجارب A/B</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة تجارب تحسين محركات البحث
          </p>
        </div>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold">قريبًا</h3>
          <p className="text-muted-foreground max-w-md">
            سيتم إضافة وظيفة التجارب قريبًا. ستتمكن من إنشاء وإدارة تجارب A/B
            لتحسين العناوين والأوصاف والمحتوى.
          </p>
        </div>
      </Card>
    </div>
  );
}
