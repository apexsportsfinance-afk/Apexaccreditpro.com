import React, { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

/**
 * APX-101: Global Network Resilience Banner
 * 
 * Provides real-time feedback on connectivity and API reachability.
 */
export default function GlobalNetworkBanner() {
  const [status, setStatus] = useState("online"); // online, offline, degraded
  const [isVisible, setIsVisible] = useState(true); // FORCED VISIBLE FOR DEBUGGING

  const checkConnectivity = useCallback(async () => {
    try {
      const response = await fetch(`${window.location.origin}/manifest.json`, { 
        method: 'HEAD', 
        cache: 'no-store' 
      });
      if (status !== "online") {
        setStatus("online");
        setTimeout(() => setIsVisible(false), 2000);
      }
    } catch (err) {
      if (!navigator.onLine) {
        setStatus("offline");
        setIsVisible(true);
      } else {
        setStatus("degraded");
      }
    }
  }, [status]);

  useEffect(() => {
    window.addEventListener("online", checkConnectivity);
    window.addEventListener("offline", () => {
      setStatus("offline");
      setIsVisible(true);
    });
    const interval = setInterval(checkConnectivity, 30000);
    if (navigator.onLine) checkConnectivity();
    else {
      setStatus("offline");
      setIsVisible(true);
    }
    return () => clearInterval(interval);
  }, [checkConnectivity]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[9999] px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-mono tracking-widest uppercase border-b backdrop-blur-md transition-colors duration-300 shadow-md",
            status === "online" && "bg-black/85 text-[#d4af37] border-[#d4af37]/30",
            status === "offline" && "bg-red-950/90 text-red-200 border-red-500/40",
            status === "degraded" && "bg-amber-950/90 text-amber-200 border-amber-500/40"
          )}
        >
          {status === "online" && (
            <>
              <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-ping mr-2" />
              <span className="font-semibold tracking-[0.2em]">APEX SYSTEM: V2.2 ACTIVE (SYSTEM READY)</span>
            </>
          )}
          {status === "offline" && (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse text-red-400" />
              <span className="font-semibold tracking-[0.2em] text-red-300">Network Offline — Data Access Limited</span>
            </>
          )}
          {status === "degraded" && (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-semibold tracking-[0.2em] text-amber-300">Connection Degraded — Retrying...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
