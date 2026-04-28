import React, { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Upload, Save, Trash2, Clock, Users, Search, Check, X, AlertCircle, CheckCircle, Paperclip, ChevronDown, Gift } from "lucide-react";


import { EventSettingsAPI, BroadcastV2API, SportEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AccreditationsAPI } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { ROLES } from "../../lib/utils";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { cn } from "../../lib/utils";
import BirthdayBroadcastPage from "./BirthdayBroadcastPage";


const SUB_TABS = [
  { id: "general", label: "General Broadcast", icon: Globe },
  { id: "targeted", label: "Targeted Broadcast", icon: Search },
  { id: "athlete", label: "Athlete QR Broadcast", icon: Users },
  { id: "birthday", label: "Birthday", icon: Gift }
];




const INITIAL_DRAFT_TEMPLATE = {
  general: { message: "", file: null },
  targeted: { message: "", targets: [], zones: [], file: null },
  athlete: { message: "", selectedAthletes: [], selectedClubs: [], selectedHeats: [], file: null },
  birthday: { message: "", file: null }
};


export default function GlobalBroadcastPanel({ eventId, onToast, disabled = false }) {
  const [activeSubTab, setActiveSubTab] = useState("general");
  
  // Requirement: Make broadcast messages independent per event
  const [eventDrafts, setEventDrafts] = useState({});

  // Safer drafting that avoids mutating constants during render
  const currentDrafts = React.useMemo(() => {
    const raw = eventDrafts[eventId] || {};
    return {
      general: { ...INITIAL_DRAFT_TEMPLATE.general, ...(raw.general || {}) },
      targeted: { ...INITIAL_DRAFT_TEMPLATE.targeted, ...(raw.targeted || {}) },
      athlete: { ...INITIAL_DRAFT_TEMPLATE.athlete, ...(raw.athlete || {}) },
      birthday: { ...INITIAL_DRAFT_TEMPLATE.birthday, ...(raw.birthday || {}) }
    };
  }, [eventId, eventDrafts]);

  const updateDraft = (tab, updates) => {
    if (!tab) return;
    setEventDrafts(prev => {
      const eventState = { ...INITIAL_DRAFT_TEMPLATE, ...(prev[eventId] || {}) };
      const tabState = { ...INITIAL_DRAFT_TEMPLATE[tab], ...(eventState[tab] || {}) };
      return {
        ...prev,
        [eventId]: {
          ...eventState,
          [tab]: { ...tabState, ...updates }
        }
      };
    });
  };

  return (

    <div id="global-broadcast-panel" className="space-y-4">
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 flex-1 px-3 py-2 rounded font-extralight text-lg transition-colors ${
                activeSubTab === tab.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

        <GeneralBroadcastPage 
          eventId={eventId} 
          onToast={onToast} 
          draft={currentDrafts.general}
          setDraft={(d) => updateDraft("general", d)}
          disabled={disabled}
        />
      )}
      {activeSubTab === "targeted" && (
        <TargetedBroadcastPage 
          eventId={eventId} 
          onToast={onToast} 
          draft={currentDrafts.targeted}
          setDraft={(d) => updateDraft("targeted", d)}
          disabled={disabled}
        />
      )}
      {activeSubTab === "athlete" && (
        <AthleteQRBroadcastPage 
          eventId={eventId} 
          onToast={onToast} 
          draft={currentDrafts.athlete}
          setDraft={(d) => updateDraft("athlete", d)}
          disabled={disabled}
        />
      )}
      {activeSubTab === "birthday" && (
        <BirthdayBroadcastPage 
          eventId={eventId} 
          onToast={onToast} 
          draft={currentDrafts.birthday}
          setDraft={(d) => updateDraft("birthday", d)}
          disabled={disabled}
        />
      )}
    </div>

  );
}

/* ─── Success Confirmation Overlay ──────────────────────────── */
function SuccessOverlay({ show, message, onClose }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-gray-800 border border-emerald-500/30 rounded-3xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-emerald-900/20 transform animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Broadcast Sent!</h3>
        <p className="text-gray-400 text-sm font-medium mb-6">{message}</p>
        <button 
          onClick={onClose}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all w-full"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ─── General Broadcast Page (Strictly Global) ──────────────── */
function GeneralBroadcastPage({ eventId, onToast, draft, setDraft, disabled }) {
  const { message = "", file: attachmentFile = null } = draft || {};

  const setMessage = (m) => setDraft({ message: m });
  const setAttachmentFile = (f) => setDraft({ file: f });
  
  const [saving, setSaving] = useState(false);
  const [msgUpdatedAt, setMsgUpdatedAt] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [currentAttachment, setCurrentAttachment] = useState(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const attachInputRef = useRef(null);

  // Requirement: Load latest from DB only if draft is currently empty for this event
  useEffect(() => { 
    if (eventId && !message) {
      loadLatest(); 
    }
  }, [eventId]);

  const loadLatest = async () => {
    try {
      const { data: broadcasts } = await supabase
        .from("broadcasts_v2")
        .select("id, message, created_at, attachment_url, attachment_name")
        .eq("event_id", eventId)
        .eq("type", "global")
        .is("target_roles", null)
        .is("target_zones", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (broadcasts?.[0]) {
        const b = broadcasts[0];
        // Only update if current message is still empty (to avoid races)
        setDraft({ message: b.message || "" });
        setMsgUpdatedAt(b.created_at);
        if (b.attachment_url) setCurrentAttachment({ url: b.attachment_url, name: b.attachment_name, broadcastId: b.id });
      }
    } catch (err) { console.error(err); }
  };

  const saveMessage = async () => {
    if (!message.trim()) { onToast?.("Please enter a message", "error"); return; }
    setSaving(true);
    try {
      let attachmentUrl = null, attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url; attachmentName = attachmentFile.name || filename;
      }
      await BroadcastV2API.sendGlobal(message, eventId, attachmentUrl, attachmentName, null, null);
      setSuccessInfo("General broadcast sent to all participants.");
      // Refresh to get the latest sent info
      loadLatest();
    } catch (err) { onToast?.("Failed: " + err.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl space-y-6">
      <SuccessOverlay show={!!successInfo} message={successInfo} onClose={() => setSuccessInfo(null)} />
      <div className="flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /><h3 className="text-xl font-bold text-white uppercase tracking-tight">General Broadcast</h3></div>
      <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
        <div className="flex justify-between items-center">
          <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">Audience: Everyone</p>
          {msgUpdatedAt && (
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Last Broadcast: {new Date(msgUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={disabled ? "View only" : "Message for everyone..."} disabled={disabled} className={cn("w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all resize-none", disabled && "opacity-50 cursor-not-allowed")} />
      <div className="flex items-center gap-3">
        <label className={cn("flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 transition-all", disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer")}>
          <Paperclip className="w-4 h-4 text-emerald-400" />
          <span>{attachmentFile ? attachmentFile.name : currentAttachment ? "Replace PDF" : "Attach PDF/Image"}</span>
          {!disabled && <input ref={attachInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />}
        </label>
        <Button onClick={saveMessage} variant="primary" loading={saving} icon={Save} disabled={disabled}>Send to Everyone</Button>
      </div>
    </div>
  );
}

/* ─── Targeted Broadcast Page (Roles & Zones) ────────────────── */
function TargetedBroadcastPage({ eventId, onToast, draft, setDraft, disabled }) {
  const { 
    message = "", 
    targets = [], 
    zones = [], 
    file: attachmentFile = null 
  } = draft || {};

  
  const setMessage = (m) => setDraft({ message: m });
  const setTargets = (t) => setDraft({ targets: typeof t === 'function' ? t(targets) : t });
  const setSelectedZones = (z) => setDraft({ zones: typeof z === 'function' ? z(zones) : z });
  const setAttachmentFile = (f) => setDraft({ file: f });
  
  const [eventZones, setEventZones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (eventId) {
      supabase.from("zones").select("code, name").eq("event_id", eventId).order("code").then(({ data }) => setEventZones(data || []));
    }
  }, [eventId]);

  const toggleTarget = role => {
    if (disabled) return;
    setTargets(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };
  const toggleZone = code => {
    if (disabled) return;
    setSelectedZones(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const saveMessage = async () => {
    if (!message.trim()) { onToast?.("Enter a message", "error"); return; }
    if (targets.length === 0 && zones.length === 0) { onToast?.("Select at least one role or zone", "error"); return; }
    setSaving(true);
    try {
      let attachmentUrl = null, attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url; attachmentName = attachmentFile.name || filename;
      }
      await BroadcastV2API.sendGlobal(message, eventId, attachmentUrl, attachmentName, targets, zones);
      setSuccessInfo(`Targeted broadcast sent to ${targets.length} roles and ${zones.length} zones.`);
      setDraft({ message: "", targets: [], zones: [], file: null });
    } catch (err) { onToast?.("Failed: " + err.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl space-y-6">
      <SuccessOverlay show={!!successInfo} message={successInfo} onClose={() => setSuccessInfo(null)} />
      <div className="flex items-center gap-2"><Search className="w-5 h-5 text-blue-400" /><h3 className="text-xl font-bold text-white uppercase tracking-tight">Targeted Broadcast</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Roles</span>
          <div className="flex flex-wrap gap-2">{ROLES.map(role => (
            <button key={role} onClick={() => toggleTarget(role)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${targets.includes(role) ? "bg-blue-600 border-blue-500 text-white shadow-lg" : "bg-gray-900 border-gray-700 text-gray-400"}`}>{role}</button>
          ))}</div>
        </div>
        <div className="space-y-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Zones</span>
          <div className="flex flex-wrap gap-2">{eventZones.map(zone => (
            <button key={zone.code} onClick={() => toggleZone(zone.code)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${zones.includes(zone.code) ? "bg-orange-600 border-orange-500 text-white shadow-lg" : "bg-gray-900 border-gray-700 text-gray-400"}`}><span className="opacity-60 mr-1.5">{zone.code}</span>{zone.name}</button>
          ))}</div>
        </div>
      </div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder={disabled ? "View only" : "Message for targeted groups..."} disabled={disabled} className={cn("w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all resize-none", disabled && "opacity-50 cursor-not-allowed")} />
      <div className="flex items-center gap-3">
        <label className={cn("flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 transition-all", disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer")}>
          <Paperclip className="w-4 h-4 text-blue-400" />
          <span>{attachmentFile ? attachmentFile.name : "Attach File"}</span>
          {!disabled && <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />}
        </label>
        <Button onClick={saveMessage} variant="primary" loading={saving} icon={Save} disabled={disabled}>Send to Targeted Audience</Button>
      </div>
    </div>
  );
}

/* ─── Athlete Broadcast Page (Granular Multi-Select) ────────── */
function AthleteQRBroadcastPage({ eventId, onToast, draft, setDraft, disabled }) {
  const { 
    message = "", 
    selectedAthletes = [], 
    selectedClubs = [], 
    selectedHeats = [], 
    file: attachmentFile = null 
  } = draft || {};


  const setMessage = (m) => setDraft({ message: m });
  const setSelectedAthletes = (sa) => setDraft({ selectedAthletes: typeof sa === 'function' ? sa(selectedAthletes) : sa });
  const setSelectedClubs = (sc) => setDraft({ selectedClubs: typeof sc === 'function' ? sc(selectedClubs) : sc });
  const setSelectedHeats = (sh) => setDraft({ selectedHeats: typeof sh === 'function' ? sh(selectedHeats) : sh });
  const setAttachmentFile = (f) => setDraft({ file: f });

  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState([]);
  const [sportEvents, setSportEvents] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [currentAttachment, setCurrentAttachment] = useState(null); // { url, name, broadcastId }
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const attachInputRef = useRef(null);

  // Load latest athlete broadcast attachment
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("broadcasts_v2")
      .select("id, attachment_url, attachment_name")
      .eq("event_id", eventId)
      .eq("type", "athlete")
      .is("deleted_at", null)
      .not("attachment_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].attachment_url) {
          setCurrentAttachment({ url: data[0].attachment_url, name: data[0].attachment_name || "Attached File", broadcastId: data[0].id });
        }
      });
  }, [eventId]);

  const deleteCurrentAttachment = async () => {
    if (!currentAttachment?.broadcastId) return;
    setDeletingAttachment(true);
    try {
      const { error } = await supabase
        .from("broadcasts_v2")
        .update({ attachment_url: null, attachment_name: null })
        .eq("id", currentAttachment.broadcastId);
      if (error) throw error;
      setCurrentAttachment(null);
      onToast?.("Attachment removed", "success");
    } catch (err) {
      onToast?.("Failed to delete attachment: " + err.message, "error");
    } finally {
      setDeletingAttachment(false);
    }
  };

  // Load registered clubs and map raw DB names to them
  const [rawToRegisteredMap, setRawToRegisteredMap] = useState({});

  useEffect(() => {
    const fetchRegisteredClubs = async () => {
      try {
        // 1. Fetch registered clubs list (normalized objects)
        const registeredClubs = await GlobalSettingsAPI.getClubs(eventId);
        setClubs(registeredClubs);

        // 2. Fetch all unique raw club names in the database for this event
        const { data: dbData } = await supabase
          .from("accreditations")
          .select("club")
          .eq("event_id", eventId);
        
        const rawNames = [...new Set((dbData || []).map(a => a.club).filter(Boolean))];

        // 3. Create a mapping from raw names to registered names
        const mapping = {};
        rawNames.forEach(raw => {
          const cleanRaw = raw.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
          
          const match = registeredClubs.find(reg => {
            const regFull = typeof reg === 'string' ? reg : reg.full;
            const cleanReg = regFull.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
            return cleanReg === cleanRaw || regFull.toLowerCase() === raw.toLowerCase();
          });

          if (match) {
            mapping[raw] = typeof match === 'string' ? match : match.full;
          } else {
            // Check if raw is already in the clubs list
            const alreadyExists = registeredClubs.some(c => (c.full || c) === raw);
            if (!alreadyExists) {
              setClubs(prev => {
                const names = prev.map(c => typeof c === 'string' ? c : c.full);
                if (!names.includes(raw)) {
                  const newList = [...prev, { short: raw, full: raw, fileRegistered: 0 }];
                  return newList.sort((a, b) => {
                    const nameA = typeof a === 'string' ? a : a.full;
                    const nameB = typeof b === 'string' ? b : b.full;
                    return nameA.localeCompare(nameB);
                  });
                }
                return prev;
              });
            }
          }
        });
        setRawToRegisteredMap(mapping);

      } catch (err) {
        console.error("Failed to fetch clubs:", err);
      }
    };
    if (eventId) fetchRegisteredClubs();
  }, [eventId]);

  // Load sport events / heats from the sport_events table
  useEffect(() => {
    const fetchSportEvents = async () => {
      try {
        const events = await SportEventsAPI.getByEventId(eventId);
        setSportEvents(events || []);
      } catch (err) {
        console.error("Failed to load sport events:", err);
        setSportEvents([]);
      }
    };
    if (eventId) fetchSportEvents();
  }, [eventId]);

  // Debounced search for athletes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || selectedClubs.length > 0 || selectedHeats.length > 0) {
        fetchAthletes();
      } else {
        setAthletes([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedClubs, selectedHeats]);

  const fetchAthletes = async () => {
    setLoading(true);
    try {
      // Map selected registered names back to ALL raw names they represent
      const rawFilter = selectedClubs.length > 0 
        ? Object.entries(rawToRegisteredMap)
            .filter(([raw, registered]) => selectedClubs.includes(registered))
            .map(([raw]) => raw)
            .concat(selectedClubs.filter(sc => !Object.values(rawToRegisteredMap).includes(sc))) // Include ones with no mapping
        : [];

      const results = await AccreditationsAPI.search(eventId, {
        club: rawFilter.length > 0 ? rawFilter : [],
        heat: selectedHeats,
        name: search,
        limit: 200
      });
      
      // If heats are selected, filter client-side by sport event codes
      let filtered = results || [];
      if (selectedHeats.length > 0) {
        filtered = filtered.filter(a => {
          const athleteEvents = a.selectedSportEvents || [];
          return athleteEvents.some(se => selectedHeats.includes(se.eventCode));
        });
      }
      
      setAthletes(filtered);
    } catch (err) { 
      console.error(err); 
      onToast?.("Search failed: " + err.message, "error");
    }
    finally { setLoading(false); }
  };

  // Bulk-fetch ALL athletes from selected clubs/heats (up to 500) and add to selectedAthletes
  const loadAllFromFilters = async () => {
    if (selectedClubs.length === 0 && selectedHeats.length === 0 && !search.trim()) {
      onToast?.("Please select at least one club, heat, or enter a search name first.", "error");
      return;
    }
    setLoadingAll(true);
    try {
      const rawFilter = selectedClubs.length > 0 
        ? Object.entries(rawToRegisteredMap)
            .filter(([raw, registered]) => selectedClubs.includes(registered))
            .map(([raw]) => raw)
            .concat(selectedClubs.filter(sc => !Object.values(rawToRegisteredMap).includes(sc)))
        : [];

      const results = await AccreditationsAPI.search(eventId, {
        club: rawFilter.length > 0 ? rawFilter : [],
        heat: selectedHeats,
        name: search,
        limit: 500
      });
      let filtered = results || [];
      if (selectedHeats.length > 0) {
        filtered = filtered.filter(a => {
          const athleteEvents = a.selectedSportEvents || [];
          return athleteEvents.some(se => selectedHeats.includes(se.eventCode));
        });
      }
      const newSelections = filtered.filter(a => !selectedAthletes.find(sa => sa.id === a.id));
      setSelectedAthletes(prev => [...prev, ...newSelections]);
      setAthletes(filtered);
      onToast?.(`Added ${newSelections.length} athletes to selection.`, "success");
    } catch (err) {
      console.error(err);
      onToast?.("Failed to load athletes: " + err.message, "error");
    } finally {
      setLoadingAll(false);
    }
  };

  const toggleAthleteSelection = (athlete) => {
    setSelectedAthletes(prev => 
      prev.find(a => a.id === athlete.id) 
        ? prev.filter(a => a.id !== athlete.id) 
        : [...prev, athlete]
    );
  };

  const toggleAllVisible = () => {
    if (athletes.length === 0) return;
    const allSelected = athletes.every(a => selectedAthletes.find(sa => sa.id === a.id));
    if (allSelected) {
      setSelectedAthletes(prev => prev.filter(sa => !athletes.find(a => a.id === sa.id)));
    } else {
      const newSelections = athletes.filter(a => !selectedAthletes.find(sa => sa.id === a.id));
      setSelectedAthletes(prev => [...prev, ...newSelections]);
    }
  };

  const removeSelected = (id) => {
    setSelectedAthletes(prev => prev.filter(a => a.id !== id));
  };

  const handleSend = async () => {
    if (!message.trim() || selectedAthletes.length === 0) return;
    setSending(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url;
        attachmentName = attachmentFile.name || filename;
      }
      const recipientIds = selectedAthletes.map(a => a.id);
      await BroadcastV2API.sendToAthletes(eventId, message, recipientIds, attachmentUrl, attachmentName);
      const count = selectedAthletes.length;
      const names = selectedAthletes.slice(0, 3).map(a => `${a.firstName} ${a.lastName}`).join(", ");
      const extra = count > 3 ? ` and ${count - 3} more` : "";
      setSuccessInfo(`Message sent to ${count} athlete${count > 1 ? "s" : ""}: ${names}${extra}`);
      setMessage("");
      setAttachmentFile(null);
      if (attachInputRef.current) attachInputRef.current.value = "";
      setSelectedAthletes([]);
      setConfirmOpen(false);
    } catch (err) {
      onToast?.("Failed to send: " + err.message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl space-y-8">
      <SuccessOverlay 
        show={!!successInfo} 
        message={successInfo} 
        onClose={() => setSuccessInfo(null)} 
      />

      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-orange-400" />
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Athlete Target Broadcast</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Selection Interface */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Filter Clubs</label>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                {clubs.map((club, idx) => {
                  const clubName = typeof club === 'string' ? club : club.full;
                  const clubKey = typeof club === 'string' ? club : (club.id || clubName || idx);
                  return (
                    <label key={clubKey} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedClubs.includes(clubName) || selectedClubs.includes(club)}
                        disabled={disabled}
                        onChange={() => {
                          const targetValue = typeof club === 'string' ? club : club.full;
                          setSelectedClubs(prev => 
                            prev.includes(targetValue) ? prev.filter(c => c !== targetValue && c.full !== targetValue) : [...prev, targetValue]
                          );
                        }}
                        className={cn("w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-0", disabled && "opacity-50 cursor-not-allowed")}
                      />
                      <span className="text-sm text-gray-300 truncate">{clubName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Filter Events / Heats</label>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                {sportEvents.length > 0 ? sportEvents.map(ev => (
                  <label key={ev.eventCode} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedHeats.includes(ev.eventCode)}
                      disabled={disabled}
                      onChange={() => setSelectedHeats(prev => prev.includes(ev.eventCode) ? prev.filter(h => h !== ev.eventCode) : [...prev, ev.eventCode])}
                      className={cn("w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-0", disabled && "opacity-50 cursor-not-allowed")}
                    />
                    <span className="text-sm text-gray-300 truncate" title={ev.eventName}>
                      <span className="text-cyan-400 font-bold mr-1">{ev.eventCode}</span>
                      {ev.eventName}
                    </span>
                  </label>
                )) : (
                  <p className="text-xs text-gray-600 p-2">No sport events found for this event</p>
                )}
              </div>
            </div>
          </div>

          <div>
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder={disabled ? "Search only" : "Search athlete name..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                disabled={disabled}
                className={cn("w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 outline-none transition-all", disabled && "opacity-50 cursor-not-allowed")}
              />
            </div>
          </div>

          {/* Bulk Load Button */}
          {(selectedClubs.length > 0 || selectedHeats.length > 0 || search.trim()) && (
            <button
              onClick={loadAllFromFilters}
              disabled={loadingAll || disabled}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-900/30",
                (loadingAll || disabled) && "opacity-50 cursor-not-allowed"
              )}
            >
              {loadingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Loading all athletes...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Load All Matching Athletes into Selection
                  {selectedClubs.length > 0 && <span className="text-blue-200 text-xs">({selectedClubs.join(", ")})</span>}
                </>
              )}
            </button>
          )}

          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-400">
              <span>Search Results ({athletes.length})</span>
              <button 
                onClick={toggleAllVisible} 
                disabled={disabled}
                className={cn("text-blue-400 hover:text-blue-300 transition-colors", disabled && "opacity-30 cursor-not-allowed")}
              >
                Select All Shown
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500 animate-pulse text-sm">Searching athletes...</div>
              ) : athletes.length > 0 ? (
                athletes.map(a => {
                  const isSelected = selectedAthletes.find(sa => sa.id === a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => !disabled && toggleAthleteSelection(a)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 transition-colors border-b border-gray-800 last:border-0",
                        !disabled ? "cursor-pointer hover:bg-gray-800/50" : "cursor-default",
                        isSelected ? "bg-blue-600/10" : ""
                      )}
                    >
                      <div>
                        <p className={`font-bold text-sm ${isSelected ? "text-blue-400" : "text-white"}`}>
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase font-black">{a.club || "No Club"}</p>
                      </div>
                      <div className={`p-1.5 rounded-full border transition-all ${
                        isSelected ? "bg-blue-600 border-blue-500 text-white" : "border-gray-700 text-transparent"
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-600 text-sm">No athletes matching criteria</div>
              )}
            </div>
          </div>
        </div>

        {/* Message and Selection Summary */}
        <div className="space-y-6">
          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Athletes Selected ({selectedAthletes.length})</label>
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-3 min-h-[140px] max-h-[200px] overflow-y-auto">
              {selectedAthletes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedAthletes.map(a => (
                    <div key={a.id} className="flex items-center gap-1.5 bg-gray-800 text-gray-200 pl-3 pr-1 py-1 rounded-lg border border-gray-700 text-xs font-bold">
                      <span className="max-w-[120px] truncate">{a.firstName} {a.lastName}</span>
                      {!disabled && (
                        <button onClick={() => removeSelected(a.id)} className="p-1 hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 py-4">
                  <Users className="w-8 h-8 mb-2 opacity-10" />
                  <p className="text-sm">Select athletes from the search list</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Athlete Broadcast Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={disabled ? "View only" : "Private message for selected athletes..."}
              disabled={disabled}
              className={cn("w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-medium focus:border-orange-500 outline-none transition-all resize-none", disabled && "opacity-50 cursor-not-allowed")}
            />
          </div>

          {/* File Attachment */}
          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Attachment (optional)</label>

            {/* Live attachment pill */}
            {currentAttachment && !attachmentFile && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <Paperclip className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <a href={currentAttachment.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-orange-300 hover:text-orange-200 truncate flex-1 font-medium">
                  {currentAttachment.name}
                </a>
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex-shrink-0">● Live</span>
              </div>
            )}

            {/* Upload + Delete row */}
            <div className="flex items-center gap-3">
              <label className={cn("flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 transition-all", disabled ? "opacity-30 cursor-not-allowed" : "hover:border-orange-500 cursor-pointer")}>
                <Paperclip className="w-4 h-4 text-orange-400" />
                <span>
                  {attachmentFile
                    ? attachmentFile.name
                    : currentAttachment
                      ? "Replace PDF / Image"
                      : "Attach PDF or Image"}
                </span>
                {!disabled && (
                  <input
                    ref={attachInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                )}
              </label>

              {/* Delete button — always visible */}
              <button
                onClick={() => {
                  if (disabled) return;
                  if (attachmentFile) {
                    setAttachmentFile(null);
                    if (attachInputRef.current) attachInputRef.current.value = "";
                  } else if (currentAttachment) {
                    deleteCurrentAttachment();
                  }
                }}
                disabled={disabled || deletingAttachment || (!attachmentFile && !currentAttachment)}
                title={attachmentFile ? "Cancel selection" : "Delete attachment"}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold transition-all",
                  (attachmentFile || currentAttachment) && !disabled
                    ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 cursor-pointer"
                    : "bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed"
                )}
              >
                {deletingAttachment
                  ? <span className="w-4 h-4 block border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
                <span>Delete</span>
              </button>
            </div>
          </div>

          <Button
            onClick={() => setConfirmOpen(true)}
            variant="primary"
            disabled={disabled || selectedAthletes.length === 0 || !message.trim()}
            className={cn(
              "w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 border-none text-white text-lg shadow-xl shadow-orange-900/20",
              !disabled && "hover:from-orange-500 hover:to-orange-400"
            )}
          >
            Send Broadcast to {selectedAthletes.length} Athletes
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Broadcast">
        <div className="space-y-4">
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-4">
            <AlertCircle className="w-6 h-6 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold">Ready to send?</p>
              <p className="text-gray-400 text-sm mt-1">
                You are about to send a message to <span className="text-orange-400 font-bold">{selectedAthletes.length}</span> athletes. 
                This will appear instantly on their QR scan pages.
              </p>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto bg-gray-900/50 rounded-xl p-3 border border-gray-700">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Recipients:</p>
            <div className="flex flex-wrap gap-1">
              {selectedAthletes.map(a => (
                <span key={a.id} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700">
                  {a.firstName} {a.lastName}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-6 mt-6">
             <div className="flex gap-3">
              <Button onClick={handleSend} loading={sending} className="flex-1 bg-orange-600 hover:bg-orange-500 py-3">
                Yes, Send Now
              </Button>
              <Button onClick={() => setConfirmOpen(false)} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
