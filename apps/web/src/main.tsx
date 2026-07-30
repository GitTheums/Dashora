import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { loadWebEnv } from "./env.js";
import "@dashora/ui/styles.css";
import "./styles.css";

const env = loadWebEnv(import.meta.env);
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App appName={env.VITE_APP_NAME} />
  </StrictMode>,
);
