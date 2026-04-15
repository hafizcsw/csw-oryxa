import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

interface Review {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  text: string;
  date: string;
}

const defaultReviews: Review[] = [
  {
    id: "1",
    name: "Mohammed Al-Rashid",
    rating: 5,
    text: "The guidance I received was exceptional. They helped me choose the right university and made the application process seamless. I'm now studying at my dream university!",
    date: "2 months ago"
  },
  {
    id: "2",
    name: "Sarah Ahmed",
    rating: 5,
    text: "Professional service from start to finish. The counselors were knowledgeable about visa requirements and scholarship opportunities. Highly recommended!",
    date: "1 month ago"
  },
  {
    id: "3",
    name: "Ali Hassan",
    rating: 5,
    text: "Thanks to their expert advice, I secured admission to a top-ranked university with a generous scholarship. The team went above and beyond to help me succeed.",
    date: "3 weeks ago"
  }
];

interface CustomerReviewsProps {
  reviews?: Review[];
}

export function CustomerReviews({ reviews = defaultReviews }: CustomerReviewsProps) {
  return (
    <section id="reviews" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">What Our Students Say</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real experiences from students who trusted us with their study abroad journey
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {reviews.map((review) => (
            <Card key={review.id} className="border-0 shadow-lg hover-lift bg-white">
              <CardContent className="p-8">
                {/* Google Logo */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-xs text-muted-foreground">Google Review</span>
                  </div>
                  <Quote className="w-8 h-8 text-primary/20" />
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-muted-foreground leading-relaxed mb-6 line-clamp-4">
                  {review.text}
                </p>

                {/* User Info */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-lg">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.date}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View More Button */}
        <div className="text-center mt-8">
          <button className="px-8 py-3 bg-gradient-primary text-white font-semibold rounded-full hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">
            Read More Reviews
          </button>
        </div>
      </div>
    </section>
  );
}
