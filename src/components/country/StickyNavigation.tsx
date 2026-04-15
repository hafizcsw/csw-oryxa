import { useEffect, useState } from "react";
import { MessageCircle, MapPin, Building2, FileText, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StickyNavigationProps {
  activeSection?: string;
}

export function StickyNavigation({ activeSection }: StickyNavigationProps) {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "overview", label: "نظرة عامة", icon: MapPin },
    { id: "why-study", label: "لماذا الدراسة هنا", icon: HelpCircle },
    { id: "universities", label: "أفضل الجامعات", icon: Building2 },
    { id: "programs", label: "البرامج الدراسية", icon: FileText },
    { id: "scholarships", label: "المنح الدراسية", icon: MessageCircle, highlight: true },
  ];

  return (
    <div
      className={cn(
        "transition-all duration-300 z-40 bg-white border-b shadow-sm",
        isSticky ? "sticky top-[60px]" : ""
      )}
    >
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all duration-300 border-b-2",
                item.highlight
                  ? "text-primary border-primary hover:bg-primary/5"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted",
                activeSection === item.id && "text-primary border-primary"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
