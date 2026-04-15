import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProgressRing } from "./ProgressRing";
import { ChecklistItem } from "./ChecklistItem";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChecklistItemData {
  label: string;
  done: boolean;
  critical: boolean;
  action?: () => void;
}

interface StudioSidebarProps {
  universityId?: string;
  universityName: string;
  slug?: string;
  seoTitle?: string;
  isActive: boolean;
  isNew: boolean;
  checklistItems: ChecklistItemData[];
  progress: number;
}

export function StudioSidebar({
  universityId,
  universityName,
  slug,
  seoTitle,
  isActive,
  isNew,
  checklistItems,
  progress,
}: StudioSidebarProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [seoOpen, setSeoOpen] = useState(true);

  const completedCount = checklistItems.filter((item) => item.done).length;
  const canPublish = checklistItems.filter(i => i.critical).every(i => i.done);

  const copySlug = () => {
    if (slug) {
      navigator.clipboard.writeText(`/university/${slug}`);
      toast({ title: t("studio.sidebar.linkCopied") });
    }
  };

  return (
    <aside className="col-span-12 md:col-span-4 space-y-4 md:sticky md:top-48 md:self-start md:max-h-[calc(100vh-14rem)] md:overflow-y-auto">
      {/* Progress + Status Card */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/30">
        <CardContent className="p-6">
          {/* Progress Ring */}
          <div className="flex items-center gap-6 mb-6">
            <ProgressRing progress={progress} size={72} strokeWidth={5} />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{t("studio.sidebar.universityCompletion")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("studio.sidebar.itemsCompleted")
                  .replace("{completed}", String(completedCount))
                  .replace("{total}", String(checklistItems.length))}
              </p>
              <Badge 
                variant={isActive ? "default" : "secondary"} 
                className="mt-2"
              >
                {isActive ? t("studio.active") : t("studio.inactive")}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Checklist Collapsible */}
          <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("studio.sidebar.checklist")}</span>
                <Badge variant="outline" className="text-xs">
                  {completedCount}/{checklistItems.length}
                </Badge>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                checklistOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.ul 
                className="mt-3 space-y-1"
                initial={false}
              >
                {checklistItems.map((item, index) => (
                  <ChecklistItem
                    key={index}
                    label={item.label}
                    done={item.done}
                    critical={item.critical}
                    onClick={item.action}
                  />
                ))}
              </motion.ul>
              
              {!canPublish && (
                <motion.div 
                  className="mt-4 p-3 bg-destructive/10 rounded-xl border border-destructive/20"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-xs text-destructive font-medium">
                    {t("studio.sidebar.mustCompleteRequired")}
                  </p>
                </motion.div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-4" />

          {/* Quick Actions */}
          {!isNew && universityId && (
            <div className="flex gap-2">
              <Link to={`/university/${universityId}`} target="_blank" className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-2 rounded-full">
                  <Eye className="h-4 w-4" />
                  {t("studio.preview")}
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-full"
                onClick={copySlug}
              >
                <Copy className="h-4 w-4" />
                {t("studio.sidebar.copy")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO Quick View */}
      {universityId && (
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">{t("studio.sidebar.seoQuickView")}</CardTitle>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    seoOpen && "rotate-180"
                  )} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 text-sm pt-0">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">{t("studio.sidebar.slug")}</span>
                  <code className="text-xs bg-background px-2 py-1 rounded border">
                    {slug || "—"}
                  </code>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">{t("studio.sidebar.title")}</span>
                  <span className="text-sm">{seoTitle || universityName || "—"}</span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </aside>
  );
}
