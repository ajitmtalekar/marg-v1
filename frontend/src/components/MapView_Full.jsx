//React
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { renderToString } from "react-dom/server";
//Leaflet
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, FeatureGroup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import { useMapEvent } from "react-leaflet";
//css files
import "leaflet/dist/leaflet.css";
import "../styles/map.css";
import "../styles/exhibits.css";
import "../styles/fabmenu.css";
import "../styles/mobile-bottomsheet.css";
import "../styles/bottom-nav.css";
//import "../styles/glass-ui.css";
//Icons file
import { FaPlay, FaFlagCheckered, FaUser, FaMapMarkerAlt } from "react-icons/fa";
import { categoryIconMap, idSpecificIcons } from "./iconMap"; // create this file
//Data driving json files
//import mapData from "../data/map.json";
import GraphDebugLayer from "../utils/GraphDebugLayer";
import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
//import { updateUserLocation, setNavigationIcon,startUserNavigation } from "./userMarker";
import {NavIconPicker} from "./navPick";

class SimpleKalman {
  constructor({ R = 0.00001, Q = 0.0001 } = {}) {
    this.R = R; // noise
    this.Q = Q; // process
    this.A = 1;
    this.B = 0;
    this.C = 1;
    this.cov = NaN;
    this.x = NaN;
  }

  filter(z) {
    if (isNaN(this.x)) {
      this.x = z;
      this.cov = 1;
    } else {
      const predX = this.A * this.x;
      const predCov = this.A * this.cov * this.A + this.Q;

      const K = predCov * this.C / (this.C * predCov * this.C + this.R);
      this.x = predX + K * (z - this.C * predX);
      this.cov = predCov - K * this.C * predCov;
    }
    return this.x;
  }
}


//porcessor code files
import {
  buildGraph, coordKey, findNearestNode, snapToClosestPath, attachVirtualNode, findNearestNodeExact, insertVirtualNode, normalizeCoord,
  getRoute, getDirections, debugGraphConnectivity, speakMarathi,
} from "../utils/router";
import QRScanner from "./QRScanner";
import { processPathNetwork } from "../utils/pathProcessor";
import PathRepairVisualizer from "../tools/PathRepairVisualizer";
//Menus
import FABMenu from "./FABMenu"
import MobileBottomSheet from "../components/MobileBottomSheet";
import ExhibitPanel from "../components/ExhibitPanel";
import DirectionsSidebar from "./DirectionsSidebar";
import { Config } from "../config/Config";
//import { speakMarathiPhrase } from '../utils/marathiSpeak';


import rawPathData from "../data/paths.json"; //uncomment for testing

//Exhibits define json
import Exhibits from "../data/exhibits.json";
import devExhibits from "../data/dev-exhibits.json"; //change for testing
const exhibits = Config.devTestMode
  ? [...Exhibits, ...devExhibits]
  : Exhibits;


//for Kanjur
//import rawPathData from "../data/kanjur-paths.json";
//Exhibits define json
//import exhibits from "../data/kanjur-exhibits.json";


//Function for admin control of Path Visualisation not used now
function AdminTools() {
  return (
    <div style={{ height: "100vh" }}>
      <PathRepairVisualizer />
    </div>
  );
}



/* ================= Icons ================= */

function iconMarker(color, IconComponent) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 18px;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
      ">
        ${renderToString(<IconComponent />)}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// 🎯 Custom Icons
const rawDebugIcon = L.divIcon({
  className: "gps-raw-here",
  html: `<div style="
    color:white;
    border-radius:50%;
    width:22px;
    height:35px;
    text-align:center;
    font-size:14px;
    line-height:22px;
  ">🚶</div>`,
});



function exhibitIcon(exhibit) {
  if (!exhibit) return null;

  const IconComponent =
    idSpecificIcons[exhibit.id] || categoryIconMap[exhibit.category] || FaMapMarkerAlt; // ✅ FALLBACK (CRITICAL)

  if (
    !idSpecificIcons[exhibit.id] &&
    !categoryIconMap[exhibit.category]
  ) {
    console.warn(
      "⚠️ Missing icon mapping for exhibit:",
      exhibit.id,
      exhibit.category
    );
  }


  return L.divIcon({
    className: "exhibit-div-icon",
    html: `
      <div class="exhibit-icon" style="
        background:${exhibit.color || "#666"};
        width:34px;
        height:34px;
        border-radius:50%;
        display:flex;
        justify-content:center;
        align-items:center;
      ">
        ${renderToString(<IconComponent />)}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}


/* ============= Map lifecycle wrapper ============= */
function MapLifecycle({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (map) onReady(map);
  }, [map]);
  return null;
}


export default function MapView({
  currentSpot,
  targetExhibitId,
  selectedButtonExhibit,
}) {

  //console.log("🧱 TileLayer URL:", Config.tileLayer.url);
  //console.log("🌍 App mode:", import.meta.env.MODE);
  //console.log("🧪 Test mode:", Config.testMode);

  /* ======== ROUTING STATE ======== */
  const [showScanner, setShowScanner] = useState(false);

  const [navIconType, setNavIconType] = useState("dot");
  const [navPickerOpen, setNavPickerOpen] = useState(false);

  const youAreHereIcon = useMemo(() => {
  return L.divIcon({
    className: "user-marker",
    html: `<div class="user-marker-icon ${navIconType}"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
    }, [navIconType]);


  /* ======== POSITION STATE ======== */
  const [userPos, setUserPos] = useState(null); // ONLY for display

  const [routeCoords, setRouteCoords] = useState([]);
  const [directions, setDirections] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [userHeading, setUserHeading] = useState(0);
  const userMarkerRef = useRef(null);
  const [routeActive, setRouteActive] = useState(false);
  const [routeVersion, setRouteVersion] = useState(0);
  const [freeStartPos, setFreeStartPos] = useState(null);
  const navigate = useNavigate();

  // Your existing state
  const [prevPos, setPrevPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(null);


  /*=== added for production GPS tracking */
  // RAW GPS (never snapped, never overridden)
  const rawGpsPosRef = useRef(null); // true GPS
  const filteredGpsPosRef = useRef(null);     // smoothed GPS
  const snappedPosRef = useRef(null);         // snapped to route

  const [gpsStatus, setGpsStatus] = useState("off");
  // on | off | permission-denied | unavailable | searching


  // For smoothing

  /* ======== GPS states======== */
  const GPS_ACCURACY_THRESHOLD = 5; // meters
  const MAX_ACCEPTABLE_ACCURACY = 20;
  const SMOOTHING_ALPHA = 0.35;
  const [rawGpsForDebug, setRawGpsForDebug] = useState(null);
  const [gpsStarted, setGpsStarted] = useState(false);
  const gpsAccuracyRef = useRef(null); // meters


  const [mapPos, setMapPos] = useState(null);
  

  /* ======== SIMULATION ======== */
  const [simulating, setSimulating] = useState(false);
  //const [isSimulating, setIsSimulating] = useState(false);

  const [navMode, setNavMode] = useState("normal"); // normal | emergency
  const [emergencyActive, setEmergencyActive] = useState(false);

  const [userRole, setUserRole] = useState("public"); // public | staff
  const [activeFloor, setActiveFloor] = useState(0);

    //const [displayUserPos, setDisplayUserPos] = useState(null);
  const [manualUserPos, setManualUserPos] = useState(null);
   
  const displayUserPos = routeActive && snappedPosRef.current
    ? snappedPosRef.current
    : userPos;

  const displayUserPosold = useMemo(() => {
  // GPS has highest priority
    if (gpsStatus === "on" && !simulating && rawGpsPosRef.current) {
      return rawGpsPosRef.current;
    }

    // Simulation next
    if (simulating && userPos) {
      return userPos;
    }

    // Manual / fallback
    return manualUserPos;
  }, [gpsStatus, simulating, userPos, manualUserPos]);
 


  /* ======== Voice STATE ======== */
  const [muteStepAnnouncements, setMuteStepAnnouncements] = useState(false);
  const [resetDirections, setResetDirections] = useState(false);
  const [freezeStepUpdates, setFreezeStepUpdates] = useState(false);

  /* ======== GRAPH STATE ======== */
  const mapRef = useRef(null);
  const simRef = useRef({ totalDistance: 0, currentDistance: 0 });
  const [pathData, setPathData] = useState(rawPathData);
  window.__pathDataGlobal = pathData;


  // Build fast lookup by id
  const pathIndex = {};
  pathData.features.forEach(f => {
    if (f?.properties?.id) {
      pathIndex[f.properties.id] = f;
    }
  });
  const [graph, setGraph] = useState(null);
  const [graphReady, setGraphReady] = useState(false);

  const allCategories = [...new Set(exhibits.map((ex) => ex.category))];


  const [startPos, setStartPos] = useState(null);

  //const [cameraFollow, setCameraFollow] = useState(true); // Google-Maps style



  const mapBounds = useMemo(() => {
    if (!Config.useBounds) return null;

    const tl = Config.bbox?.topLeft;
    const br = Config.bbox?.bottomRight;

    if (
      !Array.isArray(tl) ||
      !Array.isArray(br) ||
      tl.length !== 2 ||
      br.length !== 2
    ) {
      console.error("❌ Invalid bbox format", { tl, br });
      return null;
    }

    const bounds = L.latLngBounds(
      [Number(tl[0]), Number(tl[1])],
      [Number(br[0]), Number(br[1])]
    );

    return bounds.isValid() ? bounds : null;
  }, [Config.useBounds, Config.bbox]);

  //---Inside map ----

  function isInside([lat, lng]) {
    //console.log("checking map bounds:",mapBounds.isValid() );
    if (!mapBounds || !mapBounds.isValid()) return false;
    return mapBounds.contains([lat, lng]);
  }

  function isOutside([lat, lng]) {
  if (lat == null || lng == null) return true;

  const { minLat, maxLat, minLng, maxLng } = Config.bounds;

  const inside =
    lat >= minLat &&
    lat <= maxLat &&
    lng >= minLng &&
    lng <= maxLng;

  return !inside;
}

  function rotateUserIcon(bearing) {
  const el = document.querySelector(".user-marker-icon");
  if (!el || bearing == null) return;

  el.style.transform = `rotate(${bearing}deg)`;
  function rotateUserIcon(bearing) {
  const el = document.querySelector(".user-marker-icon");
  if (!el || bearing == null) return;

  el.style.transform = `rotate(${bearing}deg)`;
}} 

  //console.log("bounds valid:", Bounds.isValid());
  //console.log({ bboxTopLeft: Config.bbox.topLeft,bboxBottomRight: Config.bbox.bottomRight,Bounds: Bounds.isValid(),});


  const autoFollowEnabledRef = useRef(true);

  // utils / guards
  const isValidLatLng = (pos) =>
    Array.isArray(pos) &&
    pos.length === 2 &&
    Number.isFinite(pos[0]) &&
    Number.isFinite(pos[1]);



  const handleExhibitSelect = (id) => {
    //console.log("Exhibit selected from panel:", id);
    // Trigger the main route handler
    const ex = exhibits.find((e) => e.id === id);
    if (ex) {
      onExhibitClick(ex);

    }

    // Update selected exhibits (array)
    setSelectedExhibits([id]);
    setJustArrived(false);
    // Reset directions UI
    setCurrentStep(0);
    setProgressPercent(0);
  };



const prevUserPosRef = useRef(null);

useEffect(() => {
  if (!userPos || routeActive) return;

  const prev = prevUserPosRef.current;
  const same =
    prev &&
    prev.lat === userPos.lat &&
    prev.lng === userPos.lng &&
    prev.floorId === userPos.floorId;

  if (!same) {
    prevUserPosRef.current = userPos;
    setFreeStartPos(userPos);
  }
}, [userPos, routeActive]);


 useEffect(() => {
  if (!("geolocation" in navigator)) {
    setGpsStatus("unavailable");
    return;
  }

  setGpsStarted(true);
  setGpsStatus("searching");

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      rawGpsPosRef.current = [pos.coords.latitude, pos.coords.longitude];
      gpsAccuracyRef.current = pos.coords.accuracy;
      setGpsStatus("on");
      onGpsUpdate(pos); // call your existing handler
    },
    (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setGpsStatus("permission-denied");
          console.warn("GPS permission denied");
          break;
        case err.POSITION_UNAVAILABLE:
          setGpsStatus("searching");
          console.warn("GPS signal unavailable");
          break;
        case err.TIMEOUT:
          setGpsStatus("searching");
          console.warn("GPS timeout");
          break;
        default:
          setGpsStatus("searching");
          console.warn("GPS unknown error", err);
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000, // longer for laptops
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}, []);


    

  useEffect(() => {
    if (directions.length > 0) {
      setCurrentStep(0);      // ensures ALWAYS step 1
      setProgressPercent(0);
    }
  }, [directions]);

  //floor filter
  function filterByFloor(pathData, floor) {
    return {
      ...pathData,
      features: pathData.features.filter(
        f => f.properties?.floor === floor
      )
    };
  }
  const floorPaths = filterByFloor(pathData, activeFloor);

  //floor access
  function filterByAccess(pathData, role) {
    return {
      ...pathData,
      features: pathData.features.filter(f => {
        const access = f.properties?.access || "public";
        return access === "public" || access === role;
      })
    };
  }
  let usablePaths = filterByFloor(pathData, activeFloor);
  usablePaths = filterByAccess(usablePaths, userRole);

  //floor filter by Mode
  function filterByMode(pathData, mode) {
    return {
      ...pathData,
      features: pathData.features.filter(f =>
        (f.properties?.modes || ["normal"]).includes(mode)
      )
    };
  }

  usablePaths = filterByMode(usablePaths, navMode);

  // by route status
  function filterClosed(pathData) {
    return {
      ...pathData,
      features: pathData.features.filter(
        f => f.properties?.status !== "closed"
      )
    };
  }

  let usablePathsc = filterClosed(pathData);


  function preparePaths(pathData, {
    floor,
    role,
    mode
  }) {
    let paths = filterClosed(pathData);
    paths = filterByFloor(paths, floor);
    paths = filterByAccess(paths, role);
    paths = filterByMode(paths, mode);
    return paths;
  }

  const preparedPaths = preparePaths(pathData, {
    floor: activeFloor,
    role: userRole,
    mode: navMode
  });




  useEffect(() => {
    if (!freeStartPos || !graphReady || !pathData) return;

    const freeLonLat = [freeStartPos[1], freeStartPos[0]];
    const snap = findNearestNodeExact(freeLonLat, pathData);

    if (!snap) return;

    const k1 = coordKey(normalizeCoord(snap.nearest1));
    const k2 = coordKey(normalizeCoord(snap.nearest2));
    const vKey = insertVirtualNode(graph, snap.snapped, k1, k2);

    setVirtualStartKey(vKey);
  }, [freeStartPos, graphReady, pathData]);





  useEffect(() => {
    if (!currentSpot) return;
    if (!routeActive) return;
    if (!directions.length) return;

    // Parse QR location format: QR_LOCATION:lat,lon
    if (currentSpot.startsWith("QR_LOCATION:")) {
      try {
        const coords = currentSpot.replace("QR_LOCATION:", "").split(",");
        const lat = parseFloat(coords[0]);
        const lon = parseFloat(coords[1]);

        if (!isNaN(lat) && !isNaN(lon)) {
          //console.log("📍 QR scanned start:", lat, lon);

          // 👉 Set as new user position
          //setUserPos([lat, lon]);

          // 👉 Enter free-start mode
          //setFreeStartPos([lat, lon]);
          const scannedPos = [lat, lon];

          // ⭐ Force override current position
          setFreeStartPos(scannedPos);
          //setUserPos(scannedPos);
          setGpsStarted(false); // allow GPS to take over later
          // ⭐ Disable current exhibit mode completely
          setCurrentExhibitId(null);

          // ⭐ Reset simulation and routing
          setSimulating(false);
          setRouteActive(false);

          // console.log("📌 QR Start Position SET:", scannedPos);


          // 👉 Disable exhibit mode
          setCurrentExhibitId(null);

          // 👉 Stop any old simulation
          setResetDirections(true);
          setSimulating(false);
          setRouteActive(false);
          setDirections([]);

          // Optionally snap camera to position
          if (mapRef.current) {
            if (
              !Array.isArray(userPos) ||
              !Number.isFinite(userPos[0]) ||
              !Number.isFinite(userPos[1])
            ) {
              console.warn("⚠️ Invalid userPos:", userPos);
              return;
            }

            if (!autoFollowEnabledRef.current) return;

            mapRef.current.panTo(userPos, { animate: false, noMoveStart: true });

          }
        }
      } catch (e) {
        console.warn("Invalid QR location:", currentSpot);
      }
    }
  }, [currentSpot]);

  useEffect(() => {
    if (!userPos || !mapRef.current) return;

    // 🧪 DEV MODE — userPos is MANUAL, DO NOT OVERRIDE
    if (Config.devTestMode) {
      if (!simulating) {
       // console.log("inside 489");
        mapRef.current.setView(
          userPos,
          mapRef.current.getZoom() || Config.zoom,
          { animate: false }
        );
      }
      return;
    }

    // ---- PROD LOGIC BELOW (UNCHANGED) ----
    if (!isValidLatLng(userPos)) return;
    if (!autoFollowEnabledRef.current) return;

    mapRef.current.panTo(userPos, { animate: false, noMoveStart: true });
    //  if (mapRef.current && Bounds?.isValid()) {
    // mapRef.current.fitBounds(Bounds, {
    //   animate: false,
    // });
    //}

  }, [userPos]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (simulating) {
      //console.log("inside 516");
      mapRef.current.setMinZoom(mapRef.current.getZoom());
      mapRef.current.setMaxZoom(mapRef.current.getZoom());
    } else {
      //console.log("inside 520");
      mapRef.current.setMinZoom(Config.minZoom);
      mapRef.current.setMaxZoom(Config.maxZoom);
    }
  }, [simulating]);


  //Entry fallback
  const fallbackUsedRef = useRef(false);

  useEffect(() => {
     
    // Preconditions
    if (!gpsStarted) return;
    if (!userPos) return;
    if (!mapBounds) return;

    // Prevent repeat fallback
    if (fallbackUsedRef.current) return;

    // If user is inside  → use GPS normally
    if (isInside(userPos, mapBounds)) {
      //console.log("setting usr pos to:",userPos);
      setStartPos(userPos);
      return;
    }

    // 🚨 Outside  fallback to entry gate
    const entry = exhibits.find(e =>
      e.name?.toLowerCase().includes("entry")
    );

    if (!entry?.coords) {
      console.error("❌ Entry gate not configured");
      return;
    }

    const entryPos = [entry.coords[1], entry.coords[0]];


    setStartPos(entryPos);
    fallbackUsedRef.current = true;

    //console.log("🏁 Start = Entry Gate (GPS outside map)", entryPos);

  }, [
    gpsStarted,
    userPos,
    mapBounds,
    exhibits,
  ]);


  useEffect(() => {
    if (!rawPathData) return;

    const { cleaned, report } = processPathNetwork(rawPathData, {
      snapToleranceMeters: 12,
      decimals: 6,
      addReverseIfMissing: true,
      autoSplitIntersections: true,
      autoBridgeCloseNodes: false,
    });
    ////console.log("🧹 Path processing report:", report);
    //console.log(     "RAW PATH COORDS:",      rawPathData.features[1].geometry.coordinates    );
    setPathData(cleaned);
    //console.log(      "CLEANED PATH COORDS:",      cleaned.features[1].geometry.coordinates    );

    const g = buildGraph(cleaned);

    setGraph(g);
    setGraphReady(g.nodeCount() > 0);

    if (g.nodeCount() > 0) debugGraphConnectivity(g);
  }, []);

  /* =================== GRAPH BUILD DEBUG =================== */
  useEffect(() => {
    if (!graph || !graphReady) {
      //console.log("⚠ graph not ready for connectivity check");
      return;
    }
    //console.log("🔍 Running graph connectivity check…");
    debugGraphConnectivity(graph);
  }, [graph, graphReady]);


  /*=======Added for Mobile tabs =====*/
  const [activeTab, setActiveTab] = useState("map");
  const [showSheet, setShowSheet] = useState(false);
  const sirenRef = useRef(null);


  /* ======== Speak ======== */
  const synthRef = useRef(window.speechSynthesis || null);
  const utterRef = useRef(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [language, setLanguage] = useState("en-IN");
  const isHindi = language === "hi-IN";
  const isMarathi = language === "mr-IN";

  /* ======== USER + EXHIBIT ======== */
  const [clickedExhibitId, setClickedExhibitId] = useState(null);
  const [selectedExhibits, setSelectedExhibits] = useState([]);
  const [currentExhibitId, setCurrentExhibitId] = useState(null);
  const [justArrived, setJustArrived] = useState(false);
  const [virtualStartKey, setVirtualStartKey] = useState(null);



  const [searchText, setSearchText] = useState("");
  const [filteredExhibits, setFilteredExhibits] = useState([]);
  //const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [showDirections, setShowDirections] = useState(false);

  /* ======== UI state for new layout ======== */

  const UI_STATES = {
    IDLE: "idle",
    BROWSING: "browsing",
    SELECTED: "selected",
    ROUTE_READY: "route_ready",
    OUTSIDE_MAP: "outside_map",
    ROUTE_FREE: "route_free",
    NAVIGATING: "navigating", // ✅ MUST MATCH STRING
    NAVIGATINGF: "navigatingf", // ✅ MUST MATCH STRING

  };

  const [uiState, setUIState] = useState(UI_STATES.IDLE);

  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [totalRouteDistance, setTotalRouteDistance] = useState(0);
  // const [distanceRemaining, setDistanceRemaining] = useState(0);



  const getTurnIcon = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("left")) return "⬅️";
    if (lower.includes("right")) return "➡️";
    if (lower.includes("u-turn")) return "↩️";
    return "⬆️";
  };

  /* ======== UI state for new layout for Exhibits======== */

  const EXHIBIT_TABS = [
    { key: "all", label: "All" },
    { key: "entry", label: "Entry-Exit" },
    { key: "building", label: "Building" },
    { key: "heritage", label: "Heritage" },
    { key: "toilet", label: "Restrooms" },
    { key: "recreation", label: "Recreation" },
    { key: "food", label: "Cafés" },
    { key: "birds", label: "Birds" },
    { key: "animal", label: "Animals" },
    { key: "flower", label: "Flower" },
    { key: "trees", label: "Trees" },
    { key: "water", label: "Drinking Water" },
  ];



  const destinationPos = useMemo(() => {
    if (!currentExhibitId) return null;

    const ex = exhibits.find(e => e.id === currentExhibitId);
    return ex ? [ex.coords[1], ex.coords[0]] : null;
  }, [currentExhibitId, exhibits]);


  /* ======== OFF-ROUTE DETECTION + SMART RE-ROUTING ======== */

  const distancePointToSegment = (p, a, b) => {
    const toRad = d => (d * Math.PI) / 180;
    const toDeg = r => (r * 180) / Math.PI;

    const lat1 = toRad(a[0]);
    const lon1 = toRad(a[1]);
    const lat2 = toRad(b[0]);
    const lon2 = toRad(b[1]);
    const lat3 = toRad(p[0]);
    const lon3 = toRad(p[1]);

    const A = lat3 - lat1;
    const B = lon3 - lon1;
    const C = lat2 - lat1;
    const D = lon2 - lon1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const t = Math.max(0, Math.min(1, dot / lenSq));

    const lat = lat1 + C * t;
    const lon = lon1 + D * t;

    const dLat = lat3 - lat;
    const dLon = lon3 - lon;

    return Math.sqrt(dLat * dLat + dLon * dLon) * 6371000;
  };

  /* ======== Detect if user is off route ======== */

  const isUserOffRoute = (userPos, routeCoords, threshold = 5) => {
    if (!routeCoords || routeCoords.length < 2) return false;

    let minDist = Infinity;

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const d = distancePointToSegment(
        userPos,
        routeCoords[i],
        routeCoords[i + 1]
      );
      minDist = Math.min(minDist, d);
    }

    return minDist > threshold;
  };

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredExhibits([]);
      return;
    }

    const q = searchText.toLowerCase();

    setFilteredExhibits(
      exhibits.filter(e =>
        e.name.toLowerCase().includes(q)
      )
    );
  }, [searchText, exhibits]);

  /* ======== Auto re-route (debounced) ======== */
  const offRouteCountRef = useRef(0);

  useEffect(() => {
    if (
      !routeActive ||
      !userPos ||
      !destinationPos ||
      routeCoords.length < 2
    ) return;

    if (isUserOffRoute(userPos, routeCoords)) {
      offRouteCountRef.current += 1;
    } else {
      offRouteCountRef.current = 0;
    }

    // 🔥 Confirm off-route 3 times (avoids GPS jitter)
    if (offRouteCountRef.current >= 3) {
      offRouteCountRef.current = 0;
      recalculateRoute(userPos, destinationPos);
    }
  }, [userPos, routeActive, routeCoords, destinationPos]);


  const applyEMA = (prev, next, alpha = 0.35) => {
    if (!prev) return next;
    return [
      prev[0] + alpha * (next[0] - prev[0]),
      prev[1] + alpha * (next[1] - prev[1]),
    ];
  };


  const recalculateRoute = (startPos, endPos) => {
    if (!graphReady || !graph || !pathData) return;

    console.warn("🔄 Recalculating route…");

    const start = findNearestNodeExact([startPos[1], startPos[0]], pathData);
    const end = findNearestNodeExact([endPos[1], endPos[0]], pathData);

    if (!start || !end) return;

    const path = getRoute(
      normalizeCoord(start.snapped),
      normalizeCoord(end.snapped),
      graph
    );

    if (!path || path.length < 2) return;

    setRouteCoords(path.map(([lon, lat]) => [lat, lon]));
    setRouteVersion(v => v + 1);
  };

  const initialCategoryState = Object.fromEntries(
    allCategories.map((cat) => [cat, true])
  );

  const [activeCategories, setActiveCategories] =
    useState(initialCategoryState);

  const filters = {
    activeCategories,

    toggleCategory: (cat) => {
      setActiveCategories((prev) => ({
        ...prev,
        [cat]: !prev[cat],
      }));
    },

    setAll: (cats, value) => {
      const updated = Object.fromEntries(cats.map((c) => [c, value]));
      setActiveCategories(updated);
    },
  };


  /* ======== Enable compass access (iOS SAFARI) ======== */
  useEffect(() => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission().catch(() => { });
    }
  }, []);

  /* ======== Listen to device heading ======== */
  const compassHeadingRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.webkitCompassHeading != null) {
        compassHeadingRef.current = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        compassHeadingRef.current = 360 - e.alpha;
      }
    };

    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
    };
  }, []);


  /* ======== Fuse GPS + Compass ======== */
  const getFusedHeading = (gpsHeading, compassHeading) => {
    if (compassHeading != null) return compassHeading;
    if (gpsHeading != null) return gpsHeading;
    return 0;
  };

  useEffect(() => {
    if (!routeCoords.length) return;
    if (!routeActive) return;
    //if (!directions.length) return;

    const rawPath = routeCoords.map(([lat, lon]) => [lon, lat]); // reverse leaflet
    const dir = getDirections(rawPath, language, graph);

    setCurrentStep(0);
    setDirections(dir);
    setResetDirections(false);

  }, [routeVersion, language]);



  useEffect(() => {
    if (gpsStarted || simulating || Config.devTestMode) return;

    // QR / free start only BEFORE GPS lock
    if (freeStartPos && !gpsStarted) {
      setUserPos(freeStartPos);
      setCurrentExhibitId(null);
      
      return;
    }
  }, [freeStartPos, gpsStarted, simulating]);


  useEffect(() => {
    //console.log("inside 841");
    if (gpsStarted && !isInside) {
      let startPos = null;
      // console.log("inside 844");

      const entry = exhibits.find(e =>
        e.name.toLowerCase().includes("entry")
      );
      if (!entry) {
        alert("Entry gate not configured");
        return;
      }
      startPos = [entry.coords[1], entry.coords[0]];
      //console.log("🏁 Start = Entry Gate", startPos);
    }
  }, [gpsStarted, startPos]);


  useEffect(() => {
    if (!gpsStarted || !mapBounds || !exhibits.length) return;

 
    // Outside  → force entry gate
    if (!userPos || !isInside(userPos)) {
      const entry = exhibits.find(e =>
        e.name?.toLowerCase().includes("entry")
      );
      if (!entry?.coords) return;

      setMapPos([entry.coords[1], entry.coords[0]]);
    }
    // Inside  follow GPS
    else {
      setMapPos(userPos);
    }
  }, [gpsStarted, userPos, exhibits, mapBounds]);

  useEffect(() => {
    if (!mapRef.current || !mapPos) return;

    mapRef.current.setView(mapPos, Config.zoom, {
      animate: false
    });
  }, [mapPos]);

  
  function stripBasePath(pathname, basePath) {
    if (!basePath) return pathname.replace(/^\/+/, "");


    const base = "/" + basePath.replace(/^\/+|\/+$/g, "");

    let path = pathname;

    if (path === base) return "";

    if (path.startsWith(base + "/")) {
      path = path.slice(base.length + 1);
    } else {
      path = path.replace(/^\/+/, "");
    }

    return path;
  }



  /*============== On QR Click ==========*/
  function onQrResult(rawText) {
    try {
     // console.log("📥 Raw QR:", rawText);

      // ─────────────────────────────
      // CASE 1: URL-based QR
      // ─────────────────────────────
      if (rawText.startsWith("http")) {
        // Parse the QR URL

        const url = new URL(rawText); // rawQR = scanned QR string

        let rawPath = url.pathname;
        const exhibitId = stripBasePath(rawPath, Config.path);

        //console.log("🦁 Exhibit ID:", exhibitId);

        const exhibit = exhibits.find(e => e.id === exhibitId);
        if (!exhibit) {
          alert("Unknown exhibit QR");
          return;
        }

        // ✅ RESOLVE START POSITION
        let startPos = null;

        // 1️⃣ GPS inside map
        if (userPos && mapBounds && isInside(userPos)) {
          startPos = userPos;
         // console.log("📍 Start = GPS", startPos);
        }
        // 2️⃣ Entry Gate fallback
        else {
          if (gpsStarted || routeActive) return;
          const entry = exhibits.find(e =>
            e.name.toLowerCase().includes("entry")
          );
          if (!entry) {
            alert("Entry gate not configured");
            return;
          }
          startPos = [entry.coords[1], entry.coords[0]];
          //console.log("🏁 Start = Entry Gate", startPos);
        }

        // 🔥 FORCE ROUTE RE-CALCULATION
        setFreeStartPos(null);             // QR must not control start
        setUserPos([...startPos]);         // clone → force state change
        setCurrentExhibitId(exhibitId);

        // ⭐ REQUIRED in your app
        handleExhibitSelect(exhibitId);
        navigate(`/${exhibitId}`);
        setUIState(UI_STATES.ROUTE_FREE); // 🧭 now navigating


        return;
      }

      // ─────────────────────────────
      // CASE 2: JSON-based QR (legacy)
      // ─────────────────────────────
      const jsonSafe = rawText.replace(/'/g, '"');
      const data = JSON.parse(jsonSafe);

      if (!data.lat || !data.lon) {
        alert("Invalid QR code format.");
        return;
      }

      const pos = [parseFloat(data.lat), parseFloat(data.lon)];

      // legacy behavior preserved
      setFreeStartPos(pos);
      setUserPos(pos);
      setCurrentExhibitId(data.id ?? null);
      setUIState(UI_STATES.ROUTE_FREE); // 🧭 now navigating

      //console.log("📌 Using QR/freeStartPos as start:", pos);

    } catch (err) {
      console.error("QR decode failed:", err);
      alert("Invalid QR code.");
    }
  }


  function hardResetNavigation() {
    setSimulating(false);
    setMuteStepAnnouncements(true);
    setRouteActive(false);
    setDirections([]);
    setRouteCoords([]);
    setSelectedExhibits([]);
    setFreezeStepUpdates(true);
    setCurrentStep(0);
    setProgressPercent(0);

  }



  function findNearestExhibitId(latlon, thresholdMeters = 25) {
    let nearest = null;
    let minD = Infinity;
    exhibits.forEach((e) => {
      const exPt = turf.point([e.coords[0], e.coords[1]]);
      const p = turf.point([latlon[1], latlon[0]]);
      const d = turf.distance(exPt, p, { units: "kilometers" }) * 1000;
      if (d < minD) {
        minD = d;
        nearest = e.id;
      }
    });
    return minD <= thresholdMeters ? nearest : null;
  }
  // ---------- Voice Setup ----------
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) {
        setAvailableVoices(v);
        if (!selectedVoice) setSelectedVoice(v[0]);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  /* ---------------- Voice engine ---------------- */
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const speakText = (text) => {
    if (!voiceEnabled || !synthRef.current) return;
    try {
      synthRef.current.cancel();
    } catch (_) { }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    utterRef.current = u;

    try {
      synthRef.current.speak(u);
    } catch (_) { }
  };



  function handleSelectExhibit(exhibit) {
    setSelectedExhibit(exhibit);
    setSearchText(exhibit.name);
    setFilteredExhibits([]);

    // center map
    mapRef.current?.setView(
      [exhibit.coords[1], exhibit.coords[0]],
      18,
      { animate: true }
    );
  }
/*
  function handleStartDirections(exhibit = selectedExhibit) {
    if (!selectedExhibit) return;

    let start;

    if (gpsStarted && userPos && isInside(userPos)) {
      start = userPos;
    } else {
      start = freeStartPos; // entry gate fallback
    }

    if (!start) return;

    const end = [
      selectedExhibit.coords[1],
      selectedExhibit.coords[0]
    ];

    const route = computeRoute(start, end); // your existing routing logic

    setRouteCoords(route);
    setRouteActive(true);
  }
*/

  function activateEmergency() {
    if (emergencyActive) return;

    setEmergencyActive(true);
    setNavMode("emergency");

    //playSiren();

    console.warn("🚨 Emergency mode activated");
  }

  function deactivateEmergency() {
    setEmergencyActive(false);
    setNavMode("normal");

    //stopSiren();
  }

  function playSiren() {
    if (!sirenRef.current) {
      sirenRef.current = new Audio("/audio/siren.mp3");
      sirenRef.current.loop = true;
      sirenRef.current.volume = 0.9;
    }

    sirenRef.current
      .play()
      .catch(err => console.warn("Siren autoplay blocked:", err));
  }

  function stopSiren() {
    if (sirenRef.current) {
      sirenRef.current.pause();
      sirenRef.current.currentTime = 0;
    }
  }




  function onExhibitClick_freeMode(ex) {
    // ⭐ FULL CLEAN RESET — avoids stale currentStep and stale directions
    hardResetNavigation();
    if (!graphReady || !graph || !pathData) {
      console.warn("⛔ Graph not ready");
      return;
    }

    const freeLonLat = [freeStartPos[1], freeStartPos[0]];

    // ⭐ Snap start
    const bestSnap = snapToClosestPath(pathData.features, freeLonLat);
    if (!bestSnap) {
      console.warn("❗ Cannot snap freeStartPos");
      return;
    }

    const startExact = findNearestNodeExact(bestSnap, pathData);
    if (!startExact) {
      console.warn("❗ Cannot resolve start snapping");
      return;
    }

    const { snapped, nearest1, nearest2, feature: startFeature } = startExact;

    const sKey1 = coordKey(normalizeCoord(nearest1));
    const sKey2 = coordKey(normalizeCoord(nearest2));

    const startKey = insertVirtualNode(
      graph,
      snapped,
      sKey1,
      sKey2,
      startFeature.properties
    );

    // ⭐ Snap destination
    const endExact = findNearestNodeExact(ex.coords, pathData);
    if (!endExact) {
      console.warn("❗ Cannot snap exhibit position");
      return;
    }

    const {
      snapped: endSnap,
      nearest1: n1,
      nearest2: n2,
      feature: endFeature,
    } = endExact;

    const eKey1 = coordKey(normalizeCoord(n1));
    const eKey2 = coordKey(normalizeCoord(n2));

    const endKey = insertVirtualNode(
      graph,
      endSnap,
      eKey1,
      eKey2,
      endFeature.properties
    );

    // ⭐ Compute final route
    const path = getRoute(graph.nodes[startKey], graph.nodes[endKey], graph);

    if (!path || path.length < 2) {
      console.warn("⚠ No route from freeStartPos to exhibit");
      return;
    }

    // ⭐⭐ Reset state BEFORE setting directions
    setResetDirections(true);
    setSimulating(false);
    setCurrentStep(0);
    setProgressPercent(0);
    setDirections([]);

    // ⭐ Convert to Leaflet coords
    const leafletCoords = path.map(([lon, lat]) => [lat, lon]);

    setRouteCoords(leafletCoords);
    setRouteActive(true);

    // ⭐ Mark route changed → triggers directions refresh
    setRouteVersion((v) => v + 1);

    // ⭐⭐⭐ Build directions
    setDirections(getDirections(path, language));
    setResetDirections(false);
    // allow GPS updates again after 300ms (panel stabilizes)
    setTimeout(() => setFreezeStepUpdates(false), 300);

    // ⭐ Auto-start exhibit selection
    setSelectedExhibits([ex.id]);
    setCurrentStep(0);
    setProgressPercent(0);


  }




  /* == Added for GPS based real tracking */

  const onGpsUpdate = (pos) => {
    if (simulating) return; // 🚫 GPS paused during simulation
    const { latitude, longitude, accuracy } = pos.coords;
    if (accuracy > 25) return;

    const raw = [latitude, longitude];
    rawGpsPosRef.current = raw;
    setRawGpsForDebug(raw); // 🔥 THIS triggers render

    //console.log("GPS → routeActive:", routeActive);

    const filtered = applyEMA(
      filteredGpsPosRef.current,
      raw
    );
    filteredGpsPosRef.current = filtered;

    // ✅ LOGICAL POSITION
    setUserPos(filtered);

    // 🔥 Trigger navigation progress when route exists
    if (routeActive) {
      handleRealMovementProgress(filtered);
    }

    // ✅ THIS IS THE ONLY PLACE GPS sets userPos
    //setUserPos(filtered); // ✅ SINGLE SOURCE OF TRUTH
    // if (!routeActive && !isSimulating) {
    //   setUserPos(filtered);
    // }


//ajit changes this
    if (gpsStarted) {
      setGpsStarted(true);
      //console.log("🟢 GPS LOCK ACQUIRED");
    }

    //console.log("📡 RAW:", raw);
    //console.log("🎯 FILTERED:", filtered);


  };



  const handleRealMovementProgress = (gpsPos) => {
    if (!routeCoords || routeCoords.length === 0) return;
    if (!routeActive) return;
    if (freezeStepUpdates && !routeActive) return;   // 🚫 BLOCK HERE

    const finalHeading = getFusedHeading(
      null, // GPS heading unreliable//gpsPos.coords.heading,
      compassHeadingRef.current
    );

    setUserHeading(finalHeading);
    rotateUserIcon(finalHeading);
    //console.log("🚶 Progress update", gpsPos);
    //console.log("🚶 GPS → route snap", { raw: rawGpsPosRef.current, filtered: userPos,snapped: snappedPosRef.current, });



    const userPoint = turf.point([gpsPos[1], gpsPos[0]]);

    let closestDist = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < routeCoords.length; i++) {
      const r = routeCoords[i];
      const pt = turf.point([r[1], r[0]]);
      const d = turf.distance(userPoint, pt);
      if (d < closestDist) {
        closestDist = d;
        closestIndex = i;
      }
    }

    setCurrentStep(closestIndex);

    let remaining = 0;
    for (let i = closestIndex; i < routeCoords.length - 1; i++) {
      const a = turf.point([routeCoords[i][1], routeCoords[i][0]]);
      const b = turf.point([routeCoords[i + 1][1], routeCoords[i + 1][0]]);
      remaining += turf.distance(a, b) * 1000;
    }
    setDistanceRemaining(remaining);

    const travelled = simRef.current.totalDistance - remaining;
    const percent = (travelled / simRef.current.totalDistance) * 100;
    setProgressPercent(Math.min(100, percent));

    if (!muteStepAnnouncements && directions[closestIndex] && voiceEnabled) {
      speakText(directions[closestIndex]);
    }
    const snapped = routeCoords[closestIndex];
    snappedPosRef.current = snapped; // ✅ optional, for debug only // THIS IS THE ROUTE FOLLOW POSITION
    //setUserPos(snapped); // THIS drives marker
    // setDisplayUserPos(snapped);
    setCurrentStep(closestIndex);
    // Force Leaflet marker update
    if (userMarkerRef.current) {
      //userMarkerRef.current.setLatLng(snapped);
      updateUserLocation(
        snapped[0],          // lat
        snapped[1],          // lng
        mapRef.current
      );

    }

    //console.log("🧭 GPS → Route snap", { raw: rawGpsPosRef.current,  gps: gpsPos, snapped, });
  };

  // ---------- MAIN PATCH START ----------

  function onExhibitClick(ex) {
    // ⭐ FULL CLEAN RESET — avoids stale currentStep and stale directions
    hardResetNavigation();
    //console.log("🖱️ Exhibit clicked", {  clicked: ex.id,   currentExhibitId,  selectedExhibits,  justArrived,  freeStartPos, });
    //console.log("current step is:",currentStep);
    if (justArrived) setJustArrived(false);

    if (!currentExhibitId && !freeStartPos) {
      // No valid start, do NOT route
      return;
    }

    // ============================================================
    // NEW CASE: FREE-START → EXHIBIT CLICK
    // ============================================================
    // if (!currentExhibitId && freeStartPos) {  -- Patch for GPS user location
    if (!currentExhibitId && freeStartPos) {
      //console.log("🟢 Free-mode: routing from freeStartPos → exhibit");

      onExhibitClick_freeMode(ex); // ⭐ new function

      return;
    }

    // ============================================================
    // CASE 1 — FIRST CLICK (NO START, NO FREE-START)
    // ============================================================
    // ⭐ FIRST EVER CLICK (user has no start yet)
    if (!currentExhibitId && !freeStartPos) {
      // Set starting point
      setCurrentExhibitId(ex.id);
      // DO NOT ATTEMPT ROUTE ON FIRST CLICK
      setClickedExhibitId(null);
      return;
    }

    // ============================================================
    // CASE 2 — NEW EXHIBIT CLICK → ROUTE NEEDED
    // ============================================================
    // ⭐ Only attempt routing if we truly have a start
    if ((currentExhibitId || freeStartPos) && ex.id !== currentExhibitId) {
      if (!graphReady || !graph || !pathData) {
        console.warn("⛔ Graph/network not ready");
        return;
      }

      let startCoord;
      let fromName;

      if (!startCoord && !currentExhibitId && !freeStartPos) {
        console.warn("⛔ No valid start point yet. Select a start first.");
        return;
      }

      // ----------------------------------------------------------
      // ⭐ FREE-START (USER LOCATION)
      // ----------------------------------------------------------

      if (freeStartPos) {
        const freeLonLat = [freeStartPos[1], freeStartPos[0]];

        // ⭐ NEW — snap free position to closest path
        const bestSnap = snapToClosestPath(pathData.features, freeLonLat);
        if (!bestSnap) {
          console.warn("❗ Could not snap freeStartPos");
          return;
        }

        // find nearest segment of that snapped point
        const res = findNearestNodeExact(bestSnap, pathData);
        if (!res) {
          console.warn("❗ Could not snap freeStartPos to graph segment");
          return;
        }

        const { snapped, nearest1, nearest2, feature } = res;

        const key1 = coordKey(normalizeCoord(nearest1));
        const key2 = coordKey(normalizeCoord(nearest2));

        insertVirtualNode(graph, snapped, key1, key2, feature.properties);

        startCoord = normalizeCoord(snapped);
        fromName = "your current location";
      }

      // ----------------------------------------------------------
      // ⭐ NORMAL START (EXHIBIT)
      // ----------------------------------------------------------
      else {
        const from = exhibits.find((e) => e.id === currentExhibitId);
        fromName = from.name;

        const res = findNearestNodeExact(from.coords, pathData);

        if (!res) {
          console.warn("❗ Could not snap exhibit to path");
          return;
        }

        const { snapped, nearest1, nearest2, feature } = res;
        const key1 = coordKey(normalizeCoord(nearest1));
        const key2 = coordKey(normalizeCoord(nearest2));

        insertVirtualNode(graph, snapped, key1, key2, feature.properties);

        startCoord = normalizeCoord(snapped);
      }

      // ----------------------------------------------------------
      // DESTINATION SNAP
      // ----------------------------------------------------------
      const to = exhibits.find((e) => e.id === ex.id);

      const endExact = findNearestNodeExact(to.coords, pathData);
      if (!endExact) {
        console.warn("❗ Could not snap destination");
        return;
      }



      const { snapped: endSnap, nearest1: n1, nearest2: n2 } = endExact;

      //const eKey1 = coordKey(normalizeCoord(n1));
      //const eKey2 = coordKey(normalizeCoord(n2));

      const eKey1 = coordKey(normalizeCoord(n1));
      const eKey2 = coordKey(normalizeCoord(n2));
      //console.log("📍 Virtual A5 endKey:", eKey1);

      insertVirtualNode(graph, endSnap, eKey1, eKey2);

      const endCoord = normalizeCoord(endSnap);

      //console.log("StartCoord:", startCoord);
      //console.log("EndCoord:", endCoord);

      if (!Array.isArray(startCoord) || !Array.isArray(endCoord)) {
        console.warn("❗ Invalid start/end arrays", { startCoord, endCoord });
        return;
      }

      // ----------------------------------------------------------
      // ⭐ Dijkstra routing (REAL COORDS, not keys!)
      // ----------------------------------------------------------

      const path = getRoute(startCoord, endCoord, graph);
      //const path = getRoute(graph.nodes[startCoord], graph.nodes[endCoord], graph);

      if (!path || path.length < 2) {
        console.warn(`⚠️ No route from ${fromName} to ${to.name}`);
        return;
      }

      const leafletCoords = path.map(([lon, lat]) => [lat, lon]);

      // ----------------------------------------------------------
      // UI
      // ----------------------------------------------------------
      setRouteActive(true);
      setRouteCoords(leafletCoords);
      setDirections(getDirections(path, language));
      // allow GPS updates again after 300ms (panel stabilizes)
      setTimeout(() => setFreezeStepUpdates(false), 300);
      setResetDirections(false);
      setRouteVersion((v) => v + 1);

      setSelectedExhibits([currentExhibitId, ex.id]);
      setJustArrived(false);
      setCurrentStep(0);
      setProgressPercent(0);
      //console.log("current step is:",currentStep);

      //console.log(`🎯 Route ready: ${fromName} → ${to.name}`);

      // ----------------------------------------------------------
      // SPEAK
      // ----------------------------------------------------------
      if (voiceEnabled) {

        if (isHindi) speakText(`मार्ग तैयार है: ${fromName} से ${to.name}`);
        else if (isMarathi)
          speakMarathi(`मार्ग तयार आहे: ${fromName} ते ${to.name}`);
        else speakText(`Route from ${fromName} to ${to.name} is ready.`);
      }

      return;
    }

    // ============================================================
    // CASE 3 — SAME EXHIBIT CLICKED
    // ============================================================
    if (ex.id === currentExhibitId) {
      //console.log("🔁 Same exhibit clicked → selection reset");
      setSelectedExhibits([ex.id]);
      return;
    }
  }

  const onMapClick = (e) => {

    // 🧪 DEV MODE — first click sets START
    if (Config.devTestMode && !virtualStartKey) {
      const { lat, lng } = e.latlng;
      const freePos = [lat, lng];

      //console.log("🧪 DEV start selected:", freePos);

      // 🔥 THIS IS THE CRITICAL LINE
      setFreeStartPos(freePos);
      setCurrentExhibitId(null); // IMPORTANT


      const snap = findNearestNodeExact([lng, lat], pathData);
      if (!snap) {
        console.warn("❌ DEV start snap failed");
        return;
      }

      const k1 = coordKey(snap.nearest1, 6);
      const k2 = coordKey(snap.nearest2, 6);

      const vKey = insertVirtualNode(
        graph,
        snap.snapped,
        k1,
        k2,
        snap.feature?.properties
      );

      if (!vKey) {
        console.warn("❌ DEV start virtual node failed");
        return;
      }

      //console.log("🧪 DEV virtualStartKey:", vKey);
      setVirtualStartKey(vKey);

      // disable GPS follow completely
      autoFollowEnabledRef.current = false;

      return; // ⛔ STOP — this click is START only
    }

    const { lat, lng } = e.latlng;
    setUIState(UI_STATES.ROUTE_FREE); // 🧭 now navigating

    // console.log("Map clicked at:", e.latlng);
    // console.log("Map clicked at Position status:", UI_STATES.ROUTE_FREE);

    if (!graphReady || !pathData) {
      console.warn("⛔ Graph/network not ready for map click.");
      return;
    }

    // Leaflet lat,lng → GeoJSON lon,lat
    const targetPoint = [lng, lat];

    // -------------------------------
    // SNAP CLICK TO PATH
    // -------------------------------
    const res = findNearestNodeExact(targetPoint, pathData);
    if (!res) {
      console.warn("❗ Cannot snap map click to graph.");
      return;
    }

    const { snapped, nearest1, nearest2, feature } = res;

    // Convert segment endpoints → graph keys
    const key1 = coordKey(nearest1, 6);
    const key2 = coordKey(nearest2, 6);

    if (!graph.nodes[key1] || !graph.nodes[key2]) {
      console.warn("❗ Graph missing endpoint nodes:", { key1, key2 });
      return;
    }

    // Insert virtual node for END
    const endKey = insertVirtualNode(
      graph,
      snapped,
      key1,
      key2,
      feature.properties
    );
    //console.log("📍 Virtual endKey:", endKey);
    setVirtualStartKey(endKey); // or startKey if you split logic

    if (!endKey) {
      console.warn("❗ Could not create end virtual node.");
      return;
    }

    // -------------------------------
    // FIND START KEY
    // -------------------------------
    // -------------------------------
    // FIND START KEY (GENERIC)
    // -------------------------------
    let startKey = null;

    // 1️⃣ Free start (GPS / DEV / simulation)
    if (freeStartPos) {
      const userPoint = [freeStartPos[1], freeStartPos[0]]; // lon,lat
      const sres = findNearestNodeExact(userPoint, pathData);
      
      if (!sres) {
        console.warn("❗ Could not snap freeStartPos");
        return;
      }

      const sK1 = coordKey(sres.nearest1, 6);
      const sK2 = coordKey(sres.nearest2, 6);

      startKey = insertVirtualNode(
        graph,
        sres.snapped,
        sK1,
        sK2,
        sres.feature?.properties
      );
    }

    // 2️⃣ Exhibit fallback (Entry Gate / exhibit)
    else if (currentExhibitId) {
      const fromEx = exhibits.find((x) => x.id === currentExhibitId);
      if (!fromEx) {
        console.warn("❗ No exhibit for start");
        return;
      }

      const sres = findNearestNodeExact(fromEx.coords, pathData);
      if (!sres) return;

      const sK1 = coordKey(sres.nearest1, 6);
      const sK2 = coordKey(sres.nearest2, 6);

      startKey = insertVirtualNode(
        graph,
        sres.snapped,
        sK1,
        sK2,
        sres.feature?.properties
      );
    }

    // 3️⃣ Nothing available → stop
    else {
      console.warn("❗ No valid start position available");
      return;
    }

    // -------------------------------
    // ROUTE USING KEYS
    // -------------------------------
    // const path = getRoute(startKey, endKey, graph);

    // ⭐ Compute final route (pass coords, not keys)
    const path = getRoute(graph.nodes[startKey], graph.nodes[endKey], graph);

    if (!path || path.length < 2) {
      console.warn("⚠ No route available");
      return;
    }

    // Convert lon,lat → leaflet lat,lng
    const leafletCoords = path.map(([lon, lat]) => [lat, lon]);

    setRouteCoords(leafletCoords);
    setRouteActive(true);
    setRouteVersion((v) => v + 1);
    setCurrentStep(0);
    setProgressPercent(0);

    //console.log("🟦 Map-click route success:", path.length, "steps");
  };

  useEffect(() => {
    if (!clickedExhibitId) return;

    const ex = exhibits.find((e) => e.id === clickedExhibitId);
    if (!ex) return;

    // ⭐ If NO start selected → this becomes START
    if (!currentExhibitId && !freeStartPos) {
      setCurrentExhibitId(ex.id);
      setClickedExhibitId(null);
      return;
    }

    // ⭐ Now safe to calculate route
    onExhibitClick(ex);

    setClickedExhibitId(null);
  }, [clickedExhibitId, currentExhibitId, freeStartPos]);


  useEffect(() => {

    //console.group("USER POSITION OVERRIDE CHECK");
    //console.log("userPos:", userPos);
    //console.log("freeStartPos:", freeStartPos);
    //console.log("gpsStarted:", gpsStarted);
    //console.log("routeActive:", routeActive);
    //console.log("simulating:", isSimulating);
    //console.groupEnd();

    // 🚫 NEVER fallback once GPS starts
    // if (gpsStarted) return;

    // 🚫 NEVER override during simulation
    if (simulating) return;

    // 🚫 DEV MODE
    if (Config.devTestMode) return;

    // ⭐ 1 — GPS ACTIVE → ABSOLUTE PRIORITY
    if (gpsStarted && userPos) {
      // console.log("🛑 GPS active — no fallback");
      return;
    }

    // ⭐ 2 — QR / Free start
    if (freeStartPos) {
      //console.log("📌 Using freeStartPos");
      setUserPos(freeStartPos);
      setCurrentExhibitId(null);
      return;
    }

    // ⭐ 3 — EXISTING userPos → keep
    if (userPos) return;

    // ⭐ 4 — LAST RESORT → Entry gate
    //console.warn("⚠️ Using Entry Gate fallback");

    const entry = exhibits.find(e =>
      e.name.toLowerCase().includes("entry")
    );

    if (entry) {
      setCurrentExhibitId(entry.id);
      setUserPos([entry.coords[1], entry.coords[0]]);
    }

  }, [
    freeStartPos,
    simulating,
    gpsStarted,
    userPos,
  ]);

  // ---------- MAIN PATCH END ----------


  useEffect(() => {
    //console.log("🔥 Updated routeActive:", routeActive,"simulating:", simulating,"routeCoordsLen:",routeCoords.length, "routeVersion:", routeVersion);
    if (routeCoords.length > 1 && routeActive) true;
    //console.log("✅ Route visually active and ready.");
  }, [routeActive, simulating, routeCoords, routeVersion]);

  // ---------- Simulation ----------
  useEffect(() => {
    if (!simulating || routeCoords.length < 2) return;
    //setSimulating(true);

    // ⭐ Always reset at start of simulation
    setCurrentStep(0);

    //Simulate Walk Control
    let segmentIndex = 0;
    let progress = 0;
    const stepMeters = 0.8; // distance simulated each frame
    const frameDelay = 16; // ms delay ~ 16 FPS

    let timerId = null;
    let stopped = false;
    //  const map = mapRef.current;

    setSimulating(true);
    
    //  if (!simulating) {
    //    console.log("inside 1658");
    //  map.fitBounds(mapBounds, {animate: false, padding: [20, 20],});
    // }



    const totalDistance = routeCoords.reduce((sum, coord, i) => {
      if (i === 0) return sum;
      const prev = turf.point([routeCoords[i - 1][1], routeCoords[i - 1][0]]);
      const curr = turf.point([coord[1], coord[0]]);
      return sum + turf.distance(prev, curr) * 1000;
    }, 0);

    function translateToHindi(text) {
      return text
        .replace("Start", "शुरू करें")
        .replace("walk", "चलें")
        .replace("Continue straight", "सीधे आगे बढ़ें")
        .replace(
          "Arrive at your destination",
          "आप अपने गंतव्य पर पहुँच गए हैं"
        );
    }

    function translateToMarathi(text) {
      return text
        .replace("Start", "सुरू करा")
        .replace("walk", "पुढे जा")
        .replace("Continue straight", "सरळ पुढे जा")
        .replace(
          "Arrive at your destination",
          "आपण आपल्या ठिकाणी पोहोचला आहात"
        );
    }

    function step() {
      if (stopped) return;

      /* =======================
         🏁 FINAL DESTINATION
         ======================= */
      if (segmentIndex >= routeCoords.length - 1) {
        const finalPos = routeCoords[routeCoords.length - 1];

        setUserPos(finalPos);
        setSimulating(false);
        setRouteActive(false);
        setProgressPercent(100);
        setDistanceRemaining(0);
        autoFollowEnabledRef.current = false;

        if (isHindi) {
          speakText("आप गंतव्य पर पहुँच गए हैं।");
        } else if (isMarathi) {
          speakMarathi("आपण आपल्या ठिकाणी पोहोचलात.");
        } else {
          speakText("You have arrived at your destination.");
        }

        setJustArrived(true);
        stopped = true;
        clearTimeout(timerId);

        const arrivedExhibitId = findNearestExhibitId(finalPos, 25);

        if (arrivedExhibitId) {
          setCurrentExhibitId(arrivedExhibitId);
          setFreeStartPos(null);
          setVirtualStartKey(null);
        } else {
          setFreeStartPos(finalPos);
          setCurrentExhibitId(null);

          const freeLonLat = [finalPos[1], finalPos[0]];
          const snap = findNearestNodeExact(freeLonLat, pathData);

          if (snap) {
            const k1 = coordKey(normalizeCoord(snap.nearest1));
            const k2 = coordKey(normalizeCoord(snap.nearest2));
            const vKey = insertVirtualNode(graph, snap.snapped, k1, k2);
            setVirtualStartKey(vKey);
          }
        }

        setTimeout(() => {
          setSelectedExhibits([]);
          setJustArrived(false);
        }, 1500);

        return;
      }



      /* =======================
         🚶 SEGMENT WALKING
         ======================= */
      const start = turf.point([
        routeCoords[segmentIndex][1],
        routeCoords[segmentIndex][0],
      ]);

      const end = turf.point([
        routeCoords[segmentIndex + 1][1],
        routeCoords[segmentIndex + 1][0],
      ]);

      const segmentDistance = turf.distance(start, end) * 1000;

      if (segmentDistance < 1) {
        segmentIndex++;
        progress = 0;
        timerId = setTimeout(step, frameDelay);
        return;
      }

      progress += stepMeters / segmentDistance;

      /* =======================
         🔒 STOP BEFORE TURF BREAKS
         ======================= */
      if (progress >= 1) {
        progress = 0;
        segmentIndex++;

        if (segmentIndex < directions.length && voiceEnabled) {
          const stepText = directions[Math.min(segmentIndex, directions.length - 1)];

          if (language === "hi-IN") speakText(translateToHindi(stepText));
          else if (language === "mr-IN") speakMarathi(translateToMarathi(stepText));
          else speakText(stepText);

          setCurrentStep(segmentIndex);
        }

        timerId = setTimeout(step, frameDelay);
        return;
      }

      /* =======================
         📍 SAFE INTERPOLATION
         ======================= */
      const line = turf.lineString([
        start.geometry.coordinates,
        end.geometry.coordinates,
      ]);

      const maxKm = turf.length(line);
      const distKm = (segmentDistance * progress) / 1000;

      if (distKm <= 0 || distKm > maxKm) {
        console.warn("⚠️ Turf distance invalid — stopping");
        stopped = true;
        return;
      }

      const interp = turf.along(line, distKm)?.geometry?.coordinates;

      if (!interp || interp.length !== 2) {
        console.warn("⚠️ Invalid turf interpolation", interp);
        stopped = true;
        return;
      }

      const newPos = [interp[1], interp[0]];

      // ✅ ONLY update position — map follows elsewhere
      setUserPos(newPos);

      /* =======================
         📏 DISTANCE + PROGRESS
         ======================= */
      let remaining = 0;
      for (let i = segmentIndex; i < routeCoords.length - 1; i++) {
        const a = turf.point([routeCoords[i][1], routeCoords[i][0]]);
        const b = turf.point([routeCoords[i + 1][1], routeCoords[i + 1][0]]);
        remaining += turf.distance(a, b) * 1000;
      }

      remaining -= segmentDistance * progress;
      remaining = Math.max(0, remaining);

      setDistanceRemaining(remaining);

      const travelled = totalDistance - remaining;
      setProgressPercent(Math.min(100, (travelled / totalDistance) * 100));

      timerId = setTimeout(step, frameDelay);
    }

    step();
    return () => {
      stopped = true;
      clearTimeout(timerId);
    };
  }, [simulating, routeVersion, routeCoords, directions, language]);

  //Auto-scroll to current direction step
  useEffect(() => {


    if (!routeCoords.current) return;

    const el = routeCoords.current.querySelector(
      `[data-step-index="${currentStep}"]`
    );

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentStep]);

  const emergencyVisualPoints = React.useMemo(() => {
    if (navMode !== "emergency") return [];

    return exhibits.filter(e =>
      e.emergencyAssemblyPoint === true ||
      e.roles?.includes("emergency_exit")
    );
  }, [navMode, exhibits]);




  function resolveDestination({
    exhibits,
    selectedExhibitId,
    navMode,
    userPos
  }) {
    if (navMode === "emergency") {
      const candidates = exhibits.filter(e =>
        e.emergencyAssemblyPoint === true &&
        !e.roles?.includes("exit") &&
        !e.roles?.includes("emergency_exit")
      );

      if (!candidates.length) return null;

      return candidates.reduce((best, e) => {
        if (!best) return e;

        const dBest = turf.distance(
          turf.point(userPos),
          turf.point(best.coords)
        );
        const dCurr = turf.distance(
          turf.point(userPos),
          turf.point(e.coords)
        );

        return dCurr < dBest ? e : best;
      }, null);
    }

    return exhibits.find(e => e.id === selectedExhibitId);
  }




  // ⭐ Only snap user to exhibit when JUST arrived via simulation
  useEffect(() => {
    if (!justArrived) return;
    if (!userPos || !exhibits?.length) return;

    const ex = resolveDestination({
      exhibits,
      selectedExhibitId: currentExhibitId,
      navMode,
      activeFloor,
      userPos
    });

    if (!ex) return;

    // ✅ Safe place for arrival logic
    console.log("📍 Arrived at:", ex.name);

    // Optional:
    // setCurrentSpot(ex);
    // stopNavigation();
    // speakArrival(ex.name);

  }, [
    justArrived,
    userPos,
    exhibits,
    currentExhibitId,
    navMode,
    activeFloor
  ]);



  function MapClickHandler({ onMapClick, disabled }) {
    useMapEvent({
      click(e) {
        if (disabled) return;   // 🔥 BLOCK clicks when scanner open
        onMapClick(e);
      },
    });
    return null;
  }

  function MapClickHandlerpos({ onMapClick, disabled }) {
    useMapEvent({
      click(e) {
        if (disabled) return;

        const { lat, lng } = e.latlng;

        //console.log("GPS Lat:", lat);
        //console.log("GPS Lng:", lng);

        onMapClick?.({ lat, lng });
      },
    });

    return null;
  }

  function pulsingMarker(color) {
    return L.divIcon({
      html: `
      <div class="pulse-marker" style="background:${color}"></div>
    `,
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  // ------------------------
  // 1. USE MY LOCATION LOGIC
  // ------------------------

  const watchId = useRef(null);
  const lastAccuracyRef = useRef(null);

  const smooth = (prev, next) => {
    if (!prev) return next;
    return [
      prev[0] + SMOOTHING_ALPHA * (next[0] - prev[0]),
      prev[1] + SMOOTHING_ALPHA * (next[1] - prev[1]),
    ];
  };

  // 🔥 SAFARI-SAFE: GPS STARTS HERE


  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);



  // ------------------------
  // 3. TOGGLE VOICE
  // ------------------------
  const handleToggleVoice = () => setVoiceEnabled(v => !v);



  const handleLanguageChange = () => {
    const next = {
      "en-IN": "hi-IN",
      "hi-IN": "mr-IN",
      "mr-IN": "en-IN"
    };
    setLanguage(next[language]);
  };


  // ------------------------
  // 5. SIMULATE WALK LOGIC
  // ------------------------
  const handleSimulateWalk = () => {
    if (!simulating && routeCoords.length > 1 && routeActive) {
      // START
      setCurrentStep(0);
      setProgressPercent(0);
      setDistanceRemaining(0);
      setSimulating(true);

      if (language === "mr-IN") speakMarathi("मार्ग सिम्युलेशन सुरू झाले आहे.");
      else if (language === "hi-IN") speakText("मार्ग सिमुलेशन शुरू हो गया है।");
      else speakText("Starting navigation simulation.");

      if (directions.length > 0 && voiceEnabled) {
        speakText(directions[0]);
      }
    } else {
      // STOP
      setSimulating(false);
      setFreeStartPos(userPos);
      setRouteActive(false);
      setCurrentExhibitId(null);

      if (language === "mr-IN") speakMarathi("सिम्युलेशन थांबले.");
      else if (language === "hi-IN") speakText("सिमुलेशन रोका गया है।");
      else speakText("Simulation stopped.");
    }
  };

  // useEffect(() => {
  //console.log("📍 POS", {raw: rawGpsPosRef.current, user: userPos, gps: gpsStarted, route: routeActive, sim: simulating, });
  // }, [userPos]);

  // useEffect(() => {
  //   console.log("🧭 userPos UPDATED:", userPos);
  // }, [userPos]);

  // useEffect(() => {
  //  console.log("🛰 RAW GPS UPDATED:", rawGpsPosRef.current);
  // });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!userMarkerRef.current) return;

    const el = userMarkerRef.current.getElement();
    if (!el) return;

    el.style.transform = `rotate(${userHeading}deg)`;
  }, [userHeading]);

  useEffect(() => {
    if (!mapRef.current) return;

    setTimeout(() => {
      mapRef.current.invalidateSize();
    }, 150);
  }, [uiState]);


  useEffect(() => {
    const close = () => setFilteredExhibits([]);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapBounds?.isValid()) return;

    if (!simulating) {
      // console.log("inside 2038");
      mapRef.current.fitBounds(mapBounds, { animate: false, });
    }
  }, [mapBounds]);

  function MapControllerold({ mapRef }) {
    const map = useMap();

    useEffect(() => {
      mapRef.current = map;
      //console.log("🗺️ Map instance ready via useMap()");
    }, [map, mapRef]);

    return null;
  }

  function MapController({ mapRef }) {
    const map = useMap();

    useEffect(() => {
      if (!map) return;

      // expose map instance
      mapRef.current = map;

      // 🔄 enable rotation (plugin)
      map.options.rotate = true;
      map.options.touchRotate = true;
      map.options.bearing = 0;

      // defensive: some builds require this
      if (map.setBearing) {
        map.setBearing(0);
      }

      // prevent scroll/gesture conflicts
      map.getContainer().style.touchAction = "pan-x pan-y";

      // optional: log
      // console.log("🧭 Map rotation enabled");

      return () => {
        // cleanup (optional)
        if (map.setBearing) map.setBearing(0);
      };
    }, [map, mapRef]);

    return null;
  }




  function pathStyle(feature) {
    if (!feature) return { color: "#9ACB8D", weight: 2 };

    let p = feature.properties || {};

    // 🔁 RESOLVE DERIVED / REVERSED FEATURES
    if (!p.routeType && p._cleanedId) {
      const baseId = p._cleanedId.replace(/_rev_.*/, "");
      const original = pathIndex[baseId];

      if (original?.properties) {
        p = original.properties;
      }
    }

    /* =============================
       🚨 EMERGENCY MODE OVERRIDE
       ============================= */
    if (navMode === "emergency" && p.modes?.includes("emergency")) {
      return {
        color: "#D32F2F",
        weight: 5,
        dashArray: "6,6"
      };
    }

    /* =============================
       ⛔ CLOSED / RESTRICTED
       ============================= */
    if (p.status === "closed" || p.access === "restricted") {
      return {
        color: "#9E9E9E",
        weight: 2,
        dashArray: "2,6"
      };
    }

    /* =============================
       🎯 EXPLICIT COLOR
       ============================= */
    if (p.color) {
      return {
        color: p.color,
        weight: 4
      };
    }

    /* =============================
       🧭 ROUTE TYPE FALLBACK
       ============================= */
    switch (p.routeType) {
      case "primary":
        return { color: "#07f33e", weight: 4 };

      case "secondary":
        return { color: "#388E3C", weight: 3 };

      case "emergency":
        return {
          color: "#D32F2F",
          weight: 5,
          dashArray: "6,6"
        };

      case "service":
        return { color: "#5f021b", weight: 3 };

      default:
        return { color: "#9ACB8D", weight: 2 };
    }
  }

  const visibleExhibitsold = useMemo(() => {
    if (uiState === UI_STATES.IDLE) return [];

    if (uiState === UI_STATES.SELECTED && selectedExhibit) {
      return [selectedExhibit];
    }

    if (uiState === UI_STATES.BROWSING && activeCategory) {
      return exhibits.filter(e => e.category === activeCategory);
    }

    return [];
  }, [uiState, activeCategory, selectedExhibit, exhibits]);

  const visibleExhibits = useMemo(() => {
    // 1️⃣ Nothing visible when idle
    if (uiState === UI_STATES.IDLE) return [];

    // 2️⃣ When an exhibit is selected, only show that
    if (uiState === UI_STATES.SELECTED && selectedExhibit) {
      return [selectedExhibit];
    }

    // 3️⃣ Browsing mode → show icons
    if (uiState === UI_STATES.BROWSING) {
      return exhibits.filter(ex => {
        // ✅ FLOOR FILTER (if used)
        if (activeFloor !== null && ex.floor !== activeFloor) return false;

        // ✅ CATEGORY FILTER
        // activeCategory === null → ALL
        if (activeCategory && ex.category !== activeCategory) return false;

        return true;
      });
    }

    // 4️⃣ Default
    return [];
  }, [
    uiState,
    activeCategory,
    activeFloor,
    selectedExhibit,
    exhibits
  ]);



  const handleDirections = () => {
    if (!selectedExhibit) return;

    handleExhibitSelect(selectedExhibit.id);
    setUIState(UI_STATES.ROUTE_READY); // ✅ footer appears
  };

  const stopNavigation = () => {
    handleSimulateWalk();       // ⛔ stop interval / GPS mock
    // clearRoute();             // 🧹 remove polyline
    setRouteCoords([]);
    setDistanceRemaining(0);
    setTotalRouteDistance(0);
    setSelectedExhibit(null);
    setUIState(UI_STATES.IDLE);
    setSearchText("");
    setFilteredExhibits([]);

    // 🌍 RESET URL TO BASE
    //navigate(import.meta.env.BASE_URL, { replace: true });


  };


const handleUseLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported on this device");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const latLng = [latitude, longitude];

      // React state (your existing logic)
      setManualUserPos(latLng);
      rawGpsPosRef.current = latLng;
      setFreeStartPos(latLng);
      setSelectedExhibit(null);
      setRouteActive(false);
      setUIState(UI_STATES.BROWSING);

      // 🔥 THIS IS THE MISSING LINE
      updateUserLocation(latitude, longitude, mapRef.current);

      // Move map
      mapRef.current?.setView(latLng, 18, { animate: true });

      console.log("📍 GPS acquired", { latitude, longitude, accuracy });
    },
    (err) => {
      console.error("❌ GPS error:", err);
      alert("Unable to fetch your location. Please enable GPS.");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );
};


  const zoomToCategory = (categoryKey) => {
    if (!mapRef.current) return;

    const categoryExhibits =
      categoryKey === "all"
        ? exhibits
        : exhibits.filter(e => e.category === categoryKey);

    if (categoryExhibits.length === 0) return;

    const bounds = categoryExhibits.map(ex => [
      ex.coords[1], // lat
      ex.coords[0], // lng
    ]);

    mapRef.current.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 18,
      animate: true,
    });
  };

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = d => (d * Math.PI) / 180;
    const toDeg = r => (r * 180) / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function rotateMap(map, bearing) {
  if (!map) return;

  const pane = map
    .getContainer()
    .querySelector(".leaflet-map-pane");

  if (!pane) return;

  requestAnimationFrame(() => {
    pane.style.transformOrigin = "50% 50%";
    pane.style.transition = "transform 0.25s linear";
    pane.style.transform = `rotate(${-bearing}deg)`;
  });
}



  const isNavigating =
    uiState === UI_STATES.NAVIGATING ||
    uiState === UI_STATES.NAVIGATINGF;

  function useHeadingUpNavigation({
    mapRef,
    userPos,
    prevPos,
    speed,
    deviceHeading,
    isNavigating
  }) {
    const lastBearingRef = useRef(0);

    //  useEffect(() => {
    //  console.log("NAV STATE", uiState, "isNavigating", isNavigating);
    //}, [uiState]);

    useEffect(() => {
      if (
        !isNavigating ||
        !mapRef.current ||
        !userPos ||
        !prevPos
      ) {
        return;
      }

      // Avoid jitter when stationary
      if (speed < 0.5 && deviceHeading == null) return;


      const rawBearing =
        speed > 1
          ? calculateBearing(
            prevPos.lat,
            prevPos.lng,
            userPos.lat,
            userPos.lng
          )
          : deviceHeading;

      if (rawBearing == null) return;

      // Smooth rotation (low-pass filter)
      const smoothBearing =
        lastBearingRef.current * 0.8 + rawBearing * 0.2;

      lastBearingRef.current = smoothBearing;

      rotateMap(mapRef.current, smoothBearing);
    }, [
      userPos,
      prevPos,
      speed,
      deviceHeading,
      isNavigating,
      mapRef
    ]);
  }



  // ✅ CALL THE HOOK HERE
  useHeadingUpNavigation({
    mapRef,
    userPos,
    prevPos,
    speed,
    deviceHeading,
    isNavigating
  });

  useEffect(() => {
    if (!isNavigating && mapRef.current) {
      mapRef.current.getContainer().style.transform = "rotate(0deg)";
    }
  }, [isNavigating]);

  useEffect(() => {
    if (!userPos) {
      setUserPos(rawGpsPosRef.current);
      setPrevPos(rawGpsPosRef.current);
      return;
    }
    setPrevPos(userPos);
    setUserPos(rawGpsPosRef.current);

    if (isOutside(rawGpsPosRef.current)) {
      //console.warn("🚫 You are outside the MAP");
      setUIState(UI_STATES.OUTSIDE_MAP);
      return;
    }


  }, [rawGpsPosRef.current]);


  const [pickerOpen, setPickerOpen] = useState(false);

  function handleIconSelect(type) {
    setNavigationIcon(type);
    setPickerOpen(false);
  }



function getBearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function rotateMap(map, bearing) {
  const pane = map.getPane("mapPane");
  if (!pane) return;

  pane.style.transformOrigin = "50% 50%";
  pane.style.transition = "transform 0.35s ease-out";
  pane.style.transform = `rotate(${-bearing}deg)`;
}

function keepMarkerUpright(marker, bearing) {
  const el = marker.getElement();
  if (!el) return;

  const icon = el.querySelector(".user-marker-icon");
  if (!icon) return;

  icon.style.transform = `rotate(${bearing}deg)`;
}

let lastLatLng = null;

function updateUserLocation(lat, lng, map) {
  if (!map || lat == null || lng == null) return;

  if (userPos) {
    userPos.setLatLng([lat, lng]);
  }

  if (lastLatLng) {
    const bearing = getBearing(
      lastLatLng.lat,
      lastLatLng.lng,
      lat,
      lng
    );

    console.log("🧭 bearing:", bearing);

    rotateMap(map, bearing);
  }

  lastLatLng = { lat, lng };
}



 
  // ---------- Render ----------
  return (

    <div className="app-root glass-app">

      {/* ⭐ RIGHT: Directions Sidebar (Material Style) */}
      {uiState === UI_STATES.NAVIGATING &&
        directions[currentStep] && (
          <div className="nav-header">
            <div className="nav-header-left">
              <span className="nav-icon">
                {getTurnIcon(directions[currentStep])}
              </span>

              <div className="nav-text">
                {directions[currentStep]}
              </div>
            </div>

            <div className="nav-header-right">
              <button
                className="nav-expand-btn"
                onClick={() => setShowDirections(true)}
              >
                ☰
              </button>
            </div>

            <div className="nav-progress">
              <div
                className="nav-progress-bar"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}


      {uiState === UI_STATES.NAVIGATINGF && routeActive && (
        <div className="nav-header">
          <div className="nav-header-left">
            <span className="nav-icon">
              {getTurnIcon(directions[currentStep] ?? "")}
            </span>

            <div className="nav-text">
              {directions[currentStep] ?? "Proceed to destination"}
            </div>
          </div>

          <div className="nav-header-right">
            <button
              className="nav-expand-btn"
              onClick={() => setShowDirections(true)}
            >
              ☰
            </button>
          </div>

          <div className="nav-progress">
            <div
              className="nav-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div
        className="category-tabs"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {EXHIBIT_TABS.map(tab => (
          <button
            key={tab.key}
            className={`category-chip ${activeCategory === tab.key ? "active" : ""
              }`}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();      // ✅ stop Leaflet tap synthesis
              e.stopPropagation();     // ✅ safety

              setActiveCategory(
                tab.key === "all" ? null : tab.key
              );

              setUIState(UI_STATES.BROWSING); // icons only
              zoomToCategory(tab.key);       // 🔍 AUTO ZOOM
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>


      {/* Show scanner overlay */}

      {showScanner && (
        <div
          style={{
            position: "fixed",   // 🔥 MUST be fixed
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >



          <div onClick={(e) => e.stopPropagation()}>
            <QRScanner
              onResult={onQrResult}        // ✅ HANDLE DECODED QR
              onClose={() => setShowScanner(false)}
            />
          </div>

        </div>
      )}



      {/* ======================== BODY ======================== */}
      <div
        style={{
          display: "flex",
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >

        {/* ⭐ CENTER: Map Container */}

        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* MAP */}

          {uiState === UI_STATES.OUTSIDE_MAP && (
            <div className="outside-map-indicator">
              Outside  · Navigation starts at Entry Gate
            </div>
          )}


          <div className="top-ui-stack">

            {/* ---------- GPS STATUS ICON (UI) ---------- */}
            <div
              style={{
                position: "fixed",
                top: 4,
                right: 2,
                zIndex: 10000,
                background: "rgba(0,0,0,0.65)",
                borderRadius: "999px",
                padding: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none"
              }}
            >
              {gpsStatus === "on" && <MapPin color="#21eb06" size={18} />}

              {gpsStatus === "searching" && (
                <MapPin
                  color="#03a9f4"
                  size={18}
                  className="gps-searching"
                />
              )}

              {gpsStatus === "off" && <MapPinOff color="#f44336" size={18} />}

              {gpsStatus === "permission-denied" && (
                <AlertTriangle color="#ff9800" size={18} />
              )}
            </div>


            <div className="search-bar1">

              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onFocus={() => {
                  setSearchText("");          // 🔥 clear old value
                  setFilteredExhibits([]);    // 🔥 reset suggestions
                  setUIState(UI_STATES.BROWSING);
                }}
                placeholder="Search for exhibits"
              />

              <button
                disabled={!selectedExhibit}
                //onClick={() => handleExhibitSelect(selectedExhibit.id)}
                onClick={handleDirections}


                title="Directions"
              >
                ➤
              </button>

              {filteredExhibits.length > 0 && (
                <div className="search-suggestions1">
                  {filteredExhibits.slice(0, 6).map(ex => (
                    <div
                      key={ex.id}
                      className="search-suggestion-item1"
                      onClick={() => {
                        setSelectedExhibit(ex);
                        setSearchText(ex.name);

                        setFilteredExhibits([]);


                        mapRef.current?.setView(
                          [ex.coords[1], ex.coords[0]],
                          18,
                          { animate: true }
                        );
                        setUIState(UI_STATES.SELECTED); // 👈 STOP HERE
                        //handleExhibitSelect(ex.id);

                      }}
                    >
                      <strong>{ex.name}</strong>
                      <span className="suggestion-category">
                        {ex.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {emergencyActive && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 3000,
                background: "#b71c1c",
                color: "#fff",
                padding: "12px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "16px",
                animation: "pulse 1.2s infinite"
              }}
            >
              🚨 EMERGENCY MODE ACTIVE — FOLLOW SAFE EXIT ROUTE 🚨
            </div>
          )}


          <button
            onClick={() => {
              if (emergencyActive) {
                deactivateEmergency();
              } else {
                activateEmergency();
              }
            }}
            style={{
              position: "fixed",
              bottom: "90px",
              right: "16px",
              zIndex: 3000,
              background: emergencyActive ? "#2e7d32" : "#d32f2f",
              color: "#fff",
              border: "none",
              padding: "14px",
              borderRadius: "50%",
              fontSize: "18px",
              cursor: "pointer",
              boxShadow: emergencyActive
                ? "0 0 12px rgba(46,125,50,0.8)"
                : "0 0 12px rgba(211,47,47,0.8)"
            }}
            title={emergencyActive ? "Clear Emergency" : "Trigger Emergency"}
          >
            {emergencyActive ? "✅" : "🚨"}
          </button>



          {/* MAP */}
          <MapContainer
            center={Config.center}
            zoomAnimation={false}
            bounds={mapBounds}                    // ✅ REQUIRED
            zoom={Config.zoom}
            minZoom={Config.minZoom}
            maxZoom={Config.maxZoom}
            //maxBounds={mapBounds}                 // ✅ FIXED
            //maxBoundsViscosity={1.0}
            attributionControl={false}
            style={{
              position: "absolute",
              top:
                uiState === UI_STATES.NAVIGATING ||
                  uiState === UI_STATES.NAVIGATINGF
                  ? "var(--nav-header-height)"
                  : 0,

              bottom:
                uiState === UI_STATES.NAVIGATING ||
                  uiState === UI_STATES.NAVIGATINGF
                  ? "var(--nav-footer-height)"
                  : 0,

              left: 0,
              right: 0,
            }}

            whenCreated={(map) => {
              mapRef.current = map;
              map.options.rotate = true;
              map.options.touchRotate = true;
              //console.log("🗺️ Map instance ready");
            }}
            {...(Config.useBounds
              ? {
                maxBounds: mapBounds,        // ✅ NOT wrapped
                maxBoundsViscosity: 1.0,
              }
              : {})}
          >

            <MapController mapRef={mapRef} />



            {navMode === "emergency" &&
              emergencyVisualPoints.map(e => (
                <Marker
                  key={e.id}
                  position={[e.coords[1], e.coords[0]]}
                  icon={L.divIcon({
                    className: "emergency-marker",
                    html: "🚨"
                  })}
                />
              ))}

            {/* Capture map clicks   <MapClickHandler onMapClick={onMapClick} disabled={showScanner} />*/}

            {/* 
  <MapClickHandlerpos
  disabled={showScanner}
  onMapClick={({ lat, lng }) => {
    console.log("Exhibit GPS position:", lat, lng);

    // Example: save to state / backend
    // saveExhibit({ lat, lng });
  }}
/>
*/}

            <MapClickHandler onMapClick={onMapClick} disabled={showScanner} />

            <TileLayer
              url={Config.tileLayer.url}
              attribution={Config.tileLayer.attribution}
              tileSize={256}
              //tms={true}
              minZoom={Config.minZoom}
              maxZoom={Config.maxZoom}
              minNativeZoom={Config.minZoom}
              maxNativeZoom={Config.maxZoom}

              bounds={mapBounds}                  // ✅ REQUIRED
              noWrap={true}                       // ✅ REQUIRED
            />


            <GeoJSON
              data={pathData}
              style={pathStyle}
            />


            {/* ===== INTENT-DRIVEN EXHIBITS ===== */}
            {visibleExhibits.map((ex) => (
              <Marker
                key={ex.id}
                position={[ex.coords[1], ex.coords[0]]}
                icon={
                  uiState === UI_STATES.SELECTED
                    ? pulsingMarker(ex.color)
                    : exhibitIcon(ex)
                }
                eventHandlers={{
                  click: () => {
                    setSelectedExhibit(ex);
                    setUIState(UI_STATES.SELECTED);
                  },
                }}
              />
            ))}





            {displayUserPos && isValidLatLng(displayUserPos) && (
              <Marker
                position={displayUserPos}
                icon={youAreHereIcon}
                ref={userMarkerRef}
                zIndexOffset={1000}
              >
                <Popup>You are here</Popup>
              </Marker>
            )}

            {rawGpsPosRef.current && (
              <Marker
                position={rawGpsPosRef.current}
                icon={rawDebugIcon}
                zIndexOffset={2000}
              />
            )}

            {routeCoords.length > 1 && (
              <Polyline
                key={`route-${routeVersion}-${routeActive}`}
                positions={routeCoords}
                className={routeActive ? "route-glow" : ""}
                pathOptions={{
                  //className: routeActive ? "route-glow" : "",
                  color: "rgb(9, 13, 243)", // 🔵 your original route color this shows the dash colour
                  weight: 4,
                  opacity: 1,
                  smoothFactor: 0,
                  //renderer: L.canvas(),
                }}
              />
            )}




            {/* ⭐ SHOW ROUTE START MARKER */}
            {routeActive && routeCoords.length > 1 && (
              <Marker
                position={routeCoords[0]}
                icon={iconMarker("rgba(248, 10, 10, 0.74)", FaPlay)}
              />
            )}

            {/* ⭐ SHOW ROUTE END MARKER */}
            {routeActive && routeCoords.length > 1 && (
              <Marker
                position={routeCoords[routeCoords.length - 1]}
                icon={iconMarker("#ed0a0ac9", FaFlagCheckered)}
              />
            )}

            {/* ⭐ Free-start marker */}
            {freeStartPos && (
              <Marker
                position={freeStartPos}
                icon={iconMarker("#f1c40f", FaUser)}
              />
            )}


            {/* GPS accuracy ring — MOVE HERE */}
            {gpsStatus === "on" &&
              Array.isArray(displayUserPos) &&
              typeof gpsAccuracyRef.current === "number" && (
                <Circle
                  center={displayUserPos}
                  radius={gpsAccuracyRef.current}
                  pathOptions={{
                    color: "#2196f3",
                    weight: 1,
                    opacity: 0.4,
                    fillColor: "#2196f3",
                    fillOpacity: 0.15
                  }}
                />
              )}


          </MapContainer>

          {uiState === UI_STATES.ROUTE_FREE &&
            (
              <div className="map-footer">
                <div className="title"> Custom Route</div>
                <div className="subtitle">Ready to start navigation</div>
                <div className="action-row">
                  <button
                    className="go-btn"
                    onClick={() => {
                      handleSimulateWalk();        // 🚶 start movement
                      setRouteActive(true);
                      setUIState(UI_STATES.NAVIGATINGF); // 🧭 now navigating
                      setCurrentStep(0);
                      //setShowDirections(true); // collapsed by default
                    }}
                  >
                    START WALK
                  </button>
                  <button
                    className="exit-btn"
                    onClick={stopNavigation}
                  >
                    EXIT
                  </button>
                </div>
              </div>
            )}


          {uiState === UI_STATES.ROUTE_READY && routeCoords.length > 1 && selectedExhibit && (
            <div className="map-footer">
              <div className="title">{selectedExhibit.name}</div>
              <div className="subtitle">Ready to start</div>

              <div className="action-row">
                <button
                  className="go-btn"
                  onClick={() => {
                    handleSimulateWalk();                 // 🚶 START WALK
                    setUIState(UI_STATES.NAVIGATING);     // 🧭
                  }}
                >
                  GO
                </button>
                <button
                  className="exit-btn"
                  onClick={stopNavigation}
                >
                  EXIT
                </button>
              </div>
            </div>
          )}

          {/* ================= NAVIGATION FOOTER ================= */}
          {uiState === UI_STATES.NAVIGATING &&
            //selectedExhibit &&
            //totalRouteDistance > 0 && 
            (
              <div className="nav-footer">
                <div className="nav-info">
                  <div className="nav-destination">
                    {selectedExhibit?.name ?? "Custom route"}
                  </div>

                  <div className="nav-stats">
                    <span><strong>{Math.max(0, distanceRemaining.toFixed(0))} m</strong> •{" "}</span>
                    <span> • {progressPercent.toFixed(1)}% remaining</span>
                  </div>
                </div>

                <button
                  className="exit-btn"
                  onClick={stopNavigation}
                >
                  EXIT
                </button>
              </div>
            )}

          {uiState === UI_STATES.NAVIGATINGF &&
            //selectedExhibit &&
            //totalRouteDistance > 0 && 
            (
              <div className="nav-footer">
                <div className="nav-info">
                  <div className="nav-destination">
                    {selectedExhibit?.name ?? "Custom route"}
                  </div>

                  <div className="nav-stats">
                    <span><strong>{Math.max(0, distanceRemaining.toFixed(0))} m</strong> •{" "}</span>
                    <span> • {progressPercent.toFixed(1)}% remaining</span>
                  </div>
                </div>

                <button
                  className="exit-btn"
                  onClick={stopNavigation}
                >
                  EXIT
                </button>
              </div>
            )}



          {/* ⭐ Right-side floating FAB buttons ⭐ */}
          <div
            className="fab-stack"
            style={{
              position: "absolute",
              zIndex: 999999,      // ⭐⭐ IMPORTANT
              pointerEvents: "auto"
            }}
            aria-hidden="false"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}

          >
            <FABMenu
              languageLabel={
                language === "en-IN" ? "English" :
                  language === "hi-IN" ? "हिन्दी" :
                    language === "mr-IN" ? "मराठी" : "English"
              }
              disabled={showSheet}
              //qrOpen={showScanner}
              onUseLocation={handleUseLocation}
              onNavIcon={() => setNavPickerOpen(true)}
                         
             // onUseLocation={handleUseLocation}
              //onScan={handleScanQR}
              onScan={() => setShowScanner(prev => !prev)}
              // onScan={() => setShowScanner(true)}

              voiceActive={voiceEnabled}  // <-- MUST PASS THIS
              onVoice={handleToggleVoice}
              onSimulate={handleSimulateWalk}
              onLanguage={handleLanguageChange}

              // ✅ NEW — EXHIBITS BUTTON
              onExhibits={(e) => {
                e.stopPropagation();        // prevent map click behind FAB

                if (activeTab === "exhibits") {
                  // same behavior as BottomNav
                  setShowSheet(prev => !prev);

                } else {
                  setShowSheet(true);
                }

                setActiveTab("exhibits");
                setUIState(UI_STATES.BROWSING);
              }}
           
            />
            {navPickerOpen && (
              <NavIconPicker
                onSelect={(type) => {
                  setNavIconType(type);   // 🔥 THIS updates marker icon
                  setNavPickerOpen(false);
                }}
                onClose={() => setNavPickerOpen(false)}
              />
            )}

          </div>
        </div>

        <MobileBottomSheet

          isOpen={showSheet}
          onClose={() => setShowSheet(false)}
        >
          {activeTab === "exhibits" && (
            <ExhibitPanel
              exhibits={exhibits}   // ✅ PASS SOURCE OF TRUTH
              filters={filters}
              onSelect={(id) => {
                const ex = exhibits.find(e => e.id === id);
                if (!ex) return;

                setSelectedExhibit(ex);
                setUIState(UI_STATES.ROUTE_FREE);  // 👈 key change
                setShowSheet(false);
                //console.log("Exhibit clicked -> before close. showSheet:", showSheet);
                //console.log("After setShowSheet(false) -> showSheet:", showSheet);
                //setShowSheet(false);
                handleExhibitSelect(id); // Ajit uncomment this
                setShowSheet(false);     // 👈 Close sheet immediately
                setActiveTab(false);      // 👈 Optional: reset tab
              }}
            />
          )}

        </MobileBottomSheet>


        

      </div>


    </div>
  );
}
