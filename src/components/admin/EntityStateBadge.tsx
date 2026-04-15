import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Archive,
  Clock
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type LifecycleState = 
  | 'discovered' 
  | 'extracted' 
  | 'draft' 
  | 'validated' 
  | 'review_pending' 
  | 'approved' 
  | 'published' 
  | 'stale' 
  | 'archived';

interface EntityStateBadgeProps {
  state: LifecycleState;
}

const stateConfig: Record<LifecycleState, { key: string; icon: any; variant: any }> = {
  discovered: { key: "discovered", icon: Search, variant: "outline" },
  extracted: { key: "extracted", icon: FileText, variant: "secondary" },
  draft: { key: "draft", icon: FileText, variant: "outline" },
  validated: { key: "validated", icon: CheckCircle, variant: "default" },
  review_pending: { key: "review_pending", icon: Clock, variant: "secondary" },
  approved: { key: "approved", icon: CheckCircle, variant: "default" },
  published: { key: "published", icon: CheckCircle, variant: "default" },
  stale: { key: "stale", icon: AlertCircle, variant: "destructive" },
  archived: { key: "archived", icon: Archive, variant: "outline" }
};

export function EntityStateBadge({ state }: EntityStateBadgeProps) {
  const { t } = useLanguage();
  const config = stateConfig[state] || stateConfig.draft;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {t(`entityState.${config.key}`)}
    </Badge>
  );
}
