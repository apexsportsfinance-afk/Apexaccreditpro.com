import React, { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

/**
 * APX-101: Global Network Resilience Banner
 * 
 * Provides real-time feedback on connectivity and API reachability.
 * Uses persistent pings to verify actual route health beyond standard navigator.onLine.
 */
export default function GlobalNetworkBanner() {
  const [status, setStatus] = useState("online"); // online, offline, degraded
  const [isVisible, setIsVisible] = useState(false);
  const [lastOnline, setLastOnline] = useState(Date.now());

  const checkConnectivity = useCallback(async () => {
    try {
      // HEAD request to a fast, reliable endpoint (Supabase config or similar)
      // APX-101: Any response (even 404) means the server is reachable.
      // Only a fetch failure (exception) indicates real network/server downtime.
      const response = await fetch(`${window.location.origin}/favicon.ico`, { 
        method: 'HEAD', 
        cache: 'no-store' 
      });
      
      if (status === "offline" || status === "degraded") {
        setStatus("online");
        setLastOnline(Date.now());
        // Auto-dismiss success after 2s
        setTimeout(() => setIsVisible(false), 2000);
      }
    } catch (err) {
      setStatus("offline");
      setIsVisible(true);
    }
  }, [status]);

  useEffect(() => {
    const handleOnline = () => checkConnectivity();
    const handleOffline = () => {
      setStatus("offline");
      setIsVisible(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic heartbeat every 30s to detect silent failures
    const interval = setInterval(checkConnectivity, 30000);

    // Initial check if navigator says we are online but might be "lying"
    if (navigator.onLine) checkConnectivity();
    else {
      setStatus("offline");
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Back Online</span>
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
