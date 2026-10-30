import React, { useState } from "react";
//import exhibits from "../data/exhibits.json";
import "../styles/mobile.css";


export default function ExhibitPanel({ exhibits = [],filters, onSelect }) {
 const [search, setSearch] = useState("");

   const allCategories = [...new Set(exhibits.map(ex => ex.category))];

  // Track which categories are open/closed
  const [openCategories, setOpenCategories] = useState(
    Object.fromEntries(allCategories.map(cat => [cat, true]))
  );

    if (!Array.isArray(exhibits)) {
  console.warn("⚠️ ExhibitPanel received invalid exhibits:", exhibits);
  return null;
  }
  
 

  const toggleCategoryOpen = (cat) => {
    setOpenCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const expandAll = () => {
    setOpenCategories(Object.fromEntries(allCategories.map(cat => [cat, true])));
  };

  const collapseAll = () => {
    setOpenCategories(Object.fromEntries(allCategories.map(cat => [cat, false])));
  };

  // Filtered exhibits for search + checkbox category filter
  const filteredExhibits = exhibits.filter(ex => {
    const matchSearch =
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.id.toLowerCase().includes(search.toLowerCase());

    const matchCategory = filters.activeCategories[ex.category];

    return matchSearch && matchCategory;
  });

  return (
    <div className="exhibit-panel-card">
      <h3 className="ex-title">Exhibits</h3>

      {/* Search */}
      <input
        placeholder="Search exhibit..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      {/* Show/Hide Filters */}
      <div className="filter-buttons">
        <button className="btn-show" onClick={() => filters.setAll(allCategories, true)}>
          Show All
        </button>
        <button className="btn-hide" onClick={() => filters.setAll(allCategories, false)}>
          Hide All
        </button>
      </div>

      {/* Collapse controls */}
      <div className="collapse-controls">
        <button onClick={expandAll} className="btn-expand">Expand All</button>
        <button onClick={collapseAll} className="btn-collapse">Collapse All</button>
      </div>

      {/* Collapsible category sections */}
      {allCategories.map(cat => {
        const items = filteredExhibits.filter(ex => ex.category === cat);
        if (items.length === 0) return null;

        return (
          <div key={cat} className="category-block">

            {/* Category header */}
            <div className="category-header" onClick={() => toggleCategoryOpen(cat)}>
              <span className="category-title">{cat.toUpperCase()}</span>

              {/* Count badge */}
              <span className="category-badge">
                {items.length}
              </span>

              {/* Arrow */}
              <span className={`arrow ${openCategories[cat] ? "open" : ""}`}>▶</span>
            </div>

            {/* Collapsible content */}
            <div
              className={`category-content ${
                openCategories[cat] ? "expanded" : "collapsed"
              }`}
            >
              {items.map(ex => (
                <div
                  key={ex.id}
                  className={`exhibit-btn category-${cat.toLowerCase()}`}
                  onClick={() => onSelect(ex.id)}
                >
                  {ex.name}
                </div>
              ))}
            </div>

          </div>
        );
      })}
    </div>
  );
}
