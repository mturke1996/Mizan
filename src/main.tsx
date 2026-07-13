import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import { RegisteredPwaUpdatePrompt } from "@/shared/pwa/RegisteredPwaUpdatePrompt";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("تعذر العثور على عنصر تشغيل التطبيق");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
        <RegisteredPwaUpdatePrompt />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
