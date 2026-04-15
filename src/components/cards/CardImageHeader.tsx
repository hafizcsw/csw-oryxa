import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CardImageHeaderProps {
  imageUrl?: string | null;
  altText: string;
  badges?: { text: string; variant?: "default" | "secondary" | "outline" }[];
  onFavoriteClick?: () => void;
  isFavorite?: boolean;
  fallbackGradient?: string;
  fallbackIcon?: React.ReactNode;
}

export function CardImageHeader({
  imageUrl,
  altText,
  badges = [],
  onFavoriteClick,
  isFavorite = false,
  fallbackGradient = "from-primary/20 to-primary/5",
  fallbackIcon,
}: CardImageHeaderProps) {
  return (
    <div className="relative h-48 overflow-hidden rounded-t-xl">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={altText}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex items-center justify-center`}>
          {fallbackIcon}
        </div>
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      
      {/* Badges */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2">
        {badges.map((badge, index) => (
          <Badge 
            key={index} 
            variant={badge.variant || "secondary"}
            className="backdrop-blur-sm bg-background/80 shadow-lg"
          >
            {badge.text}
          </Badge>
        ))}
      </div>
      
      {/* Favorite Button */}
      {onFavoriteClick && (
        <button
          onClick={onFavoriteClick}
          className="absolute top-4 right-4 p-2 rounded-full backdrop-blur-sm bg-background/80 hover:bg-background transition-colors shadow-lg"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isFavorite ? "fill-red-500 text-red-500" : "text-foreground"
            }`}
          />
        </button>
      )}
    </div>
  );
}
