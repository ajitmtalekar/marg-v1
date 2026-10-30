//React
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { renderToString } from "react-dom/server";
//Leaflet
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, FeatureGroup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import { useMapEvent } from "react-leaflet";
import { Config } from "../config/Config";
//css files
import "leaflet/dist/leaflet.css";
import "../styles/map.css";
import "../styles/exhibits.css";
import "../styles/fabmenu.css";
import "../styles/mobile-bottomsheet.css";
import "../styles/bottom-nav.css";
//Icons file
import { FaPlay, FaFlagCheckered, FaUser, FaMapMarkerAlt } from "react-icons/fa";
import { categoryIconMap, idSpecificIcons } from "./iconMap"; // create this file
//Data driving json files
import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import { NavIconPicker } from "./navPick";
//Floor Implementation
import useFloorManager from "../hooks/useFloorManager";
//porcessor code files
import {
  buildGraph, coordKey, findNearestNodeExact, insertVirtualNode, normalizeCoord,
  getRoute, getDirections, debugGraphConnectivity, speakMarathi, addVerticalConnectors,
} from "../utils/router";
//QR scanner
import QRScanner from "./QRScanner";
//Path enhancements
import { processPathNetwork } from "../utils/pathProcessor";
import PathRepairVisualizer from "../tools/PathRepairVisualizer";
//Menus
import FABMenu from "./FABMenu"
import MobileBottomSheet from "../components/MobileBottomSheet";
import ExhibitPanel from "../components/ExhibitPanel";
//Language
//import { speakMarathiPhrase } from '../utils/marathiSpeak';
//rotate and Compass
import "leaflet-rotate";
import "leaflet-compass/dist/leaflet-compass.min.css";
import "leaflet-compass";

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

// Custom Icons -  raw GPS for debug
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

/* ============= Main Code starts here ============= */

export default function MapView({
  currentSpot,targetExhibitId,targetExhibit , selectedButtonExhibit})
   {

  //console.log("🧱 TileLayer URL:", Config.tileLayer.url);
  //console.log("🌍 App mode:", import.meta.env.MODE);
  //console.log("🧪 Test mode:", Config.testMode);
  const base = import.meta.env.BASE_URL;
  // console.log("the base value is:", base);

  /* ======== ICON Constants ======== */
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


  /*=== added for production GPS tracking */
  // RAW GPS (never snapped, never overridden)
  const rawGpsPosRef = useRef(null); // true GPS
  const filteredGpsPosRef = useRef(null);     // smoothed GPS
  const snappedPosRef = useRef(null);         // snapped to route
  const [gpsStatus, setGpsStatus] = useState("off");
  // on | off | permission-denied | unavailable | searching

  /* ======== GPS states======== */
  const GPS_ACCURACY_THRESHOLD = 2; // meters
  const MAX_ACCEPTABLE_ACCURACY = 20;
  const SMOOTHING_ALPHA = 0.35;
  const [rawGpsForDebug, setRawGpsForDebug] = useState(null);
  const [gpsStarted, setGpsStarted] = useState(false);
  const gpsAccuracyRef = useRef(null); // meters
  const [mapPos, setMapPos] = useState(null);

  /* ======== SIMULATION ======== */
  const [simulating, setSimulating] = useState(false);
  const [navMode, setNavMode] = useState("normal"); // normal | emergency
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [resetDirections, setResetDirections] = useState(false);
  const [freezeStepUpdates, setFreezeStepUpdates] = useState(false);
  const [userRole, setUserRole] = useState("public"); // public | staff

  /* ======== Voice STATE ======== */
  const [muteStepAnnouncements, setMuteStepAnnouncements] = useState(false);

  /* ======== POSITION STATE ======== */
  //const [userPos, setUserPos] = useState(null); // ONLY for display
  const [userPos, setUserPos] = useState({ coord: null, floor: 0 });
  const [rawPathData, setRawPathData] = useState({ type: "FeatureCollection", features: [] });
  const userMarkerRef = useRef(null);
  const [exhibits, setexhibits] = useState([]);
  const exhibitsReady = Array.isArray(exhibits) && exhibits.length > 0;
  const [routeNodes, setRouteNodes] = useState([]); // raw graph nodes
  // const allCategories = [...new Set(exhibits.map((ex) => ex.category))];
  const allCategories = [
    ...new Set((exhibits ?? []).map(ex => ex.category))
  ];
  const [manualUserPos, setManualUserPos] = useState(null);
  //const [displayUserPos, setDisplayUserPos] = useState(null);
  // const displayUserPosold = routeActive && snappedPosRef.current
  //  ? snappedPosRef.current
  //  : userPos;

  const displayUserPos = useMemo(() => {
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

  /* ======== Route STATE ======== */
  const navigate = useNavigate();
  const [routeCoords, setRouteCoords] = useState([]);
  const [directions, setDirections] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [userHeading, setUserHeading] = useState(0);
  const [routeActive, setRouteActive] = useState(false);
  const [routeVersion, setRouteVersion] = useState(0);
  const [freeStartPos, setFreeStartPos] = useState(null);
  const [startPos, setStartPos] = useState(null);
  //const [cameraFollow, setCameraFollow] = useState(true); // Google-Maps style

   const [qrTarget, setQrTarget] = useState(null);
  // const [pathData, setPathData] = useState(rawPathData);
  const [selectedFloor, setSelectedFloor] = useState(0);
    const qrNavigationRef = useRef(false);

 useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  const floorParam = params.get("floor");
  const exhibitParam = params.get("exhibit");

  if (!floorParam || !exhibitParam) return;

  const floor = Number(floorParam);
  if (isNaN(floor)) return;

  let cancelled = false;

  async function handleQrNavigation() {
    try {
      //console.log("QR navigation detected → loading floor:", floor);

      const res = await fetch(
        `/data/floor${floor}/exhibits.json`
      );

      if (!res.ok) throw new Error("No exhibits");

      const data = await res.json();

      const normalized = data.map((e) => ({
        ...e,
        floor
      }));

      if (cancelled) return;

      setSelectedFloor(floor);
      setexhibits(normalized);

      const exhibit = normalized.find(
        (e) => e.id === exhibitParam
      );

      if (!exhibit) {
        console.warn("QR Exhibit not found:", exhibitParam);
        return;
      }

      //console.log("Moving to:", exhibit);

      const leafletPos = [exhibit.coords[1], exhibit.coords[0]];

      setUserPos({
        coord: [exhibit.coords[0], exhibit.coords[1]],
        floor
      });

      setFreeStartPos(leafletPos);
      setStartPos(leafletPos);

      fallbackUsedRef.current = true;

    } catch (err) {
      console.error("QR navigation failed:", err);
    }
  }

  handleQrNavigation();
  // Clear URL
 // window.history.replaceState({}, "", window.location.pathname);

  return () => {
    cancelled = true;
  };

}, []);


  // window.__pathDataGlobal = pathData;
  const pathData = useMemo(() => {
    if (!rawPathData?.features?.length) return rawPathData;
    const { cleaned } = processPathNetwork(rawPathData,
      {
        snapToleranceMeters: 12,
        decimals: 6,
        addReverseIfMissing: true,
        autoSplitIntersections: true,
        autoBridgeCloseNodes: false,
      }
    );
    return cleaned;
  }, [rawPathData]);

  //useeffect to set pathdata globally  
  useEffect(() => {
    window.__pathDataGlobal = pathData;
  }, [pathData]);


  // Floor Implementation
  // const defaultFloor = floorsConfig.find(f => f.default)?.id ?? floorsConfig[0]?.id ?? 0;
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [activeFloor, setActiveFloor] = useState(0);
  const [routingMode, setRoutingMode] = useState("normal"); // "normal" | "emergency"
  const floorLayerRef = useRef(null);
  const [heading, setHeading] = useState(0);

  const {
  loading,
    defaultFloor,
    availableFloors,
    floorPaths,
    floorRoute,
    floorPOIs
} = useFloorManager({ selectedFloor,     // ✅ PASS IT
    pathData,
    routeData: routeGeoJSON,
    exhibitsData: exhibits
  });

  //compass
  /*
  useEffect(() => {
  console.log("Heading changed:", heading);
  }, [heading]);
  */

  const isDesktop =
  !("DeviceOrientationEvent" in window) ||
  navigator.userAgent.includes("Windows");

  useEffect(() => {
  if (!isDesktop) return;

  let animationFrame;

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      const rotate = () => {
        setHeading(h => (h + 2) % 360);
        animationFrame = requestAnimationFrame(rotate);
      };
      rotate();
    }
  };

  const handleKeyUp = () => {
    cancelAnimationFrame(animationFrame);
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
  }, [isDesktop]);
 

  const enableCompass = async () => {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const response = await DeviceOrientationEvent.requestPermission();
    if (response === "granted") {
      window.addEventListener("deviceorientation", handleOrientation);
    }
  } else {
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
  }
};
  useEffect(() => {
  if (!mapRef.current) return;

  function handleOrientation(event) {
  let heading = null;

  // iOS
  if (event.webkitCompassHeading !== undefined) {
    heading = event.webkitCompassHeading;
  }
  // Android
  else if (event.absolute === true && event.alpha !== null) {
    heading = 360 - event.alpha;
  }
  else if (event.alpha !== null) {
    heading = 360 - event.alpha;
  }

  if (heading !== null) {
    setHeading(heading);

    // Rotate map only while navigating
    if (
      uiState === UI_STATES.NAVIGATING ||
      uiState === UI_STATES.NAVIGATINGF
    ) 

    // Rotate user marker
    if (userMarkerRef.current?.setRotationAngle) {
      userMarkerRef.current.setRotationAngle(heading);
    }
  }
  }

  window.addEventListener("deviceorientationabsolute", handleOrientation);

  return () => {
    window.removeEventListener("deviceorientationabsolute", handleOrientation);
  };
  }, []);

  useEffect(() => {
    if (!routeNodes || routeNodes.length === 0) return;
    const firstFloor = routeNodes[0].floor;
    if (selectedFloor !== firstFloor) {
      setSelectedFloor(firstFloor);
    }
  }, [routeNodes]);

  useEffect(() => {
    if (!routeNodes || routeNodes.length === 0) return;
    const activeNode = routeNodes[currentStep];
    if (!activeNode) return;
    if (activeNode.floor !== selectedFloor) {
      setSelectedFloor(activeNode.floor);
    }
  }, [currentStep, routeNodes]);

  /* -------- Rendered Route -------- */

  const visibleRoute = useMemo(() => {
    return routeNodes
      .filter(node => node.floor === selectedFloor)
      .map(node => [node.coord[1], node.coord[0]]);
  }, [routeNodes, selectedFloor]);

  /*
    useEffect(() => {
  console.log("ROUTE DEBUG:", {
    selectedFloor,
    routeFloors: routeNodes.map(n => n.floor),
    visibleCount: routeCoords.length
  });
}, [routeNodes, selectedFloor]);
*/

  useEffect(() => {
  if (!availableFloors.length) return;
  const exists = availableFloors.find(f => f.id === selectedFloor);
  if (!exists) {
    setSelectedFloor(availableFloors[0].id);
  }
}, [availableFloors, selectedFloor]);

useEffect(() => {
  if (defaultFloor !== undefined) {
    setSelectedFloor(defaultFloor);
  }
}, [defaultFloor]);


  //useeffect to set floor implementation to return selected floor
  useEffect(() => {
    if (selectedFloor === undefined || selectedFloor === null) return;
    //if (cancelled) return;
    async function loadFloorData() {
      try {
        const pathUrl = `${base}data/floor${selectedFloor}/paths.json`;
        const exhibitUrl = `${base}data/floor${selectedFloor}/exhibits.json`;
        const [pathRes, exhibitRes] = await Promise.all([fetch(pathUrl), fetch(exhibitUrl)]);

        if (!pathRes.ok) {
          throw new Error(`Path file not found: ${pathUrl}`);
        }

        if (!exhibitRes.ok) {
          throw new Error(`Exhibit file not found: ${exhibitUrl}`);
        }

        const pathJson = await pathRes.json();
        const exhibitJson = await exhibitRes.json();

        setRawPathData({ type: "FeatureCollection", features: Array.isArray(pathJson?.features) ? pathJson.features : [] });
        setexhibits(Array.isArray(exhibitJson) ? exhibitJson : []);

        // console.log("Loaded exhibits:", exhibitJson);
      } catch (err) {
        console.error("Floor load error:", err);
      }
    }
    loadFloorData();
    //return () => {
    // cancelled = true;
    //};
  }, [selectedFloor]);


  // existing state for position, speed and heading movement
  const [prevPos, setPrevPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(null);

  /* ======== GRAPH STATE ======== */
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const simRef = useRef({ totalDistance: 0, currentDistance: 0 });

  const mapBounds = useMemo(() => {
    if (!Config.useBounds) return null;
    const tl = Config.bbox?.topLeft;
    const br = Config.bbox?.bottomRight;

    if (
      !Array.isArray(tl) ||
      !Array.isArray(br) ||
      tl.length !== 2 ||
      br.length !== 2 ||
      tl[0] == null ||
      tl[1] == null ||
      br[0] == null ||
      br[1] == null
    ) {
      console.error("❌ Invalid bbox format", { tl, br });
      return null;
    }

    const lat1 = Number(tl[0]);
    const lng1 = Number(tl[1]);
    const lat2 = Number(br[0]);
    const lng2 = Number(br[1]);

    if (
      Number.isNaN(lat1) ||
      Number.isNaN(lng1) ||
      Number.isNaN(lat2) ||
      Number.isNaN(lng2)
    ) {
      console.error("❌ Bbox contains NaN", { tl, br });
      return null;
    }

    const bounds = L.latLngBounds(
      [lat1, lng1],
      [lat2, lng2]
    );

    return bounds.isValid() ? bounds : null;

  }, [Config.useBounds, Config.bbox]);

  //console.log("BBox values:", Config.bbox.topLeft, Config.bbox.bottomRight);
  //console.log("bounds valid:", mapBounds?.isValid?.() ?? false);
  //console.log({ bboxTopLeft: Config.bbox.topLeft,bboxBottomRight: Config.bbox.bottomRight,Bounds: mapBounds.isValid(),});


  // Build fast lookup by id
  const pathIndex = {};
  pathData.features.forEach(f => {
    if (f?.properties?.id) {
      pathIndex[f.properties.id] = f;
    }
  });

  //const [graph, setGraph] = useState(null);
  //const [graphReady, setGraphReady] = useState(false);
  const graph = useMemo(() => {
    if (!pathData) return null;
    const g = buildGraph(pathData);
    addVerticalConnectors(g, pathData);
    return g;
  }, [pathData]);


  //---Inside map or outside logic goes here ----

  function isInside(coord, bounds) {
    if (!coord || coord.length !== 2) return false;
    if (!bounds?.isValid()) return false;
    const lat = coord[1];
    const lng = coord[0];
    return bounds.contains(L.latLng(lat, lng));
  }


  function rotateUserIcon(bearing) {
    const el = document.querySelector(".user-marker-icon");
    if (!el || bearing == null) return;
    el.style.transform = `rotate(${bearing}deg)`;
  }

  const autoFollowEnabledRef = useRef(true);

  // utils / guards
  const isValidLatLng = (pos) =>
    Array.isArray(pos) &&
    pos.length === 2 &&
    Number.isFinite(pos[0]) &&
    Number.isFinite(pos[1]);


  const handleExhibitSelect = (id, floorOverride = null) => {
  const ex = exhibits.find((e) => e.id === id);
    if (!ex) {
      console.warn("Exhibit not found:", id);
      return;
    }

      // Determine floor
      const floorToUse =
        floorOverride !== null
          ? floorOverride
          : selectedFloor;

      const payload = {
        id: ex.id,
        name: ex.name,
        coords: ex.coords ?? [ex.x, ex.y],
        floor: floorToUse,
      };

      //console.log("🦁 Exhibit payload:", payload);

      onExhibitClick(payload);

      setSelectedExhibits([id]);
      setJustArrived(false);
      setCurrentStep(0);
      setProgressPercent(0);
      return payload;   // 🔥 return coords
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
      //  console.log("Inside the GPS code1");
      fallbackToEntry("outside map bounds");
      setGpsStatus("unavailable");
      return;
    }

    setGpsStarted(true);
    setGpsStatus("searching");
    //console.log("Inside the GPS code2");
    //fallbackToEntry("GPS searching");
    //console.log("Inside the GPS code3");

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
            //console.warn("GPS permission denied");
            setUIState(UI_STATES.OUTSIDE_MAP);
            fallbackToEntry("outside map bounds");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsStatus("searching");
            setUIState(UI_STATES.OUTSIDE_MAP);
            // console.warn("GPS signal unavailable");
            fallbackToEntry("outside map bounds");
            break;
          case err.TIMEOUT:
            setGpsStatus("searching");
            setUIState(UI_STATES.OUTSIDE_MAP);
            //console.warn("GPS timeout");
            fallbackToEntry("outside map bounds");
            break;
          default:
            setGpsStatus("searching");
            //console.warn("GPS unknown error", err);
            fallbackToEntry("outside map bounds");
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

  //floor implmentation
useEffect(() => {
  if (!pathData) return;
  if (selectedFloor !== null) return;   // 🔥 important guard

  const floors = [...new Set(
    pathData.features.map(f => f.properties.floor)
  )];

  if (floors.length > 0) {
    setSelectedFloor(floors[0]);
  }
}, [pathData, selectedFloor]);

  useEffect(() => {
    if (!mapRef?.current || !floorPaths) return;

    const map = mapRef.current;

    if (floorLayerRef.current) {
      map.removeLayer(floorLayerRef.current);
    }

    const layer = L.geoJSON(floorPaths, {
      style: { color: "#2ecc71", weight: 3 }
    });

    layer.addTo(map);
    floorLayerRef.current = layer;

  }, [floorPaths]);

  useEffect(() => {
    if (!mapRef?.current || !floorRoute) return;

    const map = mapRef.current;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    const layer = L.geoJSON(floorRoute, {
      style: { color: "#ff0000", weight: 5 }
    });

    layer.addTo(map);
    routeLayerRef.current = layer;

  }, [floorRoute]);


  useEffect(() => {
    if (directions.length > 0) {
      setCurrentStep(0);      // ensures ALWAYS step 1
      setProgressPercent(0);
    }
  }, [directions]);

 
  useEffect(() => {
    //console.log("free Start POS is:",freeStartPos );
    if (
      !Array.isArray(freeStartPos) ||
      freeStartPos.length !== 2 ||
      typeof freeStartPos[0] !== "number" ||
      typeof freeStartPos[1] !== "number" ||
      !graph ||
      graph.nodeCount() === 0 ||   // ✅ FIX (see note below)
      !pathData ||
      !userPos ||
      typeof userPos.floor !== "number"
    ) return;

    const freeLonLat = [freeStartPos[1], freeStartPos[0]];

    if (
      typeof freeLonLat[0] !== "number" ||
      typeof freeLonLat[1] !== "number"
    ) return;

    const snap = findNearestNodeExact(
      freeLonLat,
      pathData,
      selectedFloor
    );

    if (!snap) return;
    const floor = Number(snap.feature?.properties?.floor ?? 0);


    const k1 = coordKey(normalizeCoord(snap.nearest1), floor, 6);
    const k2 = coordKey(normalizeCoord(snap.nearest2), floor, 6);

    const vKey = insertVirtualNode(
      graph,
      snap.snapped,
      k1,
      k2,
      snap.feature?.properties ?? {},
      floor
    );

    setVirtualStartKey(vKey);

  }, [freeStartPos, graph, pathData]);

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


  //Floor Implementation
  useEffect(() => {
    if (!mapRef?.current || !pathData?.features) return;

    const map = mapRef.current;

    if (floorLayerRef.current) {
      map.removeLayer(floorLayerRef.current);
      floorLayerRef.current = null;
    }

    const filteredFeatures = pathData.features.filter(
      f => Number(f.properties?.floor ?? 0) === Number(selectedFloor)
    );

    if (!filteredFeatures.length) return;

    const layer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: filteredFeatures
      },
      {
        style: (feature) => ({
          color: feature.properties?.color || "#2ecc71",
          weight: 3,
          opacity: 0.7
        })
      }
    );

    layer.addTo(map);
    floorLayerRef.current = layer;

  }, [selectedFloor, pathData]);

  //Clear Route Layer on Floor Change
  useEffect(() => {
    if (!mapRef?.current) return;
    const map = mapRef.current;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!floorRoute) return;

    const layer = L.geoJSON(floorRoute, {
      style: { color: "#ff0000", weight: 5 }
    });

    layer.addTo(map);
    routeLayerRef.current = layer;

  }, [floorRoute]);





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
    if (!gpsStarted) return;
    if (!userPos) return;
    if (!mapBounds) return;
    if (!Array.isArray(exhibits) || exhibits.length === 0) return;
    if (fallbackUsedRef.current) return;
    if (isInside(userPos, mapBounds)) {
      setStartPos(userPos);
      return;
    }
    //console.warn("🚫 You are outside the MAP");
    // setUIState(UI_STATES.OUTSIDE_MAP);
    fallbackToEntry("initial Load");
  }, [gpsStarted, userPos, mapBounds, exhibits, selectedFloor]);



  useEffect(() => {
    // Wait until bounds are ready
    if (!mapBounds) {
      //console.warn("Map bounds not ready yet");
      return;
    }

    if (!userPos) {
      setUserPos(rawGpsPosRef.current);
      setPrevPos(rawGpsPosRef.current);
      return;
    }
    setPrevPos(userPos);
    setUserPos(rawGpsPosRef.current);
    //console.log("Raw position is",rawGpsPosRef.current);
    //console.log("MAP Coords are position is",mapBounds);

    if (rawGpsPosRef.current && !isInside(rawGpsPosRef.current, mapBounds)) {
      console.warn("You are outside the MAP");
      setUIState(UI_STATES.OUTSIDE_MAP);
      fallbackToEntry("initial Load");
      return;
    }
  }, [rawGpsPosRef.current]);




  /*
    useEffect(() => {
    if (!rawPathData) return;
  
    const { cleaned, report } = processPathNetwork(rawPathData, {
      snapToleranceMeters: 12,
      decimals: 6,
      addReverseIfMissing: true,
      autoSplitIntersections: true,
      autoBridgeCloseNodes: false,
    });
  
    setRawPathData(cleaned);
  
    // Optional: debug cleaned data only
    // console.log("🧹 Path processing report:", report);
  }, [rawPathData]);
  */

  /* =================== GRAPH BUILD DEBUG =================== */
  useEffect(() => {
    if (!graph || graph.nodes.size === 0) {
      //console.log("⚠ graph not ready for connectivity check");
      return;
    }
    //console.log("🔍 Running graph connectivity check…");
    debugGraphConnectivity(graph);
  }, [graph]);


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
  const [language, setLanguage] = useState("mr-IN");
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

  const segmentIndexRef = useRef(0);
  const progressRef = useRef(0);
  const stoppedRef = useRef(false);
  const animationRef = useRef(null);


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

  /*
  const availableFloors = useMemo(() => {
  if (!pathData?.features) return [];

  const usedFloors = new Set();

  pathData.features.forEach(f => {
    usedFloors.add(Number(f.properties?.floor ?? 0));
  });

  // Match with config and keep labels
  return floorsConfig
    .filter(f => usedFloors.has(f.id))
    .sort((a, b) => a.id - b.id);

}, [pathData]);
*/


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
    if (!graph || graph.nodeCount() === 0 || !pathData) {
      console.warn("⛔ Graph/network not ready");
      return;
    }

    console.warn("🔄 Recalculating route…");

    const start = findNearestNodeExact([startPos[1], startPos[0]], pathData, selectedFloor);
    const end = findNearestNodeExact([endPos[1], endPos[0]], pathData, selectedFloor);

    if (!start || !end) return;

    const path = getRoute(
      normalizeCoord(start.snapped), selectedFloor,
      normalizeCoord(end.snapped), selectedFloor,
      graph, 6
    );


    if (!path || path.length < 2) return;

    setRouteCoords(path.map(([lon, lat]) => [lat, lon]));
    setRouteVersion(v => v + 1);
  };

  const initialCategoryState = Object.fromEntries(allCategories.map((cat) => [cat, true]));

  const [activeCategories, setActiveCategories] = useState(initialCategoryState);

  const [filters, setFilters] = useState({
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
  });


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
    // console.log("inside 1403");
    // QR / free start only BEFORE GPS lock
    if (freeStartPos && !gpsStarted) {
      //  console.log("inside 1406");

      setUserPos(freeStartPos);
      setCurrentExhibitId(null);

      return;
    }
  }, [freeStartPos, gpsStarted, simulating]);

/*
  useEffect(() => {
    if (!gpsStarted) return;
    if (!exhibitsReady) return;

    fallbackToEntry("gps-failed");
  }, [gpsStarted, exhibitsReady]);
*/

  useEffect(() => {
    if (
      !gpsStarted ||
      !mapBounds ||
      !Array.isArray(exhibits) ||
      exhibits.length === 0
    ) return;

    if (!userPos?.coord) return;
    if (!mapBounds) return;

    if (isInside(userPos.coord, mapBounds)) {
      setMapPos([userPos.coord[1], userPos.coord[0]]);
    } else {
      fallbackToEntry("outside bounds");
      setUIState(UI_STATES.OUTSIDE_MAP);

    }
    if (!userPos || !isInside(userPos, mapBounds)) {
      //console.log('i am isnide line 1451');
      const entry = exhibits.find(e =>
        e.name?.toLowerCase().includes("entry")
      );

      if (!entry?.coords) return;

      setMapPos([entry.coords[1], entry.coords[0]]);
    } else {
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

  function fallbackToEntry(reason = "unknown") {
    if (fallbackUsedRef.current) return false;

    if (!Array.isArray(exhibits) || exhibits.length === 0) {
      // console.warn("Fallback aborted: exhibits not ready");
      return false;
    }

    const entry = exhibits.find(e =>
      typeof e.name === "string" &&
      e.name.toLowerCase().includes("entry")
    );

    if (!entry?.coords || entry.coords.length !== 2) {
      // console.error("❌ Entry gate not configured properly");
      return false;
    }

    const [lng, lat] = entry.coords;

    if (typeof lng !== "number" || typeof lat !== "number") {
      // console.error("❌ Invalid entry coords:", entry.coords);
      return false;
    }

    const leafletPos = [lat, lng];

    setUserPos({
      coord: [lng, lat],
      floor: entry.floor ?? 0
    });

    setFreeStartPos(leafletPos);
    setStartPos(leafletPos);

    fallbackUsedRef.current = true;

    // console.warn(`🚨 GPS fallback → Entry Gate (${reason})`);
    return true;
  }

  //Permission for rotate and compass
  function requestCompassPermission() {
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {

    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
        }
      })
      .catch(console.error);

  } else {
    window.addEventListener("deviceorientationabsolute", handleOrientation);
  }
  }

  function handleOrientation(event) {
  let heading;

  if (event.absolute === true && event.alpha !== null) {
    heading = 360 - event.alpha;  // Adjust axis
  } else if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading; // iOS
  }

  if (heading !== undefined) {
    map.setBearing(heading);
  }
  }

  requestCompassPermission();

function moveUserToExhibit(exhibitId, floorNumber) {
  const exhibit = exhibits.find(
    e => e.id === exhibitId && e.floor === floorNumber
  );
  if (!exhibit) {
    console.warn("Exhibit not found yet");
    return;
  }
  const leafletPos = [exhibit.coords[1], exhibit.coords[0]];
  setUserPos({
    coord: [exhibit.coords[0], exhibit.coords[1]],
    floor: floorNumber
  });
  setFreeStartPos(leafletPos);
  setStartPos(leafletPos);
  fallbackUsedRef.current = true;
}

useEffect(() => {

  if (!qrTarget) return;
  if (!exhibits || exhibits.length === 0) return;

  const exhibit = exhibits.find(
    e =>
      e.id === qrTarget.exhibitId &&
      e.floor === qrTarget.floor
  );

  if (!exhibit) return;

 // console.log("Moving to:", exhibit);

  const leafletPos = [exhibit.coords[1], exhibit.coords[0]];

  setUserPos({
    coord: [exhibit.coords[0], exhibit.coords[1]],
    floor: qrTarget.floor
  });

  setFreeStartPos(leafletPos);
  setStartPos(leafletPos);

  fallbackUsedRef.current = true;

  // Important: clear QR target after successful move
  setQrTarget(null);

}, [exhibits, qrTarget]);

  /*============== On QR Click ==========*/
  function onQrResult(rawText) {
    try {
      // console.log("📥 Raw QR:", rawText);

      // ─────────────────────────────
      // CASE 1: URL-based QR
      // ─────────────────────────────
    if (rawText.startsWith("http")) {

  const url = new URL(rawText);
  const exhibitId = url.searchParams.get("exhibit");
  const floorParam = url.searchParams.get("floor");

  if (!exhibitId || floorParam === null) {
    alert("Invalid exhibit QR");
    return;
  }

  const floorNumber = Number(floorParam);
  if (isNaN(floorNumber)) {
    alert("Invalid floor value");
    return;
  }

  setSelectedFloor(floorNumber);
  setQrTarget({
  exhibitId,
  floor: floorNumber
});
   //console.log("the exhibit is:",exhibitId);
   // console.log("the floorNumber is:",floorNumber);

  // Move user directly
  //moveUserToExhibit(exhibitId, floorNumber);

  // Clear URL
  window.history.replaceState({}, "", window.location.pathname);

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
    hardResetNavigation();

    if (!graph || graph.nodeCount() === 0 || !pathData) {
      console.warn("⛔ Graph not ready");
      return;
    }

    if (!freeStartPos) {
      console.warn("❗ No freeStartPos available");
      return;
    }

    const startFloor = userPos.floor;
    const endFloor = ex.floor;

    //  routeBetween(startCoord, startFloor, endCoord, endFloor);

    // -----------------------------
    // START SNAP
    // -----------------------------
    const startPoint = [freeStartPos[1], freeStartPos[0]];
    const sres = findNearestNodeExact(startPoint, pathData, startFloor);
    if (!sres) return;

    const sKey1 = coordKey(sres.nearest1, startFloor, 6);
    const sKey2 = coordKey(sres.nearest2, startFloor, 6);

    const startKey = insertVirtualNode(
      graph,
      sres.snapped,
      sKey1,
      sKey2,
      sres.feature?.properties,
      startFloor
    );

    if (!startKey) return;

    // -----------------------------
    // END SNAP
    // -----------------------------
    const eres = findNearestNodeExact(ex.coords, pathData, endFloor);
    if (!eres) return;

    const eKey1 = coordKey(eres.nearest1, endFloor, 6);
    const eKey2 = coordKey(eres.nearest2, endFloor, 6);

    const endKey = insertVirtualNode(
      graph,
      eres.snapped,
      eKey1,
      eKey2,
      eres.feature?.properties,
      endFloor
    );

    if (!endKey) return;

    // -----------------------------
    // ROUTE USING KEYS ONLY
    // -----------------------------
    const path = getRoute(
      graph.nodes[startKey],
      startFloor,
      graph.nodes[endKey],
      endFloor,
      graph,
      6
    );

    if (!path || path.length < 2) {
      console.warn("⚠ No route");
      return;
    }

    const leafletCoords = path.map(p => {
      const [lon, lat] = p.coord;
      return [lat, lon];
    });

    setRouteCoords(leafletCoords);
    setRouteActive(true);
    setRouteVersion(v => v + 1);
    setDirections(getDirections(path, language));
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
    hardResetNavigation();

    if (justArrived) setJustArrived(false);

    // ------------------------------------------------------------
    // NO START AVAILABLE
    // ------------------------------------------------------------
    if (!currentExhibitId && !freeStartPos) {
      return;
    }

    // ------------------------------------------------------------
    // FREE MODE HANDOFF
    // ------------------------------------------------------------
    if (!currentExhibitId && freeStartPos) {
      onExhibitClick_freeMode(ex);
      return;
    }

    // ------------------------------------------------------------
    // FIRST CLICK (SET START ONLY)
    // ------------------------------------------------------------
    if (!currentExhibitId && !freeStartPos) {
      setCurrentExhibitId(ex.id);
      setClickedExhibitId(null);
      return;
    }

    // ------------------------------------------------------------
    // ROUTING CASE
    // ------------------------------------------------------------
    if ((currentExhibitId || freeStartPos) && ex.id !== currentExhibitId) {

      if (!graph || graph.nodeCount() === 0 || !pathData) {
        console.warn("⛔ Graph/network not ready");
        return;
      }

      let startKey;
      let startFloor;
      let fromName;

      // ============================================================
      // START: FREE GPS POSITION
      // ============================================================
      if (freeStartPos) {
        startFloor = userPos.floor;
        fromName = "your current location";

        const startPoint = [freeStartPos[1], freeStartPos[0]];
        const sres = findNearestNodeExact(startPoint, pathData, startFloor);
        if (!sres) {
          console.warn("❗ Could not snap freeStartPos");
          return;
        }

        const sKey1 = coordKey(sres.nearest1, startFloor, 6);
        const sKey2 = coordKey(sres.nearest2, startFloor, 6);

        startKey = insertVirtualNode(
          graph,
          sres.snapped,
          sKey1,
          sKey2,
          sres.feature?.properties,
          startFloor
        );

        if (!startKey) {
          console.warn("❗ Could not create start virtual node");
          return;
        }
      }

      // ============================================================
      // START: EXHIBIT
      // ============================================================
      else {
        const from = exhibits.find(e => e.id === currentExhibitId);
        if (!from) {
          console.warn("❗ Invalid start exhibit");
          return;
        }

        startFloor = from.floor;
        fromName = from.name;

        const sres = findNearestNodeExact(from.coords, pathData, startFloor);
        if (!sres) {
          console.warn("❗ Could not snap start exhibit");
          return;
        }

        const sKey1 = coordKey(sres.nearest1, startFloor, 6);
        const sKey2 = coordKey(sres.nearest2, startFloor, 6);

        startKey = insertVirtualNode(
          graph,
          sres.snapped,
          sKey1,
          sKey2,
          sres.feature?.properties,
          startFloor
        );

        if (!startKey) {
          console.warn("❗ Could not create start virtual node");
          return;
        }
      }

      // ============================================================
      // END: DESTINATION EXHIBIT
      // ============================================================
      const to = exhibits.find(e => e.id === ex.id);
      if (!to) {
        console.warn("❗ Invalid destination exhibit");
        return;
      }

      const endFloor = to.floor;

      const eres = findNearestNodeExact(to.coords, pathData, endFloor);
      if (!eres) {
        console.warn("❗ Could not snap destination exhibit");
        return;
      }

      const eKey1 = coordKey(eres.nearest1, endFloor, 6);
      const eKey2 = coordKey(eres.nearest2, endFloor, 6);

      const endKey = insertVirtualNode(
        graph,
        eres.snapped,
        eKey1,
        eKey2,
        eres.feature?.properties,
        endFloor
      );

      if (!endKey) {
        console.warn("❗ Could not create end virtual node");
        return;
      }

      // ============================================================
      // ROUTE (KEY-BASED ONLY)
      // ============================================================
      const path = getRoute(
        graph.nodes[startKey],
        startFloor,
        graph.nodes[endKey],
        endFloor,
        graph,
        6
      );

      if (!path || path.length < 2) {
        console.warn(`⚠️ No route from ${fromName} to ${to.name}`);
        return;
      }

      const leafletCoords = path.map(p => {
        const [lon, lat] = p.coord;
        return [lat, lon];
      });

      // ============================================================
      // UI STATE UPDATE
      // ============================================================
      setRouteActive(true);
      setRouteCoords(leafletCoords);
      setDirections(getDirections(path, language));
      setRouteVersion(v => v + 1);

      setSelectedExhibits([currentExhibitId, ex.id]);
      setJustArrived(false);
      setCurrentStep(0);
      setProgressPercent(0);

      setTimeout(() => setFreezeStepUpdates(false), 300);

      // ============================================================
      // VOICE
      // ============================================================
      if (voiceEnabled) {
        if (isHindi) speakText(`मार्ग तैयार है: ${fromName} से ${to.name}`);
        else if (isMarathi) speakMarathi(`मार्ग तयार आहे: ${fromName} ते ${to.name}`);
        else speakText(`Route from ${fromName} to ${to.name} is ready.`);
      }

      return;
    }

    // ------------------------------------------------------------
    // SAME EXHIBIT CLICKED
    // ------------------------------------------------------------
    if (ex.id === currentExhibitId) {
      setSelectedExhibits([ex.id]);
      return;
    }
  }


  const onMapClick = (e) => {
    if (!graph) {
      console.warn("Graph not ready yet");
      return;
    }

    //setFabOpen(false);   // close menu
    // 🧪 DEV MODE — first click sets START
    if (Config.devTestMode && !virtualStartKey) {
      const { lat, lng } = e.latlng;
      const freePos = [lat, lng];

      //console.log("🧪 DEV start selected:", freePos);

      // 🔥 THIS IS THE CRITICAL LINE
      setFreeStartPos(freePos);
      setCurrentExhibitId(null); // IMPORTANT


      const snap = findNearestNodeExact([lng, lat], pathData, selectedFloor);
      if (!snap) {
        console.warn("❌ DEV start snap failed");
        return;
      }

      const k1 = coordKey(snap.nearest1, userPos.floor, 6);
      const k2 = coordKey(snap.nearest2, userPos.floor, 6);

      const vKey = insertVirtualNode(
        graph,
        snap.snapped,
        k1,
        k2,
        snap.feature?.properties, userPos.floor
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
    //console.log("GRAPH DEBUG:", { graphExists: !!graph, nodeCount: graph?.nodeCount?.(), hasPathData: !!pathData});


    if (!graph || graph.nodeCount() === 0 || !pathData) {
      console.warn("⛔ Graph/network not ready for map click.");
      return;
    }

    // Leaflet lat,lng → GeoJSON lon,lat
    const targetPoint = [lng, lat];

    // -------------------------------
    // SNAP CLICK TO PATH
    // -------------------------------

    const res = findNearestNodeExact(targetPoint, pathData, selectedFloor);


    if (!res) {
      console.warn("❗ Cannot snap map click to graph.");
      return;
    }

    const { snapped, nearest1, nearest2, feature } = res;

    // Convert segment endpoints → graph keys
    const key1 = coordKey(normalizeCoord(nearest1), userPos.floor, 6);
    const key2 = coordKey(normalizeCoord(nearest2), userPos.floor, 6);

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
      feature.properties, userPos.floor
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
      const sres = findNearestNodeExact(userPoint, pathData, selectedFloor);

      if (!sres) {
        console.warn("❗ Could not snap freeStartPos");
        return;
      }

      const sK1 = coordKey(sres.nearest1, userPos.floor, 6);
      const sK2 = coordKey(sres.nearest2, userPos.floor, 6);

      startKey = insertVirtualNode(
        graph,
        sres.snapped,
        sK1,
        sK2,
        sres.feature?.properties, userPos.floor
      );
    }

    // 2️⃣ Exhibit fallback (Entry Gate / exhibit)
    else if (currentExhibitId) {
      const fromEx = exhibits.find((x) => x.id === currentExhibitId);
      if (!fromEx) {
        console.warn("❗ No exhibit for start");
        return;
      }

      const sres = findNearestNodeExact(fromEx.coords, pathData, selectedFloor);
      if (!sres) return;

      const sK1 = coordKey(sres.nearest1, userPos.floor, 6);
      const sK2 = coordKey(sres.nearest2, userPos.floor, 6);

      startKey = insertVirtualNode(
        graph,
        sres.snapped,
        sK1,
        sK2,
        sres.feature?.properties, userPos.floor
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
    // const path = getRoute(graph.nodes[startKey], graph.nodes[endKey], graph);

    //const path = getRoute(graph.nodes[startKey], selectedFloor, graph.nodes[endKey], selectedFloor, graph, 6);
    //console.log(" path returned is ", path );
    const startNode = graph.getNode(startKey);
    const endNode = graph.getNode(endKey);

    if (!startNode || !endNode) {
      console.warn("❗ Start or end node missing");
      return;
    }

    const path = getRoute(
      startNode.coord,
      startNode.floor,
      endNode.coord,
      endNode.floor,
      graph,
      6
    );


    if (!path || path.length < 2) {
      console.warn("⚠ No route available");
      return;
    }

    // Convert lon,lat → leaflet lat,lng
    // const leafletCoords = path.map(([lon, lat]) => [lat, lon]);
    const leafletCoords = path.map((p) => {
      const [lon, lat] = p.coord; // extract from .coord
      return [lat, lon];           // convert to Leaflet format
    });


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
    if (!simulating) return;
    if (!routeCoords || routeCoords.length < 2) return;

    stoppedRef.current = false;
    segmentIndexRef.current = 0;
    progressRef.current = 0;

    setCurrentStep(0);

    const stepMeters = 0.8;

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
        .replace("Arrive at your destination", "आप अपने गंतव्य पर पहुँच गए हैं");
    }

    function translateToMarathi(text) {
      return text
        .replace("Start", "सुरू करा")
        .replace("walk", "पुढे जा")
        .replace("Continue straight", "सरळ पुढे जा")
        .replace("Arrive at your destination", "आपण आपल्या ठिकाणी पोहोचला आहात");
    }

    function step() {
      if (stoppedRef.current) return;

      let segmentIndex = segmentIndexRef.current;
      let progress = progressRef.current;

      // ===== FINAL DESTINATION =====
      if (segmentIndex >= routeCoords.length - 1) {
        const finalPos = routeCoords[routeCoords.length - 1];

        setUserPos(finalPos);

        setSimulating(false);
        setRouteActive(false);
        setProgressPercent(100);
        setDistanceRemaining(0);

        if (language === "hi-IN")
          speakText("आप गंतव्य पर पहुँच गए हैं।");
        else if (language === "mr-IN")
          speakMarathi("आपण आपल्या ठिकाणी पोहोचलात.");
        else
          speakText("You have arrived at your destination.");

        stoppedRef.current = true;
        return;
      }

      // ===== SEGMENT WALK =====
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
      } else {
        progress += stepMeters / segmentDistance;
      }

      if (progress >= 1) {
        progress = 0;
        segmentIndex++;

        if (segmentIndex < directions.length && voiceEnabled) {
          const stepText =
            directions[Math.min(segmentIndex, directions.length - 1)];

          if (language === "hi-IN")
            speakText(translateToHindi(stepText));
          else if (language === "mr-IN")
            speakMarathi(translateToMarathi(stepText));
          else
            speakText(stepText);

          setCurrentStep(segmentIndex);
        }
      }

      // ===== INTERPOLATION =====
      if (segmentIndex < routeCoords.length - 1) {
        const line = turf.lineString([
          start.geometry.coordinates,
          end.geometry.coordinates,
        ]);

        const maxKm = turf.length(line);
        const distKm = (segmentDistance * progress) / 1000;

        if (distKm > 0 && distKm <= maxKm) {
          const interp = turf.along(line, distKm)?.geometry?.coordinates;
          if (interp?.length === 2) {
            const newPos = [interp[1], interp[0]];
            setUserPos(newPos);

          }
        }
      }

      // ===== DISTANCE + PROGRESS =====
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

      // Save refs
      segmentIndexRef.current = segmentIndex;
      progressRef.current = progress;

      animationRef.current = requestAnimationFrame(step);
    }

    animationRef.current = requestAnimationFrame(step);

    return () => {
      stoppedRef.current = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

  }, [simulating, routeVersion, routeCoords, directions, language, voiceEnabled]);

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
    //setCurrentSpot(ex);
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
      const bearing = calculateBearing(prevPos, userPos);
      setHeading(bearing);
      mapRef.current?.setBearing(bearing);

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
    if (activeTab === "exhibits" && exhibits.length > 0) {
      setFilters(prev => ({
        ...prev,
        activeCategories: exhibits.reduce((acc, ex) => {
          acc[ex.category] = true;
          return acc;
        }, {})
      }));
    }
  }, [exhibits]);

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
    if (uiState === UI_STATES.IDLE) return [];

    if (uiState === UI_STATES.SELECTED && selectedExhibit) {
      return [selectedExhibit];
    }

    if (uiState === UI_STATES.BROWSING) {
      return exhibits.filter(ex => {

        if (activeFloor !== null && ex.floor !== activeFloor)
          return false;

        // If no category selected → show nothing
        if (!activeCategory)
          return [];

        return ex.category === activeCategory;
      });
    }

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

  //const tileUrl =
  //  Config.tileLayer.type === "OFFLINE"
  //    ? `${Config.tileLayer.url}/floor_${selectedFloor}/{z}/{x}/{y}.png`
  //   : Config.tileLayer.url;

  const [fabOpen, setFabOpen] = useState(false);

  //const tileUrl = `${base}/tiles/floor_${selectedFloor}/{z}/{x}/{y}.png`;

  const tileUrl =
    `${import.meta.env.BASE_URL}tiles/floor_${selectedFloor}/{z}/{x}/{y}.png`;
  /*
  //console.log("selectedFloor:", selectedFloor);
  //console.log("routeCoords:", routeCoords.length);
  //console.log("routeCoords:", routeCoords.length);
  
  useEffect(() => {
    console.log("Exhibits state updated:", exhibits);
  }, [exhibits]);
  
  useEffect(() => {
    console.log("STATE exhibits length:", exhibits.length);
  }, [exhibits]);
  
  useEffect(() => {
    console.log("showSheet:", showSheet);
  }, [showSheet]);
  
  useEffect(() => {
    console.log("activeTab:", activeTab);
  }, [activeTab]);
   */
  useEffect(() => {
  function handleOrientation(e) {
    let h;

    if (e.webkitCompassHeading) {
      h = e.webkitCompassHeading; // iOS
    } else if (e.alpha != null) {
      h = 360 - e.alpha; // Android
    }

    if (h != null) {
      setHeading(h);

      if (
        uiState === UI_STATES.NAVIGATING ||
        uiState === UI_STATES.NAVIGATINGF
      ) {
        mapRef.current?.setBearing(h);
      }

      if (userMarkerRef.current?.setRotationAngle) {
        userMarkerRef.current.setRotationAngle(h);
      }
    }
  }

  window.addEventListener("deviceorientationabsolute", handleOrientation);

  return () => {
    window.removeEventListener(
      "deviceorientationabsolute",
      handleOrientation
    );
  };
}, [uiState]);
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

          <div className="leaflet-top leaflet-right">
            <div
              className="leaflet-control"
              style={{
                background: "white",
                padding: "6px 10px",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
              }}
             >
              <select
                value={selectedFloor}
                onChange={(e) => {
                  //console.log("Floor changed:", e.target.value);
                  setSelectedFloor(Number(e.target.value));
                }}
                style={{
                  fontSize: 14,
                  border: "none",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {availableFloors.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}

              </select>
            </div>
          </div>


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
              // 🧭 ADD COMPASS CONTROL
                const compass = L.control.compass({
                  position: "topright",
                  autoActive: true,
                  showDigit: false
                });

                compass.addTo(map);
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
              //key={`floor-${selectedFloor}`}   // forces remount safely
              url={tileUrl}
              attribution={Config.tileLayer.attribution}
              tileSize={256}
              minZoom={Config.minZoom}
              maxZoom={Config.maxZoom}
              minNativeZoom={Config.minZoom}
              maxNativeZoom={Config.maxZoom}
              bounds={mapBounds}
              noWrap={true}
            />



            <GeoJSON
              data={floorPaths}
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

            {Array.isArray(rawGpsPosRef.current) &&
              rawGpsPosRef.current.length === 2 &&
              isValidLatLng(rawGpsPosRef.current) && (
                <Marker
                  position={rawGpsPosRef.current}
                  icon={rawDebugIcon}
                  zIndexOffset={2000}
                />
              )}

            {Array.isArray(routeCoords) &&
              routeCoords.length > 1 &&
              routeCoords.every(p => Array.isArray(p) && p.length === 2) && (
                <>
                  <Polyline
                    key={`route-${routeVersion}-${selectedFloor}-${routeActive}`}
                    positions={routeCoords}
                    className={routeActive ? "route-glow" : ""}
                    pathOptions={{
                      color: "rgb(9, 13, 243)",
                      weight: 4,
                      opacity: 1,
                      smoothFactor: 0,
                    }}
                  />

                  {routeActive && (
                    <>
                      {/* Start marker only if start is on this floor */}
                      {routeCoords[0] && (
                        <Marker
                          position={routeCoords[0]}
                          icon={iconMarker("rgba(248, 10, 10, 0.74)", FaPlay)}
                        />
                      )}

                      {/* End marker only if end is on this floor */}
                      {routeCoords[routeCoords.length - 1] && (
                        <Marker
                          position={routeCoords[routeCoords.length - 1]}
                          icon={iconMarker("#ed0a0ac9", FaFlagCheckered)}
                        />
                      )}
                    </>
                  )}
                </>
              )}



            {/* ⭐ Free-start marker */}
            {Array.isArray(freeStartPos) &&
              freeStartPos.length === 2 &&
              isValidLatLng(freeStartPos) && (
                <Marker
                  position={freeStartPos}
                  icon={iconMarker("#f1c40f", FaUser)}
                />
              )}



            {/* GPS accuracy ring — MOVE HERE */}
            {gpsStatus === "on" && isValidLatLng(displayUserPos) &&
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

          <div className="compass-wrapper">
            <div className="compass-dial">
              <div className="compass-ring">
                <div className="north">N</div>
                <div className="east">E</div>
                <div className="south">S</div>
                <div className="west">W</div>
              </div>
              <div className="compass-degree">
                {Math.round(heading)}°
              </div>
              <div
                className="compass-needle"
                style={{
                  transform: `translate(-50%, -100%) rotate(${heading}deg)`
                }}
              />

              <div className="compass-center" />
            </div>
          </div>

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
              isOpen={fabOpen}
              onToggle={() => setFabOpen(prev => !prev)}
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
                if (e?.stopPropagation) e.stopPropagation();

                // 1️⃣ Enable all categories NOW (only when FAB clicked)
                setFilters(prev => ({
                  ...prev,
                  activeCategories: exhibits.reduce((acc, ex) => {
                    acc[ex.category] = true;
                    return acc;
                  }, {})
                }));

                // 2️⃣ Open sheet
                setActiveTab("exhibits");
                setShowSheet(true);
                setActiveCategory(null);  // 🔥 IMPORTANT
                setUIState(UI_STATES.BROWSING);
                setShowSheet(true);

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
          onClose={() => { setShowSheet(false) }}
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
                //setShowSheet(false);
                // console.log("Panel received exhibits:", exhibits.length);
                // console.log("Exhibit clicked -> before close. showSheet:", showSheet);
                //console.log("After setShowSheet(false) -> showSheet:", showSheet);
                //setShowSheet(false);
                handleExhibitSelect(id); // Ajit uncomment this
                setShowSheet(false);     // 👈 Close sheet immediately
                // setActiveTab(null);      // 👈 Optional: reset tab
              }}
            />
          )}
        </MobileBottomSheet>
      </div>
    </div>
  );
}
