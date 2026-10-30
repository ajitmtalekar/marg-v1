import React from "react";
import exhibits from "../data/exhibits.json";

export default function ExhibitSidebar({ onSelect }) {
  const grouped = {};

  exhibits.forEach(ex => {
    if (!grouped[ex.category]) grouped[ex.category] = [];
    grouped[ex.category].push(ex);
  });

  return (
    <div className="sidebar">
      <h3>Exhibits</h3>

      {Object.keys(grouped).map(cat => (
        <div key={cat} className="category-block">
          <h4>{cat.toUpperCase()}</h4>

          {grouped[cat].map(ex => (
            <button 
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className={`cat-btn category-${ex.category}`}
            >
              {ex.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
