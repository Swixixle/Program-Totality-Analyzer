console.log("BOOT-PROBE: main.tsx executed");
console.log("BOOT-PROBE: main.tsx path =", import.meta.url);

const boot = document.getElementById("boot-probe");
if (boot) boot.textContent = "BOOT-PROBE: main.tsx executed";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("BOOT-PROBE: #root element not found");
} else {
  rootEl.innerHTML = `
    <div style="padding:16px;font:16px monospace;color:#0f0;background:#000">
      BOOT-PROBE: root mounted (no React) - testing...
    </div>
  `;
  console.log("BOOT-PROBE: root mounted (no React)");
  
  setTimeout(() => {
    createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("BOOT-PROBE: React render called");
  }, 100);
}
