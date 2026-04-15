import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAvatar, SkeletonInput, SkeletonText } from "@/components/ui/skeleton-variants";
import { Card } from "@/components/ui/card";

export default function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-mesh py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton with staggered animation */}
        <div className="mb-8">
          <Skeleton 
            className="h-12 w-64 mb-4" 
            style={{ animationDelay: '0ms' }}
          />
          <Skeleton 
            className="h-6 w-48" 
            style={{ animationDelay: '100ms' }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="flex flex-col items-center">
                <Skeleton 
                  className="w-32 h-32 rounded-full mb-4" 
                  style={{ animationDelay: '150ms' }}
                />
                <Skeleton 
                  className="h-6 w-40 mb-2" 
                  style={{ animationDelay: '200ms' }}
                />
                <Skeleton 
                  className="h-4 w-32 mb-6" 
                  style={{ animationDelay: '250ms' }}
                />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton 
                    key={i} 
                    className="h-10 w-full rounded-md" 
                    style={{ animationDelay: `${300 + i * 50}ms` }}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-6">
              <Skeleton 
                className="h-8 w-48 mb-6" 
                style={{ animationDelay: '200ms' }}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton 
                      className="h-4 w-24" 
                      style={{ animationDelay: `${250 + i * 50}ms` }}
                    />
                    <Skeleton 
                      className="h-10 w-full rounded-md" 
                      style={{ animationDelay: `${300 + i * 50}ms` }}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <Skeleton 
                className="h-8 w-48 mb-6" 
                style={{ animationDelay: '500ms' }}
              />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton 
                    key={i} 
                    className="h-20 w-full rounded-lg" 
                    style={{ animationDelay: `${550 + i * 100}ms` }}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
