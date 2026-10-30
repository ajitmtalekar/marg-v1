/*
// src/components/MobileBottomSheet.jsx
import React, { useEffect, useState, useRef } from "react";

export default function MobileBottomSheet({ children, id }) {
  const [open, setOpen] = useState(false);
  const startY = useRef(0);
  const sheetRef = useRef(null);

  useEffect(() => {
    function onNav(ev) {
      const tab = ev.detail?.tab;
      if (tab === "exhibits") setOpen((v) => !v);
      else if (tab === "directions") setOpen(true);
      else setOpen(false);
    }
    window.addEventListener("botnav-change", onNav);
    return () => window.removeEventListener("botnav-change", onNav);
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    function touchStart(e) {
      startY.current = e.touches?.[0]?.clientY ?? 0;
    }
    function touchMove(e) {
      const dy = (e.touches?.[0]?.clientY ?? 0) - startY.current;
      if (dy > 50) {
        // swipe down -> close
        setOpen(false);
      }
    }
    el.addEventListener("touchstart", touchStart);
    el.addEventListener("touchmove", touchMove);
    return () => {
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
    };
  }, []);

  return (
    <div
      ref={sheetRef}
      id={id}
      className={`mobile-sheet ${open ? "open" : ""}`}
      onClick={(e) => {
        // if click outside content, close
        if (e.target.classList.contains("mobile-sheet")) setOpen(false);
      }}
    >
      <div className="sheet-handle" onClick={() => setOpen((s) => !s)} />
      <div className="sheet-content">{children}</div>
    </div>
  );
}
*/

import React, { useRef, useState } from "react";
import "../styles/mobile-bottomsheet.css";

export default function MobileBottomSheet({ isOpen, onClose, children }) {
  
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [dragging, setDragging] = useState(false);

  if (!isOpen) return null;  

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };

  const onTouchMove = (e) => {
    if (!dragging) return;

    currentY.current = e.touches[0].clientY - startY.current;

    if (currentY.current > 0) {
      sheetRef.current.style.transform = `translateY(${currentY.current}px)`;
    }
  };

  const onTouchEnd = () => {
    setDragging(false);

    if (currentY.current > 120) {
      onClose(); // close sheet
    } else {
      sheetRef.current.style.transform = "translateY(0px)"; // return to open
    }

    currentY.current = 0;
  };

  return (
    <div className={`bottomsheet-overlay ${isOpen ? "open" : ""}`}>
      <div
        ref={sheetRef}
        className={`bottomsheet ${isOpen ? "open" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="drag-handle"></div>

        <div className="bottomsheet-content">{children}</div>
      </div>
    </div>
  );
}
