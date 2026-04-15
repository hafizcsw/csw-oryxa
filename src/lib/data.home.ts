import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  site_name: string;
  currency: string;
  default_sort: string;
  sliders: { fees_max: number; living_max: number };
  theme: any;
  flags: Record<string, boolean>;
};

export type HomeIcon = {
  id: string;
  title: string;
  icon_key: string;
  route_path: string;
  action_type: "route" | "coming_soon";
  service_id: string | null;
  is_active: boolean;
  order: number;
  analytics_tag: string | null;
};

export type Country = { 
  id: string; 
  name_ar: string; 
  name_en: string | null;
  slug: string; 
  image_url: string | null; 
  // Not needed for home carousel; fetched on-demand on the country page.
  page_content?: string | null;
  display_order: number;
};

export type Testimonial = { 
  id: string; 
  student_name: string | null; 
  video_url: string | null; 
  thumbnail_url: string | null; 
  quote: string | null; 
  order: number; 
  featured: boolean; 
};

export type Post = { 
  id: string; 
  type: "news"|"blog"|"static"; 
  title: string; 
  slug: string; 
  excerpt: string | null; 
  image_url: string | null; 
  featured: boolean; 
  published_at: string; 
};

export type FooterLink = { 
  id: string; 
  group: string; 
  text: string; 
  url: string; 
  order: number; 
  is_active: boolean; 
};

export type Degree = { 
  id: string; 
  name: string; 
  slug: string; 
};

export type CertificateType = { 
  id: string; 
  name: string; 
  slug: string; 
};

export async function getSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .limit(1)
    .single();
  if (error) { 
    console.warn("[Settings] Error:", error); 
    return null; 
  }
  
  // Parse JSON fields safely
  if (data) {
    return {
      ...data,
      sliders: typeof data.sliders === 'object' && data.sliders !== null 
        ? data.sliders as { fees_max: number; living_max: number }
        : { fees_max: 10000, living_max: 10000 },
      flags: typeof data.flags === 'object' && data.flags !== null
        ? data.flags as Record<string, boolean>
        : {}
    } as Settings;
  }
  
  return null;
}

export async function getHomeIcons(): Promise<HomeIcon[]> {
  const { data, error } = await supabase
    .from("home_icons")
    .select("id, title, icon_key, route_path, action_type, service_id, is_active, order, analytics_tag")
    .eq("is_active", true)
    .order("order", { ascending: true });
  if (error) { 
    console.warn("[HomeIcons] Error:", error); 
    return []; 
  }
  return (data || []) as HomeIcon[];
}

export async function getCountries(): Promise<Country[]> {
  const { data, error } = await supabase
    .from("countries")
    // Keep payload light for faster home rendering (page_content can be very large)
    .select("id,name_ar,name_en,slug,image_url,display_order")
    .order("display_order", { ascending: true })
    .order("name_ar");
  if (error) { 
    console.warn("[Countries] Error:", error); 
    return []; 
  }
  return (data || []) as Country[];
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("id,student_name,video_url,thumbnail_url,quote,order,featured")
    .order("order", { ascending: true });
  if (error) { 
    console.warn("[Testimonials] Error:", error); 
    return []; 
  }
  return (data || []) as Testimonial[];
}

export async function getPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id,type,title,slug,excerpt,image_url,featured,published_at")
    .order("published_at", { ascending: false })
    .limit(6);
  if (error) { 
    console.warn("[Posts] Error:", error); 
    return []; 
  }
  return (data || []) as Post[];
}

export async function getFooterLinks(): Promise<FooterLink[]> {
  const { data, error } = await supabase
    .from("footer_links")
    .select("id, \"group\", text, url, \"order\", is_active")
    .eq("is_active", true)
    .order("group", { ascending: true })
    .order("order", { ascending: true });
  if (error) { 
    console.warn("[FooterLinks] Error:", error); 
    return []; 
  }
  return (data || []) as FooterLink[];
}

export async function getDegrees(): Promise<Degree[]> {
  const { data, error } = await supabase
    .from("degrees")
    .select("id,name,slug")
    .order("name");
  if (error) { 
    console.warn("[Degrees] Error:", error); 
    return []; 
  }
  return (data || []) as Degree[];
}

export async function getCertificateTypes(): Promise<CertificateType[]> {
  const { data, error } = await supabase
    .from("certificate_types")
    .select("id,name,slug")
    .order("name");
  if (error) { 
    console.warn("[Certificates] Error:", error); 
    return []; 
  }
  return (data || []) as CertificateType[];
}
