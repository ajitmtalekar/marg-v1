import L from "leaflet";

let userMarker = null;

/* ---------- CREATE ICON ---------- */
export function createUserIcon(type = "dot") {
  return L.divIcon({
    className: "user-marker",
    html: `<div class="user-marker-icon ${type}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* ---------- START NAVIGATION (ONCE) ---------- */
export function startUserNavigation(lat, lng, map) {
  if (!map || lat == null || lng == null) return;

  const iconType = localStorage.getItem("navIconType") || "dot";

  if (!userMarker) {
    userMarker = L.marker([lat, lng], {
      icon: createUserIcon(iconType),
      zIndexOffset: 1000,
    }).addTo(map);

    console.log("🧍 User navigation marker created");
  }
}

/* ---------- MOVE MARKER (SIMULATION / GPS) ---------- */
export function updateUserLocation(lat, lng) {
  if (!userMarker || lat == null || lng == null) return;

  userMarker.setLatLng([lat, lng]);
}

/* ---------- CHANGE ICON (FAB) ---------- */
export function setNavigationIcon(type) {
  localStorage.setItem("navIconType", type);

  console.log("icon selected:", type, "marker exists:", !!userMarker);

  if (userMarker) {
    userMarker.setIcon(createUserIcon(type));
  }
}

/* ---------- OPTIONAL CLEANUP ---------- */
export function stopUserNavigation() {
  if (userMarker) {
    userMarker.remove();
    userMarker = null;
  }
}
