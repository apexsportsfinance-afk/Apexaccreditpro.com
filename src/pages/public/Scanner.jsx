import React, { useState, useEffect, useRef } from "react";
import { useHardwareScanner } from "../../hooks/useHardwareScanner";
import { useQrCamera } from "../../hooks/useQrCamera";
import { useScannerSessions } from "../../hooks/useScannerSessions";
import { verifyScannerPin, isServerScannerPinEnabled } from "../../lib/scannerPin";
import ResultView from "./scanner/ResultView";
import {
  Camera,
  Info,
  Lock,
  LogOut,
  Users,
  Ticket,
  ChevronRight,
  ChevronDown,
  ScanLine,
  Clock,
  QrCode
} from "lucide-react";
import { AccreditationsAPI, TicketingAPI, EventsAPI, ZonesAPI, MainScannerAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { EventSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI, HeatSheetMatrixAPI } from "../../lib/broadcastApi";
import { toast } from "sonner";
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


const processMessageText = (text, athlete) => {
  if (!text) return "";
  if (!athlete) return text;
  const fullName = `${athlete.firstName || ""} ${athlete.lastName || ""}`.trim() || athlete.firstName || "Participant";
  return text.replace(/\[FullName\]/g, fullName).replace(/\[Name\]/g, athlete.firstName || "Participant");
};

const playZoneMessage = (msgKey, athlete, fallbackText, fallbackVoice, activeZoneConfig) => {
  const settings = activeZoneConfig?.settings || {};
  const msg = settings.messages?.[msgKey];
  console.log("Playing message for", msgKey, "Text is:", msg?.text);
  
  if (settings.voiceEnabled !== false) {
    // Audio File Tier
    if (msg?.audioUrl) {
      audioService.playAudioUrl(msg.audioUrl);
    } 
    // TTS Voice Tier
    else if (msg?.voice) {
      const voiceText = processMessageText(msg.voice, athlete);
      audioService.speak(voiceText, settings.voiceSettings || {});
    } 
    // Default Voice Tier
    else if (fallbackVoice) {
      const voiceText = processMessageText(fallbackVoice, athlete);
      audioService.speak(voiceText, settings.voiceSettings || {});
    }
  }

  // Display Text Tier
  if (msg?.text) {
    return processMessageText(msg.text, athlete);
  }
  return fallbackText;
};

export default function ScannerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [validatingPin, setValidatingPin] = useState(false);
  const defaultPin = import.meta.env.VITE_SCANNER_PIN; // APX-SEC: Removed insecure "1234" fallback

  // Configuration from URL
  const [config, setConfig] = useState({
    mode: "attendance", // attendance | spectator | info | verify
    eventId: "",
    deviceLabel: "Main-Scanner",
    zone: "",
    source: ""
  });

  const [lastScanResult, setLastScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState(false); // SUCCESS FLASH feedback
  const qrRef = useRef(null);
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
      zone: params.get("zone") || "",
      source: params.get("source") || ""
    });

    // APX-SEC: Validate Auth Token safely without storing plaintext PIN
    const savedAuthRaw = localStorage.getItem("scanner_auth_token");
    let isSessionValid = false;
    
    if (savedAuthRaw) {
      try {
        const savedAuth = JSON.parse(savedAuthRaw);
        // Valid if it exists and hasn't expired (12-hour limit)
        if (savedAuth && savedAuth.authorized && savedAuth.expires > Date.now()) {
          isSessionValid = true;
        } else {
          localStorage.removeItem("scanner_auth_token");
        }
      } catch (e) {
        localStorage.removeItem("scanner_auth_token");
      }
    }

    // APX-SEC: URL PIN is ONLY accepted for explicitly public info kiosks. Gate scanners REJECT url pins.
    const isPublicInfoKiosk = modeParam === 'info' && publicParam;

    const grantKioskSession = () => {
      setAuthorized(true);
      localStorage.setItem("scanner_auth_token", JSON.stringify({
        authorized: true,
        expires: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
      }));
    };

    if (isSessionValid) {
      setAuthorized(true);
    } else if (isPublicInfoKiosk) {
      // Public self-service info kiosk: open access, no PIN. Athletes walk up to
      // the kiosk and scan their own badge to see their own heats/lanes — the
      // same info already public on their /verify QR page, so there is nothing
      // new to gate. (A PIN here only blocked walk-up self-service.)
      grantKioskSession();
    }

    // Register Service Worker for PWA "Install" support (Disabled)
  }, [defaultPin]);

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
          } else if (!config.zone && config.mode === "attendance") {
            const mainConfig = await MainScannerAPI.getConfig(config.eventId);
            if (mainConfig) {
              setActiveZoneConfig({
                code: "MAIN",
                name: "Main Gate",
                settings: mainConfig.settings,
                ignoreDuplicates: mainConfig.ignoreDuplicates
              });
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

  // Handle Auth PIN
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!pinInput) return;
    setValidatingPin(true);
    setPinError("");

    try {
      // PIN check goes through the scannerPin helper: server-side (timing-safe,
      // PIN never sent to the client) when VITE_SERVER_SCANNER_PIN is on, else
      // the original client-side comparison (event PIN + global fallback).
      const isValid = await verifyScannerPin(config.eventId, pinInput);

      if (isValid) {
        setAuthorized(true);
        // APX-SEC: Store expiring token instead of plaintext PIN
        localStorage.setItem("scanner_auth_token", JSON.stringify({
          authorized: true,
          expires: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
        }));
        setPinError("");
        // Initialize audio context on USER interaction
        audioService.init();
      } else {
        setPinError("Invalid PIN");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setPinError("Connection Error");
    } finally {
      setValidatingPin(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("scanner_auth_token");
    setAuthorized(false);
    stopScanner();
  };

  const lastProcessedToken = useRef("");
  const lastProcessedTime = useRef(0);

  const onScanSuccess = async (decodedText) => {
    if (processing || lastScanResult) return; // BLOCK IF ALREADY SHOWING RESULT

    let token = decodedText.trim();
    if (token.includes("/verify/")) {
      token = token.split("/verify/").pop();
    }

    const now = Date.now();
    // GUARD: Increase to 30s to prevent the "scaning mulbi time" loop
    if (token === lastProcessedToken.current && (now - lastProcessedTime.current) < 30000) {
      console.log("[Scanner] Guard active for token:", token);
      return;
    }

    setProcessing(true); // HARD LOCK IMMEDIATELY
    lastProcessedToken.current = token;
    lastProcessedTime.current = now;

    // Trigger SUCCESS FLASH
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    // Add Haptic Feedback
    if (navigator.vibrate) navigator.vibrate(200);

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

      resultTimerRef.current = setTimeout(resumeScanner, 3000);
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
            const evt = await EventsAPI.getById(order.event_id);
            if (evt) wrongEvent = evt.name;
          } catch (e) { }
          showScanError("Access Denied — Wrong Event", `This ticket is for "${wrongEvent}". (Scanner: ${scannerEventId.slice(-5)} vs Ticket: ${ticketEventId.slice(-5)})`);
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
            audioService.speak("Access Granted. Thank You.");
            resultTimerRef.current = setTimeout(resumeScanner, 3000);
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
            // APX-Fix: Even if security access is denied, we MUST record attendance 
            // if this is a clearance/medical zone so it shows as DONE on the profile.
            const isClearanceZone = ["X2", "Z3", "M4", "A1"].includes(targetZone) || activeZoneConfig?.settings?.isHidden;
            
            if (isClearanceZone) {
              console.log("[Scanner] Recording clearance attendance for zone:", targetZone);
              
              const recordRes = await AttendanceAPI.recordScan({
                eventId: config.eventId,
                athleteId: athlete.id,
                clubName: athlete.club,
                scannerLocation: targetZone, 
                zoneOnly: true
              });
              
              const isDuplicate = recordRes.isNew === false;
              let finalMessage = recordRes.status === "error" ? "Offline Record" : "Attendance Marked";
              
              if (isDuplicate) {
                audioService.beep(440, 200, 'sine', 0.2);
                finalMessage = playZoneMessage("secondScan", athlete, "Already Attended", "Already Attended", activeZoneConfig);
              } else {
                audioService.playSuccessEntry();
                finalMessage = playZoneMessage("firstScan", athlete, finalMessage, "Welcome [FullName]", activeZoneConfig);
              }

              setLastScanResult({
                type: "athlete_entry",
                status: "success",
                athlete,
                message: finalMessage,
                sessionName: activeSession?.session_name || null
              });
              
              resultTimerRef.current = setTimeout(resumeScanner, 3000);
              return;
            }

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

          // --- CHECK-IN / CHECK-OUT TRACKING ---
          // DEFAULT: All zone scanners use check-in/out UNLESS explicitly set to "general" or "time_restricted"
          const zoneAccessMode = activeZoneConfig?.settings?.accessMode || "check_in_out";
          if (zoneAccessMode === "check_in_out") {
            try {
              // --- SMART TOGGLE LOGIC (Local Persistence) ---
              // Since public scanners often cannot READ logs due to RLS security, 
              // we use the local device's memory to track the last state.
              const storageKey = `presence_${config.eventId}_${athlete.id}_${config.zone}`;
              const lastState = localStorage.getItem(storageKey); // "IN" or "OUT"
              
              const isCheckingIn = lastState !== "IN"; // If never scanned or last was OUT, we are checking IN
              const nextMode = isCheckingIn ? "zone_check_in" : "zone_check_out";

              // 1. Log to the audit ledger (This always works)
              await AttendanceAPI.logScanEvent({
                eventId: config.eventId,
                athleteId: athlete.id,
                scanMode: nextMode,
                deviceLabel: config.deviceLabel,
                sessionId: activeSession?.id || null
              });

              // 2. Save the NEW state to local memory for the next scan
              localStorage.setItem(storageKey, isCheckingIn ? "IN" : "OUT");

              // 3. Silently update attendance table (But catch errors properly for logs)
              const recordRes = await AttendanceAPI.recordScan({
                eventId: config.eventId,
                athleteId: athlete.id,
                clubName: athlete.club,
                scannerLocation: config.zone ? String(config.zone).toUpperCase() : config.deviceLabel, 
                zoneOnly: true
              });
              
              if (recordRes.status === "error") {
                console.error("[Scanner] Failed to sync scan:", recordRes.message);
              }

              setLastScanResult({
                type: "athlete_entry",
                status: isCheckingIn ? "success" : "info",
                athlete,
                message: `${isCheckingIn ? "Check-In" : "Check-Out"} Successful`,
                sessionName: activeSession?.session_name || null
              });

              // Play appropriate sound and voice
              if (isCheckingIn) {
                audioService.playSuccessEntry();
                audioService.speak(`Check-In. Welcome ${athlete.firstName}`);
              } else {
                audioService.playSuccessExit();
                audioService.speak(`Check-Out. Goodbye ${athlete.firstName}`);
              }
            } catch (err) {
              console.error("Zone tracking failed:", err);
              setLastScanResult({
                type: "athlete_entry",
                status: "error",
                athlete,
                message: "System Error",
                sessionName: activeSession?.session_name || null
              });
            }

            // AUTO-RESUME
            resultTimerRef.current = setTimeout(resumeScanner, 3000);
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
              scannerLocation: `${activeZoneConfig?.name || config.deviceLabel || `Zone-${config.zone}`}${slotSuffix}`,
              sessionId: activeSession?.id || null,
              zoneOnly: true,
              scanMode: activeZoneConfig?.settings?.scanMode || "daily"
            });

            const isDuplicate = recordRes.isNew === false;
            let finalMessage = isDuplicate ? "Already Attended" : "Attendance Marked";

            const isTrulyNew = !isDuplicate || recordRes.isNewLocation;
            
            if (isTrulyNew) {
              audioService.playSuccessEntry();
              finalMessage = playZoneMessage("firstScan", athlete, finalMessage, "Welcome [FullName]", activeZoneConfig);
            } else {
              audioService.beep(440, 200, 'sine', 0.2); 
              finalMessage = playZoneMessage("secondScan", athlete, finalMessage, "Already Attended", activeZoneConfig);
            }

            setLastScanResult({
              type: "athlete_entry",
              status: recordRes.status,
              athlete,
              message: finalMessage,
              sessionName: activeSession?.session_name || null,
              isPermanentCompletion: recordRes.isNew === false && (activeZoneConfig?.settings?.scanMode === 'permanent' || activeZoneConfig?.settings?.isHidden)
            });

            // AUDIT LOG
            AttendanceAPI.logScanEvent({
              eventId: config.eventId,
              athleteId: athlete.id,
              scanMode: "zone_attendance",
              deviceLabel: config.deviceLabel,
              sessionId: activeSession?.id || null
            });

            // AUTO-RESUME
            resultTimerRef.current = setTimeout(resumeScanner, 3000);
            return; // EXIT early so standard general access logic doesn't run
          }
        }

        // --- STANDARD ACCESS LOGIC (General Zones) ---
        const recordRes = await AttendanceAPI.recordScan({
          eventId: config.eventId,
          athleteId: athlete.id,
          clubName: athlete.club,
          scannerLocation: activeZoneConfig?.name || (config.zone ? `Zone-${config.zone}` : (config.deviceLabel || "Gate Scanner")),
          sessionId: activeSession?.id || null,
          zoneOnly: isZoneLocked,
          scanMode: activeZoneConfig?.settings?.scanMode || "daily",
          ignoreDuplicates: activeZoneConfig?.ignoreDuplicates === true
        });

        const isDuplicate = recordRes.isNew === false;
        let finalMessage = recordRes.message;
        if (isZoneLocked && recordRes.isNew) {
          finalMessage = "Zone Access Granted";
        } else if (isDuplicate) {
          finalMessage = "Already Attended";
        }

        const isApproved = athlete.status === 'approved';
        const isFlagged = athlete.status === 'rejected' || athlete.status === 'suspended' || athlete.status === 'pending';

        if (isFlagged) {
          audioService.playAccessDenied();
          finalMessage = playZoneMessage("accessDenied", athlete, finalMessage, "Access Denied", activeZoneConfig);
        } else {
          if (isDuplicate) {
            audioService.beep(440, 200, 'sine', 0.2); 
            finalMessage = playZoneMessage("secondScan", athlete, finalMessage, "Already Attended", activeZoneConfig);
          } else {
            audioService.playSuccessEntry();
            finalMessage = playZoneMessage("firstScan", athlete, finalMessage, "Welcome [FullName]", activeZoneConfig);
          }
        }

        setLastScanResult({
          type: "athlete_entry",
          status: recordRes.status,
          athlete,
          message: finalMessage,
          sessionName: activeSession?.session_name || null,
          isPermanentCompletion: isDuplicate && (activeZoneConfig?.settings?.scanMode === 'permanent' || activeZoneConfig?.settings?.isHidden)
        });

        // AUDIT LOG
        if (!recordRes.ignoredDuplicate) {
          AttendanceAPI.logScanEvent({
            eventId: config.eventId,
            athleteId: athlete.id,
            scanMode: isZoneLocked ? "zone_access" : "attendance",
            deviceLabel: config.deviceLabel,
            sessionId: activeSession?.id || null
          });
        }

        // SUPER-FAST AUTO-RESUME: 8.0s for High-Traffic Gates (Adjusted per user request)
        resultTimerRef.current = setTimeout(resumeScanner, 3000);

      } else {
        // INFO OR VERIFY MODE
        let competitionData = [];
        let eSettings = {};
        let gSettings = {};
        let msgs = [];
        let finalZones = [];

        try {
          // AccreditationsAPI returns camelCase objects, so we use mapped properties
          const aid = athlete.id;
          const eid = athlete.eventId;
          const fname = athlete.firstName;
          const lname = athlete.lastName;

          const shortId = athlete.accreditationId?.includes('-') ? athlete.accreditationId.split('-').pop() : athlete.accreditationId;

          const [matrixById, matrixByAcc, matrixByShort, legacyMatrix, eventSets, globSets, athleteMsgs, zonesData] = await Promise.all([
            AthleteEventsAPI.getForAthlete(aid),
            athlete.accreditationId ? AthleteEventsAPI.getForAthlete(athlete.accreditationId) : Promise.resolve([]),
            shortId ? AthleteEventsAPI.getForAthlete(shortId) : Promise.resolve([]),
            HeatSheetMatrixAPI.getForAthlete(eid, fname, lname),
            EventSettingsAPI.getAll(eid),
            GlobalSettingsAPI.getAll(),
            BroadcastV2API.getForAthlete(eid, aid),
            ZonesAPI.getByEventId(eid)
          ]);

          // Combine modern events (De-duplicate by unique ID only to ensure no rounds are lost)
          const allModern = [...(matrixById || [])];
          const combinedModernPool = [...(matrixByAcc || []), ...(matrixByShort || [])];
          
          combinedModernPool.forEach(m => {
            if (!allModern.some(ex => ex.id === m.id)) {
              allModern.push(m);
            }
          });

          // Merge modern and legacy data to ensure no missing events and enrich Heat/Lane info
          const combined = [...allModern];
          (legacyMatrix || []).forEach(leg => {
             // Try to find a modern record to enrich (match by code and round)
             const legRound = String(leg.round || 'Finals').toLowerCase();
             const existing = combined.find(m => 
                String(m.event_code) === String(leg.event_code) && 
                String(m.round || 'Finals').toLowerCase() === legRound
             );

             if (existing) {
                // Enrich existing modern record with legacy Heat/Lane if modern is missing them
                if (!existing.heat) existing.heat = leg.heat;
                if (!existing.lane) existing.lane = leg.lane;
                if (!existing.result_time) existing.result_time = leg.result_time;
                if (!existing.rank) existing.rank = leg.rank;
             } else {
                // This is a unique legacy record not found in modern tables, add it
                combined.push({
                   event_code: leg.event_code,
                   event_name: leg.event_name,
                   round: leg.round || 'Finals',
                   heat: leg.heat,
                   lane: leg.lane,
                   rank: leg.rank,
                   result_time: leg.result_time
                });
             }
          });

          competitionData = combined.sort((a, b) => {
            const numA = parseInt(a.event_code, 10);
            const numB = parseInt(b.event_code, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.event_code).localeCompare(String(b.event_code));
          });
          eSettings = eventSets || {};
          gSettings = globSets || {};
          msgs = athleteMsgs || [];
          // Use the fetched zonesData for the result
          finalZones = zonesData || [];
        } catch (err) {
          console.warn("Failed to load extended profile data:", err);
        }

        // The athlete object is already mapped by AccreditationsAPI
        const mappedAthlete = { ...athlete };

        setLastScanResult({
          type: config.mode === "verify" ? "athlete_verify" : "athlete_info",
          status: "info",
          athlete: mappedAthlete,
          competitionData,
          eventSettings: eSettings,
          globalSettings: gSettings,
          messages: msgs,
          zones: finalZones,
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
          resultTimerRef.current = setTimeout(resumeScanner, 20000);
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

  // --- MODULAR HOOKS INTEGRATION ---
  
  // 1. Manage scheduling sessions and live active slot calculations
  const { sessions, activeSession } = useScannerSessions(config.eventId, config.mode);

  // 2. Manage HTML5Qrcode camera lifecycle, video streams, and audio init
  const { scanning, cameraError, setCameraError, startScanner, stopScanner } = useQrCamera(qrRef, onScanSuccess);

  // 3. Bind Magellan 900i global barcode wedge listener with character buffering
  useHardwareScanner(authorized, onScanSuccess);

  const showScanError = (title, message) => {
    // Add Haptic Feedback for Error
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setLastScanResult({ status: "error", title, message });
    // Play access denied sound (multiple beeps)
    audioService.playAccessDenied();
    audioService.speak("Access Denied.");
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(resumeScanner, 4000);
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
            <button 
              disabled={validatingPin}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40"
            >
              {validatingPin ? "Verifying..." : "Unlock Terminal"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-300 relative overflow-hidden ${flash ? 'bg-emerald-500/50' : 'bg-[#020617]'}`}>
      {config.source === "staff" && !scanning && !lastScanResult && (
        <a 
          href="/staff/dashboard"
          className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white font-bold uppercase tracking-wider text-xs transition-colors backdrop-blur-md shadow-lg"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Staff App
        </a>
      )}

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
              {config.mode === 'attendance' ? 'Athlete Entry Gate' :
                config.mode === 'spectator' ? 'Spectator Entry' :
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
                    {/* Elegant animated scan emblem */}
                    <div className="relative mx-auto mb-7 flex items-center justify-center">
                      {/* Soft pulsing halo */}
                      <motion.div
                        animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-44 h-44 bg-cyan-400/30 rounded-full blur-2xl"
                      />
                      {/* Glass tile */}
                      <motion.div
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="relative w-36 h-36 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-cyan-400/20 overflow-hidden"
                      >
                        <ScanLine className="w-20 h-20 text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" strokeWidth={1.5} />
                        {/* Sweeping scan line */}
                        <motion.div
                          animate={{ y: ["-60px", "60px", "-60px"] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute left-4 right-4 h-[3px] rounded-full bg-cyan-300 shadow-[0_0_20px_4px_rgba(34,211,238,0.8)]"
                        />
                      </motion.div>
                    </div>

                    <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-tight mb-3 drop-shadow-md">
                      {isPublic ? "Scan Your Badge" : "SCAN ME"}
                    </h2>

                    {/* Blinking down arrow — directs the athlete to scan below */}
                    <motion.div
                      animate={{ y: [0, 10, 0], opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                      className="flex flex-col items-center -space-y-3 text-cyan-300"
                    >
                      <ChevronDown className="w-9 h-9 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]" strokeWidth={3} />
                      <ChevronDown className="w-9 h-9 opacity-60" strokeWidth={3} />
                    </motion.div>
                  </div>

                  {/* Hardware Scanner Hint */}
                  <div className="w-full pb-8">
                    <p className="text-white/25 text-[9px] uppercase tracking-widest">
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
                  className="text-white font-black uppercase tracking-widest text-xl drop-shadow-2xl"
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

            {/* Bottom Center Camera Trigger (One-Hand Mode) - Fixed to viewport */}
            {!scanning && (
              <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100]">
                <button
                  onClick={() => startScanner(true)}
                  className="flex items-center justify-center gap-3 px-8 py-5 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 rounded-full text-white transition-all shadow-[0_0_40px_rgba(37,99,235,0.6)] backdrop-blur-md group w-64"
                  title="Activate Mobile Camera"
                >
                  <Camera className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase tracking-widest text-lg">Scan Now</span>
                </button>
              </div>
            )}
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
