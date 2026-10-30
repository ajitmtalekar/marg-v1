// src/config/Config.js

/* ================== HELPERS ================== */
const isTrue = (v) => v === true || v === "true";


const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const BASE_URL = import.meta.env.BASE_URL || "/";

const DATA_VERSION = import.meta.env.VITE_DATA_VER;


/* ================== ENV MODES ================== */
const MAP_MODE = import.meta.env.VITE_MAP_MODE || "OFFLINE"; // OSM | OFFLINE
const TEST_MODE = isTrue(import.meta.env.VITE_TEST_MODE);

/* ================== CONFIG ================== */
export const Config = {
  /* ================== APP ================== */
  name: import.meta.env.VITE_APP_NAME || "MAP",
  path: import.meta.env.VITE_APP_PATH || BASE_URL,

  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  testMode: TEST_MODE,

  custlogo: `${BASE_URL}bmc-logo.png`,
  custlogoalt: "MCGM",

  custlogo1: `${BASE_URL}Mumzoologo.jpg`,
  custlogo1alt: "MumZoo",

  custname: "वीरमाता जिजाबाई भोसले वनस्पती उद्यान व प्राणिसंग्रहालय",

  // 🧪 Feature flags
  devTestMode: TEST_MODE,
  useBounds: isTrue(import.meta.env.VITE_USE_BOUNDS),
  gpsAsCenter: isTrue(import.meta.env.VITE_GPS_AS_CENTER),
  devUseGpsAsCenter: import.meta.env.DEV,

  /* ================== MAP ================== */
  
  center: [
    toNumber(import.meta.env.VITE_APP_LAT, 18.978696), // fallback: Entry Gate LAT
    toNumber(import.meta.env.VITE_APP_LNG, 72.834938), // fallback: Entry Gate LNG
  ],

  zoom: toNumber(import.meta.env.VITE_APP_DEFAULT_ZOOM, 18),
  minZoom: toNumber(import.meta.env.VITE_APP_MIN_ZOOM, 17),
  maxZoom: toNumber(import.meta.env.VITE_APP_MAX_ZOOM, 20),

  /* ================== TILE LAYER ================== */
  tileLayer:
    MAP_MODE === "TEST"
    ? {
        type: "TEST",
        url: `${BASE_URL}tilestest/{z}/{x}/{y}.png`, // ✅ BASE-PATH SAFE
        attribution: "© OpenStreetMap contributors",
        noWrap: false,
      }
    : MAP_MODE === "OSM"
      ? {
          type: "OSM",
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "© OpenStreetMap contributors",
          noWrap: false,
        }
      : {
          type: "OFFLINE",
         // url: `${BASE_URL}tiles/floor_0/{z}/{x}/{y}.png`, // ✅ BASE-PATH SAFE
         url: `${BASE_URL}tiles`,
          attribution: "",
          noWrap: true,
        },
        

  /* ================== BOUNDING BOX ================== */
  bbox: {
    topLeft: [
      toNumber(import.meta.env.VITE_APP_BBOX_TOPLEFT_LAT),
      toNumber(import.meta.env.VITE_APP_BBOX_TOPLEFT_LNG),
    ],
    bottomRight: [
      toNumber(import.meta.env.VITE_APP_BBOX_BOTTOMRIGHT_LAT),
      toNumber(import.meta.env.VITE_APP_BBOX_BOTTOMRIGHT_LNG),
    ],
  },

  /* ================== HARD MAP LIMITS ================== */
  bounds: {
    minLat: toNumber(import.meta.env.VITE_APP_MIN_LAT),
    maxLat: toNumber(import.meta.env.VITE_APP_MAX_LAT),
    minLng: toNumber(import.meta.env.VITE_APP_MIN_LNG),
    maxLng: toNumber(import.meta.env.VITE_APP_MAX_LNG),
  },

  /* ================== GPS ================== */
  gps: {
    enableHighAccuracy: true,
    watch: true,
    throttleMs: TEST_MODE ? 2000 : 1000,
    minAccuracy: TEST_MODE ? 100 : 25, // meters
  },
};
