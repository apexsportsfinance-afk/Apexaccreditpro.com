import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { audioService } from "../lib/audio";

/**
 * Custom hook to manage the HTML5 webcam QR code scanner.
 * Encapsulates setup, start, stop, error states, and unmount cleanup.
 * 
 * @param {React.RefObject} qrRef - React reference to the DOM element serving as the camera view container.
 * @param {function} onScanSuccess - Callback invoked when a QR code is read successfully.
 * @returns {Object} { scanning, cameraError, startScanner, stopScanner }
 */
export function useQrCamera(qrRef, onScanSuccess) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const html5QrCode = useRef(null);

  // Auto-stop scanner on unmount to release camera threads and prevent memory locks
  useEffect(() => {
    return () => {
      if (html5QrCode.current && html5QrCode.current.isScanning) {
        html5QrCode.current.stop().catch((err) => {
          console.warn("Failed to stop HTML5 QrCode scanner on unmount:", err);
        });
      }
    };
  }, []);

  const startScanner = (retrying = false) => {
    if (!qrRef.current) return;
    setCameraError(null);

    // Clear existing instances to avoid duplicates
    if (html5QrCode.current) {
      html5QrCode.current.clear();
    }

    html5QrCode.current = new Html5Qrcode(qrRef.current.id);

    html5QrCode.current.start(
      { facingMode: "environment" },
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
      },
      onScanSuccess,
      () => { } // Suppress generic frame capture error noise
    ).then(() => {
      setScanning(true);
      
      // Initialize audio context on USER interaction
      audioService.init();
      if (retrying) toast.success("Camera activated");
    }).catch((err) => {
      console.warn("Camera fallback disabled:", err);
      if (retrying) {
        setCameraError("Could not access camera. Please check permissions.");
        toast.error("Camera access denied");
      }
    });
  };

  const stopScanner = () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      html5QrCode.current.stop()
        .then(() => setScanning(false))
        .catch((err) => {
          console.warn("Failed to stop HTML5 QrCode scanner:", err);
        });
    }
  };

  return {
    scanning,
    cameraError,
    setCameraError,
    startScanner,
    stopScanner
  };
}
