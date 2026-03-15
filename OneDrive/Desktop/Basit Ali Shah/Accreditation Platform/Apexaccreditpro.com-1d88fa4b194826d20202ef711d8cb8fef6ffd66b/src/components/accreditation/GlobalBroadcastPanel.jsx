import React, { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Upload, Save, Trash2, Clock, Users, Search, Check, X, AlertCircle, CheckCircle, Paperclip } from "lucide-react";
import { EventSettingsAPI, BroadcastV2API, SportEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AccreditationsAPI } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { ROLES } from "../../lib/utils";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const SUB_TABS = [
  { id: "global", label: "Event Broadcast Message", icon: Globe },
  { id: "athlete", label: "Athlete QR Broadcast", icon: Users }
];

export default function GlobalBroadcastPanel({ eventId, onToast }) {
  const [activeSubTab, setActiveSubTab] = useState("global");

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

      {activeSubTab === "global" && <GlobalBroadcastPage eventId={eventId} onToast={onToast} />}
      {activeSubTab === "athlete" && <AthleteQRBroadcastPage eventId={eventId} onToast={onToast} />}
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

/* ─── Global Broadcast Page (Role Targeting) ─────────────────── */
function GlobalBroadcastPage({ eventId, onToast }) {
  const [message, setMessage] = useState("");
  const [targets, setTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msgUpdatedAt, setMsgUpdatedAt] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [currentAttachment, setCurrentAttachment] = useState(null); // { url, name, broadcastId }
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const attachInputRef = useRef(null);

  useEffect(() => { if (eventId) loadSettings(); }, [eventId]);

  const loadSettings = async () => {
    // Load latest message and attachment from broadcasts_v2
    try {
      const { data: broadcasts, error } = await supabase
        .from("broadcasts_v2")
        .select("id, message, created_at, attachment_url, attachment_name")
        .eq("event_id", eventId)
        .eq("type", "global")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (broadcasts && broadcasts.length > 0) {
        const b = broadcasts[0];
        setMessage(b.message || "");
        setMsgUpdatedAt(b.created_at || null);
        if (b.attachment_url) {
          setCurrentAttachment({ url: b.attachment_url, name: b.attachment_name || "Attached File", broadcastId: b.id });
        } else {
          setCurrentAttachment(null);
        }
      } else {
        // Fallback to events table if no broadcasts found
        const all = await EventSettingsAPI.getAll(eventId);
        setMessage(all["broadcast_message"] || "");
        setMsgUpdatedAt(all["message_updated_at"] || null);
        setCurrentAttachment(null);
      }
    } catch (err) {
      console.error("Error loading latest broadcast:", err);
      setMessage("");
      setCurrentAttachment(null);
    }
    
    // Load targets from events table
    try {
      const all = await EventSettingsAPI.getAll(eventId);
      const savedTargets = all["broadcast_targets"];
      if (savedTargets) setTargets(JSON.parse(savedTargets));
    } catch { setTargets([]); }
  };

  const toggleTarget = (role) => {
    setTargets(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const saveMessage = async () => {
    if (!message.trim()) { onToast?.("Please enter a message", "error"); return; }
    setSaving(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url;
        attachmentName = attachmentFile.name || filename;
      }

      // Save to events table (legacy)
      await EventSettingsAPI.setMany(eventId, {
        broadcast_message: message,
        broadcast_targets: JSON.stringify(targets),
        message_updated_at: new Date().toISOString()
      });
      
      // Save to V2 broadcasts table with attachment
      const sent = await BroadcastV2API.sendGlobal(message, eventId, attachmentUrl, attachmentName);
      
      setMsgUpdatedAt(new Date().toISOString());
      if (attachmentUrl) {
        setCurrentAttachment({ url: attachmentUrl, name: attachmentName || "Attached File", broadcastId: sent?.id });
      }
      const targetLabel = targets.length > 0 ? targets.join(", ") : "Everyone";
      setSuccessInfo(`Your message has been broadcast to: ${targetLabel}`);
      setAttachmentFile(null);
      if (attachInputRef.current) attachInputRef.current.value = "";
    } catch (err) { 
      onToast?.("Failed to send: " + err.message, "error"); 
    }
    finally { setSaving(false); }
  };

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

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
      <SuccessOverlay 
        show={!!successInfo} 
        message={successInfo} 
        onClose={() => setSuccessInfo(null)} 
      />

      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-blue-400" />
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Global Event Broadcast</h3>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">Target Audience</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => toggleTarget(role)}
                className={`px-4 py-2 rounded-full border text-sm font-bold transition-all ${
                  targets.includes(role)
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40"
                    : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {role}
              </button>
            ))}
            <button
               onClick={() => setTargets([])}
               className={`px-4 py-2 rounded-full border text-sm font-bold transition-all ${
                 targets.length === 0
                   ? "bg-emerald-600 border-emerald-500 text-white"
                   : "bg-gray-900 border-gray-700 text-gray-400"
               }`}
            >
              Everyone
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Type your global broadcast message here..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500 font-bold uppercase tracking-widest">
            <span>{message.length}/2000 characters</span>
            {msgUpdatedAt && <span>Last sent: {new Date(msgUpdatedAt).toLocaleString()}</span>}
          </div>
        </div>

        {/* File Attachment */}
        <div>
          <label className="block text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Attachment (optional)</label>

          {/* Show the current live attachment name when loaded from DB */}
          {currentAttachment && !attachmentFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Paperclip className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <a href={currentAttachment.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-300 hover:text-blue-200 truncate flex-1 font-medium">
                {currentAttachment.name}
              </a>
              <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex-shrink-0">● Live</span>
            </div>
          )}

          {/* Upload + Delete row */}
          <div className="flex items-center gap-3">
            {/* Upload button */}
            <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-xl text-sm text-gray-300 transition-all">
              <Paperclip className="w-4 h-4 text-blue-400" />
              <span>
                {attachmentFile
                  ? attachmentFile.name
                  : currentAttachment
                    ? "Replace PDF / Image"
                    : "Attach PDF or Image"}
              </span>
              <input
                ref={attachInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
              />
            </label>

            {/* Delete button — always visible */}
            <button
              onClick={() => {
                if (attachmentFile) {
                  // Clear staged (not yet sent) file
                  setAttachmentFile(null);
                  if (attachInputRef.current) attachInputRef.current.value = "";
                } else if (currentAttachment) {
                  // Remove live attachment from DB
                  deleteCurrentAttachment();
                }
              }}
              disabled={deletingAttachment || (!attachmentFile && !currentAttachment)}
              title={attachmentFile ? "Cancel selection" : "Delete attachment"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold transition-all ${
                (attachmentFile || currentAttachment)
                  ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 cursor-pointer"
                  : "bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed"
              }`}
            >
              {deletingAttachment
                ? <span className="w-4 h-4 block border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />
              }
              <span>Delete</span>
            </button>
          </div>
        </div>


        <div className="flex gap-3">
          <Button
            onClick={saveMessage}
            variant="primary"
            loading={saving}
            icon={Save}
            className="px-8"
          >
            Broadcast to {targets.length || "Everyone"}
          </Button>
          <button onClick={() => setMessage("")} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-bold transition-all">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Athlete Broadcast Page (Granular Multi-Select) ────────── */
function AthleteQRBroadcastPage({ eventId, onToast }) {
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [sportEvents, setSportEvents] = useState([]);
  const [selectedHeats, setSelectedHeats] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
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
                  return [...prev, { short: raw, full: raw, fileRegistered: 0 }].sort((a,b) => a.full.localeCompare(b.full));
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
                {clubs.map(club => (
                  <label key={club} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedClubs.includes(club)}
                      onChange={() => setSelectedClubs(prev => prev.includes(club) ? prev.filter(c => c !== club) : [...prev, club])}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-gray-300 truncate">{club}</span>
                  </label>
                ))}
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
                      onChange={() => setSelectedHeats(prev => prev.includes(ev.eventCode) ? prev.filter(h => h !== ev.eventCode) : [...prev, ev.eventCode])}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-0"
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
                placeholder="Search athlete name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Bulk Load Button */}
          {(selectedClubs.length > 0 || selectedHeats.length > 0 || search.trim()) && (
            <button
              onClick={loadAllFromFilters}
              disabled={loadingAll}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30"
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
              <button onClick={toggleAllVisible} className="text-blue-400 hover:text-blue-300 transition-colors">Select All Shown</button>
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
                      onClick={() => toggleAthleteSelection(a)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors border-b border-gray-800 last:border-0 ${
                        isSelected ? "bg-blue-600/10" : "hover:bg-gray-800/50"
                      }`}
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
                      <button onClick={() => removeSelected(a.id)} className="p-1 hover:text-red-400 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
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
              placeholder="Private message for selected athletes..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-medium focus:border-orange-500 outline-none transition-all resize-none"
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
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-gray-900 border border-gray-700 hover:border-orange-500 rounded-xl text-sm text-gray-300 transition-all">
                <Paperclip className="w-4 h-4 text-orange-400" />
                <span>
                  {attachmentFile
                    ? attachmentFile.name
                    : currentAttachment
                      ? "Replace PDF / Image"
                      : "Attach PDF or Image"}
                </span>
                <input
                  ref={attachInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                />
              </label>

              {/* Delete button — always visible */}
              <button
                onClick={() => {
                  if (attachmentFile) {
                    setAttachmentFile(null);
                    if (attachInputRef.current) attachInputRef.current.value = "";
                  } else if (currentAttachment) {
                    deleteCurrentAttachment();
                  }
                }}
                disabled={deletingAttachment || (!attachmentFile && !currentAttachment)}
                title={attachmentFile ? "Cancel selection" : "Delete attachment"}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold transition-all ${
                  (attachmentFile || currentAttachment)
                    ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 cursor-pointer"
                    : "bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed"
                }`}
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
            disabled={selectedAthletes.length === 0 || !message.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 border-none text-white text-lg shadow-xl shadow-orange-900/20"
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
