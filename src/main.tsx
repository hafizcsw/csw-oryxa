// Entry point - main.tsx
import './i18n'; // Initialize i18next FIRST!
import { Suspense } from 'react';
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/ui/PageLoader";
import App from "./App.tsx";
import "./index.css";
import "./styles/universities.css";
import "./styles/ai.css";
import { initWebVitals } from "./lib/vitals";

// Clear stale SW caches on every load to prevent serving old versions
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (import.meta.env.DEV) {
          void reg.unregister();
        }
      });
    }).catch(() => {});
  }

  if (import.meta.env.DEV && "caches" in window) {
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
          <App />
        </ChatProvider>
      </LanguageProvider>
    </Suspense>
  </ErrorBoundary>
);
