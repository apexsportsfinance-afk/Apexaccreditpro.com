import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Camera, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Lock, 
  LogOut, 
  RefreshCcw, 
  Eye, 
  EyeOff,
  Users,
  Ticket,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Trophy
} from "lucide-react";
import { AccreditationsAPI, TicketingAPI, EventsAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { AthleteEventsAPI } from "../../lib/broadcastApi";
import { toast } from "sonner";
import { getCountryFlag } from "../../lib/utils";

// Helper for time differentials
const parseTimeSeconds = (timeStr) => {
  if (!timeStr || timeStr === "NT" || timeStr === "NP") return null;
  let clean = timeStr.trim().replace(/[A-Za-z]/g, '');
  if (!clean) return null;
  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts.length >= 2) {
      return (parseInt(parts[0], 10) * 60) + parseFloat(parts[1]);
    }
  }
  return parseFloat(clean);
};

const formatTimeDiff = (pbStr, recordStr) => {
  const pbSec = parseTimeSeconds(pbStr);
  const recSec = parseTimeSeconds(recordStr);
  if (pbSec === null || recSec === null || isNaN(pbSec) || isNaN(recSec)) return null;
  const diff = recSec - pbSec; 
  const isFaster = diff >= 0;
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const absDiff = Math.abs(diff);
  let diffDisplay = absDiff >= 60 ? `${sign}${Math.floor(absDiff / 60)}:${(absDiff % 60).toFixed(2).padStart(5, '0')}` : `${sign}${absDiff.toFixed(2)}`;
  return { text: diffDisplay, isFaster };
};

const calculateAge = (dob, calcYear = 2025) => {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    return calcYear - birth.getFullYear();
  } catch (e) { return null; }
};

export default function ScannerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const defaultPin = import.meta.env.VITE_SCANNER_PIN || "1234";

  // Configuration from URL
  const [config, setConfig] = useState({
    mode: "attendance", // attendance | spectator | info | verify
    eventId: "",
    deviceLabel: "Main-Scanner"
  });

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState(false); // SUCCESS FLASH feedback
  const qrRef = useRef(null);
  const html5QrCode = useRef(null);

  // Hardware Scanner (Magellan 900i) Listener Logic
  const scanBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());

  // 1. Initialize config from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode") || "attendance";
    const eventParam = params.get("event_id") || "";
    const deviceParam = params.get("device_label") || (modeParam === 'spectator' ? 'Spectator-Gate' : 'Gate-Scanner');

    setConfig({
      mode: modeParam,
      eventId: eventParam,
      deviceLabel: deviceParam
    });

    // Check localStorage session
    const savedPinAuth = localStorage.getItem("scanner_auth_pin");
    if (savedPinAuth === defaultPin) setAuthorized(true);

    // Register Service Worker for PWA "Install" support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      });
    }
  }, [defaultPin]);

  // 2. Setup Global Keydown Listener for Hardware Wedge
  useEffect(() => {
    if (!authorized) return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      
      // If gap between keys > 50ms, it's likely a human typing, reset
      if (now - lastKeyTime.current > 50) {
        scanBuffer.current = "";
      }
      lastKeyTime.current = now;

      // Finish scan on 'Enter' (Standard for Datalogic Magellan 900i)
      if (e.key === "Enter") {
        if (scanBuffer.current.length > 3) {
          onScanSuccess(scanBuffer.current);
          scanBuffer.current = "";
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authorized, config]);

  // Handle Auth PIN
  const handleAuth = (e) => {
    e.preventDefault();
    if (pinInput === defaultPin) {
      setAuthorized(true);
      localStorage.setItem("scanner_auth_pin", pinInput);
      setPinError("");
    } else {
      setPinError("Invalid PIN");
    }
  };

  const logout = () => {
    localStorage.removeItem("scanner_auth_pin");
    setAuthorized(false);
    stopScanner();
  };

  // Camera Management
  useEffect(() => {
    if (authorized && !scanning) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [authorized]);

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
      { fps: 10, qrbox: { width: 280, height: 280 } },
      onScanSuccess,
      () => {} 
    ).then(() => {
      setScanning(true);
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
    if (html5QrCode.current?.isScanning) {
      html5QrCode.current.stop().then(() => setScanning(false)).catch(() => {});
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (processing) return; 
    setProcessing(true);
    
    // Trigger SUCCESS FLASH
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    try {
      let token = decodedText.trim();
      if (token.includes("/verify/")) {
        token = token.split("/verify/").pop();
      }

      // 1. MODE: SPECTATOR
      if (config.mode === "spectator") {
        if (!token.startsWith("spec_")) {
          showScanError("Invalid Ticket", "This QR code is not a spectator ticket.");
          return;
        }
        const order = await TicketingAPI.validateOrder(token);
        if (!order || order.event_id !== config.eventId) {
          showScanError("Ticket Not Found", "This ticket is not valid for this event.");
          return;
        }
        const remaining = order.ticket_count - (order.scanned_count || 0);
        setLastScanResult({
          type: "spectator",
          status: remaining > 0 ? "success" : "duplicate",
          order,
          remaining,
          message: remaining > 0 ? `${remaining} tickets remaining` : "Tickets already used"
        });

        // AUDIT LOG
        AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          spectatorId: order.id,
          scanMode: "spectator",
          deviceLabel: config.deviceLabel
        });

        return;
      }

      // 2. MODE: ATTENDANCE OR INFO
      const athlete = await AccreditationsAPI.validateToken(token);
      if (!athlete) {
        showScanError("Not Found", "No athlete or staff record found for this code.");
        return;
      }

      if (athlete.status !== "approved") {
        showScanError("Access Denied", `Accreditation is ${athlete.status}.`);
        return;
      }

      if (config.mode === "attendance") {
        // Strict event ID check
        if (athlete.eventId !== config.eventId) {
          showScanError("Access Denied", "Athlete is registered for a different event.");
          return;
        }

        const recordRes = await AttendanceAPI.recordScan({
          eventId: config.eventId,
          athleteId: athlete.id,
          clubName: athlete.club,
          scannerLocation: config.deviceLabel
        });

        setLastScanResult({
          type: "athlete_entry",
          status: recordRes.status,
          athlete,
          message: recordRes.message
        });

        // AUDIT LOG
        AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          athleteId: athlete.id,
          scanMode: "attendance",
          deviceLabel: config.deviceLabel
        });

        // Auto-resume after 2s for attendance gate speed
        setTimeout(resumeScanner, 2000);
      } else {
        // INFO OR VERIFY MODE
        let competitionData = [];
        if (config.mode === "verify" || config.mode === "info") {
          try {
            competitionData = await AthleteEventsAPI.getForAthlete(athlete.id);
          } catch (err) {
            console.warn("Failed to load competition data:", err);
          }
        }

        setLastScanResult({
          type: config.mode === "verify" ? "athlete_verify" : "athlete_info",
          status: "info",
          athlete,
          competitionData,
          message: config.mode === "verify" ? "Accreditation Verified" : "Profile Loaded"
        });

        // AUDIT LOG (Silent)
        const logPromise = AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          athleteId: athlete.id,
          scanMode: config.mode,
          deviceLabel: config.deviceLabel
        });
        
        // Debug logging for the user
        logPromise.then(res => {
          console.log(`[AuditLog] ${config.mode} scan recorded:`, res);
        }).catch(err => {
          console.error(`[AuditLog] Failed to record ${config.mode} scan:`, err);
        });
      }

    } catch (err) {
      console.error(err);
      showScanError("System Error", "Connection failed during scan.");
    } finally {
      setProcessing(false);
    }
  };

  const showScanError = (title, message) => {
    setLastScanResult({ status: "error", title, message });
    setTimeout(resumeScanner, 3000);
  };

  const handleRedeem = async (count) => {
    if (!lastScanResult?.order) return;
    setProcessing(true);
    try {
      const updated = await TicketingAPI.redeemTickets(lastScanResult.order.id, count);
      const rem = updated.ticket_count - updated.scanned_count;
      setLastScanResult({
        ...lastScanResult,
        status: rem > 0 ? "success" : "duplicate",
        order: updated,
        remaining: rem
      });
      toast.success(`Redeemed ${count} ticket(s)`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const resumeScanner = () => {
    setLastScanResult(null);
    setProcessing(false);
  };

  // --- RENDERING ---

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase mb-2">Scanner Login</h1>
          <form className="space-y-4" onSubmit={handleAuth}>
            <input 
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              placeholder="••••"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 text-center text-4xl tracking-widest text-white outline-none focus:border-blue-500 transition-all font-mono"
            />
            {pinError && <p className="text-red-400 text-xs font-bold text-center">{pinError}</p>}
            <button className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-300 ${flash ? 'bg-emerald-500/50' : 'bg-[#020617]'}`}>
      
      {/* Header */}
      <header className="bg-white/5 border-b border-white/10 p-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
            {config.mode === 'attendance' ? <Users className="text-emerald-400" /> : 
             config.mode === 'spectator' ? <Ticket className="text-blue-400" /> : 
             <Info className="text-purple-400" />}
          </div>
          <div>
            <h1 className="text-white font-black uppercase tracking-[0.2em] text-sm">
              {config.mode === 'attendance' ? 'Entry Gate' : 
               config.mode === 'spectator' ? 'Ticket Redemption' : 
               config.mode === 'verify' ? 'Verify Accreditation' :
               'Athlete Hub'}
            </h1>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{config.deviceLabel}</p>
          </div>
        </div>
        <button onClick={logout} className="text-white/20 hover:text-red-400 p-2 transition-colors"><LogOut /></button>
      </header>

      {/* Main Scan View */}
      <main className="flex-1 relative flex flex-col pt-4 overflow-hidden">
        {!lastScanResult ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
            {/* The Unified Scanner Frame */}
            <div className="w-full max-w-sm aspect-square bg-black border-4 border-white/5 rounded-[3.5rem] relative flex items-center justify-center overflow-hidden shadow-2xl">
               <div id="qr-reader" ref={qrRef} className="absolute inset-0 w-full h-full" />
               
               {!scanning && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10 p-6 text-center">
                   <Camera className="w-16 h-16 text-white/10 mb-4" />
                   <p className="text-white font-bold text-sm mb-4">{cameraError || "Establishing Link..."}</p>
                   <button 
                     onClick={() => startScanner(true)}
                     className="px-6 py-2 bg-blue-600 rounded-full text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                   >
                     Enable Camera
                   </button>
                 </div>
               )}

               {scanning && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/40 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-scan-line z-20" />
                    <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none" />
                    <div className="absolute inset-[30px] border-2 border-white/20 rounded-[2.5rem] pointer-events-none" />
                  </>
               )}
            </div>
            
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Hardware Link Active</span>
              </div>
              <h2 className="text-white font-black uppercase tracking-widest text-lg">Position QR Code</h2>
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.3em] max-w-[200px] mx-auto text-center">Compatible with Magellan 900i and internal camera</p>
            </div>
          </div>
        ) : (
          <ResultView config={config} result={lastScanResult} onResume={resumeScanner} onRedeem={handleRedeem} />
        )}
      </main>

      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .animate-scan-line { animation: scan 2.5s infinite linear; }
        #qr-reader__scan_region { height: 100% !important; }
        #qr-reader video { object-fit: cover !important; min-height: 100% !important; min-width: 100% !important;}
      `}</style>
    </div>
  );
}

function ResultView({ config, result, onResume, onRedeem }) {
  if (result.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-red-500/10">
        <AlertCircle className="w-24 h-24 text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">{result.title || "Scan Error"}</h2>
        <p className="text-red-400 font-bold text-center max-w-sm">{result.message}</p>
        <button onClick={onResume} className="mt-8 px-8 py-3 bg-red-500/20 border border-red-500/50 text-white font-black uppercase tracking-widest rounded-xl">Discard</button>
      </div>
    );
  }

  if (result.type === 'spectator') {
    return (
      <div className="flex-1 p-6 md:p-12 space-y-6 overflow-y-auto">
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-center relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <Ticket className="w-16 h-16 text-blue-400 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-1">{result.order.customer_name}</h2>
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs mb-8">{result.order.customer_email}</p>
          
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-10">
            <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1 block text-center">Total Order</span>
              <p className="text-3xl font-black text-white">{result.order.ticket_count}</p>
            </div>
            <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1 block text-center">Already Scanned</span>
              <p className="text-3xl font-black text-emerald-400">{result.order.scanned_count || 0}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            {result.remaining > 0 ? (
              <>
                <button onClick={() => onRedeem(1)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-900/40">Redeem Single</button>
                {result.remaining > 1 && (
                  <button onClick={() => onRedeem(result.remaining)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Redeem All ({result.remaining})</button>
                )}
              </>
            ) : (
              <div className="py-6 border-2 border-dashed border-red-500/20 rounded-2xl text-red-500 font-black uppercase tracking-widest">Entry Limit Reached</div>
            )}
            <button onClick={onResume} className="py-4 text-white/30 hover:text-white font-bold uppercase tracking-widest transition-colors">Return</button>
          </div>
        </div>
      </div>
    );
  }

  if (result.type === 'athlete_entry') {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${result.status === 'success' ? 'bg-emerald-500/5' : 'bg-orange-500/5'}`}>
        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 border-4 ${result.status === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-orange-500/20 border-orange-500 text-orange-400'}`}>
          {result.status === 'success' ? <CheckCircle className="w-16 h-16 shadow-[0_0_40px_rgba(16,185,129,0.3)]" /> : <RefreshCcw className="w-16 h-16" />}
        </div>
        <h2 className={`text-4xl font-black uppercase tracking-tight mb-2 ${result.status === 'success' ? 'text-emerald-400 shadow-text' : 'text-orange-400'}`}>
          {result.status === 'success' ? 'Access Granted' : 'Duplicate Scan'}
        </h2>
        <div className="text-center mt-6">
          <p className="text-3xl font-black text-white uppercase">{result.athlete.firstName} {result.athlete.lastName}</p>
          <p className="text-orange-400 font-black uppercase tracking-[0.2em] mt-1">{result.athlete.club}</p>
        </div>
        <button onClick={onResume} className="mt-12 text-white/20 hover:text-white font-bold uppercase tracking-widest transition-colors">Clear</button>
      </div>
    );
  }

  if (result.type === 'athlete_info' || result.type === 'athlete_verify') {
    const isRich = result.type === 'athlete_verify';
    
    return (
      <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-xl mx-auto space-y-4">
          
          {/* Main ID Card Section */}
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden backdrop-blur-3xl shadow-2xl">
             <div className="absolute top-0 right-0 p-6 opacity-5">
               <Trophy className="w-32 h-32 text-white" />
             </div>
             
             <div className="flex items-start gap-6 mb-8 relative z-10">
               <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                 {result.athlete.photoUrl ? (
                   <img src={result.athlete.photoUrl} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                     <Users className="w-10 h-10 text-white/20" />
                   </div>
                 )}
               </div>
               
               <div className="flex-1 pt-2">
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase leading-tight mb-2 tracking-tight">
                    {result.athlete.firstName} {result.athlete.lastName}
                  </h2>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                      {result.athlete.role || "Participant"}
                    </div>
                    <div className="px-3 py-1 bg-white/5 text-white/40 text-[9px] font-mono tracking-widest rounded-full border border-white/5">
                      ID: {result.athlete.accreditationId?.split("-").pop() || result.athlete.id?.slice(0, 8)}
                    </div>
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1">Club</span>
                  <p className="text-xs font-bold text-white truncate">{result.athlete.club || "Independent"}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1">Region</span>
                    <p className="text-xs font-bold text-white uppercase">{result.athlete.nationality || "INT"}</p>
                  </div>
                  {getCountryFlag(result.athlete.nationality) && (
                    <img src={getCountryFlag(result.athlete.nationality)} className="w-6 h-4 object-cover rounded shadow-lg" alt="" />
                  )}
                </div>
             </div>

             {/* Dynamic Metadata (Badge & Zones) */}
             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Badge Number</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-blue-400 tracking-wider">
                    {result.athlete.badgeNumber || result.athlete.badgeId || "---"}
                  </span>
                </div>

                {result.athlete.zoneCode && (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-3">Access Zones</span>
                    <div className="flex flex-wrap gap-2">
                       {result.athlete.zoneCode.split(",").map((zone, idx) => (
                         <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter">
                           {zone.trim()}
                         </span>
                       ))}
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* Competition Matrix Section (Only if available) */}
          {result.competitionData && result.competitionData.length > 0 && (
            <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2.5rem] backdrop-blur-xl">
               <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                 <Calendar className="w-4 h-4 text-emerald-400" />
                 <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Competition Matrix</h3>
               </div>
               
               <div className="space-y-3">
                 {result.competitionData.map((ev, idx) => {
                   let displayName = ev.event_name || "";
                   let eventRecords = null;
                   
                   if (displayName.includes("|||RECORD_DATA|||")) {
                     const parts = displayName.split("|||RECORD_DATA|||");
                     displayName = parts[0].trim();
                     try {
                       eventRecords = JSON.parse(parts[1].trim());
                     } catch(e) {}
                   }

                   const athleteAge = calculateAge(result.athlete.dateOfBirth);
                   const recordTime = eventRecords?.[athleteAge] || ev.age_record_time;

                   return (
                     <div key={idx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                       <div className="flex items-center gap-4 min-w-0">
                         <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-10 text-center flex-shrink-0">
                           {ev.eventCode}
                         </span>
                         <span className="text-xs text-white/80 font-medium truncate">
                           {displayName}
                         </span>
                       </div>
                       <div className="flex items-center gap-2">
                         {ev.seed_time && recordTime && (
                           (() => {
                             const diff = formatTimeDiff(ev.seed_time, recordTime);
                             if (!diff) return null;
                             return (
                               <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${diff.isFaster ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                 {diff.text}
                               </span>
                             );
                           })()
                         )}
                         {ev.heat && (
                           <span className="text-[9px] font-black text-white/30 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                             H:{ev.heat} • L:{ev.lane}
                           </span>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
          
          <div className="pt-4">
            <button onClick={onResume} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-900/40">Ready for Next Scan</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function InfoItem({ icon: Icon, label, value, color = "text-white/80" }) {
  return (
    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/30" />
        </div>
        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
