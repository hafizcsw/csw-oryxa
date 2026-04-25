// Entry point - main.tsx
import './i18n'; // Initialize i18next FIRST!
import { Suspense } from 'react';
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ChatProvider } from "./contexts/ChatContext";
import { CommCallProvider } from "./contexts/CommCallContext";
import { CommCallWindow } from "./components/comm/CommCallWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/ui/PageLoader";
import App from "./App.tsx";
import "./index.css";
import "./styles/universities.css";
import "./styles/ai.css";
import { initWebVitals } from "./lib/vitals";

// Aggressively unregister any existing service workers and clear caches
// to recover users stuck on a stale PWA shell (white screen on cswworld.com)
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        void reg.unregister();
      });
    }).catch(() => {});
  }

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => void caches.delete(key));
    }).catch(() => {});
  }
}

// Initialize Web Vitals tracking
initWebVitals();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <LanguageProvider>
        <ChatProvider>
          <CommCallProvider>
            <App />
            <CommCallWindow />
          </CommCallProvider>
        </ChatProvider>
      </LanguageProvider>
    </Suspense>
  </ErrorBoundary>
);
