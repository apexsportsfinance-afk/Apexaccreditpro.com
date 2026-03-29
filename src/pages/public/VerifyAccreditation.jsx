import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle, XCircle, Download, Calendar,
  MessageSquare, Globe, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck,
  User, Hash, MapPin, Building, Cake, ExternalLink, Bell, X, Paperclip, FileText,
  Files, FileSpreadsheet, FileBox
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { EventSettingsAPI, FormFieldSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";
import { getCountryFlag, COUNTRIES, calculateAge } from "../../lib/utils";
import { toast } from "sonner";

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

const formatTimeDiff = (pbStr, recordStr) => {
  const pbSec = parseTimeSeconds(pbStr);
  const recSec = parseTimeSeconds(recordStr);
  if (pbSec === null || recSec === null || isNaN(pbSec) || isNaN(recSec)) return null;
  
  // The user requested PB differentials to map visually as Negative if they are slower
  // (Meaning they must DROP [X] seconds to hit the Record)
  // If their PB is faster, they are OVER the record, representing a Positive (+) gap.
  const diff = recSec - pbSec; 
  const isFaster = diff >= 0; // if difference is positive, PB was lower (faster)
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const absDiff = Math.abs(diff);
  
  let diffDisplay;
  if (absDiff >= 60) {
     const m = Math.floor(absDiff / 60);
     let s = (absDiff % 60).toFixed(2);
     if (s < 10) s = "0" + s;
     diffDisplay = `${sign}${m}:${s}`;
  } else {
     diffDisplay = `${sign}${absDiff.toFixed(2)}`;
  }
  return {
    text: diffDisplay,
    isFaster: isFaster
  };
};

export default function VerifyAccreditation() {
  const { id } = useParams();
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
  
  // Filtered messages derived from state
  const filteredMessages = React.useMemo(() => {
    const allAthleteMessages = messages
      .filter(m => m.type === "athlete")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    const allGlobalMessages = messages
      .filter(m => m.type === "global")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const allMessages = [...allAthleteMessages, ...allGlobalMessages]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    const fallbackGlobalMessage = allGlobalMessages.length === 0 ? eventSettings["broadcast_message"] : null;
    
    return {
      allAthleteMessages,
      allGlobalMessages,
      allMessages,
      fallbackGlobalMessage
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
            .select("*, events:event_id(id, name, start_date, logo_url)")
            .eq("accreditation_id", id)
            .maybeSingle();
          if (byAcc) return { data: byAcc, error: null };
          
          return supabase
            .from("accreditations")
            .select("*, events:event_id(id, name, start_date, logo_url)")
            .eq("id", id)
            .maybeSingle();
        }
        return supabase
          .from("accreditations")
          .select("*, events:event_id(id, name, start_date, logo_url)")
          .eq("accreditation_id", id)
          .maybeSingle();
      };

      const { data: fetchedData, error: fetchedError } = await fetchAccreditation();
      accData = fetchedData;
      accErr = fetchedError;

      if (accErr) throw accErr;
      if (!accData) throw new Error("Accreditation not found");

      
      const [eSettings, fieldSets, matrix, gSettings] = await Promise.all([
        accData?.event_id
          ? EventSettingsAPI.getAll(accData.event_id)
          : Promise.resolve({}),
        accData?.event_id
          ? FormFieldSettingsAPI.getByEventId(accData.event_id)
          : Promise.resolve({}),
        accData?.id && accData?.role?.toLowerCase() === "athlete"
          ? AthleteEventsAPI.getForAthlete(accData.id)
          : Promise.resolve([]),
        GlobalSettingsAPI.getAll()
      ]);


      setData(accData);
      setEventSettings(eSettings);
      setFieldSettings(fieldSets || {});
      setAthleteMatrix(matrix || []);
      setGlobSettings(gSettings || {});

      // APX-P0: Transparent Self-Scan Logging
      // Log every view/refresh as a scan event to track engagement
      if (accData?.event_id) {
        // Log to Audit Stream (Detailed)
        AttendanceAPI.logScanEvent({
          eventId: accData.event_id, 
          athleteId: accData.id,
          scanMode: "athlete_verify", 
          deviceLabel: "Mobile-Self-Scan"
        }).catch(e => console.warn("Self-scan log failed:", e));

        // APX-P0: Official Attendance Integration
        // Automatically mark as "Present" and increment scan count
        AttendanceAPI.recordScan({
          eventId: accData.event_id,
          athleteId: accData.id,
          clubName: accData.club,
          scannerLocation: "Mobile-Self-Scan"
        }).catch(e => console.warn("Self-attendance record failed:", e));
      }
      
      // Console debug for Official Documents
      const docKey = `event_${accData?.event_id}_official_docs`;
      const docsJson = gSettings[docKey];
      const docCount = docsJson ? JSON.parse(docsJson).length : 0;

      console.log("Accreditation Handshake:", {
        badgeId: accData?.accreditation_id,
        eventId: accData?.event_id,
        officialDocsFound: docCount,
        availableSettings: Object.keys(gSettings || {}).filter(k => k.includes('official_docs'))
      });
    } catch (err) {
      console.error("Error loading accreditation data:", err);
      setError(err.message || "Accreditation not found");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      
      if (!data?.event_id || !data?.id) {
        return;
      }
      
      const msgs = await BroadcastV2API.getForAthlete(data.event_id, data.id);
      
      
      setMessages(msgs || []);
      
      // Update unread count
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
      const unread = filteredMessages.allMessages.filter(m => m.id && !readIds.includes(m.id)).length;
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

  // Display ONLY securely matched events from the uploaded Heat Sheet (athlete_events database)
  const mergedEvents = React.useMemo(() => {
    if (!data) return [];
    
    // Database rows that match this athlete's ID exactly
    const matrixRows = [...athleteMatrix];

    return matrixRows.sort((a, b) => {
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
      filteredMessages.allMessages.forEach(m => {
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
  
  // Status display logic
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
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/40',
      shadowColor: 'shadow-emerald-950/20',
      iconBg: 'bg-emerald-500/20',
      icon: <CheckCircle className="w-7 h-7 text-emerald-500" />
    };
  }, [data?.status, expiry.isExpired]);

  const rawSel = data?.selected_sport_events || data?.selected_events;
  const selectedEvents = Array.isArray(rawSel) ? rawSel : [];
  
  // PDF URLs are stored in GlobalSettings by event_id
  const eventPdfUrl = globSettings[`event_${data?.event_id}_heat_sheet_url`];
  const eventResultPdfUrl = globSettings[`event_${data?.event_id}_event_result_url`];
  const officialDocs = useMemo(() => {
    const eid = data?.event_id || data?.events?.id;
    if (!eid || !globSettings) return [];
    
    // Key format: event_{UUID}_official_docs
    const key = `event_${eid}_official_docs`;
    const json = globSettings[key];
    
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Official Docs Parse Error:", e);
      return [];
    }
  }, [globSettings, data?.event_id, data?.events?.id]);

  const showForQR = (key) => {
    const loc = fieldSettings[key] || "both";
    return loc === "both" || loc === "qr";
  };

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
      {/* Messages Modal */}
      <AnimatePresence>
        {showMessagesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowMessagesModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0a1120] w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-xl">
                    <Bell className="w-5 h-5 text-cyan-400" />
                  </div>
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
                      key={m.id || i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`p-5 rounded-2xl border backdrop-blur-md ${
                        m.type === "athlete" 
                          ? "bg-indigo-500/5 border-indigo-500/20" 
                          : "bg-cyan-500/5 border-cyan-500/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                         <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                           m.type === "athlete" ? "bg-indigo-500/20 text-indigo-300" : "bg-cyan-500/20 text-cyan-300"
                         }`}>
                           {m.type === "athlete" ? "Personal Message" : "Event Broadcast"}
                         </span>
                         {m.createdAt && (
                           <span className="text-[10px] text-white/30 font-bold">
                             {new Date(m.createdAt).toLocaleString("en-US", { 
                               year: 'numeric', 
                               month: 'numeric', 
                               day: 'numeric',
                               hour: 'numeric',
                               minute: '2-digit',
                               hour12: true 
                             })}
                           </span>
                         )}
                      </div>
                      <p className="text-white/80 font-medium leading-relaxed whitespace-pre-wrap">{m.message}</p>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center opacity-20">
                    <MessageSquare className="w-12 h-12 mb-2" />
                    <p className="font-bold uppercase tracking-widest text-xs">No active messages</p>
                  </div>
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

      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-4xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center shadow-inner"
      >
        {/* Banner Section */}
        {eventSettings["banner_url"] && (
          <motion.div variants={itemVariants} className="w-full mb-3 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-white/5">
            <img src={eventSettings["banner_url"]} alt="Event banner" className="w-full h-auto object-contain bg-gray-900" />
          </motion.div>
        )}

        {/* Premium Status Indicator - UPDATED: White Background & Reduced Gap */}
        <motion.div
          variants={itemVariants}
          className={`w-full mb-3 flex items-center justify-between px-6 py-4 rounded-3xl border backdrop-blur-md transition-all bg-white border-white/20 shadow-xl shadow-black/5`}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`p-2.5 rounded-xl shadow-inner ${statusConfig.iconBg}`}>
              {statusConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-black text-xl leading-none uppercase tracking-tighter ${statusConfig.color}`}>
                {statusConfig.label} Accreditation
              </h3>
              <p className="text-gray-500 text-xs font-bold mt-1.5 uppercase tracking-wide leading-tight">
                {data.events?.name}
              </p>
            </div>
          </div>

          <button 
            onClick={markAllAsRead}
            className="relative p-3 bg-gray-100 hover:bg-gray-200 rounded-2xl border border-gray-200 transition-all group active:scale-95 ml-4"
          >
            <Bell className={`w-6 h-6 transition-colors ${unreadTotal > 0 ? "text-cyan-600" : "text-gray-400 group-hover:text-gray-600"}`} />
            <AnimatePresence>
              {unreadTotal > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white"
                >
                  {unreadTotal}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Rejection Remarks Section */}
        {data.status === 'rejected' && data.rejection_remarks && (
          <motion.div
            variants={itemVariants}
            className="w-full mb-6 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500/40" />
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-red-400" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400">Rejection Remarks</h4>
            </div>
            <p className="text-sm font-medium text-white/80 leading-relaxed italic">
              "{data.rejection_remarks}"
            </p>
          </motion.div>
        )}

        {/* Competition Record — white badge card, using merged events (PDF + registered) */}
        {showForQR("events") && (
          <motion.div variants={itemVariants} className="w-full bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-xl overflow-hidden group mt-2">
            {/* White Badge Display */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
              <div className="flex flex-col gap-1.5">
                {/* Top Row: Profile Picture and Name/Details */}
                <div className="flex items-start gap-4">
                  {/* Profile Photo */}
                  <div className="w-20 h-24 border-2 border-gray-300 rounded overflow-hidden flex-shrink-0">
                    {data.photo_url ? (
                      <img src={data.photo_url} alt="Profile" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name and Basic Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-blue-900 text-lg uppercase leading-tight">
                      {data.first_name} {data.last_name}
                    </h3>
                    <p className="text-gray-700 text-sm mt-1">{data.club || ""}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                      <span className="font-medium">{data.role || "Participant"}</span>
                      <span className="text-gray-400">|</span>
                      <span className="font-medium">{data.gender || "Gender"}</span>
                      {data.date_of_birth && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span className="font-bold text-black">Age: {calculateAge(data.date_of_birth, new Date().getFullYear())}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ID, Badge, Flag, Zone Codes */}
                <div className="flex items-start justify-between mt-0.5">
                  <div className="text-left">
                    <p className="text-xs text-gray-600">
                      <span className="font-bold">ID:</span> {data.accreditation_id?.split("-")?.pop() || "---"}
                    </p>
                    <p className="text-xs text-gray-600">
                      <span className="font-bold">BADGE:</span> {data.badge_number || "---"}
                    </p>
                  </div>
                  <div className="text-right">
                    {data.nationality && (
                      <div className="flex items-center gap-1.5">
                        {getCountryFlag(data.nationality) && (
                          <img src={getCountryFlag(data.nationality)} alt="flag" loading="lazy" className="w-10 h-6 rounded-sm object-cover shadow-sm" />
                        )}
                        <span className="text-sm text-slate-900 font-bold">{data.nationality}</span>
                      </div>
                    )}
                    {data.zone_code && (() => {
                      const codes = data.zone_code.split(",").map(z => z.trim()).filter(Boolean);
                      return codes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 justify-end mt-3.5">
                          {codes.map((code, i) => (
                            <span key={i} className="px-3 py-1 rounded-lg text-[10px] font-black text-slate-700 bg-slate-100 border border-slate-200 shadow-sm uppercase">
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Competition Events — all events from PDF + registration */}
              {mergedEvents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    {mergedEvents.map((ev, i) => {
                      let displayName = ev.event_name || ev._ev?.eventName || "";
                      let eventRecords = null;
                      
                      // Unpack the JSON String-Packing payload safely
                      if (displayName.includes("|||RECORD_DATA|||")) {
                        const parts = displayName.split("|||RECORD_DATA|||");
                        displayName = parts[0].trim();
                        try {
                          eventRecords = JSON.parse(parts[1].trim());
                        } catch(e) {
                          console.error("Failed to parse packed event records", e);
                        }
                      }

                      // Mathematically sync the Overall Record Time relative to the athlete's exact database age
                      let ageRecord = null;
                      if (eventRecords && eventRecords.length > 0) {
                         if (data.date_of_birth) {
                             const athleteAge = calculateAge(data.date_of_birth, new Date().getFullYear());
                             ageRecord = eventRecords.find(r => {
                                if (r.age.includes("&")) {
                                   const baseAge = parseInt(r.age, 10);
                                   return athleteAge >= baseAge;
                                }
                                return parseInt(r.age, 10) === athleteAge;
                             });
                         }
                         // FOOLPROOF FALLBACK: If Date of Birth is missing OR Age didn't exactly align, render the top record
                         if (!ageRecord) {
                             ageRecord = eventRecords[0]; 
                         }
                      }

                      return (
                        <div key={i} className="flex flex-col gap-1.5 border-b border-gray-100 pb-3 last:border-0 relative">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-black bg-blue-50 px-2 py-1 rounded text-xs w-8 text-center flex-shrink-0">
                              {ev.event_code || ev._ev?.eventCode}
                            </span>
                            <span className="text-gray-700 text-xs flex-1">
                              {displayName}
                            </span>
                            {ev.heat && ev.lane && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                HEAT {ev.heat} • LANE {ev.lane}
                              </span>
                            )}
                            {ev.rank && (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                RANK {ev.rank}{ev.result_time ? ` • ${ev.result_time}` : ''}
                              </span>
                            )}
                          </div>

                          {/* Record Details & Entry Time Secondary Row - STRICT ALIGNMENT */}
                          {(ageRecord || ev.seed_time) && (
                            <div className="flex items-center justify-between w-full pl-11 mt-0.5">
                               <div className="flex items-center justify-start">
                                   {ageRecord && (
                                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm uppercase">
                                        <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                        {ageRecord.age} {ageRecord.acronym} Record : {ageRecord.time}
                                      </span>
                                   )}
                               </div>
                               <div className="flex items-center justify-end">
                                   {ev.seed_time && (() => {
                                      let diffItem = null;
                                      if (ageRecord && ageRecord.time && ev.seed_time !== "NT" && ev.seed_time !== "NP") {
                                          const diffData = formatTimeDiff(ev.seed_time, ageRecord.time);
                                          if (diffData) {
                                              diffItem = (
                                                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-black tracking-wide ${diffData.isFaster ? 'bg-emerald-100 text-emerald-800 border-none' : 'bg-rose-100 text-rose-700 border-none'}`}>
                                                    {diffData.text}
                                                  </span>
                                              );
                                          }
                                      }
                                      return (
                                        <div className="flex items-center">
                                          <span className="bg-gray-100 text-gray-600 border border-gray-200 pl-2 pr-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm uppercase flex items-center">
                                            PB: {ev.seed_time}
                                            {diffItem}
                                          </span>
                                        </div>
                                      );
                                   })()}
                               </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}


        <div className="w-full grid grid-cols-1 gap-4 mt-4">
          <AnimatePresence>

        {/* Notifications & Documents */}
        <div className="space-y-4">
              {/* Personal Notifications - Full Width */}
              {filteredMessages.allAthleteMessages.length > 0 && (
                 <ExpandableMessageGroup title="Personal Notification" messages={filteredMessages.allAthleteMessages} icon={<MessageSquare className="w-5 h-5" />} isPersonal onRead={recalculateUnread} />
              )}
              
              {/* Event Broadcast - Full Width */}
              {(filteredMessages.allGlobalMessages.length > 0 || filteredMessages.fallbackGlobalMessage) && (
                 <ExpandableMessageGroup 
                   title="Event Broadcast" 
                   messages={filteredMessages.allGlobalMessages.length > 0 ? filteredMessages.allGlobalMessages : (filteredMessages.fallbackGlobalMessage ? [{message: filteredMessages.fallbackGlobalMessage, type: 'global', createdAt: eventSettings['message_updated_at'] || new Date().toISOString()}] : [])} 
                   icon={<Globe className="w-5 h-5" />} 
                   onRead={recalculateUnread} 
                 />
              )}
        </div>

          </AnimatePresence>
        </div>

        {/* Message Attachments Section */}
        {(() => {
          const attachments = [];
          const seenUrls = new Set();
          
          let hasGlobalAttachment = false;
          let hasPersonalAttachment = false;
          
          filteredMessages.allMessages.forEach(m => {
            if (m.attachmentUrl && !seenUrls.has(m.attachmentUrl)) {
              const isGlobal = m.type === 'global';
              
              if (isGlobal && !hasGlobalAttachment) {
                attachments.push(m);
                seenUrls.add(m.attachmentUrl);
                hasGlobalAttachment = true;
              } else if (!isGlobal && !hasPersonalAttachment) {
                attachments.push(m);
                seenUrls.add(m.attachmentUrl);
                hasPersonalAttachment = true;
              }
            }
          });

          if (attachments.length === 0) return null;

          return (
            <motion.div variants={itemVariants} className="mt-4 space-y-4">
              {attachments.map((att, idx) => {
                const isPersonal = att.type === 'athlete';
                const colorClass = isPersonal ? "from-indigo-600 to-indigo-700 hover:shadow-indigo-900/40" : "from-emerald-600 to-emerald-700 hover:shadow-emerald-900/40";
                
                return (
                  <div key={idx} className="bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-2xl p-2.5 shadow-xl">
                    <div className="flex items-center gap-2 mb-2 px-2">
                      <FileText className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                        {isPersonal ? 'Personal Document' : 'Broadcast Attachment'}
                      </span>
                      <span className="ml-auto text-[9px] text-white/30 font-bold">
                        {new Date(att.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <a
                      href={att.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group relative flex items-center justify-between gap-3 bg-gradient-to-br ${colorClass} p-2.5 pl-4 rounded-xl text-white font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 shadow-lg w-full`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] text-white/40 uppercase tracking-widest mb-0 font-black">Download</span>
                        <span className="text-xs tracking-tight truncate max-w-[200px]">{att.attachmentName || "Attached File"}</span>
                      </div>
                      <div className="p-2 bg-black/20 rounded-lg group-hover:bg-black/30 transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </div>
                    </a>
                  </div>
                );
              })}
            </motion.div>
          );
        })()}

        <motion.div variants={itemVariants} className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DownloadButton url={data.heat_sheet_url} visible={showForQR("heat_sheet_pdf")} label="Heat Sheet" color="blue" />
          <DownloadButton url={data.event_result_url} visible={showForQR("event_result_pdf")} label="Athlete Result" color="emerald" />
        </motion.div>


        {/* Official Event Documents (Digital Repository) */}
        {officialDocs && officialDocs.length > 0 && (
          <motion.div variants={itemVariants} className="w-full mt-6 space-y-3">
             <div className="flex items-center gap-2 mb-3 px-1">
                <Files className="w-4 h-4 text-white/40" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Official Documents</h4>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {officialDocs.map((doc, idx) => {
                   const isSpreadsheet = doc.type === 'csv' || doc.type === 'xlsx' || doc.type === 'xls';
                   const colorClass = isSpreadsheet ? "from-emerald-600 to-emerald-700" : "from-slate-700 to-slate-800";
                   
                   return (
                     <a
                       key={doc.id || idx}
                       href={doc.url}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`group relative flex items-center justify-between gap-2.5 bg-gradient-to-br ${colorClass} p-2.5 pl-3.5 rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 shadow-lg`}
                     >
                       <div className="flex flex-col text-left">
                         <span className="text-[8px] text-white/40 uppercase tracking-widest mb-0.5 font-black">
                           {doc.type?.toUpperCase()} Document
                         </span>
                         <span className="text-[10px] tracking-tight truncate max-w-[120px] md:max-w-[180px]">{doc.name}</span>
                       </div>
                       <div className="p-2 bg-black/20 rounded-lg group-hover:bg-black/30 transition-colors">
                          {isSpreadsheet ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                       </div>
                     </a>
                   );
                })}
             </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.p variants={itemVariants} className="mt-12 text-white/20 text-[10px] uppercase font-black tracking-[0.5em] text-center">
          Apex Sports Accreditation System
        </motion.p>
      </motion.div>
    </div>
  );
}

function ProfessionalRow({ icon, label, value, light }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <div className={`mt-1 flex-shrink-0 p-1.5 rounded-lg border ${light ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[10px] uppercase font-black tracking-widest mb-0.5 ${light ? "text-gray-400" : "text-white/30"}`}>{label}</p>
        <div className={`font-semibold flex items-center gap-2 ${light ? "text-gray-900" : "text-white"}`}>
            {value}
        </div>
      </div>
    </div>
  );
}

function ExpandableMessageGroup({ title, messages, icon, isPersonal, onRead }) {
  const [expanded, setExpanded] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    // Determine unread status by checking local storage
    if (!messages || messages.length === 0) return;
    try {
      const allIds = messages.filter(m => m.id).map(m => m.id);
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      const unread = allIds.some(id => !readIds.includes(id));
      setHasUnread(unread);
    } catch (e) {
      setHasUnread(true);
    }
  }, [messages]);

  const handleExpand = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && hasUnread) {
      // Mark as read
      try {
        const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
        messages.filter(m => m.id).forEach(m => {
          if (!readIds.includes(m.id)) readIds.push(m.id);
        });
        localStorage.setItem('qr_read_msgs', JSON.stringify(readIds));
        setHasUnread(false);
        if (onRead) onRead();
      } catch (e) {}
    }
  };

  if (!messages || messages.length === 0) return null;

  return (
    <motion.div
        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
        className={`w-full bg-white/[0.03] border backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl transition-all ${
            isPersonal ? 'border-indigo-500/20' : 'border-blue-500/20'
        }`}
    >
      <button 
        onClick={handleExpand}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4 text-left">
          <div className={`relative p-3 rounded-xl ${isPersonal ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
            {icon}
            {!expanded && hasUnread && (
               <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-[2.5px] border-[#0a1120] rounded-full"></span>
            )}
          </div>
          <div>
            <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${isPersonal ? 'text-indigo-300' : 'text-blue-300'}`}>
              {title}
            </h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
               Latest Update
            </p>
          </div>
        </div>
        <div className={`p-2 rounded-full ${expanded ? 'bg-white/10 text-white/80' : 'text-white/30'} transition-all`}>
           {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-4 bg-black/10 space-y-3">
               {/* Show only the latest message */}
                {messages.length > 0 && (() => {
                  const latest = messages[0];
                  return (
                    <div key={latest.id || 'latest'} className="p-6 rounded-xl border border-white/10 bg-slate-900/40 shadow-inner">
                      <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-1">Update Timestamp</span>
                          <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">
                            {latest.createdAt ? new Date(latest.createdAt).toLocaleString("en-US", { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true 
                            }) : 'No Date'}
                          </span>
                        </div>
                        {latest.id && <CheckCircle className="w-3.5 h-3.5 text-emerald-500/40" />}
                      </div>
                      <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium whitespace-pre-wrap selection:bg-cyan-500/30">
                        {latest.message || 'No message content'}
                      </p>
                    </div>
                  );
                })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DownloadButton({ url, visible, label, color }) {
  if (!url || !visible) return null;

  const colors = {
      blue: "from-blue-600 to-blue-700 hover:shadow-blue-900/40",
      emerald: "from-emerald-600 to-emerald-700 hover:shadow-emerald-900/40",
      gray: "from-gray-700 to-gray-800 hover:shadow-gray-900/40",
      cyan: "from-cyan-600 to-cyan-700 hover:shadow-cyan-900/40"
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex items-center justify-between gap-4 bg-gradient-to-br ${colors[color]} p-4 pl-6 rounded-2xl text-white font-bold transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0 shadow-lg`}
    >
      <div className="flex flex-col">
          <span className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5 font-black">Download</span>
          <span className="text-sm tracking-tight">{label}</span>
      </div>
      <div className="p-3 bg-black/20 rounded-xl group-hover:bg-black/30 transition-colors">
        <Download className="w-4 h-4" />
      </div>
    </a>
  );
}

function ScanSkeleton() {
  return (
    <div id="verify-skeleton" className="min-h-screen bg-[#050b18] flex items-center justify-center">
       <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] animate-pulse" />
          <div className="relative flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-t-2 border-cyan-500 animate-spin" />
            <p className="text-cyan-500 font-black text-xs uppercase tracking-[0.4em] animate-pulse">Authenticating</p>
          </div>
       </div>
    </div>
  );
}

function ScanError({ error }) {
  return (
    <div id="verify-error" className="min-h-screen bg-[#050b18] flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="inline-flex p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] mb-8">
            <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Verification Failed</h2>
        <p className="text-white/40 font-medium mb-12">{error || "The scanned accreditation code is invalid or has been revoked."}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
            Retry Scan
        </button>
      </div>
    </div>
  );
}
