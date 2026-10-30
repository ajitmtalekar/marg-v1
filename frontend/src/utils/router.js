/* router.js — updated for proper virtual-node insertion and one-way support */
import * as turf from "@turf/turf";
//import PathRepairVisualizer from "../tools/PathRepairVisualizer";


/* ------------------------
   Utility Normalization
------------------------- */

export function normalizeCoord(c, decimals = 6) {
  if (!c || !Array.isArray(c) || c.length < 2) return null;
  const x = Number(c[0]);
  const y = Number(c[1]);
  if (!isFinite(x) || !isFinite(y)) return null;
  return [Number(x.toFixed(decimals)), Number(y.toFixed(decimals))];
}


export function coordKey(c, floor = 0, decimals = 6) {
  if (!c) return null;

  // Extract coord array if it's wrapped
  const coords = Array.isArray(c) ? c : c.coord;
  if (!coords || coords.length < 2) return null;

  return `[${coords[0].toFixed(decimals)},${coords[1].toFixed(decimals)},F${floor}]`;
}



export function addVerticalConnectors(graph, pathData) 
  { 
    pathData.features.forEach((f) => {
      if (!f.properties?.connector) 
        return; 
      const floor = Number(f.properties.floor); 
      const connectsTo = Number(f.properties.connectsTo); 
      const cost = Number(f.properties.verticalCost ?? 10); 
      const coord = normalizeCoord(f.geometry.coordinates[0], 6); 
      const keyA = coordKey(coord, floor);
      const keyB = coordKey(coord, connectsTo); 
      
      if (graph.nodes[keyA] && graph.nodes[keyB]) { 
        graph.addEdge(keyA, keyB, cost); 
        graph.addEdge(keyB, keyA, cost); 
      } 
    }
  );
  }

/* ============================================================
   GRAPH IMPLEMENTATION (with removeEdge)
============================================================ */

export class Graph {
  constructor() {
    this.nodes = new Map(); // key -> { key, coord, floor }
    this.adj = new Map();   // key -> { neighborKey: weight }
    this._edgeCount = 0;
  }

  addNode(key, coord, floor = 0) {
    if (!this.nodes[key]) {
      this.nodes[key] = {
        key,
        coord,
        floor,
        neighbors: new Map()
      };

      this.adj[key] = {};
    }
  }

  addEdge(a, b, weight) {
    if (!this.adj[a]) this.adj[a] = {};

    if (!this.adj[a][b]) {
      this._edgeCount++;
    }

    this.adj[a][b] = weight;
  }

  removeEdge(a, b) {
    if (!this.adj[a]) return;

    if (this.adj[a][b]) {
      delete this.adj[a][b];
      this._edgeCount = Math.max(0, this._edgeCount - 1);
    }
  }

  getNeighbors(key) {
    return this.adj[key] || {};
  }

  getNode(key) {
    return this.nodes[key] || null;
  }

  hasNode(key) {
    return !!this.nodes[key];
  }

  nodeCount() {
    return Object.keys(this.nodes).length;
  }

  edgeCount() {
    return this._edgeCount;
  }
}


/* ============================================================
   insertVirtualNode — splits a segment, supports one-way
   props.oneway: "both" (default) | "forward" | "reverse"
   - "forward"  means key1 -> key2 only
   - "reverse"  means key2 -> key1 only
   - "both"     means bidirectional
============================================================ */

export function insertVirtualNode(graph, snappedCoord, key1, key2, props = {}, floor = 0)
 {
  // defensive defaults
  props = props || {};
  const weight = Number(props.weight ?? 1);  

  if (!graph || !graph.nodes || !graph.nodes[key1] || !graph.nodes[key2]) {
    console.warn("⚠ insertVirtualNode: endpoints missing:", key1, key2);
    return null;
  }

  const coord = normalizeCoord(snappedCoord, 6);
  if (!coord) {
    console.warn("⚠ insertVirtualNode: invalid snappedCoord", snappedCoord);
    return null;
  }

  //const vKey = coordKey(coord);
  const vKey = coordKey(coord, floor);


  if (!vKey) return null;

  // Add virtual node
  //graph.addNode(vKey, coord);
graph.addNode(vKey, coord, floor);

  // compute split distances (meters)
  const pV = turf.point(coord);
  const p1 = turf.point(graph.nodes[key1].coord);
const p2 = turf.point(graph.nodes[key2].coord);

  const d1 = turf.distance(p1, pV); // key1 -> virtual
  const d2 = turf.distance(pV, p2); // virtual -> key2

  // Remove direct edges between key1 and key2 so we force routing through vKey
  graph.removeEdge(key1, key2);
  graph.removeEdge(key2, key1);

  const oneway = String(props.oneway || "both").toLowerCase();

  if (oneway === "forward") {
    
    // allow only key1 -> vKey -> key2
    graph.addEdge(key1, vKey, d1 * weight);
    graph.addEdge(vKey, key2, d2 * weight);
  } else if (oneway === "reverse") {
    // allow only key2 -> vKey -> key1
    graph.addEdge(key2, vKey, d2 * weight);
    graph.addEdge(vKey, key1, d1 * weight);
  } else {
    // both directions via virtual node
    graph.addEdge(key1, vKey, d1 * weight);
    graph.addEdge(vKey, key2, d2 * weight);

    graph.addEdge(key2, vKey, d2 * weight);
    graph.addEdge(vKey, key1, d1 * weight);
  }

  // return the virtual node key so callers can reference it
  return vKey;
}

/* ============================================================
   Nearest segment helpers
============================================================ */

export function findNearestNodeExact(point, pathData, floor) {
  // 🔒 HARD NORMALIZATION
if (Array.isArray(point)) {
  // OK
} else if (point?.coord && Array.isArray(point.coord)) {
  point = point.coord;
} else if (point?.snapped && Array.isArray(point.snapped)) {
  point = point.snapped;
} else {
  console.error("❌ Invalid point passed to findNearestNodeExact:", point);
  return null;
}


 if (
  !Array.isArray(point) ||
  point.length !== 2 ||
  !Number.isFinite(point[0]) ||
  !Number.isFinite(point[1])
) {
  console.error("❌ Point is not numeric [lon,lat]:", point);
  return null;
}


  let bestDist = Infinity;
  let bestSnap = null;
  let bestA = null;
  let bestB = null;
  let bestFeature = null;



  for (const feature of pathData.features || []) {


     // ✅ FLOOR FILTER — MUST BE INSIDE LOOP
  const featureFloor = Number(feature.properties?.floor ?? 0);
const inputFloor = Number(floor ?? 0);

if (featureFloor !== inputFloor)
  continue;


     //console.log("Input point:", point);
     //console.log("Feature coords:", feature.geometry.coordinates);

    if (!feature || !feature.geometry || feature.geometry.type !== "LineString") continue;

    const coords = feature.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const A = coords[i];
      const B = coords[i + 1];
      if (
        !Array.isArray(A) || !Array.isArray(B) ||
        !Number.isFinite(A[0]) || !Number.isFinite(A[1]) ||
        !Number.isFinite(B[0]) || !Number.isFinite(B[1])
      ) {
        continue;
      }
      const seg = turf.lineString([A, B]);
      const snap = turf.nearestPointOnLine(seg, turf.point(point));
      const dist = snap.properties?.dist ?? turf.distance(turf.point(point), snap);

      if (dist < bestDist) {
        bestDist = dist;
        bestSnap = snap.geometry.coordinates;
        bestA = A;
        bestB = B;
        bestFeature = feature;
      }
    }
  }

  if (!bestSnap) return null;

  // optional distance threshold (if you want), else caller can check
  // if (bestDist > 0.030) return null;

  return {
    snapped: normalizeCoord(bestSnap, 6),
    nearest1: normalizeCoord(bestA, 6),
    nearest2: normalizeCoord(bestB, 6),
    distanceToLine: bestDist,
    feature: bestFeature
  };
}

/* ============================================================
   buildGraph (unchanged apart from using Graph.removeEdge)
============================================================ */

export function buildGraph(pathData, {
  precision = 6,
  verticalPreference = "default" // preferStairs | preferElevator | avoidStairs | wheelchair
} = {}) {

  const g = new Graph();

  if (!pathData?.features) return g;

  pathData.features.forEach((f) => {

    if (!f.geometry || f.geometry.type !== "LineString") return;

    const coords = f.geometry.coordinates;
    const pathType = f.properties?.pathType ?? "horizontal";

    /* ======================================================
       HORIZONTAL SEGMENTS (Normal Walk Paths)
    ====================================================== */

    if (pathType !== "vertical") {

      const floor = Number(f.properties?.floor ?? 0);
      const weightMultiplier = Number(f.properties?.weight ?? 1);
      const oneway = String(f.properties?.oneway || "both").toLowerCase();

      for (let i = 0; i < coords.length - 1; i++) {

        const a = normalizeCoord(coords[i], precision);
        const b = normalizeCoord(coords[i + 1], precision);

        const keyA = coordKey(a, floor, precision);
        const keyB = coordKey(b, floor, precision);

        const dist = turf.distance(turf.point(a), turf.point(b));
        const cost = dist * weightMultiplier;

        g.addNode(keyA, a, floor);
        g.addNode(keyB, b, floor);

        // IMPORTANT: Horizontal edges MUST stay on same floor
        if (oneway === "forward") {
          g.addEdge(keyA, keyB, cost);
        }
        else if (oneway === "reverse") {
          g.addEdge(keyB, keyA, cost);
        }
        else {
          g.addEdge(keyA, keyB, cost);
          g.addEdge(keyB, keyA, cost);
        }
      }

      return;
    }

    /* ======================================================
       VERTICAL CONNECTORS (Stairs / Elevator)
    ====================================================== */

    const coord = normalizeCoord(coords[0], precision);

    const fromFloor = Number(f.properties?.fromFloor);
    const toFloor = Number(f.properties?.toFloor);

    const verticalType = f.properties?.verticalType || "stairs";

    if (isNaN(fromFloor) || isNaN(toFloor)) return;

    const keyA = coordKey(coord, fromFloor, precision);
    const keyB = coordKey(coord, toFloor, precision);

    g.addNode(keyA, coord, fromFloor);
    g.addNode(keyB, coord, toFloor);

    const verticalCost = getVerticalCost(
      verticalType,
      verticalPreference,
      Number(f.properties?.weight ?? 3)
    );

    g.addEdge(keyA, keyB, verticalCost);
    g.addEdge(keyB, keyA, verticalCost);
  });

  return g;
}

function getVerticalCost(type, preference, baseCost) {

  switch (preference) {

    case "preferStairs":
      return type === "stairs" ? baseCost : baseCost * 3;

    case "preferElevator":
      return type === "elevator" ? baseCost : baseCost * 3;

    case "avoidStairs":
      return type === "stairs" ? baseCost * 10 : baseCost;

    case "wheelchair":
      return type === "stairs" ? Infinity : baseCost;

    default:
      return baseCost;
  }
}


/* ============================================================
   Dijkstra (getRoute) and directions (unchanged)
============================================================ */

export function getRoute(startCoord, startFloor, endCoord, endFloor, graph,decimals = 6) {

  if (!graph || !graph.nodes || !graph.adj) {
    console.warn("❗ getRoute called with invalid graph");
    return null;
  }
  const startKey = coordKey(startCoord, startFloor, decimals);
  const endKey = coordKey(endCoord, endFloor, decimals);

  if (!startKey || !endKey) return null;
  if (!graph.nodes[startKey] || !graph.nodes[endKey]) {
    console.warn("❗ getRoute: start/end node missing", { startKey, endKey });
    return null;
  }

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
  if (!Array.isArray(path) || path.length < 2) return [];
/*
        // Floor change detection
      if (current.floor !== next.floor) {
        const goingUp = next.floor > current.floor;
        const via = next.type || current.type || "stairs";

        if (via === "elevator") {
          steps.push(
            goingUp
              ? `Take the elevator up to floor ${next.floor}`
              : `Take the elevator down to floor ${next.floor}`
          );
        }

        else if (via === "escalator") {
          steps.push(
            goingUp
              ? `Take the escalator up to floor ${next.floor}`
              : `Take the escalator down to floor ${next.floor}`
          );
        }

        else { // stairs default
          steps.push(
            goingUp
              ? `Take the stairs up to floor ${next.floor}`
              : `Take the stairs down to floor ${next.floor}`
          );
        }

        continue;
      }
*/

  // -----------------------------
  // 1️⃣ Normalize path once
  // -----------------------------
  const nodes = path
    .map(node => {
      if (Array.isArray(node)) {
        return { coord: node, floor: 0 };
      }
      if (Array.isArray(node?.coord)) {
        return {
          coord: node.coord,
          floor: Number(node.floor ?? 0)
        };
      }
      return null;
    })
    .filter(Boolean);

  if (nodes.length < 2) return [];

  // Validate coordinates strictly
  for (const n of nodes) {
    if (
      !Array.isArray(n.coord) ||
      n.coord.length !== 2 ||
      !Number.isFinite(n.coord[0]) ||
      !Number.isFinite(n.coord[1])
    ) {
      console.warn("Invalid node in path:", n);
      return [];
    }
  }

  const steps = [];

  const isHindi = language === "hi-IN";
  const isMarathi = language === "mr-IN";

  // -----------------------------
  // 2️⃣ Translation Layer
  // -----------------------------
  function t(key) {
    const dict = {
      en: {
        start: "Start",
        straight: "Continue straight",
        right: "Turn right",
        left: "Turn left",
        slightRight: "Slight right",
        slightLeft: "Slight left",
        arrive: "Arrive at your destination",
        floorUp: "Go up to floor",
        floorDown: "Go down to floor",
        circle: "Follow the circular path"
      },
      hi: {
        start: "शुरू करें",
        straight: "सीधे जाएँ",
        right: "दाएँ मुड़ें",
        left: "बाएँ मुड़ें",
        slightRight: "थोड़ा दाएँ मुड़ें",
        slightLeft: "थोड़ा बाएँ मुड़ें",
        arrive: "आप अपने गंतव्य पर पहुँच गए हैं",
        floorUp: "ऊपर जाएँ मंज़िल",
        floorDown: "नीचे जाएँ मंज़िल",
        circle: "गोल मार्ग पर चलें"
      },
      mr: {
        start: "सुरू करा",
        straight: "सरळ जा",
        right: "उजवीकडे वळा",
        left: "डावीकडे वळा",
        slightRight: "थोडे उजवीकडे वळा",
        slightLeft: "थोडे डावीकडे वळा",
        arrive: "आपण आपल्या ठिकाणी पोहोचला आहात",
        floorUp: "वरच्या मजल्यावर जा",
        floorDown: "खालच्या मजल्यावर जा",
        circle: "गोल मार्गावर चला"
      }
    };

    const lang = isHindi ? "hi" : isMarathi ? "mr" : "en";
    return dict[lang][key] || key;
  }

  function format(turn, meters) {
    if (isHindi) return `${turn} और ${meters.toFixed(0)} मीटर चलें`;
    if (isMarathi) return `${turn} आणि ${meters.toFixed(0)} मीटर चला`;
    return `${turn} and walk ${meters.toFixed(0)} meters`;
  }

  // -----------------------------
  // 3️⃣ Circular detection (optimized)
  // -----------------------------
  function isCircularSegment(A, B) {
    if (!window.__pathDataGlobal) return false;

    for (const f of window.__pathDataGlobal.features || []) {
      if (f.geometry?.type !== "LineString") continue;

      const coords = f.geometry.coordinates;
      if (coords.length < 3) continue;

      const first = coords[0];
      const last = coords[coords.length - 1];

      const closed =
        turf.distance(turf.point(first), turf.point(last)) < 0.00005;

      if (!closed) continue;

      for (let i = 0; i < coords.length - 1; i++) {
        const p = coords[i];
        const q = coords[i + 1];

        if (
          Math.abs(p[0] - A[0]) < 1e-5 &&
          Math.abs(p[1] - A[1]) < 1e-5 &&
          Math.abs(q[0] - B[0]) < 1e-5 &&
          Math.abs(q[1] - B[1]) < 1e-5
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // -----------------------------
  // 4️⃣ Main loop
  // -----------------------------
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];

    const A = current.coord;
    const B = next.coord;

    const dist = turf.distance(
      turf.point(A),
      turf.point(B)
    ) * 1000;

    // First segment
    if (i === 0) {
      steps.push(format(t("start"), dist));
      continue;
    }

    // Floor change detection
    if (current.floor !== next.floor) {
      if (next.floor > current.floor) {
        steps.push(`${t("floorUp")} ${next.floor}`);
      } else {
        steps.push(`${t("floorDown")} ${next.floor}`);
      }
      continue;
    }

    // Circular segment
    if (isCircularSegment(A, B)) {
      steps.push(format(t("circle"), dist));
      continue;
    }

    // Turn logic
    const prev = nodes[i - 1].coord;

    const brg1 = turf.bearing(turf.point(prev), turf.point(A));
    const brg2 = turf.bearing(turf.point(A), turf.point(B));

    let angle = brg2 - brg1;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;

    let turn = t("straight");

    if (angle > 35) turn = t("right");
    else if (angle < -35) turn = t("left");
    else if (angle > 15) turn = t("slightRight");
    else if (angle < -15) turn = t("slightLeft");

    steps.push(format(turn, dist));
  }

  // Arrival
  steps.push(t("arrive"));

  return steps;
}


// ============================================================
// findNearestNode — for exhibits (simple nearest by haversine)
// ============================================================
export function findNearestNode(coord, exhibits, decimals = 6) {
  if (!Array.isArray(coord) || coord.length !== 2) return null;
  if (!Array.isArray(exhibits)) return null;

  let bestId = null;
  let bestDist = Infinity;

  const pt = turf.point(coord);

  for (const ex of exhibits) {
    if (!ex || !Array.isArray(ex.coords)) continue;
    const exPt = turf.point(ex.coords);
    const d = turf.distance(pt, exPt);
    if (d < bestDist) {
      bestDist = d;
      bestId = ex.id;
    }
  }

  return bestId;
}

// find which LineString feature covers segment a->b
export function findFeatureForSegment(a, b) {
  if (!window.__pathDataGlobal) return null;
  for (const f of window.__pathDataGlobal.features) {
    if (f.geometry.type !== "LineString") continue;
    const coords = f.geometry.coordinates;

    for (let i = 0; i < coords.length - 1; i++) {
      const A = normalizeCoord(coords[i], 6);
      const B = normalizeCoord(coords[i + 1], 6);

      if (
        Math.abs(A[0] - a[0]) < 1e-5 &&
        Math.abs(A[1] - a[1]) < 1e-5 &&
        Math.abs(B[0] - b[0]) < 1e-5 &&
        Math.abs(B[1] - b[1]) < 1e-5
      ) {
        return f;
      }
    }
  }
  return null;
}


export function snapToClosestPath(paths, freePos) {
  let closestPoint = null;
  let minDistance = Infinity;

  paths.forEach((feature) => {
    const coords = feature.geometry.coordinates;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];

      // FIXED — use correct function name
      const snapped = projectPointToSegment(freePos, p1, p2);

      // FIXED — use proper lon/lat haversine distance
      const dist = distanceLonLat(freePos, snapped);

      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = snapped;
      }
    }
  });

  return closestPoint;
}


// Returns the closest point on segment AB to point P
export function projectPointToSegment(P, A, B) {
  const [px, py] = P;
  const [ax, ay] = A;
  const [bx, by] = B;

  const ABx = bx - ax;
  const ABy = by - ay;

  const APx = px - ax;
  const APy = py - ay;

  const magAB = ABx * ABx + ABy * ABy;
  if (magAB === 0) return A;

  let t = (APx * ABx + APy * ABy) / magAB;
  t = Math.max(0, Math.min(1, t));

  return [ax + t * ABx, ay + t * ABy];
}

// Distance between two lon/lat points (haversine)
export function distanceLonLat(a, b) {
  const R = 6371000;
  const [lon1, lat1] = a.map(v => v * Math.PI / 180);
  const [lon2, lat2] = b.map(v => v * Math.PI / 180);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const h = Math.sin(dLat/2)**2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;

  return 2 * R * Math.asin(Math.sqrt(h));
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
function getVoices() {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

function normalizeMarathi(text) {
  return text
    .replace(/:/g, ": ")
    .replace(/ते/g, " ते ")
    .replace(/आहे/g, " आहे ")
    .replace(/चला/g, " चला ");
}

export async function speakMarathi(text) {
  if (!window.speechSynthesis) return;

  const voices = await getVoices();

  const voice =
    voices.find(v => v.lang === "mr-IN") || 
    voices.find(v => v.lang.startsWith("hi")) || 
    voices.find(v => v.lang.startsWith("en"));

  if (!voice) return;

  const finalText = normalizeMarathi(text);
  const chunks = finalText.split(/,|\.|:/).map(t => t.trim()).filter(Boolean);

  speechSynthesis.cancel(); // stop previous speech

  chunks.forEach(chunk => {
    const utt = new SpeechSynthesisUtterance(chunk);
    utt.voice = voice;
    utt.lang = "mr-IN";
    utt.rate = 0.75;  // faster than 0.6
    utt.pitch = 1.0;  // slightly higher
    utt.volume = 1.0;
    speechSynthesis.speak(utt);
  });
}



