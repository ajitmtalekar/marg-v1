import React, {useEffect, useState, useRef} from 'react';
import {MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, useMap} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';

/*
Path Repair & Graph Visualizer
- Loads a GeoJSON file (default: uploaded /mnt/data/paths.geojson)
- Runs automatic repair passes:
  1. Validate features (LineString only) and remove invalids
  2. Clip / drop coordinates outside bounding box (optional)
  3. Snap endpoints that are within tolerance to existing nodes
  4. Auto-split segments at intersections and create junction nodes
  5. Ensure reverse edges exist unless `oneway` forbids
  6. Remove duplicate overlapping segments and very short segments
  7. Simplify geometries to decimals precision
- Builds a simple graph (nodes + adjacency) from repaired GeoJSON and visualizes it
- Allows exporting repaired GeoJSON

Notes:
- This is a front-end tool (React) for debugging and producing a repaired geojson.
- If you want batch/CLI processing, extract the repair functions into a Node/Python script.
*/

//const DEFAULT_GEOJSON_URL = './data/paths.geojson'; // developer-provided local path

const DEFAULT_GEOJSON_URL = '/data/paths.json';
 // developer-provided local path

function prettyKey(coord, d = 6){
  return `[${coord[0].toFixed(d)},${coord[1].toFixed(d)}]`;
}

// ====== Repair utilities ======
function validateFeature(f){
  if(!f || !f.geometry) return false;
  if(f.geometry.type !== 'LineString') return false;
  if(!Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) return false;
  return true;
}

function clampToBBox(coord, bbox){
  // bbox [minLon, minLat, maxLon, maxLat]
  if(!bbox) return coord;
  const [lon, lat] = coord;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [Math.min(Math.max(lon, minLon), maxLon), Math.min(Math.max(lat, minLat), maxLat)];
}

function simplifyCoords(coords, decimals){
  return coords.map(c => [Number(c[0].toFixed(decimals)), Number(c[1].toFixed(decimals))]);
}

function removeDuplicateConsecutive(coords){
  const out = [];
  for(const c of coords){
    if(out.length === 0) out.push(c);
    else {
      const prev = out[out.length-1];
      if(Math.abs(prev[0]-c[0])>1e-9 || Math.abs(prev[1]-c[1])>1e-9) out.push(c);
    }
  }
  return out;
}

function lengthMeters(a,b){
  return turf.distance(turf.point(a), turf.point(b)) * 1000;
}

// Snap endpoints to existing nodes within tolerance (meters)
function snapEndpoints(features, toleranceMeters=4){
  // collect node coordinate set
  const nodes = {};
  features.forEach(f => {
    const coords = f.geometry.coordinates;
    const first = coords[0];
    const last = coords[coords.length-1];
    nodes[prettyKey(first)] = first;
    nodes[prettyKey(last)] = last;
  });

  const nodeList = Object.values(nodes);

  features.forEach(f => {
    const coords = f.geometry.coordinates;
    ['0','-1'].forEach(idx => {
      const i = (idx === '0')?0:coords.length-1;
      const p = coords[i];
      let best = null, bestD = Infinity;
      for(const n of nodeList){
        const d = lengthMeters(p, n);
        if(d < bestD){ bestD = d; best = n; }
      }
      if(best && bestD <= toleranceMeters && bestD > 0){
        // snap
        coords[i] = best.slice();
      }
    });
  });
}

// Split features at intersections (returns new feature array)
function splitAtIntersections(features, toleranceMeters=1e-6){
  // We'll build a spatial index using turf.lineSplit iteratively
  // Strategy: for each pair of features compute intersection points and split.
  const out = [];
  const lines = features.map(f => turf.lineString(f.geometry.coordinates, {...f.properties}));

  for(let i=0;i<lines.length;i++){
    let current = lines[i];
    for(let j=0;j<lines.length;j++){
      if(i===j) continue;
      const other = lines[j];
      try{
        const inter = turf.lineIntersect(current, other);
        if(inter.features && inter.features.length){
          // for each intersection point, split
          inter.features.forEach(pt => {
            current = turf.lineSplit(current, turf.lineString([pt.geometry.coordinates, pt.geometry.coordinates] )) || current;
            // turf.lineSplit returns a FeatureCollection — but many turf builds behave differently.
          });
        }
      }catch(e){/* ignore */}
    }
    // After processing, if it's a MultiLineString / FeatureCollection, flatten
    if(current.type === 'FeatureCollection'){
      current.features.forEach(f => out.push(f));
    } else {
      out.push(current);
    }
  }

  // convert back to feature objects with geometry and properties
  return out.map(f => ({ type: 'Feature', properties: f.properties || {}, geometry: f.geometry }));
}

function ensureBidirectionalEdges(features){
  // For each feature ensure that if oneway !== 'forward' and !== 'reverse' it's treated as both
  // For our graph builder we'll add both directions when building graph unless explicit oneway present.
  return features.map(f => {
    const p = {...f.properties};
    if(!p.oneway) p.oneway = 'both';
    return {...f, properties: p};
  });
}

function removeShortSegments(features, minMeters=0.5){
  return features.map(f => {
    const coords = f.geometry.coordinates;
    // if entire feature is very short remove by returning null
    let total = 0;
    for(let i=0;i<coords.length-1;i++) total += lengthMeters(coords[i], coords[i+1]);
    if(total < minMeters) return null;
    return f;
  }).filter(Boolean);
}

function autoRepairGeoJSON(raw, opts={}){
  const decimals = opts.decimals ?? 6;
  const snapTol = opts.snapToleranceMeters ?? 4;
  const removeShort = opts.removeShortMeters ?? 0.5;
  const bbox = opts.bbox ?? null; // optional [minLon,minLat,maxLon,maxLat]

  if(!raw || !raw.features) return raw;

  let features = raw.features.slice();

  // 1) validate & normalize
  features = features.filter(validateFeature).map(f => {
    // clone
    const props = f.properties ? {...f.properties} : {};
    let coords = f.geometry.coordinates.map(c => [Number(c[0]), Number(c[1])]);
    coords = coords.map(c => bbox? clampToBBox(c,bbox) : c);
    coords = simplifyCoords(coords, decimals);
    coords = removeDuplicateConsecutive(coords);
    return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords }};
  });

  // 2) snap endpoints to each other
  snapEndpoints(features, snapTol);

  // 3) split at intersections (best-effort)
  features = splitAtIntersections(features);

  // 4) ensure oneway default
  features = ensureBidirectionalEdges(features);

  // 5) remove very short segments
  features = removeShortSegments(features, removeShort);

  // 6) final dedupe: merge identical features
  const seen = new Set();
  const cleaned = [];
  for(const f of features){
    const key = JSON.stringify(f.geometry.coordinates);
    if(!seen.has(key)){ seen.add(key); cleaned.push(f); }
  }

  return { type: 'FeatureCollection', features: cleaned };
}

// ====== Graph builder ======
class SimpleGraph {
  constructor(){ this.nodes = {}; this.adj = {}; }
  addNode(key, coord){ if(!this.nodes[key]){ this.nodes[key]=coord; this.adj[key]={}; } }
  addEdge(a,b,w){ if(!this.adj[a]) this.adj[a]={}; this.adj[a][b]=w; }
}

function buildGraphFromGeoJSON(fc){
  const g = new SimpleGraph();
  for(const f of fc.features){
    const coords = f.geometry.coordinates;
    for(let i=0;i<coords.length;i++){
      const k = prettyKey(coords[i],6);
      g.addNode(k, coords[i]);
    }
    for(let i=0;i<coords.length-1;i++){
      const a = coords[i]; const b = coords[i+1];
      const ka = prettyKey(a,6); const kb = prettyKey(b,6);
      const w = lengthMeters(a,b);
      // respect oneway property
      const oneway = (f.properties && f.properties.oneway) ? String(f.properties.oneway).toLowerCase() : 'both';
      if(oneway === 'forward'){
        g.addEdge(ka,kb,w);
      } else if(oneway === 'reverse'){
        g.addEdge(kb,ka,w);
      } else {
        g.addEdge(ka,kb,w);
        g.addEdge(kb,ka,w);
      }
    }
  }
  return g;
}

// ====== React component ======
export default function PathRepairVisualizer({ initialUrl = DEFAULT_GEOJSON_URL }){
  const [raw, setRaw] = useState(null);
  const [repaired, setRepaired] = useState(null);
  const [graph, setGraph] = useState(null);
  const [log, setLog] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => { // load file
    fetch(initialUrl).then(r=>r.json()).then(j=>{ setRaw(j); appendLog('Loaded geojson'); }).catch(e=>appendLog('Load failed: '+e));
  }, [initialUrl]);

  function appendLog(msg){ setLog(l => [new Date().toLocaleTimeString()+': '+msg, ...l].slice(0,50)); }

  function runRepair(){
    if(!raw) return appendLog('No input');
    const repairedFc = autoRepairGeoJSON(raw, {decimals:6, snapToleranceMeters:4, removeShortMeters:0.4});
    setRepaired(repairedFc);
    setGraph(buildGraphFromGeoJSON(repairedFc));
    appendLog('Repair completed — features: '+repairedFc.features.length);
  }

  function downloadRepaired(){
    if(!repaired) return appendLog('Nothing to download');
    const blob = new Blob([JSON.stringify(repaired, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'paths-repaired.geojson';
    a.click();
    URL.revokeObjectURL(url);
    appendLog('Download triggered');
  }

  function renderGraphOverlay(){
    if(!graph) return null;
    const nodes = Object.entries(graph.nodes).map(([k,c]) => ({key:k, coord:c}));
    const edges = [];
    for(const a in graph.adj){
      for(const b in graph.adj[a]){
        edges.push({a, b, w: graph.adj[a][b], aCoord: graph.nodes[a], bCoord: graph.nodes[b]});
      }
    }
    return (
      <>
        {edges.map((e,i)=>(
          <Polyline key={i} positions={[[e.aCoord[1], e.aCoord[0]],[e.bCoord[1], e.bCoord[0]]]} dashArray="4 6" weight={2} opacity={0.7} />
        ))}
        {nodes.map(n => (
          <Marker key={n.key} position={[n.coord[1], n.coord[0]]} icon={L.divIcon({className:'tiny-node', html:'<div style="width:8px;height:8px;background:#0a84ff;border-radius:50%;border:1px solid white"></div>'})}>
            <Popup>{n.key}</Popup>
          </Marker>
        ))}
      </>
    );
  }

  return (
    <div style={{display:'flex',gap:12,height:'100vh'}}>
      <div style={{flex:1}}>
        <MapContainer center={[18.97834,72.83755]} zoom={17} style={{height:'100%'}} whenCreated={map=>mapRef.current=map}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {raw && <GeoJSON data={raw} style={{color:'#aaa', weight:2}} />}
          {repaired && <GeoJSON data={repaired} style={{color:'#2c7', weight:3}} />}
          {renderGraphOverlay()}
        </MapContainer>
      </div>
      <div style={{width:420,padding:12,overflow:'auto',background:'#fff',boxShadow:'-2px 0 6px rgba(0,0,0,0.08)'}}>
        <h3>Path Repair & Graph Visualizer</h3>
        <p><strong>Loaded:</strong> {raw ? `${raw.features.length} features` : '—'}</p>
        <p><strong>Repaired:</strong> {repaired ? `${repaired.features.length} features` : '—'}</p>
        <button onClick={runRepair} style={{marginRight:8}}>Run Automatic Repair</button>
        <button onClick={downloadRepaired}>Download Repaired GeoJSON</button>
        <hr />
        <h4>Options</h4>
        <p>Repair steps: validate → snap endpoints → split intersections → dedupe → remove short</p>
        <hr />
        <h4>Log</h4>
        <div style={{fontFamily:'monospace',fontSize:12,whiteSpace:'pre-wrap'}}>
          {log.map((l,i)=>(<div key={i}>{l}</div>))}
        </div>
        <hr />
        <h4>Graph</h4>
        <div>Nodes: {graph ? Object.keys(graph.nodes).length : '—'}</div>
        <div>Edges: {graph ? Object.keys(graph.adj).reduce((s,k)=>s+Object.keys(graph.adj[k]).length,0) : '—'}</div>
        <hr />
        <p style={{fontSize:12,color:'#666'}}>Tip: If repair misses some edges, inspect raw paths for coordinate mismatches (decimal precision, swapped lat/lon), or missing link features. Use the exported file to update your paths.json.</p>
      </div>
    </div>
  );
}
