import { useEffect, useRef } from "react";

/**
 * Custom hook to encapsulate physical barcode scanner wedge keydown listeners.
 * Tailored for Magellan 900i style wedges sending fast character sequences ending with Enter.
 * 
 * @param {boolean} authorized - Whether the terminal is logged in and authorized to scan.
 * @param {function} onScanSuccess - Callback triggered when a valid barcode sequence is intercepted.
 */
export function useHardwareScanner(authorized, onScanSuccess) {
  const scanBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());
  const scanDebounceTimer = useRef(null);
  
  // Keep the scan success callback fresh without unmounting/re-mounting global listener
  const callbackRef = useRef(onScanSuccess);
  useEffect(() => {
    callbackRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    if (!authorized) return;

    const handleKeyDown = (e) => {
      const now = Date.now();

      // Reset buffer if time gap suggests new scan sequence (e.g., > 100ms)
      if (now - lastKeyTime.current > 100) {
        scanBuffer.current = "";
      }
      lastKeyTime.current = now;

      // Append character for scanner input
      if (e.key.length === 1) {
        scanBuffer.current += e.key;
        
        // Reset debounce timer on each character
        if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
        scanDebounceTimer.current = setTimeout(() => {
          scanBuffer.current = "";
        }, 100);
      }

      // Finish scan on 'Enter' (Standard for Datalogic Magellan 900i)
      if (e.key === "Enter") {
        if (scanBuffer.current.length > 3) {
          if (callbackRef.current) {
            callbackRef.current(scanBuffer.current.trim());
          }
          scanBuffer.current = "";
          e.preventDefault();
        }
        
        // Clear any pending debounce timer
        if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
    };
  }, [authorized]);
}
