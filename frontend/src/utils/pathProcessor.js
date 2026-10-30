// pathProcessor.js
// Utilities to preprocess a GeoJSON LineString network:
//  - node snapping (merge nearly-equal coordinates)
//  - create reverse LineStrings if missing (optional)
//  - ensure graph built with two-way edges (graphlib undirected still works)
//  - connectivity check (components) and simple report
//
// Usage:
//   import { processPathNetwork } from './utils/pathProcessor'
//   const { cleaned, graph, report } = processPathNetwork(rawPathData, { snapToleranceMeters: 15 })

import * as turf from "@turf/turf";
import { Graph, alg } from "graphlib";

/**
 * Helper: normalize [lon,lat] to fixed decimals
 */
function normalizeLonLat(coord, decimals = 6) {
  return [Number(coord[0].toFixed(decimals)), Number(coord[1].toFixed(decimals))];
}

/**
 * Distance (meters) between two [lon,lat]
 */
function distMeters(aLonLat, bLonLat) {
  try {
    return turf.distance(turf.point(aLonLat), turf.point(bLonLat), { units: "kilometers" }) * 1000;
  } catch (e) {
    return Infinity;
  }
}

/**
 * processPathNetwork
 * @param {GeoJSON.FeatureCollection<LineString>} raw Path network
 * @param {Object} opts
 *   - snapToleranceMeters: merge nodes closer than this (default 15m)
 *   - decimals: coordinate rounding precision (default 6)
 *   - addReverseIfMissing: true -> add reverse LineStrings for one-way missing features
 *   - autoBridgeCloseNodes: if true, create tiny connecting edges between cluster nodes (default false)
 */
export function processPathNetwork(raw, opts = {}) {
  const {
    snapToleranceMeters = 12,
    decimals = 6,
    addReverseIfMissing = true,
    autoBridgeCloseNodes = false,
    bridgeToleranceMeters = 5
  } = opts;

  if (!raw || !raw.features) throw new Error("Invalid raw path data");

  // 1) collect all endpoints / vertices
  const nodes = []; // { id, coord: [lon,lat] }
  const nodeIndex = []; // array of coords
  const coordToNodeId = new Map();

  function findOrCreateNode(lonlat) {
    const norm = normalizeLonLat(lonlat, decimals);
    // linear scan: number of nodes will be small for  map; otherwise optimize with KD-tree
    for (let i = 0; i < nodeIndex.length; i++) {
      const n = nodeIndex[i];
      const d = distMeters(n, norm);
      if (d <= snapToleranceMeters) {
        return i; // use existing index
      }
    }
    // create new
    nodeIndex.push(norm);
    return nodeIndex.length - 1;
  }

  // 2) Walk lines and snap coordinates to nodes (snap internal vertices too)
  const cleanedFeatures = [];
  raw.features.forEach((f, fi) => {
    if (!f.geometry || f.geometry.type !== "LineString") return;

    const coords = f.geometry.coordinates;
    if (!coords || coords.length < 2) return;

    // For each vertex, map to nearest snapped node coordinate
    const snappedCoords = coords.map((pt) => {
      const nId = findOrCreateNode(pt);
      return nodeIndex[nId];
    });

    // Remove consecutive duplicate coordinates (after snapping)
    const dedup = [];
    for (let i = 0; i < snappedCoords.length; i++) {
      const prev = dedup.length ? dedup[dedup.length - 1] : null;
      if (!prev || prev[0] !== snappedCoords[i][0] || prev[1] !== snappedCoords[i][1]) {
        dedup.push(snappedCoords[i]);
      }
    }
    if (dedup.length < 2) return; // ignore degenerate
    cleanedFeatures.push({
      type: "Feature",
      properties: { ...(f.properties || {}), _origId: f.properties?.id || `f${fi}` },
      geometry: { type: "LineString", coordinates: dedup },
    });
  });

  // 3) Optionally add reverse features when missing.
  // Build a set of canonical edge keys for quick lookup: key = "lon1,lat1|lon2,lat2"
  const edgeKey = (a, b) => `${a[0]},${a[1]}|${b[0]},${b[1]}`;
  const presentEdges = new Set();
  cleanedFeatures.forEach((f) => {
    const c = f.geometry.coordinates;
    // register each pair (edge along the polyline)
    for (let i = 0; i < c.length - 1; i++) {
      const a = normalizeLonLat(c[i], decimals);
      const b = normalizeLonLat(c[i + 1], decimals);
      presentEdges.add(edgeKey(a, b));
    }
  });

  if (addReverseIfMissing) {
    const toAdd = [];
    cleanedFeatures.forEach((f) => {
      const c = f.geometry.coordinates;
      for (let i = 0; i < c.length - 1; i++) {
        const a = normalizeLonLat(c[i], decimals);
        const b = normalizeLonLat(c[i + 1], decimals);
        const revKey = edgeKey(b, a);
        if (!presentEdges.has(revKey)) {
          // create reverse mini-feature for that segment
          const feat = {
            type: "Feature",
            properties: { id: `${f.properties?._origId||'seg'}_rev_${i}` },
            geometry: { type: "LineString", coordinates: [b, a] },
          };
          toAdd.push(feat);
          presentEdges.add(revKey);
        }
      }
    });
    // append reverse edges (if any)
    if (toAdd.length) {
      toAdd.forEach((f) => cleanedFeatures.push(f));
    }
  }

  // 4) Optionally auto-bridge close nodes (small gap filling)
  if (autoBridgeCloseNodes) {
    // build node list from cleaned features
    const nodeList = {};
    cleanedFeatures.forEach((f) => {
      const c = f.geometry.coordinates;
      for (let i = 0; i < c.length; i++) {
        const k = `${c[i][0]},${c[i][1]}`;
        nodeList[k] = c[i];
      }
    });
    const keys = Object.keys(nodeList);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = nodeList[keys[i]];
        const b = nodeList[keys[j]];
        const d = distMeters(a, b);
        if (d > 0 && d <= bridgeToleranceMeters) {
          // create tiny connecting segment if not present
          const k1 = edgeKey(a, b);
          const k2 = edgeKey(b, a);
          if (!presentEdges.has(k1) && !presentEdges.has(k2)) {
            const fwd = { type: "Feature", properties: { id: `auto_bridge_${i}_${j}` }, geometry: { type: "LineString", coordinates: [a, b] } };
            cleanedFeatures.push(fwd);
            presentEdges.add(k1);
            presentEdges.add(k2);
          }
        }
      }
    }
  }

  // 5) Build a graph (undirected) using mapped node coords
  // Node keys will be string "lon,lat"
  const graph = new Graph({ directed: false });

  // fill graph nodes & edges
  cleanedFeatures.forEach((f) => {
    const coords = f.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = normalizeLonLat(coords[i], decimals);
      const b = normalizeLonLat(coords[i + 1], decimals);
      const aKey = `${a[0]},${a[1]}`;
      const bKey = `${b[0]},${b[1]}`;
      if (!graph.hasNode(aKey)) graph.setNode(aKey, { coord: a });
      if (!graph.hasNode(bKey)) graph.setNode(bKey, { coord: b });
      const distanceKm = turf.distance(turf.point(a), turf.point(b));
      // set both directions just in case underlying Graph liberty treats directed edges
      graph.setEdge(aKey, bKey, Number(distanceKm));
      graph.setEdge(bKey, aKey, Number(distanceKm));
    }
  });

  // 6) Connectivity check using graphlib.alg.components on directed view:
  // Because graph is undirected, connected components are groups
  let components = [];
  try {
    const comps = alg.components(graph);
    components = comps; // array of arrays of nodeIds
  } catch (e) {
    // fallback: BFS to find connected components
    const visited = new Set();
    const nodesList = graph.nodes();
    for (const n of nodesList) {
      if (visited.has(n)) continue;
      const stack = [n];
      const comp = [];
      while (stack.length) {
        const v = stack.pop();
        if (visited.has(v)) continue;
        visited.add(v);
        comp.push(v);
        const neigh = graph.successors(v) || [];
        for (const w of neigh) if (!visited.has(w)) stack.push(w);
      }
      components.push(comp);
    }
  }

  // 7) Final cleaned GeoJSON: ensure coordinates are numbers and rounded
  const cleaned = {
    type: "FeatureCollection",
    features: cleanedFeatures.map((f, idx) => ({
      type: "Feature",
      properties: { ...(f.properties || {}), _cleanedId: f.properties?.id || `cleaned_${idx}` },
      geometry: { type: "LineString", coordinates: f.geometry.coordinates.map((c) => normalizeLonLat(c, decimals)) },
    })),
  };

  // 8) Prepare a report
  const report = {
    originalFeatureCount: raw.features.length,
    cleanedFeatureCount: cleanedFeatures.length,
    nodeCount: graph.nodeCount(),
    edgeCount: graph.edgeCount(),
    componentsCount: components.length,
    componentsSample: components.slice(0, 5).map((c) => ({ size: c.length, sample: c.slice(0, 3) })),
    warnings: [],
  };

  if (components.length > 1) {
    report.warnings.push(`Network has ${components.length} disconnected components. First component sizes: ${components.map(c => c.length).join(',')}`);
  }
  if (cleanedFeatures.length === 0) {
    report.warnings.push("No valid LineString features found after cleaning.");
  }

  return { cleaned, graph, report };
}
