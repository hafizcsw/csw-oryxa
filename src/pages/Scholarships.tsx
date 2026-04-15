import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScholarshipSearch, formatScholarshipAmount } from "@/hooks/useScholarshipSearch";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Award, 
  Calendar, 
  MapPin, 
  GraduationCap, 
  ExternalLink,
  Search,
  Filter,
  Loader2,
  Building2
} from "lucide-react";

const DEGREE_OPTIONS = [
  { value: "bachelor", label: "بكالوريوس" },
  { value: "master", label: "ماجستير" },
  { value: "phd", label: "دكتوراه" },
];

const AMOUNT_TYPE_OPTIONS = [
  { value: "full", label: "منحة كاملة" },
  { value: "partial", label: "منحة جزئية" },
  { value: "fixed", label: "مبلغ محدد" },
  { value: "percent", label: "نسبة مئوية" },
];

export default function Scholarships() {
  const [countryCode, setCountryCode] = useState<string>("");
  const [degreeSlug, setDegreeSlug] = useState<string>("");
  const [amountType, setAmountType] = useState<string>("");

  // Fetch countries for filter
  const { data: countries = [] } = useQuery({
    queryKey: ["countries-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("id, country_code, name_ar, slug")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  // Scholarship search
  const { data: searchResult, isLoading, error } = useScholarshipSearch({
    country_code: countryCode || null,
    degree_slug: degreeSlug || null,
    amount_type: amountType || null,
    limit: 50,
    offset: 0,
  });

  const scholarships = searchResult?.items || [];
  const totalCount = searchResult?.count || 0;

  const clearFilters = () => {
    setCountryCode("");
    setDegreeSlug("");
    setAmountType("");
  };

  const hasActiveFilters = countryCode || degreeSlug || amountType;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-3 flex items-center justify-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            المنح الدراسية
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            اكتشف أفضل المنح الدراسية المتاحة للطلاب العرب حول العالم
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">الفلاتر:</span>
              </div>

              {/* Country Filter - uses country_code for filtering */}
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="الدولة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">الكل</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.country_code}>
                      {c.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Degree Filter */}
              <Select value={degreeSlug} onValueChange={setDegreeSlug}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="الدرجة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">الكل</SelectItem>
                  {DEGREE_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Amount Type Filter */}
              <Select value={amountType} onValueChange={setAmountType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="نوع المنحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">الكل</SelectItem>
                  {AMOUNT_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              )}

              <div className="mr-auto text-sm text-muted-foreground">
                {totalCount} منحة
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">حدث خطأ أثناء تحميل المنح</p>
            </CardContent>
          </Card>
        ) : scholarships.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">لا توجد منح دراسية</h3>
              <p className="text-muted-foreground">
                جرب تغيير الفلاتر للعثور على منح أخرى
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scholarships.map((scholarship) => (
              <ScholarshipCard key={scholarship.scholarship_id} scholarship={scholarship} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

interface ScholarshipCardProps {
  scholarship: {
    scholarship_id: string;
    title: string;
    description: string | null;
    university_name: string | null;
    university_logo: string | null;
    country_name_ar: string | null;
    degree_name: string | null;
    amount_type: string | null;
    amount_value: number | null;
    percent_value: number | null;
    currency_code: string | null;
    coverage_type: string | null;
    deadline: string | null;
    link: string | null;
  };
}

function ScholarshipCard({ scholarship }: ScholarshipCardProps) {
  const amountDisplay = formatScholarshipAmount(
    scholarship.amount_type,
    scholarship.amount_value,
    scholarship.percent_value,
    scholarship.currency_code
  );

  const deadlineFormatted = scholarship.deadline
    ? new Date(scholarship.deadline).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {scholarship.university_logo ? (
            <img
              src={scholarship.university_logo}
              alt=""
              className="w-12 h-12 rounded-lg object-contain bg-muted p-1"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">{scholarship.title}</CardTitle>
            {scholarship.university_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {scholarship.university_name}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Amount Badge */}
        <Badge 
          variant={scholarship.amount_type === "full" ? "default" : "secondary"}
          className="text-sm"
        >
          {amountDisplay}
        </Badge>

        {/* Meta Info */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {scholarship.country_name_ar && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {scholarship.country_name_ar}
            </span>
          )}
          {scholarship.degree_name && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" />
              {scholarship.degree_name}
            </span>
          )}
        </div>

        {/* Description */}
        {scholarship.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {scholarship.description}
          </p>
        )}

        {/* Deadline */}
        {deadlineFormatted && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-warning" />
            <span>آخر موعد: {deadlineFormatted}</span>
          </div>
        )}

        {/* Link */}
        {scholarship.link && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            asChild
          >
            <a href={scholarship.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 ml-2" />
              تقديم الآن
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
