// weights.js

export function getEdgeWeight(edge, mode) {
  if (mode === "emergency") {
    // Prefer emergency paths
    if (edge.modes.includes("emergency")) return edge.weight * 0.5;
    return edge.weight * 5; // strongly discourage normal paths
  }

  return edge.weight;
}
