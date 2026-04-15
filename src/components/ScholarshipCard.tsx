import { Award, DollarSign, Calendar, GraduationCap, BookOpen, MapPin } from "lucide-react";
import { CardImageHeader } from "./cards/CardImageHeader";
import { CardStatsGrid, StatItem } from "./cards/CardStatsGrid";
import { CardActionButtons } from "./cards/CardActionButtons";
import { CardHoverBar } from "./cards/CardHoverBar";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

type Scholarship = {
  id: string;
  title: string;
  amount?: number | null;
  currency_code?: string | null;
  deadline_date?: string | null;
  url?: string | null;
  provider_name?: string | null;
  university_id?: string | null;
  university_name?: string | null;
  country_name: string;
  country_slug: string;
  subject_name?: string | null;
  degree_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  coverage_type?: string | null;
  beneficiaries_count?: number | null;
  acceptance_rate?: number | null;
  rating?: number | null;
};

// Format money without fake currency fallback
function money(v?: number | null, c?: string | null) {
  if (v == null) return "—";
  if (c) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: "currency",
        currency: c,
        maximumFractionDigits: 0,
      }).format(v);
    } catch {
      // Invalid currency — fall through
    }
  }
  // No currency code — plain number
  return v.toLocaleString('en-US');
}

export function ScholarshipCard({ s }: { s: Scholarship }) {
  // استخدام صورة افتراضية إذا لم تكن متوفرة
  const defaultImage = s.image_url || '/scholarships/scholarship-celebration.jpg';
  
  const badges = [];
  if (s.amount) {
    badges.push({ text: money(s.amount, s.currency_code), variant: "default" as const });
  }
  if (s.coverage_type) {
    badges.push({ 
      text: s.coverage_type === 'full' ? 'تغطية كاملة' : 'تغطية جزئية', 
      variant: "secondary" as const 
    });
  }

  const stats: StatItem[] = [
    {
      icon: DollarSign,
      label: "القيمة المالية",
      value: money(s.amount, s.currency_code),
      iconColor: "text-green-500"
    },
    {
      icon: Calendar,
      label: "آخر موعد",
      value: s.deadline_date ? new Date(s.deadline_date).toLocaleDateString('ar') : "—",
      iconColor: "text-blue-500"
    },
    {
      icon: GraduationCap,
      label: "المستوى",
      value: s.degree_name || "—",
      iconColor: "text-purple-500"
    },
    {
      icon: BookOpen,
      label: "التخصص",
      value: s.subject_name || "—",
      iconColor: "text-orange-500"
    },
  ];

  const hoverStats = [];
  if (s.beneficiaries_count) {
    hoverStats.push({ label: "المستفيدون", value: s.beneficiaries_count });
  }
  if (s.acceptance_rate) {
    hoverStats.push({ label: "معدل القبول", value: `${s.acceptance_rate}%` });
  }
  if (s.rating) {
    hoverStats.push({ label: "التقييم", value: `${s.rating}/5` });
  }

  return (
    <div className="group relative bg-card rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-border">
      <CardImageHeader
        imageUrl={defaultImage}
        altText={s.title}
        badges={badges}
        fallbackGradient="from-yellow-500/20 to-orange-500/10"
        fallbackIcon={<Award className="w-24 h-24 text-yellow-500/40" />}
      />

      <div className="p-6 space-y-4">
        {/* Title and Logo */}
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 border-2 border-primary/20">
            <AvatarImage src={s.image_url || undefined} alt={s.provider_name || s.university_name || ""} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {(s.provider_name || s.university_name || "M")[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2">
              {s.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="truncate">
                {s.provider_name || s.university_name || "—"} • {s.country_name}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <CardStatsGrid stats={stats} columns={2} />

        {/* Description */}
        {s.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {s.description}
          </p>
        )}

        {/* Action Buttons */}
        <CardActionButtons
          onViewDetails={() => window.open(s.url || '#', '_blank')}
          onApply={s.url ? () => window.open(s.url, '_blank') : undefined}
          detailsLabel="عرض التفاصيل"
          applyLabel="التقديم"
        />
      </div>

      {/* Hover Bar */}
      {hoverStats.length > 0 && <CardHoverBar stats={hoverStats} />}
    </div>
  );
}
