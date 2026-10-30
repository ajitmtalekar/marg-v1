import fs from "fs";

const R = 6378137;

function latLngToMeters(lat, lng) {
  const x = (lng * Math.PI * R) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return { x, y };
}

function metersToLatLng(x, y) {
  const lng = (x / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) *
    (180 / Math.PI);
  return { lat, lng };
}

function generateVisualCircle(lat, lng, radius, points = 64) {
  const center = latLngToMeters(lat, lng);
  const coords = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    const p = metersToLatLng(x, y);
    coords.push([p.lng, p.lat]);
  }

  return coords;
}

// Jijamata parameters
const coords = generateVisualCircle(
  18.978125,
  72.83595,
  11,
  64
);

fs.writeFileSync(
  "jijamata_circle.json",
  JSON.stringify(coords, null, 2)
);
