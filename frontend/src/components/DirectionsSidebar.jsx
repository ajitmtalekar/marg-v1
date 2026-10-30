import React, { useEffect, useRef } from "react";
import {
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  
  LinearProgress,
  
} from "@mui/material";

import TurnLeftIcon from "@mui/icons-material/TurnLeft";
import TurnRightIcon from "@mui/icons-material/TurnRight";
import StraightIcon from "@mui/icons-material/Straight";
import UTurnLeftIcon from "@mui/icons-material/UTurnLeft";
import NavigationIcon from "@mui/icons-material/Navigation";

export default function DirectionsSidebar({
  directions,
  currentStep,
  progressPercent,
  
  onClose, // 👈 REQUIRED
}) {


  // ⭐ ICON DETECTION
  const getIcon = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("left")) return <TurnLeftIcon />;
    if (lower.includes("right")) return <TurnRightIcon />;
    if (lower.includes("continue") || lower.includes("straight") || lower.includes("ahead"))
      return <StraightIcon />;
    if (lower.includes("u-turn")) return <UTurnLeftIcon />;
    return <NavigationIcon />;
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        top: "64px",                         // ⬅ BELOW NAV HEADER
        right: 0,
        bottom: "96px",                      // ⬅ ABOVE FOOTER
        width: {
          xs: "92vw",
          md: "380px",
        },

        zIndex: 3200,
        overflowY: "auto",
        backgroundColor: "#fff",

        borderRadius: "16px 0 0 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",

        animation: "slideIn 220ms ease-out",

        "@keyframes slideIn": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      }}
    >



      {/* ⭐ STICKY HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: "1rem",
            color: "#1a237e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🧭 Directions
        </h2>

        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ✕
        </button>



        <LinearProgress variant="determinate" value={progressPercent} sx={{ mt: 1 }} />
      </div>

      {/* ⭐ DIRECTIONS LIST */}
      <List sx={{ padding: 0 }}>
  {directions[currentStep] && (
    <>
      <ListItem
        sx={{
          background: "#eafde3",
          borderLeft: "6px solid #1E88E5",
          py: 2,
        }}
      >
        <ListItemIcon sx={{ color: "#1E88E5" }}>
          {getIcon(directions[currentStep])}
        </ListItemIcon>

        <ListItemText
          primary={directions[currentStep]}
          slotProps={{
            primary: {
              sx: {
                fontWeight: 700,
                color: "#1E88E5",
                fontSize: "1rem",
              },
            },
          }}
        />
      </ListItem>

      <LinearProgress
        variant="determinate"
        value={100}
        sx={{ height: 4, borderRadius: 2 }}
      />
    </>
  )}
</List>

    </Paper>
  );
}
