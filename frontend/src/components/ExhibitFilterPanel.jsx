import React, { useState } from "react";
import exhibits from "../data/exhibits.json";

export default function ExhibitFilterPanel({ filters }) {
  const allCategories = [...new Set(exhibits.map(ex => ex.category))];

  const [search, setSearch] = useState("");

  return (
    <div className="filter-panel">
      <h3>Filters</h3>

      <input
        placeholder="Search exhibit..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="filter-search"
      />

      <div className="filter-buttons">
        <button onClick={() => filters.setAll(allCategories, true)}>Show All</button>
        <button onClick={() => filters.setAll(allCategories, false)}>Hide All</button>
      </div>

      {allCategories.map(cat => (
        <div key={cat} className="filter-item">
          <input
            type="checkbox"
            checked={filters.activeCategories[cat] ?? true}
            onChange={() => filters.toggleCategory(cat)}
          />
          <label>{cat.toUpperCase()}</label>
        </div>
      ))}
    </div>
  );
}
