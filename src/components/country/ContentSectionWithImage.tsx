import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ContentSectionWithImageProps {
  title: string;
  description: string;
  image?: string;
  icon?: LucideIcon;
  imagePosition?: "left" | "right";
  highlights?: string[];
  className?: string;
}

export function ContentSectionWithImage({
  title,
  description,
  image,
  icon: Icon,
  imagePosition = "right",
  highlights = [],
  className = ""
}: ContentSectionWithImageProps) {
  return (
    <div className={`py-16 ${className}`}>
      <div className="container mx-auto px-4">
        <div className={`grid md:grid-cols-2 gap-12 items-center max-w-7xl mx-auto ${
          imagePosition === "left" ? "md:flex-row-reverse" : ""
        }`}>
          {/* Content */}
          <div className={imagePosition === "left" ? "md:order-2" : ""}>
            {Icon && (
              <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-6">
                <Icon className="w-12 h-12 text-primary" />
              </div>
            )}
            <h2 className="text-4xl font-bold mb-6 text-foreground">{title}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              {description}
            </p>
            {highlights.length > 0 && (
              <ul className="space-y-3">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <span className="text-muted-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Image */}
          <div className={imagePosition === "left" ? "md:order-1" : ""}>
            <Card className="overflow-hidden border-0 shadow-2xl hover-lift">
              <CardContent className="p-0">
                {image ? (
                  <img
                    src={image}
                    alt={title}
                    className="w-full h-[400px] object-cover"
                  />
                ) : (
                  <div className="w-full h-[400px] bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                    {Icon && <Icon className="w-32 h-32 text-white opacity-30" />}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Small Gallery Images */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden hover-scale cursor-pointer"
                >
                  <div className="w-full h-full bg-muted/50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
