import React, { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import { buildGraph, findShortestPath, keyFor, normalizeCoord } from "../utils/pathNetwork";

const MapView = ({ pathData }) => {
  const [map, setMap] = useState(null);
  const [graph, setGraph] = useState(null);
  const [startPoint, setStartPoint] = useState({
    id: "entry_gate",
    name: "Entry Gate",
    coords: [72.83422, 18.97941],
  });

  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    if (!pathData || !pathData.nodes || !pathData.edges) {
      console.error("Invalid pathData passed to MapView");
      return;
    }

    const g = buildGraph(pathData);
    console.log(`✅ Graph built: ${g.nodeCount()} nodes, ${g.edgeCount()} edges`);
    setGraph(g);

    const mapInstance = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: startPoint.coords,
      zoom: 16,
    });

    setMap(mapInstance);

    // Add Start Marker
    const startMarker = new maplibregl.Marker({ color: "green" })
      .setLngLat(startPoint.coords)
      .setPopup(new maplibregl.Popup().setText("Start Here"))
      .addTo(mapInstance);

    // Map Click Handler
    mapInstance.on("click", (e) => {
      const clickedCoords = [e.lngLat.lng, e.lngLat.lat];
      console.log("🖱️ Clicked on map:", clickedCoords);
      setSelectedPoint({ coords: clickedCoords });
    });

    return () => mapInstance.remove();
  }, [pathData]);

  // Draw route after both points are set
  useEffect(() => {
    if (!map || !graph || !selectedPoint) return;

    // Remove existing route layers if any
    if (map.getLayer("route")) {
      map.removeLayer("route");
      map.removeSource("route");
    }

    // Add marker for selected location
    new maplibregl.Marker({ color: "red" })
      .setLngLat(selectedPoint.coords)
      .setPopup(new maplibregl.Popup().setText("Selected Location"))
      .addTo(map);

    // Compute and draw route
    const fromKey = keyFor(startPoint.coords);
    const toKey = keyFor(selectedPoint.coords);

    const path = findShortestPath(graph, fromKey, toKey);
    if (!path || path.length < 2) {
      console.warn("⚠️ No valid path for selected location");
      return;
    }

    const routeCoords = path.map((k) => k.split(",").map(Number));

    map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: routeCoords,
        },
      },
    });

    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#0074D9",
        "line-width": 5,
      },
    });

    console.log("🛣️ Path drawn:", routeCoords);
  }, [selectedPoint, map, graph]);

  return <div id="map" style={{ width: "100%", height: "600px" }} />;
};

export default MapView;
