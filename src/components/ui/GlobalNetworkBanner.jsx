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
            "fixed top-0 left-0 right-0 z-[9999] px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase border-b shadow-lg transition-colors duration-300",
            status === "online" && "bg-emerald-500 text-white border-emerald-400",
            status === "offline" && "bg-red-600 text-white border-red-500",
            status === "degraded" && "bg-amber-500 text-white border-amber-400"
          )}
        >
          {status === "online" && (
            <>
              <div className="w-2 h-2 bg-white rounded-full animate-ping mr-2" />
              <span>APEX SYSTEM: V2.2 ACTIVE (SYSTEM READY)</span>
            </>
          )}
          {status === "offline" && (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Network Offline — Data Access Limited</span>
            </>
          )}
          {status === "degraded" && (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Connection Degraded — Retrying...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
