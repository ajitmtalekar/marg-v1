import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [scanningStatus, setScanningStatus] = useState("Idle");

  // --- CLEANUP ---
  useEffect(() => {
    console.log("QRScanner mounted");
    return () => {
      stopCamera();
      console.log("QRScanner unmounted");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- CAMERA START ---
  const startCamera = async () => {
    try {
      if (scannerRef.current) return;

      setActive(true);
      setScanningStatus("Camera starting...");

      await new Promise(requestAnimationFrame);
      await new Promise((r) => setTimeout(r, 50));

      const qrBoxSize = Math.max(
        50,
        Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.6)
      );

      const scanner = new Html5Qrcode("qr-camera");
      scannerRef.current = scanner;

      setScanningStatus("Scanning...");

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: qrBoxSize,
          aspectRatio: 1.0,
          disableFlip: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        },
        (decodedText) => {
          console.log("QR detected:", decodedText);
          onResult(decodedText);
          closeScanner();
        },
        (error) => {
          // ignore minor scan errors
        }
      );
    } catch (err) {
      console.error("Camera start failed:", err);
      setScanningStatus("Error starting camera");
      closeScanner();
    }
  };

  // --- CAMERA STOP ---
  const stopCamera = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (_) {}
    setActive(false);
    setScanningStatus("Idle");
  };

  const closeScanner = async () => {
    await stopCamera();
    onClose?.();
  };

  // --- FILE SCAN ---
  const scanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const scanner = new Html5Qrcode("qr-file-reader");
      const decodedText = await scanner.scanFile(file, true);

      console.log("File QR decoded:", decodedText);
      onResult(decodedText);

      await scanner.clear();
      onClose?.();
    } catch (err) {
      console.error("File scan failed:", err);
    }
  };

  return (
    <>
      {/* FULLSCREEN CAMERA OVERLAY */}
<div
  style={{
    position: "fixed",
    inset: 0,
    background: "#000",        // 🔴 REQUIRED
    zIndex: 2000,              // 🔴 ABOVE MAP + FAB
    display: active ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <div
    id="qr-camera"
    style={{
      width: "100%",
      height: "100%",
      maxWidth: 480,
      position: "relative",
    }}
  >
    {/* Pulsing scan box */}
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "65%",
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
        border: "3px solid #00e5ff",
        borderRadius: 12,
        boxShadow: "0 0 20px #00e5ff",
        animation: "pulse 1.3s infinite",
        pointerEvents: "none",
      }}
    />

    {/* Status text */}
    <div
      style={{
        position: "absolute",
        bottom: 20,
        width: "100%",
        textAlign: "center",
        color: "#fff",
        fontSize: 16,
        textShadow: "0 0 6px #000",
      }}
    >
      {scanningStatus}
    </div>
  </div>
</div>


      {/* FILE SCAN READER */}
      <div id="qr-file-reader" style={{ display: "none" }} />

      {/* UI CARD */}
      {!active && (
        <div
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            width: "90%",
            maxWidth: 320,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={startCamera}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              marginBottom: 10,
              fontSize: 16,
            }}
          >
            Scan with Camera
          </button>

          <label
            style={{
              display: "block",
              padding: 12,
              background: "#444",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Scan from Image
            <input
              type="file"
              accept="image/*"
              onChange={scanFile}
              style={{ display: "none" }}
            />
          </label>

          <div
            style={{
              fontSize: 14,
              color: "#777",
              cursor: "pointer",
            }}
            onClick={closeScanner}
          >
            Cancel
          </div>
        </div>
      )}

      {/* Pulsing animation keyframes */}
      <style>
        {`
        @keyframes pulse {
          0% { box-shadow: 0 0 10px #0ff, 0 0 20px #0ff inset; }
          50% { box-shadow: 0 0 20px #0ff, 0 0 30px #0ff inset; }
          100% { box-shadow: 0 0 10px #0ff, 0 0 20px #0ff inset; }
        }
      `}
      </style>
    </>
  );
}
