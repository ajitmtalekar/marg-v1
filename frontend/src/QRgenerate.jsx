import React, { useState, useRef, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRgenerate({ selectedFloor }) {
  const [exhibits, setExhibits] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const qrRef = useRef(null);

  const BASE_URL = import.meta.env.VITE_APP_BASE_URL;

  /* ----------------------------------
     1️⃣ Load exhibits per floor
  ---------------------------------- */
  useEffect(() => {
    if (selectedFloor === undefined || selectedFloor === null) return;

    async function loadExhibits() {
      try {
        const res = await fetch(
          `/data/floor${selectedFloor}/exhibits.json`
        );

        if (!res.ok) throw new Error("Exhibits not found");

        const data = await res.json();
        setExhibits(data);
        setSelectedId(""); // reset selection on floor change
      } catch (err) {
        console.error("Failed to load exhibits:", err);
        setExhibits([]);
      }
    }

    loadExhibits();
  }, [selectedFloor]);

  /* ----------------------------------
     2️⃣ QR URL includes floor
  ---------------------------------- */
  const qrValue =
    selectedId && selectedFloor !== undefined
      ? `${BASE_URL}?exhibit=${selectedId}&floor=${selectedFloor}`
      : "";

  /* ----------------------------------
     3️⃣ Download QR with margin
  ---------------------------------- */
  function downloadQR() {
    const qrCanvas = qrRef.current?.querySelector("canvas");
    if (!qrCanvas) return;

    const margin = 32;
    const size = qrCanvas.width + margin * 2;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = size;
    exportCanvas.height = size;

    const ctx = exportCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.drawImage(qrCanvas, margin, margin);

    const pngUrl = exportCanvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `qr_floor${selectedFloor}_${selectedId}.png`;
    link.click();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>🦁 Exhibit QR Generator</h2>

      <p><strong>Current Floor:</strong> {selectedFloor}</p>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 20 }}
      >
        <option value="">Select Exhibit</option>
        {exhibits.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      {qrValue && (
        <div style={{ textAlign: "center" }}>
          <div ref={qrRef} style={{ background: "#fff", padding: 16 }}>
            <QRCodeCanvas
              value={qrValue}
              size={260}
              level="H"
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          <p>
            <strong>QR URL:</strong>
            <br />
            <code>{qrValue}</code>
          </p>

          <button onClick={downloadQR}>⬇ Download QR</button>
        </div>
      )}
    </div>
  );
}
