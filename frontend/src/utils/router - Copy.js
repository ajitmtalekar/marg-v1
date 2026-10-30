/* ============================================================
   router.js — Complete Fixed Version
   ============================================================ */

import * as turf from "@turf/turf";

/* ------------------------
   Utility Normalization
------------------------- */

// safe normalize + key helpers
export function normalizeCoord(c, decimals = 6) {
  if (!c || !Array.isArray(c) || c.length < 2) return null;
  const x = Number(c[0]);
  const y = Number(c[1]);
  if (!isFinite(x) || !isFinite(y)) return null;
  return [Number(x.toFixed(decimals)), Number(y.toFixed(decimals))];
}

export function coordKey(c, decimals = 6) {
  const n = normalizeCoord(c, decimals);
  if (!n) return null;
  return `[${n[0].toFixed(decimals)},${n[1].toFixed(decimals)}]`;
}



/* ------------------------
   Safe Nearest Node
------------------------- */

export function insertVirtualNode(graph, snappedCoord, key1, key2, props = {}) {
  if (!graph.nodes[key1] || !graph.nodes[key2]) {
    console.warn("⚠ insertVirtualNode: endpoints missing:", key1, key2);
    return null;
  }

  const coord = normalizeCoord(snappedCoord, 6);
  const vKey = coordKey(coord);

  // Do not recreate node if it already exists
  graph.addNode(vKey, coord);

  const pV = turf.point(coord);
  const p1 = turf.point(graph.nodes[key1]);
  const p2 = turf.point(graph.nodes[key2]);

  const d1 = turf.distance(pV, p1);
  const d2 = turf.distance(pV, p2);


  
 // graph.addEdge(vKey, key1, d1);
 // graph.addEdge(key1, vKey, d1);

 // graph.addEdge(vKey, key2, d2);
 // graph.addEdge(key2, vKey, d2);

 // Read direction properties
const oneway = props.oneway || "both";   // default = bidirectional

// -------- 1) TWO-WAY (default) --------
 if (oneway === "forward") {
        // Only key1 → key2 direction
        graph.addEdge(key1, key2, d1 + d2);
    }
    else if (oneway === "reverse") {
        // Only key2 → key1 direction
        graph.addEdge(key2, key1, d1 + d2);
    }
    else {
        // default bidirectional
        graph.addEdge(key1, key2, d1 + d2);
        graph.addEdge(key2, key1, d1 + d2);
    }

  //console.log("InsertVirtualNode:", {vKey,  nearest1: key1, nearest2: key2, snapped: coord});

  return vKey;
}

export function findNearestNodeExact(point, pathData) {
  let bestDist = Infinity;
  let bestSnap = null;
  let bestA = null;
  let bestB = null;
  let bestFeature = null;

  for (const feature of pathData.features) {

    // Only use line strings
    if (!feature || feature.geometry.type !== "LineString") continue;

    const coords = feature.geometry.coordinates;

    for (let i = 0; i < coords.length - 1; i++) {
        const A = coords[i];
        const B = coords[i + 1];

        const snap = turf.nearestPointOnLine(
            turf.lineString([A, B]),
            turf.point(point)
        );

        const dist = snap.properties.dist;

        if (dist < bestDist) {
            bestDist = dist;
            bestSnap = snap.geometry.coordinates;
            bestA = A;
            bestB = B;
            bestFeature = feature; // ⭐ remember the correct feature
        }
    }
  }

  if (!bestSnap) return null;

  return {
    snapped: normalizeCoord(bestSnap, 6),
    nearest1: normalizeCoord(bestA, 6),
    nearest2: normalizeCoord(bestB, 6),
    distanceToLine: bestDist,
    feature: bestFeature  // ⭐ return it here
  };
}



export function findNearestNodeExactold(point, pathData) {
  if (!Array.isArray(point) || point.length !== 2) {
    console.error("❌ findNearestNodeExact invalid point:", point);
    return null;
  }

  const pt = turf.point(point);

  let bestSnap = null;
  let bestDist = Infinity;
  let bestSegment = null;
   let bestA = null;
  let bestB = null;
  let bestFeature = null;

  // 1. Project onto every segment of every LineString
  for (const feature  of pathData.features) {
    if (!feature .geometry || feature.geometry.type !== "LineString") continue;

    const lineCoords = feature .geometry.coordinates;

    for (let i = 0; i < lineCoords.length - 1; i++) {
      const A = lineCoords[i];
      const B = lineCoords[i + 1];
      const seg = turf.lineString([lineCoords[i], lineCoords[i + 1]]);
      const snap = turf.nearestPointOnLine(seg, pt);

      const d = snap.properties?.dist ?? turf.distance(pt, snap);

      if (d < bestDist) {
        bestDist = d;
        bestSnap = snap.geometry.coordinates;
        bestSegment = [lineCoords[i], lineCoords[i + 1]];
        bestA = A;
        bestB = B;
        bestFeature = feature; // ⭐ remember the correct feature
      }
    }
  }

  // Reject clicks far away (> 30m)
  if (!bestSnap || bestDist > 0.030) {
    console.warn("⚠ Click is too far from any path (>30m)");
    return null;
  }

  const [A, B] = bestSegment;

  return {
    snapped: normalizeCoord(bestSnap, 6),
    nearest1: normalizeCoord(A, 6),
    nearest2: normalizeCoord(B, 6),
    distanceToLine: bestDist,
    feature: bestFeature  // ⭐ return it here
  };
}


export function findNearestNode(point, pathData, decimals = 6) {
  if (!pathData || !pathData.features) {
    console.warn("❗ findNearestNode: invalid path data");
    return normalizeCoord(point, decimals);
  }

  const pt = turf.point(normalizeCoord(point, decimals = 6));
  let nearest = null;
  let minDist = Infinity;

  pathData.features.forEach((f) => {
    if (!f.geometry || f.geometry.type !== "LineString") return;

    f.geometry.coordinates.forEach((raw) => {
      const c = normalizeCoord(raw, decimals);
      const d = turf.distance(pt, turf.point(c));

      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    });
  });

  if (!nearest) {
    console.warn("❗ findNearestNode: no nodes found");
    return normalizeCoord(point, decimals = 6);
  }

  return nearest;
}

/* ============================================================
   GRAPH IMPLEMENTATION
============================================================ */

export class Graph {
  constructor() {
    this.nodes = {};      // key → coord
    this.adj = {};        // key → { neighborKey: weight }
    this._edgeCount = 0;
  }

  addNode(key, coord) {
    if (!this.nodes[key]) {
      this.nodes[key] = coord;
      this.adj[key] = {};
    }
  }

  addEdge(a, b, weight) {
    if (!this.adj[a]) this.adj[a] = {};
    if (!this.adj[a][b]) this._edgeCount++;
    this.adj[a][b] = weight;
  }

  nodeCount() {
    return Object.keys(this.nodes).length;
  }

  edgeCount() {
    return this._edgeCount;
  }
}

/* ============================================================
   BUILD GRAPH — FIXED VERSION
============================================================ */

export function buildGraph(pathData) {
  const g = new Graph();

  if (!pathData || !pathData.features) {
    console.error("❗ buildGraph: invalid pathData");
    return g;
  }

  pathData.features.forEach((f) => {
    if (!f.geometry || f.geometry.type !== "LineString") return;

    const coords = f.geometry.coordinates;
    if (!coords || coords.length < 2) return;

    // Loop through ALL segments
    for (let i = 0; i < coords.length - 1; i++) {
      const a = normalizeCoord(coords[i], 6);
      const b = normalizeCoord(coords[i + 1], 6);

      const keyA = coordKey(a);
      const keyB = coordKey(b);

      const dist = turf.distance(turf.point(a), turf.point(b));

      g.addNode(keyA, a);
      g.addNode(keyB, b);

      // forward + reverse
      g.addEdge(keyA, keyB, dist);
      g.addEdge(keyB, keyA, dist);
    }
  });

  //console.log( `📊 Graph built successfully with ${g.nodeCount()} nodes and ${g.edgeCount()} edges` );
  //console.log("DEBUG: graph edges sample:", Object.keys(g.adj).slice(0, 10));
  //console.log("DEBUG: node coords:", Object.keys(g.nodes));

  return g;
}

/* ============================================================
   DIJKSTRA ROUTING
============================================================ */

export function getRoute(startCoord, endCoord, graph, decimals = 6) {
  if (!graph || !graph.nodes || !graph.adj) {
    console.warn("❗ getRoute called with invalid graph");
    return null;
  }

  const startKey = coordKey(startCoord, decimals);
  const endKey = coordKey(endCoord, decimals);

  if (!startKey || !endKey) {
    console.warn("❗ getRoute: start or end coord invalid", { startCoord, endCoord });
    return null;
  }

  if (!graph.nodes[startKey] || !graph.nodes[endKey]) {
    console.warn("❗ getRoute: start or end node missing", { fromFuzzy: startKey, toFuzzy: endKey });
    return null;
  }

  // Dijkstra (same as your implementation) — using graph.nodes and graph.adj
  const dist = {}, prev = {}, visited = new Set();

  Object.keys(graph.nodes).forEach(k => { dist[k] = Infinity; prev[k] = null; });
  dist[startKey] = 0;

  function extractMin() {
    let best = null, bestDist = Infinity;
    for (const k in dist) {
      if (!visited.has(k) && dist[k] < bestDist) { bestDist = dist[k]; best = k; }
    }
    return best;
  }

  while (true) {
    const u = extractMin();
    if (!u) break;
    if (u === endKey) break;
    visited.add(u);
    const neighbors = graph.adj[u] || {};
    for (const v in neighbors) {
      const alt = dist[u] + neighbors[v];
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if ((!prev[endKey] && startKey !== endKey) && dist[endKey] === Infinity) {
    console.warn("❗ getRoute: no route found between nodes", { fromFuzzy: startKey, toFuzzy: endKey });
    return null;
  }

  const path = [];
  let cur = endKey;
  while (cur) {
    path.unshift(graph.nodes[cur]);
    cur = prev[cur];
  }

  return path;
}


/* ============================================================
   TURN DIRECTIONS
============================================================ */

export function getDirections(path, language = "en-IN") {
  if (!path || path.length < 2) return [];

  const steps = [];

  function bearing(a, b) {
    return turf.bearing(turf.point(a), turf.point(b));
  }

  function distance(a, b) {
    return turf.distance(turf.point(a), turf.point(b)) * 1000;
  }

  const isHindi = language === "hi-IN";
  const isMarathi = language === "mr-IN";

  function translateTurn(turn) {
    if (isHindi) {
      return {
        "Start": "शुरू करें",
        "Continue straight": "सीधे जाएँ",
        "Turn right": "दाएँ मुड़ें",
        "Turn left": "बाएँ मुड़ें",
        "Slight right": "थोड़ा दाएँ मुड़ें",
        "Slight left": "थोड़ा बाएँ मुड़ें",
        "Arrive": "आप अपने गंतव्य पर पहुँच गए हैं"
      }[turn] || turn;
    }

    if (isMarathi) {
      return {
        "Start": "सुरू करा",
        "Continue straight": "सरळ जा",
        "Turn right": "उजव्या बाजूला वळा",
        "Turn left": "डाव्या बाजूला वळा",
        "Slight right": "थोडे उजव्या बाजूला वळा",
        "Slight left": "थोडे डाव्या बाजूला वळा",
        "Arrive": "आपण आपल्या ठिकाणी पोहोचला आहात"
      }[turn] || turn;
    }

    return turn; // English default
  }

  function formatStep(turn, dist) {
    const t = translateTurn(turn);

    if (isHindi) return `${t} और ${dist.toFixed(0)} मीटर चलें`;
    if (isMarathi) return `${t} आणि ${dist.toFixed(0)} मीटर चला`;

    // English
    return `${t} and walk ${dist.toFixed(0)} meters`;
  }

  for (let i = 0; i < path.length - 1; i++) {
    const A = path[i];
    const B = path[i + 1];
    const dist = distance(A, B);

    if (i === 0) {
      const turn = translateTurn("Start");
      if (isHindi) {
        steps.push(`शुरू करें और ${dist.toFixed(0)} मीटर चलें`);
      } else if (isMarathi) {
        steps.push(`सुरू करा आणि ${dist.toFixed(0)} मीटर चला`);
      } else {
        steps.push(`Start and walk ${dist.toFixed(0)} meters`);
      }
      continue;
    }

    const prev = path[i - 1];
    const brg1 = bearing(prev, A);
    const brg2 = bearing(A, B);

    let turnAngle = brg2 - brg1;
    if (turnAngle > 180) turnAngle -= 360;
    if (turnAngle < -180) turnAngle += 360;

    let turnWord = "Continue straight";

    if (turnAngle > 35) turnWord = "Turn right";
    else if (turnAngle < -35) turnWord = "Turn left";
    else if (turnAngle > 15) turnWord = "Slight right";
    else if (turnAngle < -15) turnWord = "Slight left";

    steps.push(formatStep(turnWord, dist));
  }

  const arrival = translateTurn("Arrive");

  steps.push(
    isHindi
      ? "आप अपने गंतव्य पर पहुँच गए हैं"
      : isMarathi
      ? "आपण आपल्या ठिकाणी पोहोचला आहात"
      : "Arrive at your destination"
  );

  return steps;
}



/* ============================================================
   GRAPH CONNECTIVITY DEBUGGER
============================================================ */

export function debugGraphConnectivity(graph) {
  if (!graph) {
    //console.log("⚠ debugGraphConnectivity: graph is null");
    return;
  }

  //console.log("🧩 Graph node count:", graph.nodeCount());
  //console.log("Sample keys:", Object.keys(graph.nodes).slice(0, 10));
}

/* ============================================================
   Speak Marathi
============================================================ */

export function speakMarathi(text) {
  const utt = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();

  let voice =
    voices.find(v => v.name.includes("Google") && v.lang === "mr-IN") ||
    voices.find(v => v.lang === "mr-IN") ||
    voices.find(v => v.name.toLowerCase().includes("marathi")) ||
    voices.find(v => v.lang.startsWith("hi")) ||
    voices.find(v => v.lang.startsWith("en"));

  if (voice) utt.voice = voice;

  // ✨ Best clarity tuning
  utt.rate = 0.6;     // SLOW → clear pronunciation
  utt.pitch = 0.9;    // slight low pitch → clearer consonants
  utt.volume = 1.0;

  speechSynthesis.cancel(); // ensure clean playback
  speechSynthesis.speak(utt);
}



