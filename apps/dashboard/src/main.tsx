import React from "react";
import { createRoot } from "react-dom/client";
import { App as LegacyApp } from "./App";
import { App as NewApp } from "./AppNew";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

const params = new URLSearchParams(window.location.search);
const useLegacy = params.get("legacy") === "1" || params.get("ui") === "legacy";
const useNew = params.get("ui") === "new" || params.get("new_ui") === "1";

createRoot(container).render(
  <React.StrictMode>
    {useLegacy ? <LegacyApp /> : <NewApp />}
  </React.StrictMode>,
);
