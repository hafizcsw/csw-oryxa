import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DSButton } from "@/components/design-system/DSButton";
import { Pencil, Trash2, BookOpen, ExternalLink, DollarSign, Home } from "lucide-react";
import UniversityDataQualityBadge from "./UniversityDataQualityBadge";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type Uni = {
  id: string;
  name: string;
  country_id: string;
  country_name?: string;
  city?: string | null;
  logo_url?: string | null;
  main_image_url?: string | null;
  website?: string | null;
  annual_fees?: number | null;
  monthly_living?: number | null;
  ranking?: number | null;
  description?: string | null;
  is_active?: boolean;
};

interface UniversityMobileCardProps {
  university: Uni;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}

export default function UniversityMobileCard({
  university,
  isSelected,
  onToggleSelect,
  onRemove,
}: UniversityMobileCardProps) {
  const { t } = useLanguage();
  
  // Calculate completeness for gradient color
  const calculateCompleteness = () => {
    const fields = [
      university.city,
      university.logo_url,
      university.website,
      university.annual_fees,
      university.monthly_living,
      university.ranking,
      university.description,
    ];
    const filled = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
    return Math.round((filled / fields.length) * 100);
  };

  const completeness = calculateCompleteness();
  
  // Dynamic gradient based on completeness
  const headerGradient = completeness >= 80
    ? "from-emerald-500/90 to-teal-600/90"
    : completeness >= 50
    ? "from-amber-500/90 to-orange-600/90"
    : "from-red-500/90 to-rose-600/90";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-md",
        "transition-all duration-300",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Gradient Header */}
      <div className={cn(
        "relative p-4 bg-gradient-to-r",
        headerGradient
      )}>
        {/* Decorative elements */}
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute -bottom-3 -left-3 w-14 h-14 rounded-full bg-white/10" />
        
        <div className="relative flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-primary"
            />
          </div>
          
          {/* Logo */}
          <div className="flex-shrink-0">
            {university.logo_url ? (
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm p-1.5 shadow-lg border border-white/20">
                <img 
                  src={university.logo_url} 
                  alt="" 
                  className="h-full w-full object-contain rounded-lg" 
                />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <span className="text-white/60 text-xs">—</span>
              </div>
            )}
          </div>
          
          {/* Name & Location */}
          <div className="flex-1 min-w-0 text-white">
            <h3 className="font-bold text-base leading-tight line-clamp-2">{university.name}</h3>
            <p className="text-sm opacity-90 mt-1">
              {university.country_name || "—"}
              {university.city && ` • ${university.city}`}
            </p>
          </div>
          
          {/* Quality & Status Badges */}
          <div className="flex flex-col items-end gap-1.5">
            <UniversityDataQualityBadge university={university} />
            <Badge 
              variant={university.is_active ? "default" : "secondary"} 
              className={cn(
                "text-xs",
                university.is_active 
                  ? "bg-white/20 text-white border-white/30 hover:bg-white/30" 
                  : "bg-black/20 text-white/80"
              )}
            >
              {university.is_active ? t('admin.universities.mobile.active') : t('admin.universities.mobile.inactive')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 py-3 bg-muted/30 border-b flex flex-wrap items-center gap-4 text-sm">
        {university.annual_fees && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-foreground font-medium">${university.annual_fees.toLocaleString()}</span>
            <span className="text-xs">{t('admin.universities.mobile.perYear')}</span>
          </div>
        )}
        
        {university.monthly_living && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Home className="w-4 h-4 text-blue-500" />
            <span className="text-foreground font-medium">${university.monthly_living.toLocaleString()}</span>
            <span className="text-xs">{t('admin.universities.mobile.perMonth')}</span>
          </div>
        )}
        
        {university.ranking && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-xs">{t('admin.universities.mobile.ranking')}</span>
            <span className="text-foreground font-bold">#{university.ranking}</span>
          </div>
        )}
        
        {university.website && (
          <a 
            href={university.website} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center gap-1 text-primary hover:underline mr-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-xs">{t('admin.universities.mobile.website')}</span>
          </a>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 flex gap-2">
        <Link to={`/admin/university/${university.id}/studio?tab=programs`} className="flex-1">
          <DSButton variant="outline" size="sm" className="w-full">
            <BookOpen className="w-4 h-4" />
            <span className="mr-1.5">{t('admin.universities.mobile.programs')}</span>
          </DSButton>
        </Link>
        
        <Link to={`/admin/university/${university.id}/studio`} className="flex-1">
          <DSButton variant="primary" size="sm" className="w-full">
            <Pencil className="w-4 h-4" />
            <span className="mr-1.5">Studio</span>
          </DSButton>
        </Link>
        
        <DSButton 
          variant="outline" 
          size="sm" 
          onClick={onRemove} 
          className="text-destructive hover:text-destructive hover:bg-destructive/10 px-3"
        >
          <Trash2 className="w-4 h-4" />
        </DSButton>
      </div>
    </motion.div>
  );
}
