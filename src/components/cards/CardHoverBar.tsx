interface StatItem {
  label: string;
  value: string | number;
}

interface CardHoverBarProps {
  stats: StatItem[];
}

export function CardHoverBar({ stats }: CardHoverBarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-primary/95 to-primary/85 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
      <div className="flex justify-around items-center py-3 px-4">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <p className="text-xs text-primary-foreground/80 mb-1">{stat.label}</p>
            <p className="text-sm font-bold text-primary-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
