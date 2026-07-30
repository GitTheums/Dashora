import { ThemeProvider } from "@dashora/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "./auth/auth-gate.js";
import { loadWebEnv } from "./env.js";
import "@dashora/ui/fonts";
import "@dashora/ui/styles.css";
import "./styles.css";

const env = loadWebEnv(import.meta.env);
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider defaultMode="system">
      <AuthGate appName={env.VITE_APP_NAME} apiBaseUrl={env.VITE_API_BASE_URL} />
    </ThemeProvider>
  </StrictMode>,
);
