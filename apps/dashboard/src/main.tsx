import React from "react";
import { createRoot } from "react-dom/client";
// Use the original App for E2E compatibility; AppNew available for new frontend
import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
