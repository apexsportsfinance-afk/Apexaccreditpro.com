import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle, XCircle, Download, Calendar,
  MessageSquare, Globe, AlertTriangle, ChevronDown, ChevronUp,
  User, Bell, X,
  ChevronRight, Trophy, Search, Target,
  Clock, RotateCcw, CheckCircle2, Trash2, Activity, Loader2, Gift
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { EventSettingsAPI, FormFieldSettingsAPI, BroadcastV2API, AthleteEventsAPI, GlobalSettingsAPI, HeatSheetMatrixAPI } from "../../lib/broadcastApi";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { ZonesAPI, BookingsAPI, LiveScoresAPI, MatchEventsAPI, PlayerStatsAPI } from "../../lib/storage";
import { getStatFieldsForSport, getSportStatLabel } from "../../lib/sportStatFields";
import { computeExpiryStatus } from "../../lib/expiryUtils";
import { getCountryFlag, getCountryCode3, cn, getThumbnailUrl } from "../../lib/utils";
import { toast } from "sonner";
import QRProfileGallery from "../../components/public/QRProfileGallery";
import TeamBadge from "../../components/ui/TeamBadge";
import { usePublicAssetUrls } from "../../lib/storage/publicAssets";
import { ExpandableMessageGroup, DownloadButton, ScanSkeleton, ScanError } from "./verify/ScanComponents";

// Helper function to calculate exact split time between PB and Record
const parseTimeSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || timeStr === "NT" || timeStr === "NP") return null;
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
  if (!name || typeof name !== "string") return "";
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <div className="inline-flex p-5 bg-red-500/10 border border-red-500/20 rounded-full mb-8">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase mb-4">Profile Error</h2>
            <p className="text-white/40 mb-8 text-sm font-mono">
              {this.state.error?.message || "Internal Rendering Crash"}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-xs uppercase"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Collapsible event row for the QR profile heat sheet. The header stays compact
// (truncated name + heat/lane); tapping the chevron reveals the full event name
// and any available details, mirroring the broadcast ExpandableMessageGroup.
function EventCard({ ev }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayName = ev.event_name || `Event ${ev.event_code}`;

  const details = [
    { label: "Round", value: ev.round },
    { label: "Seed Time", value: ev.seed_time || ev.seedTime },
    { label: "Race Time", value: ev.race_time || ev.result_time },
    { label: "Call Room", value: ev.call_room_time },
    { label: "Session", value: ev.session_name || ev.session_time },
    { label: "Team", value: ev.team_name || ev.team },
  ].filter((d) => d.value != null && d.value !== "" && d.value !== 0);

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl shadow-sm relative overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 z-10" />
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className="w-full flex justify-between items-start gap-4 p-4 text-left outline-none hover:bg-slate-100/60 transition-colors"
      >
        <div className="flex gap-3 min-w-0">
          <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg w-10 h-10 shrink-0 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-0.5">Ev</span>
            <span className="text-sm font-black text-slate-900 leading-none">{ev.event_code || ev.event_number}</span>
          </div>
          <div className="flex flex-col min-w-0 pt-0.5">
            <span className="text-[11px] font-black text-slate-900 leading-tight inline-block uppercase tracking-tight truncate">{displayName}</span>
          </div>
        </div>
        <div className="flex items-center shrink-0 gap-2">
          <div className="px-3 py-1 bg-slate-900 text-[9px] font-black text-white rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">
            H{ev.heat} • L{ev.lane}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 pl-5">
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-snug mb-3">{displayName}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {details.map((d) => (
                  <div key={d.label} className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{d.label}</span>
                    <span className="text-[11px] font-bold text-slate-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Top-level collapsible wrapper for the heat-sheet event list. Starts collapsed;
// tapping the header reveals the events, each of which expands individually.
function EventsAccordion({ events }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between p-4 text-left outline-none hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Events</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{events.length} {events.length === 1 ? "Entry" : "Entries"}</span>
          </div>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              {events.map((ev, idx) => (
                <EventCard key={idx} ev={ev} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VerifyAccreditation() {
  const { id: rawId } = useParams();
  const id = (rawId || "").replace(/^\/+/, "").trim();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [eventSettings, setEventSettings] = useState({});
  const [fieldSettings, setFieldSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [athleteMatrix, setAthleteMatrix] = useState([]);
  const [legacyMatrix, setLegacyMatrix] = useState([]);
  const [phase, setPhase] = useState("Initializing");

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
  const [athleteScans, setAthleteScans] = useState([]);
  const [athleteLogs, setAthleteLogs] = useState([]);
  const [scannerResult, setScannerResult] = useState(null); // { status: "granted" | "denied", zoneName: string }

  // Booking states
  const [bookingConfig, setBookingConfig] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [participantBookings, setParticipantBookings] = useState([]);
  const [isBooking, setIsBooking] = useState(false);
  const [editingMeetings, setEditingMeetings] = useState([]);
  const [isBookingExpanded, setIsBookingExpanded] = useState(false);
  const [isBookingsLoaded, setIsBookingsLoaded] = useState(false);
  const [isFetchingBookings, setIsFetchingBookings] = useState(false);

  // Lazy load states for other tabs
  const [isFeedbackLoaded, setIsFeedbackLoaded] = useState(false);
  const [isDocsExpanded, setIsDocsExpanded] = useState(false);
  const [isDocsLoaded, setIsDocsLoaded] = useState(false);

  // Lazy load Bookings
  const fetchBookings = async () => {
    if (!data?.event_id || !data?.id) return;
    setIsFetchingBookings(true);
    try {
      const [aBookings, pBooking] = await Promise.all([
        BookingsAPI.getBookings(data.event_id),
        BookingsAPI.getParticipantBooking(data.event_id, data.id)
      ]);
      setAllBookings(aBookings || []);
      if (pBooking) setParticipantBookings(pBooking);
      setIsBookingsLoaded(true);
    } catch (err) {
      console.error("Bookings Fetch Error:", err);
    } finally {
      setIsFetchingBookings(false);
    }
  };

  useEffect(() => {
    if (isBookingExpanded && !isBookingsLoaded && !isFetchingBookings) {
      fetchBookings();
    }
  }, [isBookingExpanded, isBookingsLoaded, isFetchingBookings, data?.event_id, data?.id]);

  // Live Scores State — gated behind a Sport choice so the widget never has
  // to pull every sport/league/match for the event in one shot.
  const [liveScoreSettings, setLiveScoreSettings] = useState(null);
  const [liveSports, setLiveSports] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [liveMatchEvents, setLiveMatchEvents] = useState({});
  const [isLiveScoresExpanded, setIsLiveScoresExpanded] = useState(false);
  const [isSportsLoaded, setIsSportsLoaded] = useState(false);
  const [isFetchingScores, setIsFetchingScores] = useState(false);

  // Season Stats — sport-specific accumulated player stats (player_match_stats),
  // lazy-loaded only for athletes since coaches/managers don't have totals.
  const [seasonStats, setSeasonStats] = useState([]);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isStatsLoaded, setIsStatsLoaded] = useState(false);
  const [isFetchingStats, setIsFetchingStats] = useState(false);

  useEffect(() => {
    if (isStatsExpanded && !isStatsLoaded && !isFetchingStats && data?.id) {
      setIsFetchingStats(true);
      PlayerStatsAPI.getPlayerTotals(data.id)
        .then(rows => setSeasonStats(rows || []))
        .catch(() => setSeasonStats([]))
        .finally(() => { setIsStatsLoaded(true); setIsFetchingStats(false); });
    }
  }, [isStatsExpanded, isStatsLoaded, isFetchingStats, data?.id]);

  const [selectedSportId, setSelectedSportId] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ leagueNames: [], matchDates: [] });
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const STATUS_FILTER_OPTIONS = ["Live", "Upcoming", "Half Time / Break", "Finished", "Cancelled", "Postponed"];

  // Step 1: load only the (small) list of sports once the section is expanded.
  const fetchLiveSports = async () => {
    if (!data?.event_id) return;
    setIsFetchingScores(true);
    try {
      const sports = await LiveScoresAPI.getSports(data.event_id);
      setLiveSports(sports || []);
      setIsSportsLoaded(true);
    } catch (err) {
      console.error("Live Scores Sports Fetch Error:", err);
    } finally {
      setIsFetchingScores(false);
    }
  };

  useEffect(() => {
    if (isLiveScoresExpanded && !isSportsLoaded && !isFetchingScores) {
      fetchLiveSports();
    }
  }, [isLiveScoresExpanded, isSportsLoaded, isFetchingScores, data?.event_id]);

  // Step 2: once a sport is chosen, fetch the league/date options for just
  // that sport (cheap distinct-value lookup, no match rows downloaded).
  useEffect(() => {
    if (!selectedSportId || !data?.event_id) return;
    setSelectedStatus("");
    setSelectedLeague("");
    setSelectedDate("");
    LiveScoresAPI.getFilterOptions(data.event_id, selectedSportId)
      .then(opts => setFilterOptions(opts))
      .catch(() => setFilterOptions({ leagueNames: [], matchDates: [] }));
  }, [selectedSportId, data?.event_id]);

  // Step 3: fetch only the matches matching the chosen sport + filters, then
  // only the match events belonging to those specific matches.
  useEffect(() => {
    if (!selectedSportId || !data?.event_id) return;
    let cancelled = false;
    setIsFetchingScores(true);
    LiveScoresAPI.getMatchesWithTeams(data.event_id, selectedSportId, {
      status: selectedStatus || null,
      leagueName: selectedLeague || null,
      matchDate: selectedDate || null,
    }).then(async (matches) => {
      if (cancelled) return;
      setLiveMatches(matches || []);
      const matchIds = (matches || []).map(m => m.id);
      const events = await MatchEventsAPI.getByMatchIds(matchIds);
      if (cancelled) return;
      const grouped = {};
      events.forEach(ev => {
        if (!grouped[ev.match_id]) grouped[ev.match_id] = [];
        grouped[ev.match_id].push(ev);
      });
      setLiveMatchEvents(grouped);
    }).catch(err => console.error("Live Scores Matches Fetch Error:", err))
      .finally(() => { if (!cancelled) setIsFetchingScores(false); });
    return () => { cancelled = true; };
  }, [selectedSportId, selectedStatus, selectedLeague, selectedDate, data?.event_id]);

  // Lazy-load attendance scans and live scores settings after initial render
  useEffect(() => {
    if (!data?.event_id) return;
    LiveScoresAPI.getSettings(data.event_id)
      .then(s => setLiveScoreSettings(s || {}))
      .catch(() => setLiveScoreSettings({}));
    if (data.id) {
      Promise.all([
        AttendanceAPI.getAthleteAttendance(data.event_id, data.id),
        AttendanceAPI.getAthleteLogs(data.event_id, data.id)
      ]).then(([scans, logs]) => {
        setAthleteScans(scans || []);
        setAthleteLogs(logs || []);
      }).catch(console.error);
    }
  }, [data?.event_id, data?.id]);

  const [expandedMeetings, setExpandedMeetings] = useState([]);
  const [expandedDates, setExpandedDates] = useState({});

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // setIsInstallable(true); // DISABLED: Do not show automatic app install prompt
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const toggleMeeting = (groupName) => {
    setExpandedMeetings(prev => 
      prev.includes(groupName) ? prev.filter(m => m !== groupName) : [...prev, groupName]
    );
  };

  const toggleDate = (groupName, dateStr) => {
    setExpandedDates(prev => {
      const current = prev[groupName] || [];
      return {
        ...prev,
        [groupName]: current.includes(dateStr) ? current.filter(d => d !== dateStr) : [...current, dateStr]
      };
    });
  };

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

    // Birthday certificates are kept in their own group so they are NOT
    // overwritten when a new personal notification arrives.
    const birthdayMessages = messages
      .filter(m => m.type === "birthday")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const allMessages = [...generalMessages, ...targetedMessages, ...personalMessages, ...birthdayMessages]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Legacy fallback
    const fallbackMessage = generalMessages.length === 0 ? eventSettings["broadcast_message"] : null;

    return {
      generalMessages,
      targetedMessages,
      personalMessages,
      birthdayMessages,
      allMessages,
      fallbackMessage
    };
  }, [messages, eventSettings]);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (data?.event_id && data?.role) {
      loadMessages();
    }
  }, [data]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setPhase("Fetching Profile");
    try {
      console.log("APEX_DEBUG: Starting loadData for ID:", id);

      const fetchAccreditation = async () => {
        const cleanId = id.includes("ACC-") ? id.split("-").pop() : id;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || 
                       /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

        // 1. Primary Lookup (Fastest: UUID or Direct ID)
        if (isUUID) {
          const uuid = id.length === 36 ? id : cleanId;
          const { data } = await supabase.from("accreditations").select("*, events:event_id(id, name, slug, start_date, logo_url)").eq("id", uuid).maybeSingle();
          if (data) return { data, error: null };
        }

        // 2. Secondary Lookup (Accreditation ID or Badge Number)
        const filters = [`accreditation_id.eq.${id}`, `badge_number.eq.${id}`];
        if (id !== cleanId) {
          filters.push(`accreditation_id.eq.${cleanId}`, `badge_number.eq.${cleanId}`);
        }

        return supabase
          .from("accreditations")
          .select("*, events:event_id(id, name, slug, start_date, logo_url)")
          .or(filters.join(","))
          .maybeSingle();
      };

      const timeoutPromise = (ms, label) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout: ${label} after ${ms}ms`)), ms)
      );

      let accData = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        if (attempts > 1) {
          setPhase(`Retrying Profile Lookup (Attempt ${attempts}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        try {
          const { data, error } = await Promise.race([
            fetchAccreditation(),
            timeoutPromise(15000, `Fetch Attempt ${attempts}`)
          ]);

          if (error) {
            console.error(`APEX_DEBUG: Fetch error on attempt ${attempts}:`, error);
          }

          if (data) {
            accData = data;
            break;
          }
        } catch (err) {
          console.error(`APEX_DEBUG: Race error on attempt ${attempts}:`, err);
        }

        console.warn(`APEX_DEBUG: Accreditation not found on attempt ${attempts}`);
      }

      if (!accData) throw new Error("Accreditation profile not found. Please ensure the QR code is correct or try again in a moment.");

      console.log("APEX_DEBUG: Main data loaded:", accData.id);
      setPhase("Loading Event Details");

      const nameParts = (accData?.name || "").trim().split(/\s+/);
      const fname = nameParts[0] || "";
      const lname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      // APEX-DEEP: Split into Priority Load vs Lazy Load to fix QR Profile bottleneck
      // Attendance scans, attendance logs, and live scores settings are loaded lazily after render
      const [eSettings, fieldSets, matrix, legMatrix, gSettings, zonesResult, bConfigRaw] = await Promise.race([
        Promise.all([
          (async () => { const r = await (accData?.event_id ? EventSettingsAPI.getAll(accData.event_id) : Promise.resolve({})); return r; })(),
          (async () => { const r = await (accData?.event_id ? FormFieldSettingsAPI.getByEventId(accData.event_id) : Promise.resolve({})); return r; })(),
          (async () => { const r = await (accData?.id && accData?.role?.toLowerCase() === "athlete" ? AthleteEventsAPI.getForAthlete(accData.id) : Promise.resolve([])); return r; })(),
          (async () => { const r = await (accData?.event_id && accData?.role?.toLowerCase() === "athlete" ? HeatSheetMatrixAPI.getForAthlete(accData.event_id, fname, lname) : Promise.resolve([])); return r; })(),
          (async () => { const r = await GlobalSettingsAPI.getAll(); return r; })(),
          (async () => { const r = await (accData?.event_id ? ZonesAPI.getByEventId(accData.event_id) : Promise.resolve([])); return r; })(),
          (async () => { const r = await (accData?.event_id ? BookingsAPI.getConfig(accData.event_id) : Promise.resolve(null)); return r; })(), // Get config ONLY to see if active
        ]),
        timeoutPromise(30000, "Priority Metadata Sync")
      ]);

      const fConfig = null;
      const feedbackIsActiveRaw = false;
      const bConfig = bConfigRaw;
      const aBookings = [];
      const pBooking = null;

      console.log("APEX_DEBUG: All priority metadata synced");
      console.log("APEX_DEBUG: Finalizing data states...");
      setPhase("Applying Data");
      
      setData(accData);
      setEventSettings(eSettings);
      setFieldSettings(fieldSets || {});
      setAthleteMatrix(matrix || []);
      setLegacyMatrix(legMatrix || []);
      
      // APEX-DEEP: If no events found, perform a deep fuzzy search fallback
      if ((!matrix || matrix.length === 0) && (!legMatrix || legMatrix.length === 0) && accData?.role?.toLowerCase() === "athlete") {
        console.log("APEX_DEBUG: Triggering Deep Search Fallback...");
        const deepSearch = await HeatSheetMatrixAPI.getForAthlete(accData.event_id, fname.substring(0, 4), lname.substring(0, 4));
        if (deepSearch && deepSearch.length > 0) {
           console.log(`APEX_DEBUG: Deep Search found ${deepSearch.length} potential matches.`);
           setLegacyMatrix(deepSearch);
        }
      }

      setGlobSettings(gSettings || {});
      setAllZones(zonesResult || []);
      setBookingConfig(bConfig);
      setAllBookings(aBookings || []);
      if (pBooking) {
        setParticipantBookings(pBooking);
      }

      // APX-DEBUG: Log raw data for zone sync diagnosis
      console.group("APX-ZONE-SYNC-DEBUG");
      console.log("Athlete ID used for scan query:", accData?.id);
      console.log("Event ID used for scan query:", accData?.event_id);
      console.log("allZones count:", (zonesResult || []).length);
      console.log("allZones raw (settings):", (zonesResult || []).map(z => ({ name: z.name, code: z.code, settings: z.settings })));
      console.groupEnd();
      
      const feedbackIsActive = feedbackIsActiveRaw === 'true' || feedbackIsActiveRaw === true;
      setFeedbackConfig(fConfig ? { ...fConfig, is_active: feedbackIsActive } : null);

      console.log("APEX_DEBUG: State updates dispatched");


      // APX-P0: Analytics Logging (No Official Attendance)
      if (accData?.event_id) {
        // We still determine if they WOULD have access if scanning a zone,
        // so the UI can display the correct banner (Access Granted/Denied).
        if (targetZone) {
          const scannerLocation = zonesResult.find(z => z.code === targetZone)?.name || `Zone ${targetZone}`;
          const athleteZones = (accData.zone_code || "").split(",").map(z => z.trim());
          const hasAccess = athleteZones.includes("∞") || athleteZones.includes(targetZone);

          setScannerResult({
            status: hasAccess ? "granted" : "denied",
            zoneName: scannerLocation
          });
        }

        // Log the view for analytics without affecting official attendance metrics
        AttendanceAPI.logScanEvent({
          eventId: accData.event_id,
          athleteId: accData.id,
          scanMode: "public_profile_view",
          deviceLabel: "Athlete-Self-Service"
        }).catch(e => console.warn("Profile view log failed:", e));
      }

      if (accData?.events?.name) {
        setMedalsLoading(true);
        try {
          const compName = accData.events.name.trim().toLowerCase();
          const { data: mData } = await Promise.race([
            supabase.from("medal_results").select("*").ilike("competition", compName),
            timeoutPromise(5000, "Medal Sync")
          ]);

          if (mData && mData.length > 0) {
            const processed = mData.map(r => {
              const ageMatch = r.age_group.match(/^(\d+\s*&\s*Over|\d+\s*-\s*\d+|\d+\s*Year\s*Olds)/i);
              const ageCategory = ageMatch ? ageMatch[1] : r.age_group;
              return { ...r, ageCategory };
            });
            setLiveMedals(processed);
          }
        } catch (e) {
          console.warn("Medal sync bypassed:", e.message);
        } finally {
          setMedalsLoading(false);
        }
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
    } finally {
      setLoading(false);
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

  const handleBookSlot = async (slotId) => {
    setIsBooking(true);
    try {
      const occupancy = allBookings.filter(b => b.slot_id === slotId).length;
      const slot = bookingConfig.slots.find(s => s.id === slotId);
      if (occupancy >= slot.max_capacity) {
        toast.error("This slot is now fully booked. Please select another time.");
        return;
      }
      
      const newBooking = await BookingsAPI.bookSlot(data.event_id, data.id, slotId, slot.group_name);
      
      // Update local participant bookings
      const updatedPBookings = await BookingsAPI.getParticipantBooking(data.event_id, data.id);
      setParticipantBookings(updatedPBookings || []);
      setEditingMeetings(prev => prev.filter(m => m !== slot.group_name));
      
      const updatedBookings = await BookingsAPI.getBookings(data.event_id);
      setAllBookings(updatedBookings || []);
      
      toast.success("Booking confirmed successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to book slot. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async (slotId, groupName) => {
    setIsBooking(true);
    try {
      console.log(`Cancelling booking for slotId: ${slotId}, groupName: ${groupName}`);
      const cancelResult = await BookingsAPI.cancelBooking(data.event_id, data.id, slotId);
      console.log("Cancel Result Data:", cancelResult);
      
      const updatedPBookings = await BookingsAPI.getParticipantBooking(data.event_id, data.id);
      console.log("Updated bookings after cancel:", updatedPBookings);
      setParticipantBookings(updatedPBookings || []);
      setEditingMeetings(prev => prev.filter(m => m !== groupName));
      
      const updatedBookings = await BookingsAPI.getBookings(data.event_id);
      setAllBookings(updatedBookings || []);
      
      toast.success("Booking cancelled.");
    } catch (err) {
      console.error("Cancel Booking Error:", err);
      toast.error("Failed to cancel booking.");
    } finally {
      setIsBooking(false);
    }
  };

  const mergedEvents = React.useMemo(() => {
    try {
      if (!data) return [];
      console.log("APEX_DEBUG: Merging Events Flow", {
        athleteMatrixCount: athleteMatrix?.length,
        legacyMatrixCount: legacyMatrix?.length,
        accreditationId: data.id
      });

      const allModern = [...(athleteMatrix || [])];
      (legacyMatrix || []).forEach(leg => {
        if (!leg) return;
        // APX-Fix: Match by event_code more aggressively to ensure times are synced
        const existing = allModern.find(m => String(m.event_code) === String(leg.event_code));
        
        if (existing) {
          // Sync missing metadata from legacy matrix
          if (!existing.heat || existing.heat === 0) existing.heat = leg.heat;
          if (!existing.lane || existing.lane === 0) existing.lane = leg.lane;
          if (!existing.race_time && leg.race_time) existing.race_time = leg.race_time;
          if (!existing.call_room_time && leg.call_room_time) existing.call_room_time = leg.call_room_time;
          if (!existing.session_name && leg.session_name) existing.session_name = leg.session_name || leg.session_time;
          if (!existing.seed_time && leg.seed_time) existing.seed_time = leg.seed_time || leg.seedTime;
          if (!existing.team_name && leg.team) existing.team_name = leg.team;
        } else {
          // If not in modern table, add as new legacy record
          allModern.push({
            ...leg,
            round: leg.round || 'Finals',
            event_name: leg.event_name || `Event ${leg.event_code}`,
            seed_time: leg.seed_time || leg.seedTime,
            team_name: leg.team
          });
        }
      });

      const matrixRows = [...allModern];
      const grouped = {};

      matrixRows.forEach(row => {
        if (!row) return;
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

      const sorted = finalResults.sort((a, b) => {
        const numA = parseInt(a.event_code, 10);
        const numB = parseInt(b.event_code, 10);
        if (isNaN(numA) && isNaN(numB)) return String(a.event_code).localeCompare(String(b.event_code));
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      });

      console.log("APEX_DEBUG: Final Merged Events", sorted);
      return sorted;
    } catch (e) {
      console.error("CRITICAL: MergedEvents Error:", e);
      return athleteMatrix || []; // Fallback to modern only
    }
  }, [athleteMatrix, legacyMatrix, data]);

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
    } catch (e) { }
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

  // Whole-section toggle for the Event Gallery, mirroring the Live Scores
  // Enabled/Disabled switch. Absent setting (pre-existing events) defaults
  // to enabled so this stays backward compatible.
  const galleryEnabled = useMemo(() => {
    const eid = data?.event_id;
    if (!eid || !globSettings) return true;
    const v = globSettings[`event_${eid}_gallery_enabled`];
    return v === undefined || v === null ? true : v !== "false";
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

  // Group slots by meeting name and then date
  const groupedSlots = React.useMemo(() => {
    if (!bookingConfig || !bookingConfig.slots) return {};
    const groups = {};
    bookingConfig.slots.forEach(slot => {
      const g = slot.group_name || "General Meeting";
      if (!groups[g]) groups[g] = {};
      const d = slot.date || "Unknown Date";
      if (!groups[g][d]) groups[g][d] = [];
      groups[g][d].push(slot);
    });
    
    // Sort times within dates
    Object.keys(groups).forEach(g => {
      Object.keys(groups[g]).forEach(d => {
        groups[g][d].sort((a, b) => new Date(`${a.date} ${a.time_frame.split('-')[0]}`) - new Date(`${b.date} ${b.time_frame.split('-')[0]}`));
      });
    });
    
    return groups;
  }, [bookingConfig]);

  const showForQR = (key) => {
    const loc = fieldSettings[key] || "both";
    return loc === "both" || loc === "qr";
  };

  // APX-Fix: Unified Allocated Sports Logic for Filtering and Display
  const allocatedSports = useMemo(() => {
    if (!data) return [];

    let selectedSports = [];
    if (Array.isArray(data.selected_sports)) selectedSports = data.selected_sports;
    else if (Array.isArray(data.selectedSports)) selectedSports = data.selectedSports;
    else if (typeof data.selected_sports === 'string' && data.selected_sports.startsWith('[')) {
       try { selectedSports = JSON.parse(data.selected_sports); } catch(e) {}
    }

    // Fallback: If no explicit sports selected, pull from assigned events
    const matrixSports = athleteMatrix?.map(e => e.event_name || e.event_code) || [];
    
    const combined = [...selectedSports, ...matrixSports];
    const unique = [];
    const seen = new Set();
    combined.forEach(s => {
      if (!s) return;
      const normalized = String(s).trim().toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(String(s).trim());
      }
    });
    return unique;
  }, [data, athleteMatrix]);

  const hasZoneScan = (zone) => {
    if (!athleteScans || athleteScans.length === 0) return false;
    
    const zName = (zone.name || "").toUpperCase().trim();
    const zCode = String(zone.code || "").toUpperCase().trim();
    
    return athleteScans.some(s => {
      const locString = (s.scanner_location || "").toUpperCase().trim();
      const locations = locString.split(",").map(l => l.trim());
      
      return locations.some(loc => {
        return loc === zName || 
               loc === zCode || 
               loc === `ZONE-${zCode}` ||
               loc.startsWith(zName) ||
               loc.includes(`[${zCode}]`) ||
               (zCode.length > 1 && loc.includes(zCode));
      });
    });
  };

  const visibleClearances = useMemo(() => {
    if (!allZones) return [];
    return allZones.filter(z => {
      const settings = z.settings || {};
      const isPermanent = settings.scanMode === 'permanent' || settings.scan_mode === 'permanent';
      const isHidden = settings.isHidden === true || settings.isHidden === 'true';
      
      const isKnownClearance = ["X2", "Z3", "M4", "A1"].includes(String(z.code).toUpperCase().trim());
      
      if (isHidden || isKnownClearance) return hasZoneScan(z);
      return isPermanent;
    });
  }, [allZones, athleteScans]);

  const visibleTechnicalDocs = useMemo(() => {
    if (!technicalDocs) return [];
    return technicalDocs.filter(doc => {
      if (!doc.sport || doc.sport === "General") return true;
      const normalizedDocSport = doc.sport.trim().toUpperCase();
      return allocatedSports.some(s => s.trim().toUpperCase() === normalizedDocSport);
    });
  }, [technicalDocs, allocatedSports]);

  const visibleOfficialDocs = useMemo(() => {
    if (!officialDocs) return [];
    return officialDocs.filter(doc => {
      if (!doc.sport || doc.sport === "General") return true;
      const normalizedDocSport = doc.sport.trim().toUpperCase();
      return allocatedSports.some(s => s.trim().toUpperCase() === normalizedDocSport);
    });
  }, [officialDocs, allocatedSports]);

  // Resolve every storage asset this public page renders through the
  // public-verify-assets edge function. Flag OFF (default): synchronous public
  // URLs, byte-identical to today. Flag ON (private bucket): short-lived signed
  // URLs the anonymous page can't mint itself. Read as `assetUrls[storedValue]`.
  const profileAssetValues = useMemo(() => {
    const vals = [data?.photo_url, data?.heat_sheet_url, data?.event_result_url];
    [...visibleTechnicalDocs, ...visibleOfficialDocs, ...safetyDocs].forEach((d) => {
      if (d?.url) vals.push(d.url);
    });
    return vals.filter(Boolean);
  }, [data?.photo_url, data?.heat_sheet_url, data?.event_result_url, visibleTechnicalDocs, visibleOfficialDocs, safetyDocs]);
  const { urls: assetUrls } = usePublicAssetUrls(profileAssetValues, {
    accreditationId: data?.id,
    scope: "profile",
  });

  // Team logos on the live-scores matches sign under the event-scoped allowlist.
  const teamLogoValues = useMemo(
    () => liveMatches.flatMap((m) => [m.team_a_logo_url, m.team_b_logo_url]).filter(Boolean),
    [liveMatches]
  );
  const { urls: teamLogoUrls } = usePublicAssetUrls(teamLogoValues, {
    eventId: data?.event_id,
    scope: "live",
  });

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

  if (loading) return <ScanSkeleton id={id} phase={phase} />;
  if (error || !data) return <ScanError error={error} />;

  return (
    <ErrorBoundary>
      <div id="verify-accreditation-page" className="min-h-screen bg-[#050b18] text-slate-200 font-inter selection:bg-cyan-500/30">
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
                          m.type === "birthday"
                            ? "bg-pink-500/5 border-pink-500/20"
                            : m.type === "athlete"
                              ? "bg-indigo-500/5 border-indigo-500/20"
                              : (m.targetRoles?.length > 0 || m.targetZones?.length > 0)
                                ? "bg-blue-500/5 border-blue-500/20"
                                : "bg-emerald-500/5 border-emerald-500/20"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                            m.type === "birthday"
                              ? "bg-pink-500/20 text-pink-300"
                              : m.type === "athlete"
                                ? "bg-indigo-500/20 text-indigo-300"
                                : (m.targetRoles?.length > 0 || m.targetZones?.length > 0)
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                          )}>
                            {m.type === "birthday" ? "Birthday" : (m.type === "athlete" ? "Personal" : (m.targetRoles?.length > 0 || m.targetZones?.length > 0 ? "Targeted" : "General"))}
                          </span>
                          {m.createdAt && <span className="text-[10px] text-white/30 font-bold">{new Date(m.createdAt).toLocaleString()}</span>}
                        </div>
                        <p dir="auto" style={{ textAlign: 'start' }} className="text-white/80 font-medium leading-relaxed whitespace-pre-wrap">{m.message}</p>
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
          {/* PWA Install Prompt */}
          <AnimatePresence>
            {isInstallable && (
              <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                className="w-full mb-6 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between shadow-2xl border border-white/20 gap-4">
                  <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                    <div className="p-3 bg-white/20 rounded-xl shrink-0">
                      <Download className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-black uppercase tracking-wider text-sm sm:text-base">Install Event App</h3>
                      <p className="text-white/80 text-xs sm:text-sm font-medium">Add to your home screen for quick access</p>
                    </div>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="w-full sm:w-auto px-6 py-3 bg-white text-blue-600 hover:bg-slate-50 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-transform active:scale-95 whitespace-nowrap"
                  >
                    Install Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {eventSettings["banner_url"] && (
            <motion.div variants={itemVariants} className="w-full mb-3 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-white/5">
              <img src={eventSettings["banner_url"]} alt="Event banner" className="w-full h-auto object-contain bg-gray-900" />
            </motion.div>
          )}

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
                  <button 
                    onClick={() => loadData()}
                    className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl transition-all hover:bg-blue-100 active:scale-95"
                    title="Refresh Schedule"
                  >
                    <RotateCcw className="w-5 h-5 text-blue-600" />
                  </button>
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

          {data.status !== 'rejected' && showForQR("events") && (
            <motion.div
              variants={itemVariants}
              className="w-full relative mb-6"
            >
              <div className="bg-white rounded-[1.5rem] shadow-xl p-5 border border-slate-100 relative z-10">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="w-20 h-24 border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                        {data.photo_url && assetUrls[data.photo_url] ? (
                          <img src={getThumbnailUrl(assetUrls[data.photo_url], 400)} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h1 className="text-xl md:text-2xl font-black text-[#2D4A9E] uppercase tracking-tight flex items-center gap-3">
                            {data.first_name} {data.last_name}
                            {visibleClearances.length > 0 && (
                              <div className="hidden md:flex items-center gap-2 ml-4">
                                {visibleClearances.map(z => (
                                  <div 
                                    key={z.id}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    {z.code} DONE
                                  </div>
                                ))}
                              </div>
                            )}
                          </h1>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide mb-2">{data.club || "Individual Participant"}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded-md uppercase">{data.role}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded-md uppercase">{data.gender}</span>
                            {allocatedSports.map((sport, idx) => (
                              <span key={`sport-${idx}`} className="px-2.5 py-0.5 bg-cyan-50 border border-cyan-100 text-[9px] font-black text-cyan-600 rounded-md uppercase shadow-sm whitespace-nowrap">
                                {sport}
                              </span>
                            ))}
                          </div>
                        </div>

                        {visibleClearances.length > 0 && (
                          <div className="flex md:hidden flex-wrap gap-2">
                            {visibleClearances.map(z => (
                              <div 
                                key={z.id}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm"
                              >
                                <CheckCircle className="w-3 h-3" />
                                {z.code} DONE
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-900 uppercase">ID: {data.accreditation_id?.split("-")?.pop() || data.id?.slice(0, 8)}</span>
                      <span className="text-[9px] font-black text-slate-900 uppercase">Badge: {data.badge_number}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3">
                        {data.nationality && (
                          <div className="flex items-center gap-1.5">
                            {getCountryFlag(data.nationality) && <img src={getCountryFlag(data.nationality)} alt="flag" className="w-6 shadow-sm rounded-sm" />}
                            <span className="text-[10px] font-black text-slate-900 uppercase">{getCountryCode3(data.nationality)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {data.status !== 'rejected' && mergedEvents.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <EventsAccordion events={mergedEvents} />
                  </div>
                )}
              </div>
            </motion.div>
          )}

        {data.status !== 'rejected' && (
          <div className="w-full space-y-4">
            <div className="mt-4">
              <AnimatePresence>
                <div className="space-y-4">
                  {(filteredMessages.generalMessages.length > 0 || filteredMessages.fallbackMessage) && (
                    <ExpandableMessageGroup
                      title="General Broadcast"
                      messages={filteredMessages.generalMessages.length > 0 ? filteredMessages.generalMessages : (filteredMessages.fallbackMessage ? [{ message: filteredMessages.fallbackMessage, type: "global", createdAt: eventSettings["message_updated_at"] }] : [])}
                      icon={<Globe className="w-5 h-5" />}
                      isGeneral
                      accreditationId={data?.id}
                      onRead={recalculateUnread}
                    />
                  )}

                  {filteredMessages.targetedMessages.length > 0 && (
                    <ExpandableMessageGroup
                      title="Targeted Update"
                      messages={filteredMessages.targetedMessages}
                      icon={<Search className="w-5 h-5" />}
                      isTargeted
                      accreditationId={data?.id}
                      onRead={recalculateUnread}
                    />
                  )}

                  {filteredMessages.personalMessages.length > 0 && (
                    <ExpandableMessageGroup
                      title="Personal Notification"
                      messages={filteredMessages.personalMessages}
                      icon={<MessageSquare className="w-5 h-5" />}
                      isPersonal
                      accreditationId={data?.id}
                      onRead={recalculateUnread}
                    />
                  )}

                  {filteredMessages.birthdayMessages.length > 0 && (
                    <ExpandableMessageGroup
                      title="Birthday Wishes"
                      messages={filteredMessages.birthdayMessages}
                      icon={<Gift className="w-5 h-5" />}
                      isBirthday
                      accreditationId={data?.id}
                      onRead={recalculateUnread}
                    />
                  )}
                </div>
              </AnimatePresence>
            </div>

            {bookingConfig?.is_active && (bookingConfig.allowed_categories || []).map(c => c.toLowerCase()).includes((data.role || '').toLowerCase()) && data.status !== 'rejected' && (
              <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <button 
                  onClick={() => setIsBookingExpanded(!isBookingExpanded)}
                  className="w-full flex items-center justify-between p-5 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">{bookingConfig.title || "Event Slot Booking"}</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{bookingConfig.description || "Manage your schedule"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
                    {isBookingExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isBookingExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5">

                  <div className="space-y-6">
                    {Object.entries(groupedSlots).length === 0 && (
                      <div className="text-center p-4 text-xs font-bold text-slate-400 uppercase border border-dashed border-slate-200 rounded-xl">No slots available</div>
                    )}
                    
                    {Object.entries(groupedSlots).map(([groupName, dates]) => {
                      const hiddenDates = bookingConfig.hidden_dates || [];
                      const visibleDates = Object.entries(dates).filter(([dateStr]) => !hiddenDates.includes(`${groupName}_${dateStr}`));
                      const currentBooking = participantBookings.find(b => b.group_name === groupName);
                      
                      // Skip rendering this group if it has no visible dates and the user has no booking for it
                      if (visibleDates.length === 0 && !currentBooking) return null;
                      
                      const isEditing = editingMeetings.includes(groupName);
                      
                      const isMeetingExpanded = expandedMeetings.includes(groupName);
                      
                      if (currentBooking && !isEditing) {
                        return (
                          <div key={groupName} className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 text-emerald-500/10 rotate-12 pointer-events-none">
                              <CheckCircle2 className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-2 text-emerald-700 relative z-10">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-xs font-black uppercase tracking-wider">{groupName} Confirmed</span>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-emerald-100 flex items-center justify-between shadow-sm relative z-10">
                              <div>
                                <p className="text-sm font-black text-slate-900 mt-1">
                                  {bookingConfig.slots?.find(s => s.id === currentBooking.slot_id)?.time_frame || "Unknown Time"}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                  {bookingConfig.slots?.find(s => s.id === currentBooking.slot_id)?.date || "Unknown Date"}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 z-20">
                                <button 
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingMeetings(prev => [...prev, groupName]); setExpandedMeetings(prev => prev.includes(groupName) ? prev : [...prev, groupName]); }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-lg transition-colors cursor-pointer"
                                >
                                  Change Slot
                                </button>
                                <button 
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelBooking(currentBooking.slot_id, groupName); }}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" /> Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={groupName} className="space-y-2 border border-slate-100 bg-white rounded-2xl overflow-hidden shadow-sm">
                          <button 
                            onClick={() => toggleMeeting(groupName)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100/50"
                          >
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                              {isMeetingExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />}
                              {groupName}
                            </h3>
                            {isEditing && (
                              <div 
                                onClick={(e) => { e.stopPropagation(); setEditingMeetings(prev => prev.filter(m => m !== groupName)); }}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase bg-white px-2 py-1 rounded shadow-sm border border-slate-200 cursor-pointer"
                              >
                                Cancel Change
                              </div>
                            )}
                          </button>
                          
                          <AnimatePresence>
                            {isMeetingExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 space-y-3">
                                  {visibleDates.map(([dateStr, slots]) => {
                                    const isDateExpanded = (expandedDates[groupName] || []).includes(dateStr);
                                    return (
                                      <div key={dateStr} className="space-y-2 border border-blue-50/50 rounded-xl overflow-hidden">
                                        <button 
                                          onClick={() => toggleDate(groupName, dateStr)}
                                          className="w-full flex items-center gap-2 p-3 bg-blue-50/30 hover:bg-blue-50/50 transition-colors"
                                        >
                                          {isDateExpanded ? <ChevronDown className="w-3.5 h-3.5 text-blue-500" /> : <ChevronRight className="w-3.5 h-3.5 text-blue-500" />}
                                          <h4 className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" /> {dateStr}
                                          </h4>
                                        </button>
                                        
                                        <AnimatePresence>
                                          {isDateExpanded && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: "auto", opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="p-3 pt-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                {slots.map(slot => {
                                                  const occupancy = allBookings.filter(b => b.slot_id === slot.id).length;
                                                  const isFull = occupancy >= slot.max_capacity;
                                                  const isCurrent = currentBooking?.slot_id === slot.id;
                                                  
                                                  if (isFull && !isCurrent) return null;

                                                  return (
                                                    <button
                                                      key={slot.id}
                                                      disabled={isBooking || isFull}
                                                      onClick={() => handleBookSlot(slot.id)}
                                                      className={cn(
                                                        "flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border transition-all duration-200 shadow-sm",
                                                        isCurrent 
                                                          ? "bg-blue-600 border-blue-600 cursor-default ring-2 ring-blue-600 ring-offset-2" 
                                                          : "bg-slate-900 border-slate-800 hover:border-blue-400 hover:bg-slate-800 cursor-pointer",
                                                        isBooking && "opacity-50 cursor-not-allowed"
                                                      )}
                                                    >
                                                      <div className="text-xs font-black mb-1 text-white">
                                                        {slot.time_frame.split(' - ')[0]}
                                                      </div>
                                                      <div className={cn("text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider", isCurrent ? "text-blue-100" : "text-emerald-400")}>
                                                        {isCurrent ? "Current" : (
                                                          <>
                                                            <span className={cn("w-1.5 h-1.5 rounded-full", isFull ? "bg-red-400" : "bg-emerald-400")}></span>
                                                            {slot.max_capacity - occupancy} Left
                                                          </>
                                                        )}
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
            )}
            
            {galleryEnabled && (
              <QRProfileGallery
                eventId={data.event_id}
                matchedPhotoIds={data.documents?.matched_photos || []}
              />
            )}

            {liveScoreSettings?.live_scores_enabled && (
              <div className="w-full mb-6">
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setIsLiveScoresExpanded(!isLiveScoresExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        <Activity className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Live Scores</h2>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                          View Match Results
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
                      {isLiveScoresExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isLiveScoresExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white"
                      >
                        <div className="p-6">
                          {!isSportsLoaded && isFetchingScores ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                          ) : (
                            <>
                              {/* Sport chips — nothing else loads until one is picked */}
                              <div className="flex flex-wrap gap-2 mb-4">
                                {liveSports.map(sport => (
                                  <button
                                    key={sport.id}
                                    onClick={() => setSelectedSportId(sport.id)}
                                    className={cn(
                                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                                      selectedSportId === sport.id
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300"
                                    )}
                                  >
                                    {sport.sport_name}{sport.gender ? ` (${sport.gender})` : ""}
                                  </button>
                                ))}
                                {liveSports.length === 0 && (
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">No sports configured yet</p>
                                )}
                              </div>

                              {selectedSportId && (
                                <>
                                  {/* Status / League / Date filters, scoped to the chosen sport */}
                                  <div className="grid grid-cols-3 gap-2 mb-4">
                                    <select
                                      value={selectedStatus}
                                      onChange={(e) => setSelectedStatus(e.target.value)}
                                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-700 outline-none"
                                    >
                                      <option value="">All Statuses</option>
                                      {STATUS_FILTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <select
                                      value={selectedLeague}
                                      onChange={(e) => setSelectedLeague(e.target.value)}
                                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-700 outline-none"
                                    >
                                      <option value="">All Leagues</option>
                                      {filterOptions.leagueNames.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                    <select
                                      value={selectedDate}
                                      onChange={(e) => setSelectedDate(e.target.value)}
                                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-700 outline-none"
                                    >
                                      <option value="">All Dates</option>
                                      {filterOptions.matchDates.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                  </div>

                                  <div className="flex items-center justify-end mb-4">
                                    <button
                                      onClick={() => LiveScoresAPI.getMatchesWithTeams(data.event_id, selectedSportId, {
                                        status: selectedStatus || null, leagueName: selectedLeague || null, matchDate: selectedDate || null,
                                      }).then(setLiveMatches)}
                                      disabled={isFetchingScores}
                                      className="px-4 py-2 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2"
                                    >
                                      <RotateCcw className={cn("w-3.5 h-3.5", isFetchingScores && "animate-spin")} />
                                      {isFetchingScores ? "Updating..." : "Refresh Scores"}
                                    </button>
                                  </div>

                                  {isFetchingScores ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                                  ) : liveMatches.length === 0 ? (
                                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase p-8">No matches match these filters</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {liveMatches.map(match => {
                                        const isLive = match.status === "Live" || match.status === "Half Time / Break";
                                        const showScore = isLive || match.status === "Finished";
                                        return (
                                        <div key={match.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
                                          <div className="flex justify-between items-center">
                                            <span className={cn(
                                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                              match.status === "Live" ? "bg-red-500 text-white animate-pulse" :
                                              match.status === "Half Time / Break" ? "bg-amber-100 text-amber-600" :
                                              match.status === "Finished" ? "bg-slate-200 text-slate-500" :
                                              match.status === "Cancelled" ? "bg-red-100 text-red-600" :
                                              match.status === "Postponed" ? "bg-amber-100 text-amber-600" :
                                              "bg-blue-100 text-blue-600"
                                            )}>
                                              {match.status}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{match.match_title}</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 flex items-center justify-end gap-2 text-right">
                                              <p className="text-xs font-bold text-slate-800 truncate">{match.team_a_name || 'TBA'}</p>
                                              <TeamBadge logoUrl={teamLogoUrls[match.team_a_logo_url]} country={match.team_a_country} name={match.team_a_name} size="sm" />
                                            </div>
                                            {showScore ? (
                                              <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
                                                <span className="text-sm font-black text-emerald-600">{match.team_a_score}</span>
                                                <span className="text-[10px] text-slate-300">-</span>
                                                <span className="text-sm font-black text-emerald-600">{match.team_b_score}</span>
                                              </div>
                                            ) : (
                                              <div className="px-3 py-1 shrink-0">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">vs</span>
                                              </div>
                                            )}
                                            <div className="flex-1 flex items-center gap-2 text-left">
                                              <TeamBadge logoUrl={teamLogoUrls[match.team_b_logo_url]} country={match.team_b_country} name={match.team_b_name} size="sm" />
                                              <p className="text-xs font-bold text-slate-800 truncate">{match.team_b_name || 'TBA'}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {match.match_date}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {match.match_time}</span>
                                            <span>{match.venue}</span>
                                          </div>
                                          {(liveMatchEvents[match.id] || []).length > 0 && (
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
                                              {liveMatchEvents[match.id].map(ev => (
                                                <span key={ev.id} className="flex items-center gap-1">
                                                  <span className="text-emerald-600 font-bold">{ev.event_type}</span> {ev.player_name}
                                                  {ev.minute ? ` ${ev.minute}'` : ""}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {data.role?.toLowerCase() === "athlete" && (
              <div className="w-full mb-6">
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <button
                    onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-cyan-50 rounded-xl">
                        <Target className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Season Stats</h2>
                        <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">Accumulated Performance</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
                      {isStatsExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isStatsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white"
                      >
                        <div className="p-6">
                          {isFetchingStats ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>
                          ) : seasonStats.length === 0 ? (
                            <p className="text-center text-[10px] font-bold text-slate-400 uppercase p-8">No stats recorded yet</p>
                          ) : (
                            <div className="space-y-4">
                              {seasonStats.map(row => {
                                const fields = getStatFieldsForSport(row.standings_type);
                                return (
                                  <div key={row.sport_id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-black text-slate-900 uppercase tracking-wide">{row.sport_name || getSportStatLabel(row.standings_type)}</span>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">{row.matches_played} {row.matches_played === 1 ? "Match" : "Matches"}</span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                      {fields.map(f => (
                                        <div key={f.key} className="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                          <p className="text-lg font-black text-cyan-600">{row.stats?.[f.key] ?? 0}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{f.short}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* -------------------------------------- */}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <DownloadButton url={assetUrls[data.heat_sheet_url]} visible={showForQR("heat_sheet_pdf")} label="Heat Sheet" color="blue" />
              <DownloadButton url={assetUrls[data.event_result_url]} visible={showForQR("event_result_pdf")} label="Athlete Result" color="emerald" />
            </div>

            {visibleTechnicalDocs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 px-2">Result Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {visibleTechnicalDocs.map(doc => (
                    <DownloadButton key={doc.id || doc.url} url={assetUrls[doc.url]} visible={true} label={doc.title || doc.name} color="blue" />
                  ))}
                </div>
              </div>
            )}

            {visibleOfficialDocs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 px-2">Official Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {visibleOfficialDocs.map(doc => (
                    <DownloadButton key={doc.id || doc.url} url={assetUrls[doc.url]} visible={true} label={doc.title || doc.name} color="emerald" />
                  ))}
                </div>
              </div>
            )}

            {safetyDocs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 px-2">Safety Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {safetyDocs.map(doc => (
                    <DownloadButton key={doc.id || doc.url} url={assetUrls[doc.url]} visible={true} label={doc.title || doc.name} color="blue" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <motion.p variants={itemVariants} className="mt-12 text-white/20 text-[10px] uppercase font-black tracking-[0.5em] text-center">Apex Sports Accreditation System</motion.p>
      </motion.div>

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
                  const ranked = Object.values(swimmers).sort((a, b) => (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze)).slice(0, 20);
                  if (ranked.length === 0) return (<div className="py-20 text-center opacity-20 font-black uppercase text-xs">No Data Found</div>);
                  return (
                    <div className="space-y-2">
                      {ranked.map((r, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between group shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", i < 3 ? "bg-slate-900 text-white" : "text-slate-300")}>{i + 1}</div>
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
  </ErrorBoundary>
  );
}



