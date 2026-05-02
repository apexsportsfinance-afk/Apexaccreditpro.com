import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle, XCircle, Download, Calendar,
  MessageSquare, Globe, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck,
  User, Hash, MapPin, Building, Cake, ExternalLink, Bell, X, Paperclip, FileText,
  Files, FileSpreadsheet, FileBox, ShieldAlert, ChevronRight, Trophy, Search, Medal as MedalIcon, Target,
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { EventSettingsAPI, FormFieldSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { ConfigAPI } from "../../lib/storage";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";
import { getCountryFlag, COUNTRIES, calculateAge, cn } from "../../lib/utils";
import { toast } from "sonner";
import { createPortal } from "react-dom";

// Helper function to calculate exact split time between PB and Record
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

const formatTimeDiff = (resultStr, seedStr) => {
  const resSec = parseTimeSeconds(resultStr);
  const seedSec = parseTimeSeconds(seedStr);
  if (resSec === null || seedSec === null || isNaN(resSec) || isNaN(seedSec)) return null;
  
  const diff = resSec - seedSec;
  const isFaster = diff < -0.001; 
  const isSlower = diff > 0.001;
  const absDiff = Math.abs(diff).toFixed(2);
  
  return {
    text: isFaster ? `-${absDiff}` : (isSlower ? `+${absDiff}` : "0.00"),
    isFaster: !isSlower // Consider neutral (0.00) as green for effort
  };
};

const formatDocName = (name) => {
  if (!name) return "";
  // 1. Remove .pdf extension case-insensitively
  let clean = name.replace(/\.pdf\s*$/i, '');
  // 2. Replace separators with spaces
  clean = clean.replace(/[_-]/g, ' ');
  // 3. Convert to Title Case
  return clean.split(' ').map(word => {
    if (!word) return "";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

export default function VerifyAccreditation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [eventSettings, setEventSettings] = useState({});
  const [fieldSettings, setFieldSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [athleteMatrix, setAthleteMatrix] = useState([]);

  const [messages, setMessages] = useState([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [globSettings, setGlobSettings] = useState({});
  const [liveMedals, setLiveMedals] = useState([]);
  const [showMedalsModal, setShowMedalsModal] = useState(false);
  const [selectedAgeCategory, setSelectedAgeCategory] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [medalsLoading, setMedalsLoading] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState(null);
  const [allZones, setAllZones] = useState([]);
  const [scannerResult, setScannerResult] = useState(null); // { status: "granted" | "denied", zoneName: string }
  
  // Get zone from URL
  const queryParams = new URLSearchParams(window.location.search);
  const targetZone = queryParams.get("zone");
  
  // Partition messages into three distinct categories
  const filteredMessages = React.useMemo(() => {
    const generalMessages = messages
      .filter(m => m.type === "global" && (!m.targetRoles || m.targetRoles.length === 0) && (!m.targetZones || m.targetZones.length === 0))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    const targetedMessages = messages
      .filter(m => m.type === "global" && ((m.targetRoles && m.targetRoles.length > 0) || (m.targetZones && m.targetZones.length > 0)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const personalMessages = messages
      .filter(m => m.type === "athlete")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    const allMessages = [...generalMessages, ...targetedMessages, ...personalMessages]
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    // Legacy fallback
    const fallbackMessage = generalMessages.length === 0 ? eventSettings["broadcast_message"] : null;
    
    return {
      generalMessages,
      targetedMessages,
      personalMessages,
      allMessages,
      fallbackMessage
    };
  }, [messages, eventSettings]);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  useEffect(() => {
    if (data?.event_id && data?.role) {
      loadMessages();
    }
  }, [data]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let accData, accErr;

      const fetchAccreditation = async () => {
        if (isUUID) {
          const { data: byAcc } = await supabase
            .from("accreditations")
            .select("*, events:event_id(id, name, slug, start_date, logo_url)")
            .eq("accreditation_id", id)
            .maybeSingle();
          if (byAcc) return { data: byAcc, error: null };
          
          return supabase
            .from("accreditations")
            .select("*, events:event_id(id, name, slug, start_date, logo_url)")
            .eq("id", id)
            .maybeSingle();
        }
        return supabase
          .from("accreditations")
          .select("*, events:event_id(id, name, slug, start_date, logo_url)")
          .eq("accreditation_id", id)
          .maybeSingle();
      };

      const { data: fetchedData, error: fetchedError } = await fetchAccreditation();
      accData = fetchedData;
      accErr = fetchedError;

      if (accErr) throw accErr;
      if (!accData) throw new Error("Accreditation not found");

      
      const [eSettings, fieldSets, matrix, gSettings, fConfig, feedbackIsActiveRaw, zonesResult] = await Promise.all([
        accData?.event_id
          ? EventSettingsAPI.getAll(accData.event_id)
          : Promise.resolve({}),
        accData?.event_id
          ? FormFieldSettingsAPI.getByEventId(accData.event_id)
          : Promise.resolve({}),
        accData?.id && accData?.role?.toLowerCase() === "athlete"
          ? AthleteEventsAPI.getForAthlete(accData.id)
          : Promise.resolve([]),
        GlobalSettingsAPI.getAll(),
        accData?.event_id
          ? ConfigAPI.getFeedback(accData.event_id)
          : Promise.resolve(null),
        accData?.event_id
          ? GlobalSettingsAPI.get(`event_${accData.event_id}_feedback_is_active`)
          : Promise.resolve(null),
        accData?.event_id
          ? supabase.from("zones").select("*").eq("event_id", accData.event_id)
          : Promise.resolve({ data: [] })
      ]);


      setData(accData);
      setEventSettings(eSettings);
      setFieldSettings(fieldSets || {});
      setAthleteMatrix(matrix || []);
      setGlobSettings(gSettings || {});
      setAllZones(zonesResult.data || []);
      // Merge is_active from GlobalSettings (stored separately, bypasses missing DB column)
      const feedbackIsActive = feedbackIsActiveRaw === 'true' || feedbackIsActiveRaw === true;
      setFeedbackConfig(fConfig ? { ...fConfig, is_active: feedbackIsActive } : null);


      // APX-P0: Transparent Self-Scan Logging
      if (accData?.event_id) {
        const scannerLocation = targetZone ? 
          (matrix.find(z => z.code === targetZone)?.name || `Zone ${targetZone}`) : 
          "Mobile-Self-Scan";

        // Zone Validation Logic
        if (targetZone) {
          const athleteZones = (accData.zone_code || "").split(",").map(z => z.trim());
          const hasAccess = athleteZones.includes("∞") || athleteZones.includes(targetZone);
          
          setScannerResult({ 
            status: hasAccess ? "granted" : "denied", 
            zoneName: scannerLocation 
          });

          // Log zone-specific attendance if granted
          if (hasAccess) {
             AttendanceAPI.recordScan({
              eventId: accData.event_id,
              athleteId: accData.id,
              clubName: accData.club,
              scannerLocation: scannerLocation,
              zoneOnly: true // Custom flag for API update
            }).catch(e => console.warn("Zone attendance record failed:", e));
          }
        }

        AttendanceAPI.logScanEvent({
          eventId: accData.event_id, 
          athleteId: accData.id,
          scanMode: targetZone ? "zone_access" : "athlete_verify", 
          deviceLabel: targetZone ? `Guard-Zone-${targetZone}` : "Mobile-Self-Scan"
        }).catch(e => console.warn("Self-scan log failed:", e));

        if (!targetZone) { // Only log main entrance if not in zone mode
          AttendanceAPI.recordScan({
            eventId: accData.event_id,
            athleteId: accData.id,
            clubName: accData.club,
            scannerLocation: "Mobile-Self-Scan"
          }).catch(e => console.warn("Self-attendance record failed:", e));
        }
      }
      
      if (accData?.events?.name) {
        setMedalsLoading(true);
        const compName = accData.events.name.trim().toLowerCase();
        const { data: mData } = await supabase
          .from("medal_results")
          .select("*")
          .ilike("competition", compName);
          
        if (mData && mData.length > 0) {
          const processed = mData.map(r => {
            const ageMatch = r.age_group.match(/^(\d+\s*&\s*Over|\d+\s*-\s*\d+|\d+\s*Year\s*Olds)/i);
            const ageCategory = ageMatch ? ageMatch[1] : r.age_group;
            return { ...r, ageCategory };
          });
          setLiveMedals(processed);
        }
        setMedalsLoading(false);
      }
    } catch (err) {
      console.error("Error loading accreditation data:", err);
      setError(err.message || "Accreditation not found");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      if (!data?.event_id || !data?.id) return;
      // Pass role and zone codes so targeted broadcasts are correctly filtered
      const athleteRole = data?.role || null;
      const athleteZones = data?.zone_code
        ? data.zone_code.split(",").map(z => z.trim()).filter(Boolean)
        : [];
      const msgs = await BroadcastV2API.getForAthlete(data.event_id, data.id, athleteRole, athleteZones);
      setMessages(msgs || []);
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      const unread = msgs?.filter(m => m.id && !readIds.includes(m.id)).length || 0;
      setUnreadTotal(unread);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    }
  };

  const recalculateUnread = () => {
    try {
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      const unread = messages.filter(m => m.id && !readIds.includes(m.id)).length;
      setUnreadTotal(unread);
    } catch (e) {
      setUnreadTotal(0);
    }
  };

  useEffect(() => {
    if (!loading && data) {
      recalculateUnread();
    }
  }, [filteredMessages.allMessages, loading, data]);

  const mergedEvents = React.useMemo(() => {
    if (!data) return [];
    
    const matrixRows = [...athleteMatrix];
    const grouped = {};
    
    matrixRows.forEach(row => {
      const code = row.event_code;
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
        const numA = parseInt(a.event_code, 10);
        const numB = parseInt(b.event_code, 10);
        if (isNaN(numA) && isNaN(numB)) return String(a.event_code).localeCompare(String(b.event_code));
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      });
  }, [athleteMatrix, data]);

  const markAllAsRead = () => {
    try {
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      let updated = false;
      messages.forEach(m => {
        if (m.id && !readIds.includes(m.id)) {
          readIds.push(m.id);
          updated = true;
        }
      });
      if (updated) localStorage.setItem('qr_read_msgs', JSON.stringify(readIds));
      setUnreadTotal(0);
      setShowMessagesModal(true);
    } catch (e) {}
  };

  const expiry = computeExpiryStatus(data);
  
  const statusConfig = React.useMemo(() => {
    if (data?.status === 'rejected') {
      return {
        label: 'Rejected',
        type: 'error',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/40',
        shadowColor: 'shadow-red-950/20',
        iconBg: 'bg-red-500/20',
        icon: <XCircle className="w-7 h-7 text-red-500" />
      };
    }
    if (data?.status === 'pending') {
      return {
        label: 'Pending',
        type: 'warning',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/40',
        shadowColor: 'shadow-amber-950/20',
        iconBg: 'bg-amber-500/20',
        icon: <AlertTriangle className="w-7 h-7 text-amber-500" />
      };
    }
    if (expiry.isExpired) {
      return {
        label: 'Expired',
        type: 'error',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/40',
        shadowColor: 'shadow-red-950/20',
        iconBg: 'bg-red-500/20',
        icon: <XCircle className="w-7 h-7 text-red-500" />
      };
    }
    return {
      label: 'Valid',
      type: 'success',
      color: 'text-emerald-400',
      bgColor: 'bg-[#10b981]/10',
      borderColor: 'border-[#10b981]/40',
      shadowColor: 'shadow-[#10b981]/20',
      iconBg: 'bg-[#10b981]/20',
      icon: <CheckCircle className="w-7 h-7 text-[#10b981]" />
    };
  }, [data?.status, expiry.isExpired]);

  const officialDocs = useMemo(() => {
    const eid = data?.event_id;
    if (!eid || !globSettings) return [];
    try {
      const json = globSettings[`event_${eid}_official_docs`];
      return json ? JSON.parse(json) : [];
    } catch (e) { return []; }
  }, [globSettings, data?.event_id]);
  
  const technicalDocs = useMemo(() => {
    const eid = data?.event_id;
    if (!eid || !globSettings) return [];
    try {
      const json = globSettings[`event_${eid}_technical_docs`];
      return json ? JSON.parse(json) : [];
    } catch (e) { return []; }
  }, [globSettings, data?.event_id]);

  const safetyDocs = useMemo(() => {
    const eid = data?.event_id;
    if (!eid || !globSettings) return [];
    try {
      const json = globSettings[`event_${eid}_safety_docs`];
      return json ? JSON.parse(json) : [];
    } catch (e) { return []; }
  }, [globSettings, data?.event_id]);

  const customFieldConfigs = useMemo(() => {
    const eid = data?.event_id;
    if (!eid || !globSettings) return [];
    try {
      const json = globSettings[`event_${eid}_custom_fields`];
      return json ? JSON.parse(json) : [];
    } catch (e) { return []; }
  }, [globSettings, data?.event_id]);

  const parsedCustomFields = useMemo(() => {
    if (!data?.custom_message) return {};
    try {
      return typeof data.custom_message === "string" 
        ? JSON.parse(data.custom_message) 
        : data.custom_message;
    } catch (e) {
      return {};
    }
  }, [data?.custom_message]);

  const showForQR = (key) => {
    const loc = fieldSettings[key] || "both";
    return loc === "both" || loc === "qr";
  };

  // APX-Fix: Unified Allocated Sports Logic for Filtering and Display
  const allocatedSports = useMemo(() => {
    if (!data) return [];
    
    // APX-Fix: Pull sports ONLY from selected_sports/selectedSports fields.
    // Do NOT pull zone names into the sports list as they are separate concepts.
    const selectedSports = Array.isArray(data.selected_sports) 
      ? data.selected_sports 
      : (Array.isArray(data.selectedSports) ? data.selectedSports : []);
    
    // De-duplicate and clean
    const combined = [];
    const seen = new Set();
    selectedSports.forEach(s => {
      if (!s) return;
      const normalized = s.trim().toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        combined.push(s.trim());
      }
    });
    return combined;
  }, [data]);

  // Filter Technical Documents based on Athlete's Allocated Sports
  const visibleTechnicalDocs = useMemo(() => {
    if (!technicalDocs) return [];
    return technicalDocs.filter(doc => {
      // If document is "General" or has no sport tag, show to everyone
      if (!doc.sport || doc.sport === "General") return true;
      
      // Check if the document's sport is in the athlete's allocated sports
      const normalizedDocSport = doc.sport.trim().toUpperCase();
      return allocatedSports.some(s => s.trim().toUpperCase() === normalizedDocSport);
    });
  }, [technicalDocs, allocatedSports]);

  // Filter Official Documents based on Athlete's Allocated Sports
  const visibleOfficialDocs = useMemo(() => {
    if (!officialDocs) return [];
    return officialDocs.filter(doc => {
      // If document is "General" or has no sport tag, show to everyone
      if (!doc.sport || doc.sport === "General") return true;
      
      // Check if the document's sport is in the athlete's allocated sports
      const normalizedDocSport = doc.sport.trim().toUpperCase();
      return allocatedSports.some(s => s.trim().toUpperCase() === normalizedDocSport);
    });
  }, [officialDocs, allocatedSports]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) return <ScanSkeleton />;
  if (error || !data) return <ScanError error={error} />;

  return (
    <div id="verify-accreditation-page" className="min-h-screen bg-[#050b18] text-slate-200 font-inter selection:bg-cyan-500/30">
      {/* Scanner Result Overlay */}
      <AnimatePresence>
        {scannerResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={cn(
                "w-full max-w-sm rounded-[3rem] p-10 text-center border-4 shadow-2xl overflow-hidden relative",
                scannerResult.status === "granted" 
                  ? "bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/20" 
                  : "bg-red-500/10 border-red-500/50 shadow-red-500/20"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3, ease: "linear" }}
                  className={scannerResult.status === "granted" ? "bg-emerald-500" : "bg-red-500"}
                  onAnimationComplete={() => setScannerResult(null)}
                />
              </div>

              <div className={cn(
                "w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg",
                scannerResult.status === "granted" ? "bg-emerald-500 shadow-emerald-500/40" : "bg-red-500 shadow-red-500/40"
              )}>
                {scannerResult.status === "granted" ? (
                  <CheckCircle className="w-14 h-14 text-white" />
                ) : (
                  <XCircle className="w-14 h-14 text-white" />
                )}
              </div>

              <h2 className={cn(
                "text-4xl font-black uppercase tracking-tighter mb-4",
                scannerResult.status === "granted" ? "text-emerald-400" : "text-red-400"
              )}>
                {scannerResult.status === "granted" ? "Access Granted" : "Access Denied"}
              </h2>
              
              <div className="bg-white/5 rounded-2xl py-3 px-6 mb-8 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Current Sector</p>
                <p className="text-xl font-bold text-white uppercase">{scannerResult.zoneName}</p>
              </div>

              <button 
                onClick={() => setScannerResult(null)}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs transition-all border border-white/10"
              >
                Continue to Profile
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Messages Modal */}
      <AnimatePresence>
        {showMessagesModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowMessagesModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0a1120] w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-xl"><Bell className="w-5 h-5 text-cyan-400" /></div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Event Messages</h2>
                </div>
                <button onClick={() => setShowMessagesModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-6 h-6 text-white/40" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {filteredMessages.allMessages.length > 0 ? (
                  filteredMessages.allMessages.map((m, i) => (
                    <motion.div
                      key={m.id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className={cn(
                        "p-5 rounded-2xl border backdrop-blur-md",
                        m.type === "athlete" 
                          ? "bg-indigo-500/5 border-indigo-500/20" 
                          : (m.targetRoles?.length > 0 || m.targetZones?.length > 0)
                            ? "bg-blue-500/5 border-blue-500/20"
                            : "bg-emerald-500/5 border-emerald-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                         <span className={cn(
                           "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                           m.type === "athlete" 
                             ? "bg-indigo-500/20 text-indigo-300"
                             : (m.targetRoles?.length > 0 || m.targetZones?.length > 0)
                               ? "bg-blue-500/20 text-blue-300"
                               : "bg-emerald-500/20 text-emerald-300"
                         )}>
                           {m.type === "athlete" ? "Personal" : (m.targetRoles?.length > 0 || m.targetZones?.length > 0 ? "Targeted" : "General")}
                         </span>
                         {m.createdAt && <span className="text-[10px] text-white/30 font-bold">{new Date(m.createdAt).toLocaleString()}</span>}
                      </div>
                      <p className="text-white/80 font-medium leading-relaxed whitespace-pre-wrap">{m.message}</p>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center opacity-20"><MessageSquare className="w-12 h-12 mb-2" /><p className="font-bold uppercase tracking-widest text-xs">No active messages</p></div>
                )}
              </div>
              <button 
                onClick={() => setShowMessagesModal(false)}
                className="w-full mt-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all"
              >
                Close Panel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants} initial="hidden" animate="visible"
        className="relative z-10 w-full max-w-4xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center shadow-inner"
      >
        {eventSettings["banner_url"] && (
          <motion.div variants={itemVariants} className="w-full mb-3 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-white/5">
            <img src={eventSettings["banner_url"]} alt="Event banner" className="w-full h-auto object-contain bg-gray-900" />
          </motion.div>
        )}

        {/* Header with Status Toggle (Updated for SS2 fidelity) */}
        {data.status === 'rejected' ? (
          <motion.div
            variants={itemVariants}
            className="w-full mb-6 flex items-center gap-5 px-8 py-7 rounded-[2rem] bg-indigo-950/30 shadow-2xl backdrop-blur-md border border-red-500/40"
          >
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-[3px] border-red-500 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500 stroke-[3.5px]" />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-3xl leading-none text-[#ff6b6b] uppercase tracking-tighter mb-2">
                Rejected
              </h1>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest leading-tight">
                {data.events?.name}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={itemVariants}
            className="w-full mb-4 px-4 py-4 rounded-[1.5rem] bg-white shadow-xl shadow-black/20"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                 </div>
                 <div className="flex flex-col">
                    <h3 className="font-black text-sm uppercase tracking-widest text-[#10b981] leading-tight">Valid Accreditation</h3>
                    <p className="text-[10px] font-black text-slate-900 uppercase leading-tight truncate max-w-[200px]">{data.events?.name}</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={markAllAsRead} className="relative p-2.5 bg-slate-50 border border-slate-100 rounded-xl transition-all">
                  <Bell className={`w-5 h-5 ${unreadTotal > 0 ? "text-blue-500" : "text-slate-400"}`} />
                  {unreadTotal > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-white">{unreadTotal}</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Rejection Remarks */}
        {data.status === 'rejected' && (data.remarks || data.rejection_remarks) && (
          <motion.div 
            variants={itemVariants} 
            className="w-full mb-8 p-6 bg-red-950/20 border-t border-b sm:border border-[#ff6b6b]/20 sm:rounded-3xl backdrop-blur-sm shadow-xl"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <MessageSquare className="w-5 h-5 text-[#ff6b6b]" />
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff6b6b]">
                Rejection Remarks
              </h4>
            </div>
            <p className="text-2xl font-black text-white tracking-tight leading-relaxed">
              "{data.remarks || data.rejection_remarks}"
            </p>
          </motion.div>
        )}

        {/* Identity Badge */}
        {data.status !== 'rejected' && showForQR("events") && (
          <motion.div
            variants={itemVariants}
            className="w-full relative"
          >
            <div className="bg-white rounded-[1.5rem] shadow-xl p-5 border border-slate-100 relative z-10">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-20 h-24 border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                      {data.photo_url ? (
                        <img src={data.photo_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-y-4 gap-x-6">
                      <div className="min-w-0">
                        <h2 className="font-extrabold text-xl text-[#2D4A9E] leading-tight mb-0.5">{data.first_name} {data.last_name}</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide mb-2">{data.club || "Individual Participant"}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded-md uppercase">{data.role}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded-md uppercase">{data.gender}</span>
                          {data.date_of_birth && (
                            <span className="text-[10px] font-black text-slate-900 uppercase">Age: {calculateAge(data.date_of_birth, new Date().getFullYear())}</span>
                          )}
                        </div>
                      </div>

                      {/* APX-Fix: Auto-adjusting Allocated Sports (Merged and De-duplicated) */}
                      {allocatedSports.length > 0 && (
                        <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0 max-w-full lg:max-w-[60%]">
                          <div className="flex items-center gap-1.5 lg:justify-end">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Allocated Sports</span>
                          </div>
                          <div className="flex flex-wrap justify-start lg:justify-end gap-1.5">
                            {allocatedSports.map((sport, idx) => (
                              <div 
                                key={idx} 
                                className="px-2.5 py-1 bg-gradient-to-br from-[#2D4A9E]/5 to-blue-500/5 border border-[#2D4A9E]/10 rounded-lg shadow-sm flex items-center group transition-all hover:border-[#2D4A9E]/20"
                              >
                                <span className="text-[10px] font-black text-[#2D4A9E] uppercase tracking-tight whitespace-nowrap">{sport}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-900 uppercase">ID: {data.accreditation_id?.split("-")?.pop() || data.id?.slice(0,8)}</span>
                    <span className="text-[9px] font-black text-slate-900 uppercase">Badge: {data.badge_number}</span>
                    
                    {/* Dynamic Custom Fields */}
                    <div className="mt-2 flex flex-col gap-1 items-start">
                      {customFieldConfigs
                        ?.filter(cfg => cfg.showOnBadge === true)
                        ?.map((cfg, idx) => {
                          const value = parsedCustomFields[cfg.id];
                          if (!value) return null;
                          return (
                            <div key={idx} className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 shadow-sm flex flex-col items-start min-w-[80px]">
                              <span className="text-[7px] text-slate-500 font-bold uppercase leading-none mb-0.5">{cfg.label}</span>
                              <span className="text-[9px] font-black uppercase leading-none">{value}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     {data.nationality && (
                       <div className="flex items-center gap-1.5">
                         {getCountryFlag(data.nationality) && <img src={getCountryFlag(data.nationality)} alt="flag" className="w-6 shadow-sm rounded-sm" />}
                         <span className="text-[10px] font-black text-slate-900 uppercase">{data.nationality}</span>
                       </div>
                     )}
                     <div className="flex gap-1">
                        {[...new Set((data.zone_code || "").split(",").map(z => z.trim()).filter(Boolean))].map((code, i) => (
                          <span key={i} className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[9px] font-black text-slate-600 shadow-sm">{code}</span>
                        ))}
                     </div>
                  </div>
                </div>
              </div>

              {/* Restoration: Competition Records (SS2 Style) */}
              {data.status !== 'rejected' && mergedEvents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="space-y-3">
                    {mergedEvents.map((ev, i) => {
                      let displayName = ev.event_name || "";
                      let eventRecords = null;
                      if (displayName.includes("|||RECORD_DATA|||")) {
                        const parts = displayName.split("|||RECORD_DATA|||");
                        displayName = parts[0].trim();
                        try { eventRecords = JSON.parse(parts[1].trim()); } catch(e) {}
                      }

                      const resTime = ev.result_time || "";
                      const seedTime = ev.seed_time || "";
                      const diff = formatTimeDiff(resTime, seedTime);

                      return (
                        <div key={i} className="relative py-2.5 border-b border-slate-50 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-3 min-w-0">
                              <span className="text-[10px] font-black text-slate-900 shrink-0 mt-0.5">{ev.event_code}</span>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-slate-700 leading-tight inline-block">{displayName}</span>
                                {eventRecords && eventRecords[0] && (
                                  <div className="mt-1 inline-flex items-center px-2 py-0.5 bg-indigo-50 rounded text-[8px] font-black text-indigo-600 uppercase border border-indigo-100">
                                    {eventRecords[0].acronym} RECORD: {eventRecords[0].time}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end shrink-0 gap-1">
                               <div className="px-2 py-0.5 bg-blue-500 text-[8px] font-black text-white rounded uppercase whitespace-nowrap">
                                  HEAT {ev.heat} • LANE {ev.lane}
                               </div>
                               {diff && (
                                 <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-slate-400">PB: {seedTime || "NT"}</span>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-black",
                                      diff.isFaster ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                    )}>
                                      {diff.text}
                                    </span>
                                 </div>
                               )}
                               {!diff && !ev.result_time && (
                               <span className="text-[10px] font-black text-slate-800 uppercase bg-slate-100 px-1 rounded shadow-sm">NT</span>
                               )}
                               {ev.result_time && !diff && (
                                 <span className="text-[9px] font-black text-emerald-600">{ev.result_time}</span>
                               )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* SECURE VISIBILITY: Hide all deeper features for rejected accreditations */}
        {data.status !== 'rejected' && (
          <div className="w-full space-y-4">
            <div className="mt-4">
              <AnimatePresence>
                <div className="space-y-4">
                  {/* 1. General Messages */}
                  {(filteredMessages.generalMessages.length > 0 || filteredMessages.fallbackMessage) && (
                    <ExpandableMessageGroup 
                      title="General Broadcast" 
                      messages={filteredMessages.generalMessages.length > 0 ? filteredMessages.generalMessages : (filteredMessages.fallbackMessage ? [{message: filteredMessages.fallbackMessage, type: "global", createdAt: eventSettings["message_updated_at"]}] : [])} 
                      icon={<Globe className="w-5 h-5" />} 
                      isGeneral 
                      onRead={recalculateUnread} 
                    />
                  )}

                  {/* 2. Targeted Messages */}
                  {filteredMessages.targetedMessages.length > 0 && (
                    <ExpandableMessageGroup 
                      title="Targeted Update" 
                      messages={filteredMessages.targetedMessages} 
                      icon={<Search className="w-5 h-5" />} 
                      isTargeted 
                      onRead={recalculateUnread} 
                    />
                  )}

                  {/* 3. Personal Messages */}
                  {filteredMessages.personalMessages.length > 0 && (
                    <ExpandableMessageGroup 
                      title="Personal Notification" 
                      messages={filteredMessages.personalMessages} 
                      icon={<MessageSquare className="w-5 h-5" />} 
                      isPersonal 
                      onRead={recalculateUnread} 
                    />
                  )}
                  {liveMedals.length > 0 && (
                    <motion.div onClick={() => setShowMedalsModal(true)} className="bg-gradient-to-r from-amber-500 to-orange-600 border border-white/20 rounded-2xl p-4 shadow-lg cursor-pointer relative overflow-hidden group">
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/40"><MedalIcon className="w-5 h-5 text-white" /></div>
                          <div><div className="text-white font-black text-sm uppercase">Best Swimmers Ranking Live</div><div className="text-white/60 text-[8px] font-black uppercase tracking-widest">Live Results Dashboard</div></div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/80" />
                      </div>
                    </motion.div>
                  )}
                  {data?.events?.slug && feedbackConfig?.is_active && (
                    <motion.div onClick={() => navigate(`/feedback/${data.events.slug}`)} className="bg-gradient-to-r from-[#00A3FF] to-[#0066FF] border border-white/20 rounded-2xl p-4 shadow-lg cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/40"><MessageSquare className="w-5 h-5 text-white" /></div>
                          <div><div className="text-white font-black text-sm uppercase">Your Voice Matters!</div><div className="text-white/60 text-[8px] font-black uppercase">Share your feedback & help us improve</div></div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/80" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </AnimatePresence>
            </div>

            {/* Attachments Section */}
            {(() => {
              const attachments = [];
              const seenUrls = new Set();
              filteredMessages.allMessages.forEach(m => {
                if (m.attachmentUrl && !seenUrls.has(m.attachmentUrl)) {
                  attachments.push(m);
                  seenUrls.add(m.attachmentUrl);
                }
              });
              if (attachments.length === 0) return null;
              return (
                <div className="space-y-3">
                  {attachments.map((att, idx) => (
                    <a key={idx} href={att.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white/[0.04] border border-white/10 p-4 rounded-2xl text-white">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <div className="flex flex-col"><span className="text-[9px] text-white/40 uppercase font-black">{att.type === 'athlete' ? 'Personal' : 'Event'} Doc</span><span className="text-sm font-bold">{att.attachmentName || "Download File"}</span></div>
                      </div>
                      <Download className="w-4 h-4 text-white/40" />
                    </a>
                  ))}
                </div>
              );
            })()}

            {/* Direct Downloads */}
            <div className="grid grid-cols-2 gap-4">
              <DownloadButton url={data.heat_sheet_url} visible={showForQR("heat_sheet_pdf")} label="Heat Sheet" color="blue" />
              <DownloadButton url={data.event_result_url} visible={showForQR("event_result_pdf")} label="Athlete Result" color="emerald" />
            </div>

            {/* Event Resources */}
            {(visibleOfficialDocs.length > 0 || visibleTechnicalDocs.length > 0 || safetyDocs.length > 0) && (
              <div className="mt-10 space-y-6">
                 {visibleOfficialDocs.length > 0 && (
                   <div className="space-y-3">
                     <h4 className="font-black text-white uppercase tracking-[0.15em] px-2" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>Official Event Documents</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {visibleOfficialDocs.map((doc, idx) => (
                          <motion.a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-start justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors shrink-0">
                                <Download className="w-4 h-4 text-cyan-400" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1 mb-1 flex-nowrap min-w-0">
                                  <span className="text-[9px] font-black text-white/30 uppercase leading-none shrink-0">Official Profile</span>
                                  {doc.sport && doc.sport !== "General" && (
                                    <span className="text-[8px] font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1 rounded whitespace-nowrap py-0.5 leading-none">{doc.sport}</span>
                                  )}
                                </div>
                                <span className="font-black text-white leading-tight break-words" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>{formatDocName(doc.name)}</span>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-cyan-400 transition-colors shrink-0 ml-2" />
                          </motion.a>
                        ))}
                     </div>
                   </div>
                 )}
                 {visibleTechnicalDocs.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-black text-white uppercase tracking-[0.15em] px-2" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>Result Documents</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {visibleTechnicalDocs.map((doc, idx) => (
                          <motion.a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-start justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors shrink-0">
                                <Download className="w-4 h-4 text-blue-400" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1 mb-1 flex-nowrap min-w-0">
                                  <span className="text-[9px] font-black text-white/30 uppercase leading-none shrink-0">Result Profile</span>
                                  {doc.sport && doc.sport !== "General" && (
                                    <span className="text-[8px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1 rounded whitespace-nowrap py-0.5 leading-none">{doc.sport}</span>
                                  )}
                                </div>
                                <span className="font-black text-white leading-tight break-words" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>{formatDocName(doc.name)}</span>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors shrink-0 ml-2" />
                          </motion.a>
                        ))}
                      </div>
                    </div>
                  )}

                  {safetyDocs.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-black text-white uppercase tracking-[0.15em] px-2" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>Safety Documents</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {safetyDocs.map((doc, idx) => (
                          <motion.a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-start justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-2xl hover:bg-red-500/10 transition-all group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2 bg-red-500/10 rounded-xl group-hover:bg-red-500/20 transition-colors shrink-0">
                                <ShieldAlert className="w-4 h-4 text-red-400" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1 mb-1 flex-nowrap min-w-0">
                                  <span className="text-[9px] font-black text-red-500/40 uppercase leading-none shrink-0">Safety Asset</span>
                                </div>
                                <span className="font-black text-white leading-tight break-words uppercase" style={{ fontFamily: "'Gill Sans MT', 'Gill Sans', Calibri, sans-serif", fontSize: "14px" }}>{formatDocName(doc.name)}</span>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-red-500/20 group-hover:text-red-400 transition-colors shrink-0 ml-2" />
                          </motion.a>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        <motion.p variants={itemVariants} className="mt-12 text-white/20 text-[10px] uppercase font-black tracking-[0.5em] text-center">Apex Sports Accreditation System</motion.p>
      </motion.div>

      {/* Live Medals Modal (Professional Restore) */}
      <AnimatePresence>
        {showMedalsModal && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md px-0 sm:px-4">
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} className="bg-white w-full sm:max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/10" style={{ maxHeight: "92vh" }}>
              <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg"><Trophy className="w-6 h-6 text-white" /></div>
                  <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Live Results Center</h3><p className="text-[9px] text-amber-600 font-black uppercase tracking-widest leading-none">{data?.events?.name}</p></div>
                </div>
                <button onClick={() => setShowMedalsModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <select value={selectedAgeCategory || ""} onChange={(e) => setSelectedAgeCategory(e.target.value || null)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-tight text-slate-900 outline-none">
                    <option value="">All Ages</option>
                    {[...new Set(liveMedals.map(m => m.ageCategory))].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <select value={selectedGender || ""} onChange={(e) => setSelectedGender(e.target.value || null)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-tight text-slate-900 outline-none">
                    <option value="">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {(() => {
                  const swimmers = {};
                  liveMedals.filter(r => {
                      if (selectedAgeCategory && r.ageCategory !== selectedAgeCategory) return false;
                      if (selectedGender) {
                         const g = r.gender ? r.gender.toLowerCase() : r.event_name.toLowerCase();
                         if (selectedGender === 'Male' && !g.includes('boy') && !g.includes('men') && !g.includes('male')) return false;
                         if (selectedGender === 'Female' && !g.includes('girl') && !g.includes('women') && !g.includes('female')) return false;
                      }
                      return true;
                  }).forEach(r => {
                    const k = `${r.swimmer_name}-${r.team}`;
                    if (!swimmers[k]) swimmers[k] = { name: r.swimmer_name, team: r.team, gold: 0, silver: 0, bronze: 0 };
                    if (Number(r.place) === 1) swimmers[k].gold++; 
                    else if (Number(r.place) === 2) swimmers[k].silver++; 
                    else if (Number(r.place) === 3) swimmers[k].bronze++;
                  });
                  const ranked = Object.values(swimmers).sort((a,b) => (b.gold-a.gold) || (b.silver-a.silver) || (b.bronze-a.bronze)).slice(0, 20);
                  if (ranked.length === 0) return (<div className="py-20 text-center opacity-20 font-black uppercase text-xs">No Data Found</div>);
                  return (
                    <div className="space-y-2">
                      {ranked.map((r, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between group shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", i<3 ? "bg-slate-900 text-white" : "text-slate-300")}>{i+1}</div>
                            <div className="flex flex-col"><span className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[140px]">{r.name}</span><span className="text-[8px] text-slate-400 font-black uppercase truncate max-w-[120px]">{r.team}</span></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-1 rounded-lg"><span className="text-[10px] font-black text-amber-600">{r.gold}</span></div>
                            <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-1 rounded-lg"><span className="text-[10px] font-black text-slate-400">{r.silver}</span></div>
                            <div className="flex items-center gap-1 bg-orange-50 px-1.5 py-1 rounded-lg"><span className="text-[10px] font-black text-orange-900">{r.bronze}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpandableMessageGroup({ title, messages, icon, isPersonal, isTargeted, isGeneral, onRead }) {
  const [hasUnread, setHasUnread] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const latestMessage = messages && messages.length > 0 ? messages[0] : null;
  
  useEffect(() => {
    if (!latestMessage) return;
    const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
    setHasUnread(latestMessage.id && !readIds.includes(latestMessage.id));
  }, [latestMessage]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && hasUnread && latestMessage?.id) {
      markRead();
    }
  };

  const markRead = () => {
    if (hasUnread && latestMessage?.id) {
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      if (!readIds.includes(latestMessage.id)) {
        readIds.push(latestMessage.id);
        localStorage.setItem('qr_read_msgs', JSON.stringify(readIds));
        setHasUnread(false);
        if (onRead) onRead();
      }
    }
  };

  const theme = isPersonal 
    ? { border: "border-indigo-500/20", text: "text-indigo-300", bg: "bg-indigo-500/5" }
    : isTargeted
      ? { border: "border-blue-500/20", text: "text-blue-300", bg: "bg-blue-500/5" }
      : { border: "border-emerald-500/20", text: "text-emerald-300", bg: "bg-emerald-500/5" };

  if (!latestMessage) return null;
  
  return (
    <motion.div 
      className={cn("w-full bg-white/[0.03] border rounded-[2rem] overflow-hidden transition-all", theme.border)}
    >
      <button 
        onClick={toggleExpand}
        className="w-full flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left outline-none group"
      >
        <div className="flex items-center gap-4">
          <div className="relative p-3 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors">
            {React.cloneElement(icon, { className: cn("w-5 h-5", theme.text) })}
            {hasUnread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-[#050b18] rounded-full" />}
          </div>
          <div>
            <h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", theme.text)}>{title}</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase mt-0.5">LATEST UPDATE</p>
          </div>
        </div>
        <div className={cn("p-2 rounded-xl bg-white/5 transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-2 space-y-4">
              <div className={cn("p-6 rounded-3xl border border-white/10", theme.bg)}>
                <div className="flex justify-between mb-4 border-b border-white/5 pb-3">
                  <div>
                    <span className="text-[9px] text-white/30 font-black uppercase block mb-1">Timestamp</span>
                    <span className="text-[10px] text-white/60 font-black">{latestMessage.createdAt ? new Date(latestMessage.createdAt).toLocaleString() : 'Recent'}</span>
                  </div>
                  {latestMessage.attachmentUrl && (
                    <a href={latestMessage.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-all">
                      <Paperclip className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase">View File</span>
                    </a>
                  )}
                </div>
                <p className="text-white font-medium leading-relaxed whitespace-pre-wrap">{latestMessage.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


function DownloadButton({ url, visible, label, color }) {
  if (!url || !visible) return null;
  const colors = { blue: "from-blue-600 to-blue-700", emerald: "from-emerald-600 to-emerald-700" };
  return (<a href={url} target="_blank" rel="noopener noreferrer" className={`group flex items-center justify-between gap-4 bg-gradient-to-br ${colors[color]} p-4 pl-6 rounded-2xl text-white font-bold shadow-lg`}><div className="flex flex-col"><span className="text-[10px] text-white/40 uppercase font-black">Download</span><span className="text-sm">{label}</span></div><div className="p-3 bg-black/20 rounded-xl"><Download className="w-4 h-4" /></div></a>);
}

function ScanSkeleton() {
  return (<div className="min-h-screen bg-[#050b18] flex items-center justify-center"><div className="flex flex-col items-center gap-6"><div className="w-16 h-16 rounded-full border-t-2 border-cyan-500 animate-spin" /><p className="text-cyan-500 font-black text-xs uppercase tracking-[0.4em] animate-pulse">Authenticating</p></div></div>);
}

function ScanError({ error }) {
  return (<div className="min-h-screen bg-[#050b18] flex items-center justify-center p-6 text-center"><div className="max-w-md"><div className="inline-flex p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] mb-8"><AlertTriangle className="w-12 h-12 text-red-500" /></div><h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Verification Failed</h2><p className="text-white/40 font-medium mb-12">{error || "The scanned accreditation code is invalid."}</p><button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase text-xs">Retry Scan</button></div></div>);
}


