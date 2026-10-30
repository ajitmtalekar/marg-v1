import React from "react";
import "./bottom-nav.css";

export default function BottomNav({ active, setActive }) {
  return (
    <div className="bottom-nav">
      onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
     
      <div className={`nav-item ${active==="exhibits"?"active":""}`} onClick={()=>setActive("exhibits")}>📍 Exhibits</div>

    </div>
  );
}

/* 
 <div className={`nav-item ${active==="map"?"active":""}`} onClick={()=>setActive("map")}>🗺 Map</div>
      <div className={`nav-item ${active==="directions"?"active":""}`} onClick={()=>setActive("directions")}>➡ Directions</div>
      <div className={`nav-item ${active==="settings"?"active":""}`} onClick={()=>setActive("settings")}>⚙ Settings</div>
// src/components/BottomNav.jsx
import React from "react";

export default function BottomNav({ onTab }) {
  return (
    <div className="bottom-nav">
      <button className="bottom-tab" onClick={() => onTab("map")}>Map</button>
      <button className="bottom-tab" onClick={() => onTab("exhibits")}>Exhibits</button>
      <button className="bottom-tab" onClick={() => onTab("directions")}>Directions</button>
      <button className="bottom-tab" onClick={() => onTab("settings")}>Settings</button>
    </div>
  );
}
*/