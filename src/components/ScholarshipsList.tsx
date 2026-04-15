import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

interface ScholarshipsListProps {
  countrySlug?: string;
  degreeSlug?: string;
  visitorId?: string;
  limit?: number;
  title?: string;
}

export function ScholarshipsList({ 
  countrySlug, 
  degreeSlug, 
  visitorId,
  limit = 8,
  title = "Available Scholarships" 
}: ScholarshipsListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['scholarships', countrySlug, degreeSlug, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('scholarships-suggest', {
        body: { 
          country_slug: countrySlug, 
          degree_slug: degreeSlug,
          visitor_id: visitorId,
          limit 
        }
      });
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </section>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.items.map((scholarship: any) => (
          <Card key={scholarship.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{scholarship.title}</CardTitle>
                {scholarship.amount && (
                  <Badge variant="secondary" className="ml-2">
                    {scholarship.currency || 'USD'} {scholarship.amount.toLocaleString()}
                  </Badge>
                )}
              </div>
              <CardDescription>
                {scholarship.countries?.name_ar && (
                  <span className="mr-2">📍 {scholarship.countries.name_ar}</span>
                )}
                {scholarship.degrees?.name && (
                  <span>🎓 {scholarship.degrees.name}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                {scholarship.deadline && (
                  <p className="text-sm text-muted-foreground">
                    Deadline: {new Date(scholarship.deadline).toLocaleDateString()}
                  </p>
                )}
                {scholarship.url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={scholarship.url} target="_blank" rel="noopener noreferrer">
                      Learn More <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
