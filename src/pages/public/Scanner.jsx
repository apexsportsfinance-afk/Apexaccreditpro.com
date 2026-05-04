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
import { AccreditationsAPI, TicketingAPI, EventsAPI, ZonesAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { EventSettingsAPI, FormFieldSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";
import { toast } from "sonner";
import { getCountryFlag, calculateAge } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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
  const [allZones, setAllZones] = useState([]);

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

  // 3. Fetch Zone configuration for time-based rules and hidden zone filtering
  useEffect(() => {
    const fetchZoneConfig = async () => {
      if (config.eventId) {
        try {
          const zones = await ZonesAPI.getByEventId(config.eventId);
          setAllZones(zones || []);
          // Only look for active zone config in attendance mode with a zone code
          if (config.zone && config.mode === "attendance") {
            const currentZone = zones.find(z => String(z.code).toUpperCase() === String(config.zone).toUpperCase());
            if (currentZone) {
              setActiveZoneConfig(currentZone);
            }
          }
        } catch (err) {
          console.warn("Failed to load zone configuration:", err);
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
      audioService.speak("Access Granted. Welcome.");

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
            audioService.speak("Checkout Successful");
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
            audioService.speak("Access Granted. Welcome.");
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
          const athleteZones = String(rawZones).split(",").map(z => z.trim().toUpperCase());
          const targetZone = String(config.zone).trim().toUpperCase();
          const hasAccess = athleteZones.includes("∞") || athleteZones.includes(targetZone);
          
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
            
            // Find the SPECIFIC slot they are currently in
            const activeSlot = slots.find(slot => {
              return currentTimeStr >= slot.start && currentTimeStr <= slot.end;
            });

            if (!activeSlot) {
              showScanError("Access Denied", "Outside of allowed time slots for this zone.");
              return;
            }

            // [NEW] Logic for Time-Restricted Zones: Mark Attendance per Slot
            const slotSuffix = ` [${activeSlot.start}-${activeSlot.end}]`;
            const recordRes = await AttendanceAPI.recordScan({
              eventId: config.eventId,
              athleteId: athlete.id,
              clubName: athlete.club,
              scannerLocation: `${config.deviceLabel || `Zone-${config.zone}`}${slotSuffix}`,
              sessionId: activeSession?.id || null,
              zoneOnly: true
            });

            const isDuplicate = recordRes.message?.includes("Repeat Entry");
            const finalMessage = isDuplicate ? "Already Attended" : "Attendance Marked";

            setLastScanResult({
              type: "athlete_entry",
              status: recordRes.status,
              athlete,
              message: finalMessage,
              sessionName: activeSession?.session_name || null
            });

            // AUDIT LOG
            AttendanceAPI.logScanEvent({
              eventId: config.eventId,
              athleteId: athlete.id,
              scanMode: "zone_attendance",
              deviceLabel: config.deviceLabel,
              sessionId: activeSession?.id || null
            });

            // Play appropriate sound and voice
            if (isDuplicate) {
              audioService.beep(440, 200, 'sine', 0.2); // Softer double-beep for "Already"
              audioService.speak("Already Attended");
            } else {
              audioService.playSuccessEntry();
              audioService.speak("Attendance Marked");
            }

            // AUTO-RESUME
            resultTimerRef.current = setTimeout(resumeScanner, 8000);
            return; // EXIT early so standard general access logic doesn't run
          }
        }

        // --- STANDARD ACCESS LOGIC (General Zones) ---
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

        const isApproved = athlete.status === 'approved';
        const isFlagged = athlete.status === 'rejected' || athlete.status === 'suspended' || athlete.status === 'pending';

        if (isFlagged) {
          // Play access denied sound
          audioService.playAccessDenied();
          audioService.speak("Access Denied");
        } else {
          // Play entry success sound
          audioService.playSuccessEntry();
          audioService.speak(`Access Granted. Welcome ${athlete.firstName}`);
        }

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
          zones: allZones,
          message: config.mode === "verify" ? "Accreditation Verified" : "Profile Loaded"
        });

        const isFlagged = athlete.status === 'rejected' || athlete.status === 'suspended' || athlete.status === 'pending';
        
        if (isFlagged) {
          audioService.playAccessDenied();
          audioService.speak("Access Denied");
        } else {
          audioService.speak(config.mode === "verify" ? "Accreditation Verified" : "Profile Loaded");
        }

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
    audioService.speak("Access Denied.");
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
          <ResultView 
            config={config} 
            result={lastScanResult} 
            onResume={resumeScanner} 
            onRedeem={handleRedeem} 
            isPublic={isPublic} 
            zoneConfig={activeZoneConfig}
          />
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

function ResultView({ config, result, onResume, onRedeem, isPublic, zoneConfig }) {
  // Theme Helper: Map zone color or mode to a specific color palette
  const themeColor = zoneConfig?.color || (config.mode === 'spectator' ? '#3b82f6' : '#10b981');

  if (result.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black">
        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
        <ShieldAlert className="w-48 h-48 text-red-500 mb-8 drop-shadow-[0_0_40px_rgba(239,68,68,0.7)]" />
        <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-4 text-center">{result.title || "Access Denied"}</h2>
        <div className="px-12 py-6 bg-red-500/20 border border-red-500/40 rounded-[2.5rem]">
          <p className="text-red-200 text-2xl font-black text-center max-w-lg uppercase tracking-tight">{result.message}</p>
        </div>
        <button onClick={onResume} className="mt-16 px-12 py-6 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-[0.3em] rounded-3xl transition-all border border-white/10 text-xl">Skip and Resume</button>
      </div>
    );
  }

  // --- SPECTATOR SUCCESS HUD ---
  if (result.type === 'spectator_success') {
    const isExit = result.status === 'exit';
    const accentColor = isExit ? '#ef4444' : themeColor;
    const Icon = isExit ? LogOut : CheckCircle;

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black animate-in fade-in zoom-in duration-300">
        <div className="absolute inset-0 opacity-40 overflow-hidden pointer-events-none" style={{ backgroundColor: `${accentColor}20` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border-[60px] border-white/10 rounded-full animate-ping" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-3xl">
          <div className="w-56 h-56 rounded-full flex items-center justify-center mb-12 border-8 shadow-[0_0_80px_-10px_rgba(255,255,255,0.3)]" style={{ backgroundColor: `${accentColor}40`, borderColor: accentColor }}>
            <Icon className="w-32 h-32 text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]" />
          </div>

          <h1 className="text-8xl font-black text-white uppercase tracking-tighter mb-8 drop-shadow-2xl">
            {result.message || (isExit ? "Checked Out" : "Access Granted")}
          </h1>

          <div className="bg-white/10 backdrop-blur-2xl px-16 py-10 rounded-[4rem] border-2 shadow-2xl w-full" style={{ borderColor: `${accentColor}40` }}>
            <p className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-4">
              {result.order?.customer_name || "Spectator"}
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border" style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }}>
               <Ticket className="w-5 h-5 text-white" />
               <span className="text-xs font-black text-white uppercase tracking-[0.3em]">Valid Ticket</span>
            </div>
          </div>

          <p className="mt-12 text-white/40 font-black uppercase tracking-[0.5em] text-lg animate-pulse italic">
            Scanning resuming in 8s...
          </p>
        </div>
      </div>
    );
  }

  // --- ATHLETE ENTRY HUD ---
  if (result.type === 'athlete_entry') {
    const athlete = result.athlete;
    const isApproved = athlete.status === 'approved';
    const accentColor = isApproved ? themeColor : '#f59e0b';
    const isSuspended = athlete.status === 'suspended' || athlete.status === 'rejected';
    const isPending = athlete.status === 'pending';
    const isFlagged = isSuspended || isPending;

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black animate-in fade-in zoom-in duration-300">
        {isFlagged && (
           <div className={`absolute top-0 left-0 right-0 p-8 flex items-center justify-center gap-6 ${isSuspended ? 'bg-red-600' : 'bg-amber-600'} animate-bounce shadow-2xl z-50`}>
              <ShieldAlert className="w-12 h-12 text-white" />
              <div className="text-center">
                 <h2 className="text-3xl font-black text-white uppercase tracking-tighter">ALERT: {isSuspended ? 'SUSPENDED PROFILE' : 'PENDING APPROVAL'}</h2>
                 <p className="text-white/90 font-bold uppercase text-sm">REFER TO INFORMATION DESK IMMEDIATELY</p>
              </div>
           </div>
        )}

        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl">
          <div className="relative mb-12 group">
            <div className="relative w-72 h-72 rounded-full border-8 shadow-2xl overflow-hidden bg-gray-900 border-white/20" style={{ borderColor: isFlagged ? '#ef4444' : accentColor }}>
               {athlete.photoUrl ? (
                 <img src={athlete.photoUrl} alt="" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <User className="w-32 h-32 text-white/20" />
                 </div>
               )}
            </div>
            <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-10 py-3 rounded-full border-4 shadow-xl z-20 ${isFlagged ? 'bg-red-600 border-white' : 'bg-emerald-600 border-white'}`}>
               <span className="text-xl font-black text-white uppercase tracking-widest">{isFlagged ? athlete.status : 'ACCESS GRANTED'}</span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
             <h1 className="text-8xl font-black text-white uppercase tracking-tighter leading-none">
               {athlete.firstName}
             </h1>
             <h2 className="text-6xl font-black text-white/60 uppercase tracking-tighter leading-none mb-12">
               {athlete.lastName}
             </h2>
          </div>

          <div className="grid grid-cols-2 gap-6 w-full mt-12">
             <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-left">
                <span className="text-xs font-black text-white/30 uppercase tracking-[0.3em] block mb-2">Club / Team</span>
                <p className="text-3xl font-black text-white uppercase truncate">{athlete.club || "Independent"}</p>
             </div>
             <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-left">
                <span className="text-xs font-black text-white/30 uppercase tracking-[0.3em] block mb-2">Role & Zone</span>
                <p className="text-3xl font-black text-white uppercase">{athlete.role || "ATHLETE"} / {config.zone || "MAIN"}</p>
             </div>
          </div>

          <p className="mt-16 text-white/20 font-black uppercase tracking-[0.6em] text-sm animate-pulse">
            Next scan ready in 8s
          </p>
        </div>
      </div>
    );
  }

  // --- ATHLETE INFO/VERIFY HUD ---
  if (result.type === 'athlete_info' || result.type === 'athlete_verify') {
    const { athlete, competitionData } = result;
    const isSuspended = athlete.status === 'suspended' || athlete.status === 'rejected';
    const isPending = athlete.status === 'pending';
    const isFlagged = isSuspended || isPending;
    const accentColor = isFlagged ? '#ef4444' : (isPending ? '#f59e0b' : themeColor);

    return (
      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar bg-black">
        {isFlagged && (
           <div className={`mb-12 p-10 rounded-[3rem] flex items-center gap-10 ${isSuspended ? 'bg-red-600' : 'bg-amber-600'} shadow-2xl`}>
              <ShieldAlert className="w-24 h-24 text-white animate-pulse" />
              <div>
                 <h2 className="text-5xl font-black text-white uppercase tracking-tighter">FLAGGED PROFILE</h2>
                 <p className="text-white/80 font-bold uppercase text-xl leading-none mt-2">DO NOT ADMIT: {athlete.status.toUpperCase()}</p>
              </div>
           </div>
        )}

        <div className="max-w-4xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row items-center gap-12">
             <div className="w-64 h-80 rounded-[3rem] border-8 shadow-2xl overflow-hidden bg-white/5 border-white/10 shrink-0" style={{ borderColor: accentColor }}>
                {athlete.photoUrl ? (
                  <img src={athlete.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                     <User className="w-32 h-32 text-white/10" />
                  </div>
                )}
             </div>

             <div className="flex-1 text-center md:text-left space-y-4">
                <div className="inline-flex items-center gap-4 px-6 py-2 bg-white/5 rounded-full border border-white/10 mb-4">
                   <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                   <span className="text-xs font-black text-white uppercase tracking-[0.3em]">{athlete.role || "ATHLETE"} ID #{athlete.accreditationId?.split("-")?.pop() || "---"}</span>
                </div>
                <h1 className="text-8xl font-black text-white uppercase tracking-tighter leading-none">
                  {athlete.firstName}
                </h1>
                <h2 className="text-7xl font-black text-white/40 uppercase tracking-tighter leading-none">
                  {athlete.lastName}
                </h2>
                <div className="flex flex-wrap gap-4 mt-8">
                   <div className="px-5 py-2 bg-white/10 rounded-xl border border-white/10">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{athlete.club || "INDEPENDENT"}</span>
                   </div>
                   {athlete.nationality && (
                      <div className="px-5 py-2 bg-white/10 rounded-xl border border-white/10 flex items-center gap-2">
                        {getCountryFlag(athlete.nationality) && <img src={getCountryFlag(athlete.nationality)} className="w-6 h-4 rounded-sm" />}
                        <span className="text-xs font-black text-white uppercase tracking-widest">{athlete.nationality}</span>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {athlete.zoneCode && (() => {
            const visibleZoneCodes = athlete.zoneCode.split(",")
              .map(c => c.trim())
              .filter(code => {
                if (!code) return false;
                const zoneInfo = result.zones?.find?.(z => String(z.code) === code);
                return !zoneInfo?.settings?.isHidden;
              });
            return visibleZoneCodes.length > 0 ? (
               <div className="grid grid-cols-1 gap-4">
                  <span className="text-xs font-black text-white/20 uppercase tracking-[0.5em] text-center">Security Zone Authorization</span>
                  <div className="flex flex-wrap justify-center gap-4">
                     {visibleZoneCodes.map((code, i) => (
                        <div key={i} className="px-12 py-6 rounded-3xl border-4 bg-white/5 text-4xl font-black text-white uppercase tracking-tighter" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                           {code.trim()}
                        </div>
                     ))}
                  </div>
               </div>
            ) : null;
          })()}

          <div className="pt-20">
            <button onClick={onResume} className="w-full py-10 bg-blue-600 hover:bg-blue-500 text-white text-4xl font-black uppercase tracking-[0.2em] rounded-[3rem] transition-all shadow-[0_40px_80px_-20px_rgba(37,99,235,0.5)]">
              Proceed to Next Scan
            </button>
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
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
