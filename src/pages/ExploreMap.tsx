/**
 * Full-screen Explore Map page
 * Route: /explore-map
 */
import { WorldMapSection } from "@/components/home/WorldMapSection";
import { Layout } from "@/components/layout/Layout";

export default function ExploreMap() {
  return (
    <Layout>
      <div className="w-full min-h-[calc(100vh-64px)]">
        <WorldMapSection />
      </div>
    </Layout>
  );
}
