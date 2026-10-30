import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import QRgenerate from "./QRgenerate.jsx";
import DataEditor from "./DataEditor.jsx";
import TileGenerator from "../src/components/TileGenerator.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import "leaflet/dist/leaflet.css";


// ✅ Detect base path automatically
const getBaseName = () => {
  if (!import.meta.env.PROD) return "/";
  if (window.location.pathname.startsWith("/mummap")) return "/mummap";
  return "/map"; // default
};

const basename = getBaseName();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .then(reg => console.log("SW registered:", reg.scope))
      .catch(err => console.error("SW registration failed:", err));
  });
}


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        {/* App wraps all app-level navigation */}
        <Route path="*" element={<App />} />

        {/* Standalone route */}
        <Route path="/QR" element={<QRgenerate />} />

         <Route path="/Data" element={<DataEditor />} />
          <Route path="/tiles" element={<TileGenerator />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
