import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSmoothScroll } from "./lib/smoothScroll";

// MSW mocks DISABLED — frontend now hits real backend directly.
// Set VITE_API_BASE_URL in .env (e.g. VITE_API_BASE_URL=http://localhost:8000)

// Init Lenis smooth scroll (no-op under prefers-reduced-motion)
initSmoothScroll();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
