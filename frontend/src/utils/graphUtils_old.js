import { Graph, alg } from "graphlib";
import * as turf from "@turf/turf";

/**
 * 🔑 Create a consistent key for graph nodes.
 */
export function keyFor(coord) {
  if (!coord || coord.length < 2 || isNaN(coord[0]) || isNaN(coord[1])) {
    console.warn("⚠️ Invalid coords for key:", coord);
    return "[0,0]";
  }
  const [lon, lat] = coord.map((n) => Number(n.toFixed(4)));
  return `[${lon},${lat}]`;
}

/**
 * 🎯 Normalize coordinate precision (round to 4 decimals)
 */
export function normalizeCoord(coord) {
  if (!coord || coord.length < 2) return [0, 0];
  const [lon, lat] = coord.map(Number);
  return [Number(lon.toFixed(4)), Number(lat.toFixed(4))];
}

/**
 * 🧭 Build a bidirectional weighted graph from path GeoJSON
 */
export function buildGraph(pathData) {
  const g = new Graph({ directed: false });
  if (!pathData?.features?.length) {
    console.error("❌ No path data available!");
    return g;
  }

  const addedEdges = new Set();
  const baseDistances = [];

  pathData.features.forEach((feature) => {
    if (feature.geometry.type !== "LineString") return;
    const coords = feature.geometry.coordinates;

    for (let i = 0; i < coords.length - 1; i++) {
      const a = normalizeCoord(coords[i]);
      const b = normalizeCoord(coords[i + 1]);

      const keyA = keyFor(a);
      const keyB = keyFor(b);

      if (!g.hasNode(keyA)) g.setNode(keyA, a);
      if (!g.hasNode(keyB)) g.setNode(keyB, b);

      const dist = turf.distance(turf.point(a), turf.point(b), { units: "kilometers" }) * 1000;
      baseDistances.push(dist);

      const edgeKey = [keyA, keyB].sort().join("-");
      if (!addedEdges.has(edgeKey)) {
        g.setEdge(keyA, keyB, dist);
        g.setEdge(keyB, keyA, dist);
        addedEdges.add(edgeKey);
      }
    }
  });

  // Auto-connect nearby nodes
  const sorted = baseDistances.slice().sort((a, b) => a - b);
  const medianDist = sorted[Math.floor(sorted.length / 2)] || 200;
  const proximityThreshold = medianDist * 1.25;

  const nodes = g.nodes();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const aKey = nodes[i];
      const bKey = nodes[j];
      const a = g.node(aKey);
      const b = g.node(bKey);

      const dist = turf.distance(turf.point(a), turf.point(b), { units: "kilometers" }) * 1000;
      if (dist > 0 && dist <= proximityThreshold && !g.hasEdge(aKey, bKey)) {
        g.setEdge(aKey, bKey, dist);
        g.setEdge(bKey, aKey, dist);
      }
    }
  }

  return g;
}

/**
 * 🚀 Get route using Dijkstra
 */
export function getRoute(graph, fromKey, toKey) {
  if (!graph.hasNode(fromKey) || !graph.hasNode(toKey)) return [];

  const weightFn = (v, w) => graph.edge(v, w);
  const edgeFn = (v) => graph.neighbors(v) || [];

  try {
    const result = alg.dijkstra(graph, fromKey, weightFn, edgeFn);

    if (!result[toKey] || !isFinite(result[toKey].distance)) return [];

    const path = [];
    let current = toKey;
    while (current && current !== fromKey) {
      path.unshift(current);
      current = result[current]?.predecessor;
    }
    if (current === fromKey) path.unshift(fromKey);

    return path.map((key) => graph.node(key));
  } catch (err) {
    console.error("❌ Dijkstra computation failed:", err);
    return [];
  }
}

/**
 * 🧩 Snap arbitrary GPS coords to nearest node and get safe route
 */
export function getRouteSnapped(graph, startCoord, endCoord) {
  if (!graph || graph.nodeCount() === 0) return [];

  const allNodes = graph.nodes().map((key) => ({
    key,
    coords: graph.node(key),
  }));

  const snapToNearestNode = (coord) => {
    let nearestKey = null;
    let minDist = Infinity;
    const target = turf.point(coord);

    for (const { key, coords } of allNodes) {
      const d = turf.distance(target, turf.point(coords), { units: "kilometers" });
      if (d < minDist) {
        minDist = d;
        nearestKey = key;
      }
    }
    return nearestKey;
  };

  const fromKey = snapToNearestNode(startCoord);
  const toKey = snapToNearestNode(endCoord);

  if (!fromKey || !toKey) return [];

  return getRoute(graph, fromKey, toKey);
}

/**
 * 🌍 Export graph as GeoJSON
 */
export function exportGraphAsGeoJSON(graph) {
  const features = [];

  graph.nodes().forEach((nodeKey) => {
    const coords = graph.node(nodeKey);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: { type: "node", id: nodeKey },
    });
  });

  graph.edges().forEach((edge) => {
    const src = graph.node(edge.v);
    const tgt = graph.node(edge.w);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [src, tgt] },
      properties: { type: "edge", from: edge.v, to: edge.w },
    });
  });

  return { type: "FeatureCollection", features };
}
