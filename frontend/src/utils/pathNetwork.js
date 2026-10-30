import { Graph } from "@dagrejs/graphlib";
import * as turf from "@turf/turf";

export function keyFor(coords) {
  if (!coords || coords.length !== 2) return null;
  return `${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;
}

export function normalizeCoord(coords) {
  return coords.map((c) => parseFloat(c.toFixed(5)));
}

export function buildGraph(pathData) {
  if (!pathData || !Array.isArray(pathData.nodes) || !Array.isArray(pathData.edges)) {
    throw new Error("Invalid or empty pathData provided to buildGraph");
  }

  const g = new Graph({ directed: false });

  pathData.nodes.forEach((node) => {
    const k = keyFor(node.coords);
    if (k && !g.hasNode(k)) g.setNode(k, normalizeCoord(node.coords));
  });

  pathData.edges.forEach((edge) => {
    const fromKey = keyFor(edge.from);
    const toKey = keyFor(edge.to);
    if (fromKey && toKey && !g.hasEdge(fromKey, toKey)) {
      const distance =
        edge.distance ||
        turf.distance(turf.point(edge.from), turf.point(edge.to), { units: "kilometers" }) * 1000;
      g.setEdge(fromKey, toKey, distance);
    }
  });

  return g;
}

export function findShortestPath(graph, fromKey, toKey) {
  if (!graph || !graph.hasNode(fromKey) || !graph.hasNode(toKey)) {
    console.warn("Invalid nodes for pathfinding", fromKey, toKey);
    return null;
  }

  const { dijkstra } =  import("@dagrejs/graphlib/lib/alg/dijkstra.js");
  const distances = dijkstra(graph, fromKey);

  if (!distances[toKey] || !distances[toKey].distance || !isFinite(distances[toKey].distance)) {
    return null;
  }

  const path = [];
  let current = toKey;
  while (current) {
    path.unshift(current);
    current = distances[current].predecessor;
  }

  return path;
}
