import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const enablePWA = mode === "production";

  return {
    define: {
      // Frontend cutover: override Lovable Cloud auto-injected env to point to pkiv project
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://pkivavsxbvwtnkgxaufa.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraXZhdnN4YnZ3dG5rZ3hhdWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODY3NzYsImV4cCI6MjA5MTU2Mjc3Nn0.jYZe5WnjINZdXT9tmizxxfbd1jT4wJ277kdD1nTl1Gs'),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('pkivavsxbvwtnkgxaufa'),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      enablePWA && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt'],
        manifest: {
          name: 'بوابة الطالب',
          short_name: 'الطالب',
          description: 'بوابة الطالب للتسجيل وإدارة المستندات',
          theme_color: '#8b5cf6',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/placeholder.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/~oauth/, /./],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 24 * 60 * 60
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'student-docs-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            },
            // World GeoJSON — large file, rarely changes, CacheFirst with long TTL
            {
              urlPattern: /^https:\/\/raw\.githubusercontent\.com\/datasets\/geo-countries\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-world-geojson-v1',
                expiration: {
                  maxEntries: 2,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Carto basemap tiles — CacheFirst, respects provider caching headers
            {
              urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles-carto-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 7 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ArcGIS satellite/reference tiles
            {
              urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles-arcgis-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 7 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // OpenTopoMap tiles
            {
              urlPattern: /^https:\/\/[a-c]\.tile\.opentopomap\.org\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles-topo-v1',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 7 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Leaflet assets (marker icons from unpkg)
            {
              urlPattern: /^https:\/\/unpkg\.com\/leaflet@.*\/dist\/images\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-leaflet-assets-v1',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ].filter(Boolean) as any,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
