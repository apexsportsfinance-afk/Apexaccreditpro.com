import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  AlertCircle,
  Check,
  CheckCircle,
  Info,
  Lock,
  LogOut,
  RefreshCcw,
  Eye,
  EyeOff,
  Users,
  User,
  Ticket,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  QrCode,
  Bell,
  ShieldAlert,
  ShieldCheck,
  FileText,
  MessageSquare
} from "lucide-react";
import { AccreditationsAPI, TicketingAPI, EventsAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { EventSettingsAPI, FormFieldSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";
import { toast } from "sonner";
import { getCountryFlag, calculateAge } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { audioService } from "../../lib/audio";

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

const INSPIRATIONAL_QUOTES = [
  { text: "Let me win. But if I cannot win, let me be brave in the attempt.", author: "Special Olympics Oath" },
  { text: "The world can be a rough place, but it's also a place of great beauty and great hope.", author: "Eunice Kennedy Shriver (Founder)" },
  { text: "Don't tell me what I can't do. Let me show you what I CAN do.", author: "Special Olympics Motto" },
  { text: "God doesn't make mistakes. We were all created for a purpose.", author: "Loretta Claiborne (Runner)" },
  { text: "My disability does not define me, my determination does.", author: "Karen Gaffney (Swimmer)" },
  { text: "A champion is someone who gets up when they can't.", author: "Special Olympics Spirit" },
  { text: "I may be different, but I am just like you.", author: "Special Olympics Athlete" },
  { text: "Optimism is the faith that leads to achievement. Nothing can be done without hope and confidence.", author: "Helen Keller" }
];

const calculateAgeLocal = (dob, calcYear = new Date().getFullYear()) => {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    return calcYear - birth.getFullYear();
  } catch (e) { return null; }
};

export default function ScannerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const defaultPin = import.meta.env.VITE_SCANNER_PIN || "1234";

  // Configuration from URL
  const [config, setConfig] = useState({
    mode: "attendance", // attendance | spectator | info | verify
    eventId: "",
    deviceLabel: "Main-Scanner",
    zone: ""
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
  const resultTimerRef = useRef(null);

  // UI States for Aesthetic Upgrade
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [activeZoneConfig, setActiveZoneConfig] = useState(null);

  // High-Speed Hardware Locking (APX-FIX for Spectators)
  const isCurrentlyProcessing = useRef(false);

  // 1. Initialize config from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode") || "attendance";
    const eventParam = params.get("event_id") || "";
    const publicParam = params.get("public") === "true";
    const urlPin = params.get("pin");
    const deviceParam = params.get("device_label") || (modeParam === 'spectator' ? 'Spectator-Gate' : 'Gate-Scanner');

    setIsPublic(publicParam);
    setConfig({
      mode: modeParam,
      eventId: eventParam,
      deviceLabel: deviceParam,
      zone: params.get("zone") || ""
    });

    // Auto-authorize if PIN is in URL or session exists
    const savedPinAuth = localStorage.getItem("scanner_auth_pin");
    if (urlPin === defaultPin || savedPinAuth === defaultPin) {
      setAuthorized(true);
      if (urlPin === defaultPin) {
        localStorage.setItem("scanner_auth_pin", defaultPin);
      }
    }

    // Register Service Worker for PWA "Install" support (Disabled)
  }, [defaultPin]);

  // 2. Fetch today's sessions for automatic matching
  useEffect(() => {
    const fetchSessions = async () => {
      if (config.eventId && config.mode === "attendance") {
        try {
          const today = new Date().toISOString().split("T")[0];
          const data = await AttendanceAPI.getSessions(config.eventId, today);
          setSessions(data || []);
        } catch (err) {
          console.warn("Failed to load sessions:", err);
        }
      }
    };
    fetchSessions();
  }, [config.eventId, config.mode]);

  // 3. Fetch Zone configuration for time-based rules
  useEffect(() => {
    const fetchZoneConfig = async () => {
      if (config.eventId && config.zone && config.mode === "attendance") {
        try {
          const zones = await ZonesAPI.getByEventId(config.eventId);
          const currentZone = zones.find(z => String(z.code).toUpperCase() === String(config.zone).toUpperCase());
          if (currentZone) {
            setActiveZoneConfig(currentZone);
          }
        } catch (err) {
          console.warn("Failed to load zone configuration for time-based access:", err);
        }
      }
    };

    fetchZoneConfig();
    const interval = setInterval(fetchZoneConfig, 30000); // Dynamic update every 30s
    return () => clearInterval(interval);
  }, [config.eventId, config.zone, config.mode]);

  // Quote Rotation Timer
  useEffect(() => {
    if (!lastScanResult) {
      const interval = setInterval(() => {
        setCurrentQuoteIndex(prev => (prev + 1) % INSPIRATIONAL_QUOTES.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [lastScanResult]);

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

  const findActiveSession = (sessionList) => {
    if (!sessionList || sessionList.length === 0) return null;
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTimeVal = currentH * 60 + currentM;

    return sessionList.find(s => {
      const [startH, startM] = s.start_time.split(':').map(Number);
      const [endH, endM] = s.end_time.split(':').map(Number);
      const startVal = startH * 60 + startM;
      const endVal = endH * (s.end_time.includes(':') ? 60 : 1) + (endM || 0);
      return currentTimeVal >= startVal && currentTimeVal <= endVal;
    });
  };

  // Handle Auth PIN
  const handleAuth = (e) => {
    e.preventDefault();
    if (pinInput === defaultPin) {
      setAuthorized(true);
      localStorage.setItem("scanner_auth_pin", pinInput);
      setPinError("");
      // Initialize audio context on USER interaction
      audioService.init();
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
    // Intentionally NOT auto-starting the camera so users can use physical hardware scanners
    // and save battery/performance. User must explicitly click "Activate Camera".
    return () => {
      stopScanner();
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
      () => { }
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
    if (html5QrCode.current?.isScanning) {
      html5QrCode.current.stop().then(() => setScanning(false)).catch(() => { });
    }
  };

  const lastProcessedToken = useRef("");
  const lastProcessedTime = useRef(0);

  const onScanSuccess = async (decodedText) => {
    if (processing) return;

    let token = decodedText.trim();
    if (token.includes("/verify/")) {
      token = token.split("/verify/").pop();
    }

    // [APX-MOD] Guard against accidental double-scanning of the same physical code within 5 seconds
    const now = Date.now();
    if (token === lastProcessedToken.current && (now - lastProcessedTime.current) < 5000) {
      return;
    }

    // [APX-LOCK] Strict hardware lock for Spectator High-Traffic Gates
    const isSpectatorMode = config.mode === 'spectator' || config.mode === 'spectator_exit';
    if (isSpectatorMode) {
      if (isCurrentlyProcessing.current) return;
      isCurrentlyProcessing.current = true;
    }

    setProcessing(true);
    lastProcessedToken.current = token;
    lastProcessedTime.current = now;

    // Clear any pending result clear timers immediately on new scan
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    // Trigger SUCCESS FLASH
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    // [NEW] Generic Pass Handling (Bulletproof: Case-Insensitive & Resilient Delimiters)
    const normalizedToken = (token || "").trim().toUpperCase();
    if (normalizedToken.startsWith("GENERIC|") || normalizedToken.startsWith("GENERIC-")) {
      const delimiter = normalizedToken.includes("|") ? "|" : "-";
      const parts = token.split(delimiter);

      if (parts.length < 3) {
        showScanError("Invalid Format", "Unexpected Generic Pass token structure.");
        return;
      }

      const eventIdPart = parts[1].trim();
      const datesPart = parts[2].trim();
      const guestNamePart = (parts[3] || "Generic Spectator").trim();

      // Flexible ID Match: Handles both short and long form IDs
      const scannerEventId = (config.eventId || "").toLowerCase();
      const tokenEventId = eventIdPart.toLowerCase();

      const isIdMatch = tokenEventId === scannerEventId ||
        (tokenEventId.length >= 8 && scannerEventId.startsWith(tokenEventId)) ||
        (scannerEventId.length >= 8 && tokenEventId.startsWith(scannerEventId));

      if (!isIdMatch) {
        showScanError("Wrong Event", "This Generic Pass is for a different event.");
        return;
      }

      if (datesPart && datesPart !== "FULL-EVENT") {
        const today = new Date().toLocaleDateString('en-CA');
        const allowedDates = datesPart.split(",");
        if (!allowedDates.includes(today)) {
          showScanError("Invalid Date", "This pass is not valid for today.");
          return;
        }
      }

      setLastScanResult({
        type: "spectator_success",
        status: "success",
        message: "Generic Access Granted",
        order: { customer_name: guestNamePart }
      });
      // Play entry success sound
      audioService.playSuccessEntry();

      // [NEW] Record attendance silently in the background
      TicketingAPI.recordGenericEntry(config.eventId, guestNamePart, config.deviceLabel || "Generic Gate")
        .catch(e => console.warn("Attendance record failed for generic pass", e));

      resultTimerRef.current = setTimeout(resumeScanner, 8000);
      return;
    }

    try {
      // 1. MODE: SPECTATOR (ENTRY OR EXIT)
      if (config.mode === "spectator" || config.mode === "spectator_exit") {
        const order = await TicketingAPI.validateOrder(token);
        if (!order) {
          showScanError("Not Found", "No valid order or ticket found for this code.");
          return;
        }

        const scannerEventId = (config.eventId || "").trim().toLowerCase();
        const ticketEventId = (order.event_id || "").trim().toLowerCase();

        if (ticketEventId !== scannerEventId) {
          let wrongEvent = "a different event";
          try {
            const { data: evt } = await supabase.from('events').select('name').eq('id', order.event_id).single();
            if (evt) wrongEvent = evt.name;
          } catch (e) { }
          showScanError("Wrong Event", `This ticket is for "${wrongEvent}". (Scanner: ${scannerEventId.slice(-5)} vs Ticket: ${ticketEventId.slice(-5)})`);
          return;
        }

        const t = order.specific_ticket;

        // --- EXIT MODE FLOW ---
        if (config.mode === "spectator_exit") {
          try {
            await TicketingAPI.checkOutTicket(order.id, t?.id);
            setLastScanResult({
              type: "spectator_success",
              status: "exit",
              order,
              message: "Checkout Successful"
            });
            // Play exit success sound
            audioService.playSuccessExit();
            resultTimerRef.current = setTimeout(resumeScanner, 1500);
          } catch (exitErr) {
            showScanError("Invalid Exit", exitErr.message === "INVALID_EXIT" ? "Ticket is not currently inside." : exitErr.message);
          }
          return;
        }

        // --- ENTRY MODE FLOW ---
        const total = Number(order.ticket_count || 0);
        const scanned = Number(order.scanned_count || 0);
        const remaining = total - scanned;

        try {
          const updated = await TicketingAPI.redeemTickets(order.id, 1, t?.id);
          if (updated) {
            setLastScanResult({
              type: "spectator_success",
              status: "success",
              order: updated,
              message: "Access Granted"
            });
            // Play entry success sound
            audioService.playSuccessEntry();
            resultTimerRef.current = setTimeout(resumeScanner, 8000);
          }
        } catch (redeemErr) {
          const msg = redeemErr.message || "";
          if (msg.startsWith("FUTURE_TICKET")) {
            const date = msg.split('|')[1];
            const formatted = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            showScanError("Access Denied", `VALID ON ${formatted.toUpperCase()} — Please return on event day.`);
          } else if (msg.startsWith("EXPIRED_TICKET")) {
            const date = msg.split('|')[1];
            showScanError("Expired", `This ticket was valid for ${date}.`);
          } else if (msg === "ALREADY_SCANNED_TODAY") {
            showScanError("Already In", "This pass has already entered today.");
          } else if (msg === "ALREADY_SCANNED") {
            showScanError("Already In", "This ticket is already marked as inside.");
          } else if (remaining <= 0) {
            showScanError("Limit Reached", "All slots for this order have been used.");
          } else {
            showScanError("Access Denied", msg);
          }
        }
        return;
      }

      // 2. MODE: ATTENDANCE OR INFO
      const athlete = await AccreditationsAPI.validateToken(token);
      if (!athlete) {
        showScanError("Not Found", "No athlete or staff record found for this code.");
        return;
      }


      if (config.mode === "attendance") {
        // Strict event ID check
        if (athlete.eventId !== config.eventId) {
          showScanError("Access Denied", "Athlete is registered for a different event.");
          return;
        }

        const isZoneLocked = !!config.zone;
        
        // Zone Validation (if locked)
        if (isZoneLocked) {
          const rawZones = athlete.zoneCode || athlete.zone_code || "";
          const athleteZones = String(rawZones).split(",").map(z => z.trim());
          const hasAccess = athleteZones.includes("∞") || athleteZones.includes(config.zone);
          
          if (!hasAccess) {
            showScanError("Access Denied", `You do not have permission for ${config.deviceLabel || 'this zone'}.`);
            
            // Log security event (failed zone access)
            AttendanceAPI.logScanEvent({
              eventId: config.eventId,
              athleteId: athlete.id,
              scanMode: "zone_denied",
              deviceLabel: config.deviceLabel || `Zone-${config.zone}`
            });
            return;
          }

          // --- TIME BASED ACCESS ENFORCEMENT ---
          if (activeZoneConfig?.settings?.accessMode === "time_restricted") {
            const slots = activeZoneConfig.settings.timeSlots || [];
            const now = new Date();
            const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            
            const isAllowed = slots.some(slot => {
              return currentTimeStr >= slot.start && currentTimeStr <= slot.end;
            });

            if (!isAllowed) {
              showScanError("Access Denied", "Outside of allowed time slots for this zone.");
              return;
            }
          }
        }

        const recordRes = await AttendanceAPI.recordScan({
          eventId: config.eventId,
          athleteId: athlete.id,
          clubName: athlete.club,
          scannerLocation: config.deviceLabel || "Gate Scanner",
          sessionId: activeSession?.id || null,
          zoneOnly: isZoneLocked
        });

        setLastScanResult({
          type: "athlete_entry",
          status: recordRes.status,
          athlete,
          message: isZoneLocked ? "Zone Access Granted" : recordRes.message,
          sessionName: activeSession?.session_name || null
        });

        // AUDIT LOG
        AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          athleteId: athlete.id,
          scanMode: isZoneLocked ? "zone_access" : "attendance",
          deviceLabel: config.deviceLabel,
          sessionId: activeSession?.id || null
        });

        // Play entry success sound
        audioService.playSuccessEntry();

        // SUPER-FAST AUTO-RESUME: 8.0s for High-Traffic Gates (Adjusted per user request)
        resultTimerRef.current = setTimeout(resumeScanner, 8000);

      } else {
        // INFO OR VERIFY MODE
        let competitionData = [];
        let eSettings = {};
        let gSettings = {};
        let msgs = [];

        try {
          const [matrix, eventSets, globSets, athleteMsgs] = await Promise.all([
            AthleteEventsAPI.getForAthlete(athlete.id),
            EventSettingsAPI.getAll(athlete.eventId),
            GlobalSettingsAPI.getAll(),
            BroadcastV2API.getForAthlete(athlete.eventId, athlete.id)
          ]);
          competitionData = matrix || [];
          eSettings = eventSets || {};
          gSettings = globSets || {};
          msgs = athleteMsgs || [];
        } catch (err) {
          console.warn("Failed to load extended profile data:", err);
        }

        setLastScanResult({
          type: config.mode === "verify" ? "athlete_verify" : "athlete_info",
          status: "info",
          athlete,
          competitionData,
          eventSettings: eSettings,
          globalSettings: gSettings,
          messages: msgs,
          message: config.mode === "verify" ? "Accreditation Verified" : "Profile Loaded"
        });

        // Auto-resume after 50s for the next athlete (Self-Service Hub)
        if (config.mode === "info") {
          resultTimerRef.current = setTimeout(resumeScanner, 50000);
        }

        // AUDIT LOG (Silent)
        AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          athleteId: athlete.id,
          scanMode: config.mode,
          deviceLabel: config.deviceLabel
        });
      }

    } catch (err) {
      console.error(err);
      showScanError("System Error", "Connection failed during scan.");
    } finally {
      setProcessing(false);
      // Wait a tiny bit more than the DB roundrip before allowing the next hardware hit
      setTimeout(() => {
        isCurrentlyProcessing.current = false;
      }, 300);
    }
  };

  const showScanError = (title, message) => {
    setLastScanResult({ status: "error", title, message });
    // Play access denied sound (multiple beeps)
    audioService.playAccessDenied();
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(resumeScanner, 8000);
  };

  const handleRedeem = async (count, scanOrder = null, scanTicket = null) => {
    const order = scanOrder || lastScanResult?.order;
    const ticket = scanTicket || lastScanResult?.specificTicket;

    if (!order) return;
    setProcessing(true);

    try {
      const ticketId = ticket?.id || null;
      console.log(`Attempting redemption: Order ${order.id}, Count ${count}, Ticket ${ticketId}`);

      const updated = await TicketingAPI.redeemTickets(order.id, count, ticketId);

      if (updated) {
        console.warn(`SCAN SUCCESS: Order ${order.id} updated successfully.`);
        toast.success(`Check-in Successful: ${order.customer_name}`);
        // Zero-Touch: Immediately resume for the next person
        resumeScanner();
      } else {
        toast.error("Database update failed. Check connection.");
        setProcessing(false);
      }
    } catch (err) {
      console.error("Redeem Error:", err);
      toast.error(err.message);
      setProcessing(false);
    }
  };

  const resumeScanner = () => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    setLastScanResult(null);
    setProcessing(false);
    isCurrentlyProcessing.current = false;
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
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-300 relative overflow-hidden ${flash ? 'bg-emerald-500/50' : 'bg-[#020617]'}`}>

      {/* Premium Water Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-50">
        {/* Deep Gradient Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#051124] to-[#0a192f]" />

        {/* Animated Water Ripples (SVG Filter) */}
        <div className="absolute inset-0 opacity-20 mix-blend-screen"
          style={{
            filter: 'url(#water-ripples)',
            background: 'radial-gradient(circle at 50% 50%, #3b82f6 0%, transparent 70%)',
            transform: 'scale(1.5)'
          }}
        />

        {/* Ambient Light Rays */}
        <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-blue-400/5 to-transparent skew-x-[-20deg] blur-3xl animate-pulse" />
        <div className="absolute top-0 right-1/4 w-1/3 h-full bg-gradient-to-b from-cyan-400/5 to-transparent skew-x-[15deg] blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* SVG Filters Definition (Hidden) */}
      <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden">
        <filter id="water-ripples">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.015" numOctaves="3" seed="2" result="noise">
            <animate attributeName="baseFrequency" dur="30s" values="0.01 0.015; 0.015 0.02; 0.01 0.015" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* Header */}
      <header className="bg-white/5 border-b border-white/10 p-6 flex items-center justify-between backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
            {config.mode === 'attendance' ? <Users className="text-emerald-400" /> :
              config.mode === 'spectator' ? <Ticket className="text-blue-400" /> :
                config.mode === 'spectator_exit' ? <LogOut className="text-red-400" /> :
                  <Info className="text-purple-400" />}
          </div>
          <div>
            <h1 className="text-white font-black uppercase tracking-[0.2em] text-sm">
              {config.mode === 'attendance' ? 'Athletes Entry Gate' :
                config.mode === 'spectator' ? 'Spectators Entry' :
                  config.mode === 'spectator_exit' ? 'Spectator Exit' :
                    config.mode === 'verify' ? 'Verify Accreditation' :
                      'Athlete Hub'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{config.deviceLabel}</p>
              {activeZoneConfig?.settings?.accessMode === "time_restricted" && (
                <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-black text-amber-400 uppercase tracking-tighter animate-pulse">
                  <Clock className="w-2 h-2" />
                  Time-Restricted Active
                </div>
              )}
            </div>
          </div>
        </div>
        {!isPublic && <button onClick={logout} className="text-white/40 hover:text-red-400 p-2 transition-colors"><LogOut /></button>}
      </header>

      {/* Main Scan View */}
      <main className="flex-1 relative flex flex-col pt-4 overflow-hidden">
        {!lastScanResult ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/4 -left-20 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />

            {/* Premium 3D Scanner Container */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-sm aspect-square bg-[#0a1120]/40 border border-white/10 rounded-[4rem] relative flex items-center justify-center overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl ring-1 ring-white/10"
            >
              <div id="qr-reader" ref={qrRef} className="absolute inset-0 w-full h-full [&>video]:object-cover" />

              {/* Unified Static State (When NOT Scanning) */}
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-md z-30 p-8 text-center bg-gradient-to-t from-[#020617] to-transparent">
                  <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <motion.div
                      animate={{
                        scale: [1, 1.02, 1],
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="w-48 h-48 bg-blue-500/5 rounded-[30px] border border-white/10 flex items-center justify-center mx-auto mb-6 relative backdrop-blur-md shadow-2xl overflow-hidden"
                    >
                      <img 
                        src="/scan-instruction.png" 
                        alt="Scan Instruction" 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent pointer-events-none" />
                    </motion.div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight mb-2 drop-shadow-md">
                      {isPublic ? "Scan Badge" : "SCAN ME"}
                    </h2>
                  </div>
                  {/* Corner Camera Trigger */}
                  <div className="absolute top-6 right-6 z-50">
                    <button
                      onClick={() => startScanner(true)}
                      className="p-4 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 rounded-2xl text-blue-400 hover:text-white transition-all shadow-xl backdrop-blur-md group"
                      title="Activate Mobile Camera"
                    >
                      <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  {/* Hardware Scanner Hint */}
                  <div className="w-full pb-8">
                    <p className="text-white/20 text-[9px] uppercase tracking-widest">
                      Hardware barcode scanner linked
                    </p>
                  </div>
                </div>
              )}

              {scanning && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent pointer-events-none opacity-40 z-10" />
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.8)] animate-scan-line z-20" />
                  <div className="absolute inset-0 border-[40px] border-[#0a1120]/60 pointer-events-none z-10" />
                  <div className="absolute inset-[40px] border-2 border-white/20 rounded-[2.5rem] pointer-events-none z-10" />
                  
                  {/* Provide way to close the camera and go back to physical scanner mode */}
                  <button
                    onClick={() => stopScanner()}
                    className="absolute top-6 right-6 p-3 bg-red-600/80 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-all shadow-xl z-50 flex items-center justify-center"
                  >
                    <LogOut className="w-4 h-4 ml-0.5" />
                  </button>
                </>
              )}
            </motion.div>

            {/* Dynamic Quote Section */}
            <div className="w-full max-w-lg text-center px-4 min-h-[100px] flex flex-col items-center justify-center relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuoteIndex}
                  initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(5px)" }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="space-y-4"
                >
                  <p className="text-lg md:text-xl font-medium text-white/70 italic leading-relaxed tracking-tight max-w-md mx-auto">
                    "{INSPIRATIONAL_QUOTES[currentQuoteIndex].text}"
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400/60">
                    — {INSPIRATIONAL_QUOTES[currentQuoteIndex].author}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Refined Footer */}
            <div className="text-center space-y-6 pt-8 pb-12 w-full max-w-lg mx-auto">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-blue-500/5 backdrop-blur-xl border border-white/5 rounded-full shadow-lg shadow-black/20">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Hardware Link Active</span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-blue-500 rounded-full blur-xl"
                  />
                  <div className="relative w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <QrCode className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
                
                <motion.h2
                  animate={{
                    scale: [1, 1.02, 1],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-white font-black uppercase tracking-[0.3em] text-xl drop-shadow-2xl"
                >
                  Scan QR Code Below
                </motion.h2>
                
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-blue-400/40"
                >
                  <ChevronRight className="w-6 h-6 rotate-90" />
                </motion.div>
              </motion.div>
            </div>
          </div>
        ) : (
          <ResultView config={config} result={lastScanResult} onResume={resumeScanner} onRedeem={handleRedeem} isPublic={isPublic} />
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

function ResultView({ config, result, onResume, onRedeem, isPublic }) {
  if (result.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black">
        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
        <ShieldAlert className="w-32 h-32 text-red-500 mb-8 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]" />
        <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4 text-center">{result.title || "Access Denied"}</h2>
        <div className="px-8 py-4 bg-red-500/20 border border-red-500/40 rounded-2xl">
          <p className="text-red-200 text-xl font-bold text-center max-w-sm lowercase first-letter:uppercase">{result.message}</p>
        </div>
        <button onClick={onResume} className="mt-12 px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-[0.3em] rounded-2xl transition-all border border-white/10">Skip and Resume</button>
      </div>
    );
  }

  // --- NEW V2.0 FULL-SCREEN SUCCESS OVERLAY ---
  if (result.type === 'spectator_success') {
    const isExit = result.status === 'exit';
    const bgColor = isExit ? 'bg-blue-600' : 'bg-emerald-600';
    const Icon = isExit ? LogOut : CheckCircle;

    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 ${bgColor} animate-in fade-in zoom-in duration-300`}>
        {/* Animated Background Rays */}
        <div className="absolute inset-0 opacity-20 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border-[40px] border-white/20 rounded-full animate-ping" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-40 h-40 bg-white/20 rounded-full flex items-center justify-center mb-10 border-4 border-white/40 shadow-2xl">
            <Icon className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
          </div>

          <h1 className="text-7xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-lg">
            {result.message || (isExit ? "Checked Out" : "Access Granted")}
          </h1>

          <div className="bg-black/20 backdrop-blur-md px-12 py-6 rounded-[2.5rem] border border-white/20 shadow-2xl">
            <p className="text-3xl font-black text-white uppercase tracking-wide">
              {result.order?.customer_name || "Spectator"}
            </p>
          </div>

          <p className="mt-8 text-white/60 font-bold uppercase tracking-[0.4em] text-sm animate-pulse italic">
            Scanning resuming in 8s...
          </p>
        </div>
      </div>
    );
  }

  const total = Number(result.order?.ticket_count || 0);
  const scanned = Number(result.order?.scanned_count || 0);
  const remaining = total - scanned;

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
              <p className="text-3xl font-black text-white">{total}</p>
            </div>
            <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1 block text-center">Already Scanned</span>
              <p className="text-3xl font-black text-emerald-400">{scanned}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            {remaining > 0 ? (
              <>
                <button onClick={() => onRedeem(1)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-900/40">Redeem Single</button>
                {remaining > 1 && (
                  <button onClick={() => onRedeem(remaining)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Redeem All ({remaining})</button>
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
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${result.status === 'success' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 border-4 ${result.status === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-amber-500/20 border-amber-500 text-amber-400'}`}>
          {result.status === 'success' ? <CheckCircle className="w-16 h-16 shadow-[0_0_40px_rgba(16,185,129,0.3)]" /> : <Clock className="w-16 h-16" />}
        </div>
        <h2 className={`text-4xl font-black uppercase tracking-tight mb-2 ${result.status === 'success' ? 'text-emerald-400 shadow-text' : 'text-amber-400'}`}>
          Access Granted
        </h2>

        {result.sessionName && (
          <div className="mt-2 px-4 py-1 bg-white/5 border border-white/10 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{result.sessionName}</span>
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-3xl font-black text-white uppercase">{result.athlete.firstName} {result.athlete.lastName}</p>
          <p className="text-blue-400 font-black uppercase tracking-[0.2em] mt-1">{result.athlete.club || "Independent"}</p>
        </div>
        <button onClick={onResume} className="mt-8 text-white/20 hover:text-white font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Ready for next
        </button>
      </div>
    );
  }

  if (result.type === 'athlete_info' || result.type === 'athlete_verify') {
    const { athlete, competitionData, eventSettings, globalSettings, messages } = result;
    const expiry = computeExpiryStatus(athlete);

    // Display ONLY securely matched events from the uploaded Heat Sheet (athlete_events database)
    const mergedEvents = React.useMemo(() => {
      if (!competitionData) return [];
      
      const matrixRows = [...competitionData];
      const grouped = {};
      
      // 1. Group by event_code to detect multi-round stages
      matrixRows.forEach(row => {
        const code = row.event_code || row.eventCode;
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(row);
      });

      const finalResults = [];
      Object.keys(grouped).forEach(code => {
        const rounds = grouped[code];
        const finalsWithResult = rounds.find(r => r.round === 'Finals' && (r.result_time || r.rank));
        const prelimsWithResult = rounds.find(r => r.round === 'Prelims' && (r.result_time || r.rank));
        const finalsNoResult = rounds.find(r => r.round === 'Finals');
        const prelimsNoResult = rounds.find(r => r.round === 'Prelims');

        let selected = finalsWithResult || prelimsWithResult || finalsNoResult || prelimsNoResult || rounds[0];
        const hasMultipleRounds = rounds.length > 1;
        const time = (selected.result_time || "").toLowerCase();
        const isQualified = time.includes('q');

        finalResults.push({
          ...selected,
          showRoundBadge: hasMultipleRounds,
          hideRank: selected.round === 'Prelims' && isQualified
        });
      });

      return finalResults.sort((a, b) => {
          const numA = parseInt(a.event_code || a.eventCode, 10);
          const numB = parseInt(b.event_code || b.eventCode, 10);
          if (isNaN(numA) && isNaN(numB)) return String(a.event_code || a.eventCode).localeCompare(String(b.event_code || b.eventCode));
          if (isNaN(numA)) return 1;
          if (isNaN(numB)) return -1;
          return numA - numB;
        });
    }, [competitionData]);

    // Status configuration matching VerifyAccreditation.jsx
    const statusConfig = (() => {
      if (athlete?.status === 'rejected') {
        return {
          label: 'Rejected',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          icon: <AlertCircle className="w-7 h-7 text-red-500" />,
          iconBg: 'bg-red-500/20'
        };
      }
      if (athlete?.status === 'pending') {
        return {
          label: 'Pending',
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          icon: <AlertCircle className="w-7 h-7 text-amber-500" />,
          iconBg: 'bg-amber-500/20'
        };
      }
      if (expiry.isExpired) {
        return {
          label: 'Expired',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          icon: <AlertCircle className="w-7 h-7 text-red-500" />,
          iconBg: 'bg-red-500/20'
        };
      }
      return {
        label: 'Valid',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        icon: <CheckCircle className="w-7 h-7 text-emerald-500" />,
        iconBg: 'bg-emerald-500/20'
      };
    })();

    return (
      <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-[#050b18]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl mx-auto space-y-4"
        >
          {/* Detailed Status Header (White BG as requested) */}
          <div className="w-full flex items-center justify-between px-6 py-4 rounded-3xl border backdrop-blur-md bg-white border-white/20 shadow-xl shadow-black/20">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`p-2.5 rounded-xl shadow-inner ${statusConfig.iconBg}`}>
                {statusConfig.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-black text-xl leading-none uppercase tracking-tighter ${statusConfig.color}`}>
                  {statusConfig.label} Accreditation
                </h3>
                <p className="text-gray-500 text-[10px] font-bold mt-1.5 uppercase tracking-tight leading-tight">
                  {athlete.events?.name || "Event Accreditation"}
                </p>
              </div>
            </div>
            {messages && messages.length > 0 && (
              <div className="p-2.5 bg-cyan-100 rounded-full">
                <Bell className="w-5 h-5 text-cyan-600" />
              </div>
            )}
          </div>

          {/* Premium White Badge Display */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-5">
                {/* Photo */}
                <div className="w-24 h-28 border-2 border-gray-200 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-blue-900 text-xl md:text-2xl uppercase leading-tight mb-1">
                    {athlete.firstName} {athlete.lastName}
                  </h3>
                  <p className="text-gray-600 text-xs font-bold uppercase tracking-tight">{athlete.club || "Independent"}</p>

                  <div className="flex items-center gap-2 mt-4 text-[10px] uppercase font-black text-gray-400 tracking-wider">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{athlete.role || "Athlete"}</span>
                    <span>•</span>
                    <span>{athlete.gender || "Gender"}</span>
                    {athlete.dateOfBirth && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 font-black">Age: {calculateAgeLocal(athlete.dateOfBirth)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ID and Flag row */}
              <div className="flex items-end justify-between pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">
                    <span className="text-gray-400">ID:</span> {athlete.accreditationId?.split("-")?.pop() || "---"}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">
                    <span className="text-gray-400">Badge:</span> {athlete.badgeNumber || "---"}
                  </p>
                </div>
                {athlete.nationality && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                    {getCountryFlag(athlete.nationality) && (
                      <img src={getCountryFlag(athlete.nationality)} alt="" className="w-8 h-5 rounded-sm shadow-sm object-cover" />
                    )}
                    <span className="text-xs font-black text-gray-900">{athlete.nationality}</span>
                  </div>
                )}
              </div>

              {/* Zones */}
              {athlete.zoneCode && (() => {
                const codes = athlete.zoneCode.split(",").map(z => z.trim()).filter(Boolean);
                return codes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {codes.map((code, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Competition Matrix within the card */}
            {mergedEvents && mergedEvents.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Competition Record</h4>
                </div>
                <div className="space-y-4">
                  {mergedEvents.map((ev, i) => {
                    let displayName = ev.event_name || "";
                    let eventRecords = null;
                    if (displayName.includes("|||RECORD_DATA|||")) {
                      const parts = displayName.split("|||RECORD_DATA|||");
                      displayName = parts[0].trim();
                      try { eventRecords = JSON.parse(parts[1].trim()); } catch (e) { }
                    }

                    // Record Logic matching VerifyAccreditation.jsx
                    let ageRecord = null;
                    if (eventRecords && eventRecords.length > 0) {
                      const athleteAge = calculateAgeLocal(athlete.dateOfBirth);
                      ageRecord = ageRecord = athleteAge ? eventRecords.find(r => r.age.includes("&") ? athleteAge >= parseInt(r.age, 10) : parseInt(r.age, 10) === athleteAge) : eventRecords[0];
                    }

                    const resTimeStr = (ev.result_time || "").trim().toUpperCase();
                    const isNonFinish = ['NS', 'DQ', 'SCR'].includes(resTimeStr);
                    const hasResult = ev.result_time || ev.rank;
                    const currentRank = ev.rank ? parseInt(ev.rank, 10) : null;
                    const isPodium = !isNonFinish && currentRank && currentRank <= 3 && currentRank > 0;

                    const podiumThemes = {
                      1: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-600', shadow: 'shadow-amber-500/5', medal: '🥇' },
                      2: { bg: 'bg-slate-400/5', border: 'border-slate-400/20', text: 'text-slate-500', shadow: 'shadow-slate-400/5', medal: '🥈' },
                      3: { bg: 'bg-orange-700/5', border: 'border-orange-700/20', text: 'text-orange-900', shadow: 'shadow-orange-700/5', medal: '🥉' }
                    };

                    const podiumConfig = (isPodium && currentRank && podiumThemes[currentRank]) ? podiumThemes[currentRank] : { bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-800' };

                    return (
                      <div key={i} className={`flex flex-col p-4 rounded-3xl border transition-all duration-300 relative overflow-hidden ${podiumConfig.bg} ${podiumConfig.border} shadow-sm hover:scale-[1.01]`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="shrink-0 bg-slate-900 text-white font-black text-[10px] w-10 h-6 flex items-center justify-center rounded-lg shadow-lg">
                            {ev.event_code || ev.eventCode}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-black leading-tight block uppercase ${isPodium ? podiumConfig.text : 'text-slate-800'}`}>
                              {displayName}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                            {!hasResult ? (
                              <div className="text-xs font-black text-blue-600 uppercase">
                                {(ev.heat || ev.lane) ? `H${ev.heat} / L${ev.lane}` : "Scheduled"}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-black tabular-nums ${isNonFinish ? 'text-red-500' : 'text-emerald-600'}`}>
                                  {ev.result_time}
                                </span>
                                {ev.seed_time && ev.seed_time !== "NT" && (() => {
                                  const diffData = formatTimeDiff(ev.result_time, ev.seed_time);
                                  return diffData ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${diffData.isFaster ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {diffData.text}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                              {!hasResult ? "Seed" : "Rank"}
                            </span>
                            {!hasResult ? (
                              <div className="text-xs font-black text-slate-700 tabular-nums">
                                {ev.seed_time || "NT"}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {ev.hideRank ? (
                                  <span className="text-sm font-black text-blue-600 uppercase">Qualified (Q)</span>
                                ) : (
                                  <>
                                    {isPodium && <span className="text-lg leading-none">{podiumConfig.medal}</span>}
                                    <span className={`text-sm font-black ${isPodium ? podiumConfig.text : 'text-slate-900'}`}>
                                      #{ev.rank}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {ageRecord && (
                          <div className="mt-3 pt-3 border-t border-slate-100/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3 h-3 text-indigo-400" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {ageRecord.acronym} <span className="text-indigo-600">{ageRecord.time}</span>
                              </span>
                            </div>
                            {ev.round && (
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${ev.round === 'Finals' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {ev.round}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Safety Documents Section (Only for Verification Mode) */}
          {(() => {
            const safetyDocsData = globalSettings?.[`event_${athlete.eventId}_safety_docs`];
            let safetyDocs = [];
            try {
              if (safetyDocsData) safetyDocs = JSON.parse(safetyDocsData);
            } catch (e) {
              console.error("Failed to parse safety docs", e);
            }

            if (safetyDocs.length === 0 || config.mode !== 'verify') return null;

            return (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 mb-4 px-2 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Safety & Emergency Assets</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {safetyDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => window.open(doc.url, '_blank')}
                      className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                          <FileText className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-white font-black uppercase text-[10px] break-all line-clamp-1" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-red-400/60 text-[8px] font-bold uppercase tracking-wider">
                            {doc.type} • {doc.size}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-500/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Messages / Broadcasts Section - HIDDEN as per user request (Only for VerifyAccreditation page) */}
          {false && messages && messages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Bell className="w-4 h-4 text-white/40" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Notices</h4>
              </div>
              {messages.map((m, i) => (
                <div key={i} className={`p-4 rounded-2xl border backdrop-blur-md ${m.type === 'athlete' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${m.type === 'athlete' ? 'bg-blue-500/20 text-blue-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                      {m.type === 'athlete' ? 'Personal Message' : 'Event Broadcast'}
                    </span>
                    <span className="text-[8px] text-white/30 font-bold">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white/80 text-xs font-medium leading-relaxed">{m.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4">
            <button onClick={onResume} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-3xl transition-all shadow-xl shadow-blue-900/40">Ready for Next Scan</button>
          </div>
        </motion.div>
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
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
