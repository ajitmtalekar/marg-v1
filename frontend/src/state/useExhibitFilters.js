import { useState } from "react";

export default function useExhibitFilters() {
  const [activeCategories, setActiveCategories] = useState({});

  function toggleCategory(cat) {
    setActiveCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  }

  function setAll(categories, state) {
    const obj = {};
    categories.forEach(c => obj[c] = state);
    setActiveCategories(obj);
  }

  return { activeCategories, toggleCategory, setAll };
}
