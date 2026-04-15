// Script to update country images in database
import { supabase } from "@/integrations/supabase/client";

// Map of country slugs to image paths
const countryImages: Record<string, string> = {
  'australia': '/src/assets/countries/australia.jpg',
  'canada': '/src/assets/countries/canada.jpg',
  'china': '/src/assets/countries/china.jpg',
  'germany': '/src/assets/countries/germany.jpg',
  'japan': '/src/assets/countries/japan.jpg',
  'netherlands': '/src/assets/countries/netherlands.jpg',
  'russia': '/src/assets/countries/russia.jpg',
  'turkey': '/src/assets/countries/turkey.jpg',
  'uk': '/src/assets/countries/uk.jpg',
};

export async function updateCountryImages() {
  console.log('🚀 Starting country images update...');
  
  for (const [slug, imagePath] of Object.entries(countryImages)) {
    try {
      const { error } = await supabase
        .from('countries')
        .update({ image_url: imagePath })
        .eq('slug', slug);
      
      if (error) {
        console.error(`❌ Error updating ${slug}:`, error);
      } else {
        console.log(`✅ Updated ${slug} with image: ${imagePath}`);
      }
    } catch (e) {
      console.error(`❌ Exception updating ${slug}:`, e);
    }
  }
  
  console.log('✨ Country images update completed!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateCountryImages();
}
