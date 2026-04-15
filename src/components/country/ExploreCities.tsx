import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, Building2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface City {
  id: string;
  name: string;
  image?: string;
  universities: number;
  students: number;
  description: string;
}

const defaultCities: City[] = [
  {
    id: "1",
    name: "Berlin",
    universities: 45,
    students: 180000,
    description: "Germany's vibrant capital, known for innovation, culture, and world-class universities."
  },
  {
    id: "2",
    name: "Munich",
    universities: 32,
    students: 120000,
    description: "A blend of tradition and technology, home to prestigious research institutions."
  },
  {
    id: "3",
    name: "Hamburg",
    universities: 28,
    students: 95000,
    description: "Germany's gateway to the world, offering maritime studies and international programs."
  },
  {
    id: "4",
    name: "Frankfurt",
    universities: 22,
    students: 70000,
    description: "Financial hub with excellent business schools and career opportunities."
  }
];

interface ExploreCitiesProps {
  cities?: City[];
  countryName?: string;
}

export function ExploreCities({ cities = defaultCities, countryName = "Germany" }: ExploreCitiesProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  return (
    <section id="explore" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Explore in {countryName}</h2>
          <p className="text-lg text-primary font-medium mb-2">
            Hover over the city cards to discover more!
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the best cities to study, live, and build your future
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {cities.map((city) => (
            <Card
              key={city.id}
              className={cn(
                "relative overflow-hidden border-2 transition-all duration-500 cursor-pointer group",
                hoveredCity === city.id
                  ? "border-primary shadow-2xl scale-105 z-10"
                  : "border-border hover:border-primary/50"
              )}
              onMouseEnter={() => setHoveredCity(city.id)}
              onMouseLeave={() => setHoveredCity(null)}
            >
              <CardContent className="p-0">
                {/* City Image */}
                <div className="relative h-48 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 overflow-hidden">
                  {city.image ? (
                    <img
                      src={city.image}
                      alt={city.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="w-20 h-20 text-white opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-overlay opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                  
                  {/* City Name Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <h3 className="text-white text-3xl font-bold drop-shadow-lg">
                      {city.name}
                    </h3>
                  </div>
                </div>

                {/* City Stats */}
                <div className="p-6 space-y-4 bg-white">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Universities</p>
                        <p className="text-lg font-bold text-foreground">{city.universities}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <GraduationCap className="w-4 h-4 text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Students</p>
                        <p className="text-lg font-bold text-foreground">
                          {(city.students / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Description - Show on Hover */}
                  <div
                    className={cn(
                      "transition-all duration-500 overflow-hidden",
                      hoveredCity === city.id
                        ? "max-h-40 opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed pt-2 border-t">
                      {city.description}
                    </p>
                  </div>

                  {/* Explore Button */}
                  <button
                    className={cn(
                      "w-full py-2 px-4 rounded-lg font-medium transition-all duration-300",
                      hoveredCity === city.id
                        ? "bg-gradient-primary text-white shadow-lg"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    Explore {city.name}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
