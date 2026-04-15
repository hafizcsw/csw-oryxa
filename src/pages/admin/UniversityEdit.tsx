import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit3, Image, Video, DollarSign, Award, Activity, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UniversityOverview from "./universities/overview/UniversityOverview";
import PriceGrid from "./universities/prices/PriceGrid";
import PhotosGallery from "./universities/photos/PhotosGallery";
import MediaManager from "./universities/media/MediaManager";
import SeoManager from "./universities/seo/SeoManager";
import ProgramsTab from "./universities/programs/ProgramsTab";
import ScholarshipsTab from "./universities/scholarships/ScholarshipsTab";
import { supabase } from "@/integrations/supabase/client";

const sections = [
  { value: "overview", label: "Overview", icon: <Edit3 className="h-4 w-4" /> },
  { value: "programs", label: "البرامج", icon: <GraduationCap className="h-4 w-4" />, badge: null },
  { value: "photos", label: "Photos Gallery", icon: <Image className="h-4 w-4" /> },
  { value: "videos", label: "Videos Gallery", icon: <Video className="h-4 w-4" /> },
  { value: "prices", label: "Prices List", icon: <DollarSign className="h-4 w-4" /> },
  { value: "scholarships", label: "المنح الدراسية", icon: <Award className="h-4 w-4" /> },
  { value: "media", label: "Media & SEO", icon: <Image className="h-4 w-4" /> },
  { value: "history", label: "Activity Log", icon: <Activity className="h-4 w-4" /> },
];

export default function UniversityEdit() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [programCount, setProgramCount] = useState(0);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (id) loadProgramCount();
  }, [id]);

  const loadProgramCount = async () => {
    const { count } = await supabase
      .from("programs")
      .select("*", { count: "exact", head: true })
      .eq("university_id", id);
    setProgramCount(count || 0);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  if (!id) return <div className="p-4">معرّف الجامعة مفقود</div>;

  // Update program count badge dynamically
  const sectionsWithBadge = sections.map(section => 
    section.value === "programs" 
      ? { ...section, badge: programCount }
      : section
  );

  return (
    <div className="p-4" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/universities-admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">إدارة الجامعة</h2>
      </div>

      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Sidebar */}
        <Card className="w-64 p-4 shrink-0 overflow-y-auto">
          <nav className="space-y-1">
            {sectionsWithBadge.map((section) => (
              <Button
                key={section.value}
                variant={activeTab === section.value ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleTabChange(section.value)}
              >
                {section.icon}
                <span className="ml-2 flex-1 text-right">{section.label}</span>
                {section.badge !== null && section.badge !== undefined && (
                  <Badge variant="secondary" className="mr-auto">
                    {section.badge}
                  </Badge>
                )}
              </Button>
            ))}
          </nav>
        </Card>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && <UniversityOverview universityId={id} />}
          
          {activeTab === 'programs' && <ProgramsTab universityId={id} />}
          
          {activeTab === 'photos' && <PhotosGallery universityId={id} />}
          
          {activeTab === 'videos' && (
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">معرض الفيديو</h3>
              <p className="text-muted-foreground">إدارة فيديوهات الجامعة (قريباً)</p>
            </Card>
          )}
          
          {activeTab === 'prices' && <PriceGrid universityId={id} />}
          
          {activeTab === 'scholarships' && <ScholarshipsTab universityId={id} />}
          
          {activeTab === 'media' && (
            <div className="space-y-6">
              <MediaManager universityId={id} />
              <SeoManager universityId={id} />
            </div>
          )}
          
          {activeTab === 'history' && (
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">سجل النشاطات</h3>
              <p className="text-muted-foreground">سجل التعديلات والإجراءات (قريباً)</p>
            </Card>
          )}
      </div>
    </div>
  </div>
);
}
