import { Fab, Zoom } from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ImageIcon from "@mui/icons-material/Image";

export default function FloatingQRButtons({ onCamera, onFile }) {
  return (
    <>
      <Zoom in>
        <Fab
          size="small"
          color="primary"
          onClick={onCamera}
          style={{
            position: "absolute",
            bottom: 90,
            right: 16,
            zIndex: 1500,
          }}
        >
          <QrCodeScannerIcon />
        </Fab>
      </Zoom>

      <Zoom in>
        <Fab
          size="small"
          onClick={() => document.getElementById("qr-file-input").click()}
          style={{
            position: "absolute",
            bottom: 150,
            right: 16,
            zIndex: 1500,
            background: "#444",
            color: "#fff",
          }}
        >
          <ImageIcon />
        </Fab>
      </Zoom>

      <input
        id="qr-file-input"
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: "none" }}
      />
    </>
  );
}
