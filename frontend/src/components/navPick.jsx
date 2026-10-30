import React from "react";
import "../styles/NavPick.css";

export function NavIconPicker({ onSelect, onClose }) {
  const handleSelect = (type) => {
    onSelect(type);
    onClose(); // close picker after selection
  };

  return (
    <div className="nav-icon-overlay" onClick={onClose}>
      <div
        className="nav-icon-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Choose Navigation Icon</h3>

        <div className="nav-icon-grid">
          <button onClick={() => handleSelect("dot")}>
            🔵 <span>Default Blue Dot</span>
          </button>

          <button onClick={() => handleSelect("arrow")}>
            ➤ <span>Arrow (Walking)</span>
          </button>

          <button onClick={() => handleSelect("car")}>
            🚗 <span>Car</span>
          </button>

          <button onClick={() => handleSelect("bike")}>
            🚲 <span>Bike</span>
          </button>

          <button onClick={() => handleSelect("walk")}>
            🐅 <span>Tiger</span>
          </button>

          <button onClick={() => handleSelect("penguin")}>
            🐧 <span>Penguin</span>
          </button>

          <button onClick={() => handleSelect("emergency")}>
            🧑‍🚒 <span>Emergency</span>
          </button>
        </div>

        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
