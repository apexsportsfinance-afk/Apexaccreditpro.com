import React, { useState, useEffect } from "react";
import { FileText, Upload, Trash2, Download, Clock, RotateCcw, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI, HeatSheetMatrixAPI, AthleteEventsAPI } from "../../lib/broadcastApi";
import { parseCompetitionFile, matchAthleteEvents } from "../../lib/CoachHeatParser";
import { calculateAge, cn } from "../../lib/utils";
import Button from "../ui/Button";

const SLOTS = [
  { key: "heat_sheet", label: "Heat Sheet", color: "blue" },
  { key: "event_result", label: "Event Result", color: "green" }
];

const colorMap = {
  blue: { border: "border-blue-500", bg: "bg-blue-600 hover:bg-blue-700", text: "text-blue-400", dashed: "hover:border-blue-500" },
  green: { border: "border-green-500", bg: "bg-green-600 hover:bg-green-700", text: "text-green-400", dashed: "hover:border-green-500" }
};

export default function EventPdfSlots({ eventId, onToast, disabled }) {
  const [slots, setSlots] = useState({ heat_sheet: null, event_result: null });
  const [timestamps, setTimestamps] = useState({ heat_sheet: null, event_result: null });
  const [uploading, setUploading] = useState({});
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    loadSlots();
  }, [eventId]);

  const loadSlots = async () => {
    const all = await GlobalSettingsAPI.getAll();
    setSlots({
      heat_sheet: all[`event_${eventId}_heat_sheet_url`] || null,
      event_result: all[`event_${eventId}_event_result_url`] || null
    });
    setTimestamps({
      heat_sheet: all[`event_${eventId}_heat_sheet_updated_at`] || null,
      event_result: all[`event_${eventId}_event_result_updated_at`] || null
    });
  };

  const handleUpload = async (e, slot) => {
    if (disabled) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      onToast?.("File must be under 10 MB", "error");
      return;
    }
    setUploading(prev => ({ ...prev, [slot.key]: true }));
    try {
      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const filename = `event-files/${eventId}/${slot.key}-${Date.now()}.${ext}`;
      
      // 0. Proactively delete the legacy file from the bucket to save space
      if (slots[slot.key] && slots[slot.key].includes('/public/accreditation-files/')) {
        const oldPath = slots[slot.key].split('/public/accreditation-files/')[1];
        if (oldPath) {
          const { error: delErr } = await supabase.storage.from("accreditation-files").remove([oldPath]);
          if (delErr) console.error("Failed to cleanly drop legacy file from storage:", delErr);
        }
      }

      // Force 'application/pdf' contentType to bypass Supabase bucket MIME type restrictions
      const { data, error } = await supabase.storage
        .from("accreditation-files")
        .upload(filename, uint8, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("accreditation-files")
        .getPublicUrl(data.path);
      const now = new Date().toISOString();
      await GlobalSettingsAPI.setMany({
        [`event_${eventId}_${slot.key}_url`]: urlData.publicUrl,
        [`event_${eventId}_${slot.key}_updated_at`]: now
      });

      // Parse and save Heat Sheet or Event Result matrix
      if (slot.key === "heat_sheet" || slot.key === "event_result") {
        try {
          onToast?.(`Processing ${slot.label}... please wait`, "info");
          // 1. Parse raw rows from File via Python Universal Engine (with JS fallback)
          const { matchAthleteEvents, parseCompetitionFile } = await import('../../lib/CoachHeatParser');
          
          let rawRows = [];
          
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', slot.key);
  
            const isLocal = window.location.hostname === "localhost" || window.location.hostname.startsWith("172.");
            const API_URL = isLocal 
              ? `http://${window.location.hostname}:5000/api/index` 
              : "/api/index";

            const pyRes = await fetch(API_URL, {
              method: "POST",
              body: formData
            });
  
            if (!pyRes.ok) throw new Error("Python Engine unreachable");
            
            const pyData = await pyRes.json();
            if (!pyData.success) throw new Error(pyData.error || "Python parsing failed");
            
            rawRows = pyData.results || [];
            console.log("Extracted via Python Backend");
            
          } catch (pyErr) {
            console.warn("Python engine offline or unreachable (remote). Falling back to JavaScript engine...", pyErr);
            // GRACEFUL FALLBACK TO JAVASCRIPT NATIVE COMPILER
            rawRows = await parseCompetitionFile(file, slot.key);
          }
          
          if (rawRows.length === 0) {
            onToast?.(`No athlete rows could be extracted. Please check the file format.`, "warning");
          } else {
            // 2. Fetch all event accreditations
            let rawAccData = [];
            let from = 0;
            const pageSize = 1000;
            let fetchHasMore = true;

            while (fetchHasMore) {
              const { data: pageData, error: fetchErr } = await supabase
                .from("accreditations")
                .select("id, first_name, last_name, date_of_birth, gender, club")
                .eq("event_id", eventId)
                .eq("status", "approved")
                .range(from, from + pageSize - 1);

              if (fetchErr) throw new Error("Database fetch error: " + fetchErr.message);
              if (pageData && pageData.length > 0) {
                rawAccData = [...rawAccData, ...pageData];
                if (pageData.length < pageSize) fetchHasMore = false;
                else from += pageSize;
              } else {
                fetchHasMore = false;
              }
            }

            onToast?.(`Found ${rawAccData.length} approved registrations for this event. Starting match...`, "info");

            console.log("DIAC_DEBUG: Synchronizer Active - Timestamp: " + new Date().toISOString());
            
            
            // Safety De-duplication: If there are accidental duplicates in the DB (same name + club), collapse them
            const uniqueAccs = new Map();
            (rawAccData || []).forEach(acc => {
              // Normalize names to strip all punctuation and spaces for the key
              const cleanFirst = (acc.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanLast = (acc.last_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanClub = (acc.club || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              
              const profileKey = `${cleanFirst}|${cleanLast}|${cleanClub}`;
              
              // Always keep the most recent or first one found
              if (!uniqueAccs.has(profileKey)) {
                uniqueAccs.set(profileKey, acc);
              }
            });

            const accData = Array.from(uniqueAccs.values()).map(acc => ({
              id: acc.id,
              name: `${acc.first_name || ''} ${acc.last_name || ''}`.trim(),
              gender: acc.gender,
              age: acc.date_of_birth ? calculateAge(acc.date_of_birth, new Date().getFullYear()) : null,
              club_name: acc.club
            }));

            console.log(`DIAC_DEBUG: Syncing [${rawRows.length}] PDF rows against [${accData.length}] approved database accreditations.`);

            // 3. WIPE OLD DATA BEFORE SAVING NEW (SYNC STRATEGY)
            const { AthleteEventsAPI, HeatSheetMatrixAPI } = await import('../../lib/broadcastApi');
            let clearedCount = 0;
            try {
               await HeatSheetMatrixAPI.clearMatrixForMeet(eventId);
               clearedCount = await AthleteEventsAPI.clearEventsForMeet(eventId);
            } catch (wipeErr) {
            }

            // 4. Save raw rows to lane_matrix (persists all rows regardless of matching)
            await HeatSheetMatrixAPI.upsertMatrix(eventId, rawRows, slot.key).catch(err =>
              console.warn("[HeatSheet] lane_matrix save failed (non-critical):", err)
            );
              
            // 5. Run Matching Cascade against accreditations
            if (rawAccData.length === 0) {
              onToast?.(`${rawRows.length} rows saved. No database accreditations found to match against.`, "warning");
            } else {
              const matchedEvents = await matchAthleteEvents(rawRows, accData);
              const verifiedMatches = matchedEvents.filter(e => e.matched).length;
              const distinctAthletes = new Set(matchedEvents.filter(e => e.matched).map(e => e.accreditation_id)).size;

              // 6. Upsert matched rows to athlete_events table
              const count = await AthleteEventsAPI.upsertEvents(matchedEvents);
              
              if (verifiedMatches === 0) {
                onToast?.(
                  `Sync Complete: ${clearedCount} old records removed. ${rawRows.length} rows parsed but 0 verified matches. Ensure athlete names match registration exactly.`,
                  "warning"
                );
              } else {
                onToast?.(`Sync Complete: ${clearedCount} old records removed. Saved ${verifiedMatches} verified matches for ${distinctAthletes} athlete(s).`, "success");
              }
            }
          }
        } catch (parseErr) {
          console.error(`${slot.label} Parse Error:`, parseErr);
          onToast?.(`Failed to parse ${slot.label}: ${parseErr.message}`, "warning");
        }
      }

      setSlots(prev => ({ ...prev, [slot.key]: urlData.publicUrl }));
      setTimestamps(prev => ({ ...prev, [slot.key]: now }));
      if (slot.key !== "heat_sheet" && slot.key !== "event_result") {
        onToast?.(`${slot.label} uploaded successfully`, "success");
      }

    } catch (err) {
      console.error(err);
      onToast?.(err.message || "Upload failed", "error");
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
      if (e.target) e.target.value = '';
    }
  };

  const handleResetData = async () => {
    if (disabled) return;
    setResetting(true);
    try {
      // 1. Clear lane_matrix
      await HeatSheetMatrixAPI.clearMatrixForMeet(eventId);
      
      // 2. Clear athlete_events
      await AthleteEventsAPI.clearEventsForMeet(eventId);
      
      onToast?.("All event data has been wiped. You can now upload fresh files.", "success");
    } catch (err) {
      console.error("Reset Error:", err);
      onToast?.("Failed to clear some data. Please check connection.", "error");
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (slotKey) => {
    if (disabled) return;
    try {
      if (slots[slotKey] && slots[slotKey].includes('/public/accreditation-files/')) {
        const oldPath = slots[slotKey].split('/public/accreditation-files/')[1];
        if (oldPath) {
          const { error: delErr } = await supabase.storage.from("accreditation-files").remove([oldPath]);
          if (delErr) console.warn("[Drop] Storage removal warning:", delErr);
        }
      }
      
      const { error: setErr } = await GlobalSettingsAPI.setMany({
        [`event_${eventId}_${slotKey}_url`]: null,
        [`event_${eventId}_${slotKey}_updated_at`]: null
      });

      if (setErr) throw setErr;

      setSlots(prev => ({ ...prev, [slotKey]: null }));
      setTimestamps(prev => ({ ...prev, [slotKey]: null }));
      onToast?.("File detached successfully", "success");
    } catch (err) {
      console.error("[Drop] Critical Error:", err);
      onToast?.(`Detaching failed: ${err.message || 'Unknown error'}`, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <h2 className="text-white font-black uppercase tracking-[0.2em] text-xs">Event Document Center</h2>
        </div>
        
        <button 
          onClick={handleResetData}
          disabled={resetting || disabled}
          className={cn(
            "flex items-center gap-2 group px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl transition-all active:scale-95",
            (resetting || disabled) ? "opacity-50 cursor-not-allowed" : "hover:bg-red-500/20 hover:border-red-500/40"
          )}
        >
          <RotateCcw className={cn("w-4 h-4 text-red-400 transition-transform duration-700", resetting && "animate-spin", !disabled && "group-hover:rotate-[-180deg]")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
            {resetting ? 'Wiping Database...' : 'Reset Event Data'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SLOTS.map(slot => {
        const config = colorMap[slot.color];
        const isUp = uploading[slot.key];
        const hasFile = !!slots[slot.key];

        return (
          <div key={slot.key} className={cn(
            "relative group p-6 rounded-2xl border-2 transition-all duration-500 overflow-hidden",
            hasFile ? `${config.border} bg-slate-900/40` : "border-slate-800 border-dashed bg-slate-950/20",
            !hasFile && !disabled && config.dashed
          )}>
            {/* Background elements omitted for brevity */}
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2.5 rounded-xl bg-slate-900 border", hasFile ? config.border : "border-slate-800")}>
                    <FileText className={cn("w-5 h-5", hasFile ? config.text : "text-slate-600")} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-widest text-[11px]">{slot.label}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{hasFile ? 'Live Document Attached' : 'Empty Slot'}</p>
                  </div>
                </div>

                {hasFile ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => window.open(slots[slot.key], '_blank')}
                        className={cn("rounded-lg gap-2 text-[10px] font-black uppercase", config.bg)}
                      >
                        <Download className="w-3.5 h-3.5" /> View
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(slot.key)} 
                        disabled={disabled}
                        className={cn(
                          "rounded-lg gap-2 text-[10px] font-black uppercase text-red-500",
                          disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-red-500/10"
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Drop
                      </Button>
                    </div>
                    {timestamps[slot.key] && (
                      <div className="flex items-center gap-2 text-slate-500 font-bold italic text-[9px]">
                        <Clock className="w-3 h-3" /> Updated {new Date(timestamps[slot.key]).toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative mt-2">
                    {!disabled && <input type="file" onChange={(e) => handleUpload(e, slot)} disabled={isUp} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />}
                    <Button 
                      variant="outline" 
                      disabled={disabled}
                      className={cn(
                        "w-full py-6 bg-slate-900 border-slate-800 border-dashed rounded-xl gap-3",
                        disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-850"
                      )}
                    >
                      <div className="p-2 rounded-lg bg-slate-950">
                        <Upload className={cn("w-4 h-4", isUp ? "animate-bounce text-cyan-400" : "text-slate-500")} />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{isUp ? 'Processing...' : disabled ? "View Only" : `Attach ${slot.label}`}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}



