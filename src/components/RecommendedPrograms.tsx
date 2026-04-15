import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProgramCard } from "./ProgramCard";
import { Skeleton } from "./ui/skeleton";
import { track } from "@/lib/analytics";
import { useEffect } from "react";
import { useUnifiedShortlist } from "@/hooks/useUnifiedShortlist";
import { programToShortlistSnapshot } from "@/lib/programToShortlistSnapshot";

interface RecommendedProgramsProps {
  visitorId: string;
  userId?: string;
  limit?: number;
  title?: string;
  showViewMore?: boolean;
}

export function RecommendedPrograms({ 
  visitorId, 
  userId, 
  limit = 12,
  title = "Recommended for You",
  showViewMore = true 
}: RecommendedProgramsProps) {
  const navigate = useNavigate();
  const { toggleWithSnapshot, isFavorite } = useUnifiedShortlist();
  
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations-v2', visitorId, userId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('recommend-programs-v2', {
        body: { 
          visitor_id: visitorId, 
          user_id: userId, 
          limit,
          lang: 'ar',
          display_currency_code: 'USD'
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!visitorId
  });

  useEffect(() => {
    if (data?.items?.length > 0) {
      track('recommendations_displayed', { 
        count: data.items.length,
        visitor_id: visitorId,
        user_id: userId 
      });
    }
  }, [data, visitorId, userId]);

  const handleProgramClick = (programId: string, position: number) => {
    track('recommendation_clicked', { 
      program_id: programId, 
      pos: position,
      visitor_id: visitorId 
    });
  };

  if (isLoading) {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </section>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return null;
  }

  return (
    <section className="mb-12 p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg border border-primary/10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Based on your preferences and browsing history
          </p>
        </div>
        {showViewMore && (
          <a 
            href="/universities?tab=programs" 
            className="text-primary hover:underline text-sm font-medium"
          >
            View All →
          </a>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.items.slice(0, limit).map((program: any, index: number) => {
          const programId = program.program_id;
          return (
            <div 
              key={programId}
              onClick={() => handleProgramClick(programId, index)}
            >
              <ProgramCard 
                p={{
                  program_id: programId,
                  program_name: program.title,
                  university_id: program.university_id || '',
                  university_name: program.university_name,
                  city: program.city,
                  logo_url: program.logo_url,
                  country_name: program.country_name || '',
                  country_slug: program.country_slug,
                  currency_code: program.currency_code || 'USD',
                  degree_id: program.degree_id,
                  degree_name: program.degree_slug,
                  fees_yearly: program.annual_fees,
                  duration_months: program.duration_months,
                  ielts_required: program.ielts_required,
                  next_intake_date: program.next_intake_date,
                  delivery_mode: program.delivery_mode,
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
