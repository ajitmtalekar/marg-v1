import React, { useState, useEffect, useRef } from "react";
import MapView from "./components/MapView";
//import MapView from "./components/MapView_GPS_Only";
import QRScanner from "./components/QRScanner";
import { registerSW } from "virtual:pwa-register";
import { Routes, Route } from "react-router-dom";
import PathRepairVisualizer from "./tools/PathRepairVisualizer";
import { SiteConfigContext } from "./config/SiteConfigContext";
//import "./App.css"
import { Config } from "./config/Config";
import "leaflet/dist/leaflet.css";


registerSW();

export default function App() {
  const [currentSpot, setCurrentSpot] = useState(null);
 // const [showScanner, setShowScanner] = useState(false);
  const mapRef = useRef(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
const [targetExhibit, setTargetExhibit] = useState(null);



     useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const spotLat = params.get("lat");
      const spotLng = params.get("lng");
  
      if (spotLat && spotLng) {
        setCurrentSpot({
          coords: [parseFloat(spotLng), parseFloat(spotLat)],
          name: "URL Spot"
        });
      }
    }, []);

      const DATA_VERSION = Config.DATA_VERSION;

    useEffect(() => {
      const storedVersion = localStorage.getItem("dataVersion");

      if (storedVersion !== DATA_VERSION) {
       // console.log("Updating cached map data");
        localStorage.clear();
        localStorage.setItem("dataVersion", DATA_VERSION);
      }
    }, []);

    useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  const floorParam = params.get("floor");
  const exhibitParam = params.get("exhibit");

  if (floorParam !== null) {
    const floor = Number(floorParam);
    if (!isNaN(floor)) {
      setSelectedFloor(floor);
    }
  }

  if (exhibitParam) {
    setTargetExhibit(exhibitParam);
  }
}, []);


    
 

  return (
    <div >

      {/* ⭐ HEADER BAR — LOGO + TITLE ⭐ */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "1px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          gap: "12px",
          flexShrink: 0,   // ✅ important
        }}
      >
        {/* Logo */}
        <a href="/" >
          <img
            src={Config.custlogo}
            alt={Config.custlogoalt}
            style={{ height: "50px" }}
          />
        </a>
        <a href="/">
          <img
            src={Config.custlogo1}
            alt={Config.custlogo1alt}
            style={{ height: "50px" }}
          />
        </a>
        

       <h3
        style={{
          flex: 1,
          margin: 0,
          fontSize: "clamp(6px, 4vw, 33px)",
          textAlign: "center",
          fontWeight: 250,
        }}
      >
        {Config.custname}
      </h3>
      </header>
      {/* ⭐ END HEADER BAR ⭐ */}

     <div
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative",
        }}
      >
        <MapView
          ref={mapRef}
          currentSpot={currentSpot}
          selectedFloor={selectedFloor}
          setSelectedFloor={setSelectedFloor}
          targetExhibit={targetExhibit}
          onQrResult={(spot) => setCurrentSpot(spot)}
        />
      </div>
      <footer
          style={{
            flexShrink: 0,
            borderTop: "1px solid #ddd",
            background: "#fff",
            padding: "6px",
            textAlign: "center",
            fontSize: "12px",
            display: "flex",
          }}
        >
           <h6
        style={{
          flex: 1,
          margin: 0,
          fontSize: "clamp(6px, 4vw, 33px)",
          textAlign: "center",
          fontWeight: 400,
        }}
      >
        Wayfinder developed by S9Ventures
      </h6>
            
      </footer>

      <Routes>
             <Route path="/repair" element={<PathRepairVisualizer />} />
      </Routes>
    </div>
  );
}
