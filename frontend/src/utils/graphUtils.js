import { alg } from "graphlib";

/**
 * Check if two nodes are connected in the given graph
 * before running Dijkstra.
 */
export function verifyConnectivity(graph, fromKey, toKey) {
  if (!graph.hasNode(fromKey)) {
    console.warn(`🚫 fromKey missing in graph: ${fromKey}`);
    return false;
  }
  if (!graph.hasNode(toKey)) {
    console.warn(`🚫 toKey missing in graph: ${toKey}`);
    return false;
  }

  // Run a quick BFS or Dijkstra without weights to test connectivity
  const result = alg.dijkstra(graph, fromKey, () => 1);
  const distance = result[toKey]?.distance;

  if (distance === Infinity || distance === undefined) {
    console.warn(`🔍 Nodes exist but are not connected: ${fromKey} -> ${toKey}`);
    return false;
  }

  console.info(`✅ Nodes are connected, estimated hops: ${distance}`);
  return true;
}
