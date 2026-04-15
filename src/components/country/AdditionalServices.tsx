import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, DollarSign, MapPin, HelpCircle, Plane, Building2 } from "lucide-react";

interface Service {
  id: string;
  title: string;
  description: string;
  icon: typeof Home;
  color: string;
  buttonText: string;
  buttonAction?: () => void;
}

const defaultServices: Service[] = [
  {
    id: "1",
    title: "Find your home away from home",
    description: "Discover comfortable and affordable accommodation options near your university",
    icon: Home,
    color: "from-blue-500 to-blue-600",
    buttonText: "Search Accommodation"
  },
  {
    id: "2",
    title: "Send funds securely with money transfer",
    description: "Safe and fast international money transfer services for students",
    icon: DollarSign,
    color: "from-green-500 to-green-600",
    buttonText: "Transfer Money"
  },
  {
    id: "3",
    title: "Cost of living calculator",
    description: "Estimate your monthly expenses and plan your budget effectively",
    icon: Building2,
    color: "from-purple-500 to-purple-600",
    buttonText: "Calculate Costs"
  },
  {
    id: "4",
    title: "Can't decide where to study?",
    description: "Get personalized recommendations from our expert counselors",
    icon: HelpCircle,
    color: "from-orange-500 to-orange-600",
    buttonText: "Get Advice"
  },
  {
    id: "5",
    title: "Visa application assistance",
    description: "Complete guidance on visa requirements and application process",
    icon: Plane,
    color: "from-red-500 to-red-600",
    buttonText: "Visa Help"
  },
  {
    id: "6",
    title: "Explore study destinations",
    description: "Compare different countries and find your perfect study destination",
    icon: MapPin,
    color: "from-teal-500 to-teal-600",
    buttonText: "Explore Now"
  }
];

interface AdditionalServicesProps {
  services?: Service[];
}

export function AdditionalServices({ services = defaultServices }: AdditionalServicesProps) {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Additional Services for Students</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a successful study abroad experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card
                key={service.id}
                className="border-0 shadow-lg hover-lift bg-white overflow-hidden group"
              >
                <CardContent className="p-8">
                  {/* Icon with Gradient */}
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.color} mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors duration-300">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {service.description}
                  </p>

                  {/* CTA Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={service.buttonAction}
                  >
                    {service.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
