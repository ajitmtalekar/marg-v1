// buildFloorGraph.js
import React, { useEffect, useState } from "react";

// buildFloorGraph.js

export function buildFloorGraph(exhibits, paths, mode = "normal") {
  const nodes = new Map();   // nodeId -> { id, coord, floor }
  const edges = new Map();   // nodeId -> [ { to, weight } ]

  /* -------------------------------------------------------
     Utilities
  ------------------------------------------------------- */

  function addNode(node) {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    }
  }

  function addEdge(from, to, weight = 1) {
    if (!nodes.has(from) || !nodes.has(to)) {
      console.warn("⚠ Edge skipped — missing node:", from, to);
      return;
    }

    if (!edges.has(from)) edges.set(from, []);

    edges.get(from).push({
      to,
      weight: Number(weight) || 1
    });
  }

  function makeNodeId(id, floor) {
    return `${id}@f${floor}`;
  }

  /* -------------------------------------------------------
     1️⃣ Create Nodes (from exhibits)
  ------------------------------------------------------- */

  exhibits.forEach(e => {
    if (!e?.id || !Array.isArray(e.coords) || e.floor == null) return;

    addNode({
      id: makeNodeId(e.id, e.floor),
      coord: e.coords,
      floor: Number(e.floor)
    });
  });

  /* -------------------------------------------------------
     2️⃣ Create Edges (from path features)
  ------------------------------------------------------- */

  if (!paths?.features) return { nodes, edges };

  paths.features.forEach(feature => {
    const p = feature.properties || {};

    const modes = Array.isArray(p.modes) ? p.modes : ["normal"];
    const status = p.status || "open";

    // Skip closed paths
    if (status === "closed") return;

    // Skip incompatible routing mode
    if (!modes.includes(mode)) return;

    const weight = Number(p.weight ?? 1);

    /* ------------------------------
       HORIZONTAL PATHS
    ------------------------------ */

    if (p.pathType !== "vertical") {

      if (!p.from || !p.to || p.floor == null) return;

      const from = makeNodeId(p.from, p.floor);
      const to   = makeNodeId(p.to, p.floor);

      addEdge(from, to, weight);

      // default both if undefined
      const oneway = String(p.oneway || "both").toLowerCase();

      if (oneway === "both") {
        addEdge(to, from, weight);
      }
      else if (oneway === "reverse") {
        addEdge(to, from, weight);
      }
      // if "forward" → only from → to (already added)
    }

    /* ------------------------------
       VERTICAL CONNECTORS
    ------------------------------ */

    if (p.pathType === "vertical") {

      if (
        !p.from ||
        !p.to ||
        p.fromFloor == null ||
        p.toFloor == null
      ) return;

      const from = makeNodeId(p.from, p.fromFloor);
      const to   = makeNodeId(p.to, p.toFloor);

      addEdge(from, to, weight);
      addEdge(to, from, weight);
    }
  });

  return { nodes, edges };
}

