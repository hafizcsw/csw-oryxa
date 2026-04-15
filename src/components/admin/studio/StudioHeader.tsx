import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface StudioHeaderProps {
  universityId?: string;
  universityName: string;
  countryName?: string;
  isNew: boolean;
  isDirty: boolean;
  isActive: boolean;
  isSaving: boolean;
  progress: number;
  onSave: () => void;
}

export function StudioHeader({
  universityId,
  universityName,
  countryName,
  isNew,
  isDirty,
  isActive,
  isSaving,
  progress,
  onSave,
}: StudioHeaderProps) {
  const { t } = useLanguage();
  
  return (
    <header className="sticky top-16 z-40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b shadow-sm">
      <div className="w-full px-6">
        <div className="mx-auto max-w-7xl w-full py-4">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin/universities-admin" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("admin.sidebar.universities")}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  {isNew ? t("studio.newUniversity") : universityName || t("studio.edit")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Main Header Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Link to="/admin/universities-admin">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight">
                    {isNew ? t("studio.addNewUniversity") : universityName || t("studio.editUniversity")}
                  </h1>
                  <Badge 
                    variant={isActive ? "default" : "secondary"}
                    className="font-normal"
                  >
                    {isActive ? t("studio.active") : t("studio.inactive")}
                  </Badge>
                  {isDirty && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Badge variant="outline" className="border-warning/50 text-warning bg-warning/10">
                        {t("studio.unsavedChanges")}
                      </Badge>
                    </motion.div>
                  )}
                </div>
                {!isNew && countryName && (
                  <p className="text-sm text-muted-foreground">{countryName}</p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {!isNew && universityId && (
                <Link to={`/university/${universityId}`} target="_blank">
                  <Button variant="outline" size="sm" className="gap-2 rounded-full">
                    <Eye className="h-4 w-4" />
                    {t("studio.preview")}
                  </Button>
                </Link>
              )}
              <motion.div
                animate={isDirty ? { scale: [1, 1.02, 1] } : {}}
                transition={{ repeat: isDirty ? Infinity : 0, duration: 2 }}
              >
                <Button
                  onClick={onSave}
                  disabled={isSaving || (!isDirty && !isNew)}
                  className={cn(
                    "gap-2 rounded-full shadow-md transition-all",
                    isDirty && "ring-2 ring-primary/20 ring-offset-2"
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isNew ? t("studio.createUniversity") : t("studio.save")}
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {Math.round(progress)}% {t("studio.complete")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
