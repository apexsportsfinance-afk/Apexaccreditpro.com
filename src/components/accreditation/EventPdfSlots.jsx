import React, { useState, useEffect } from "react";
import { FileText, Upload, Trash2, Download, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI, HeatSheetMatrixAPI } from "../../lib/broadcastApi";
import { parseCompetitionFile } from "../../lib/CoachHeatParser";

const SLOTS = [
  { key: "heat_sheet", label: "Heat Sheet", color: "blue" },
  { key: "event_result", label: "Event Result", color: "green" }
];

const colorMap = {
  blue: { border: "border-blue-500", bg: "bg-blue-600 hover:bg-blue-700", text: "text-blue-400", dashed: "hover:border-blue-500" },
  green: { border: "border-green-500", bg: "bg-green-600 hover:bg-green-700", text: "text-green-400", dashed: "hover:border-green-500" }
};

export default function EventPdfSlots({ eventId, onToast }) {
  const [slots, setSlots] = useState({ heat_sheet: null, event_result: null });
  const [timestamps, setTimestamps] = useState({ heat_sheet: null, event_result: null });
  const [uploading, setUploading] = useState({});

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
          onToast?.(`Parsing ${slot.label}...`, "info");
          // 1. Parse raw rows from File
          const { parseCompetitionFile, matchAthleteEvents } = await import('../../lib/CoachHeatParser');
          const rawRows = await parseCompetitionFile(file, slot.key);
          
          onToast?.(`Matching ${rawRows.length} records to accreditations...`, "info");
          // 2. Fetch all event accreditations (map true schema to recipe expectation)
          let rawAccData = [];
           let from = 0;
           let pageSize = 1000;
           let fetchHasMore = true;

           while (fetchHasMore) {
             const { data: pageData, error: fetchErr } = await supabase
               .from("accreditations")
               .select("id, first_name, last_name, date_of_birth, club")
               .eq("event_id", eventId)
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

          const { calculateAge } = await import('../../lib/utils');

          const accData = (rawAccData || []).map(acc => ({
            id: acc.id,
            name: `${acc.first_name || ''} ${acc.last_name || ''}`.trim(),
            age: acc.date_of_birth ? calculateAge(acc.date_of_birth, new Date().getFullYear()) : null,
            club_name: acc.club
          }));
            
          // 3. Run Matching Cascade
          const matchedEvents = matchAthleteEvents(rawRows, accData || []);
          
          // 4. Upsert to new athlete_events table
          const { AthleteEventsAPI } = await import('../../lib/broadcastApi');
          const count = await AthleteEventsAPI.upsertEvents(matchedEvents);
          
          const verifiedMatches = matchedEvents.filter(e => e.matched).length;
          onToast?.(`Saved ${count} records (${verifiedMatches} verified matches).`, "success");
        } catch (parseErr) {
          console.error(`${slot.label} Parse Error:`, parseErr);
          onToast?.(`Failed to parse ${slot.label}: ${parseErr.message}`, "warning");
        }
      }

      setSlots(prev => ({ ...prev, [slot.key]: urlData.publicUrl }));
      setTimestamps(prev => ({ ...prev, [slot.key]: now }));
      onToast?.(`${slot.label} uploaded and processed successfully`, "success");
    } catch (err) {
      console.error(err);
      onToast?.(err.message || "Upload failed", "error");
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
      e.target.value = '';
    }
  };

  const handleDelete = async (slotKey) => {
    if (!confirm(`Delete ${slotKey.replace('_', ' ')}?`)) return;
    try {
      if (slots[slotKey] && slots[slotKey].includes('/public/accreditation-files/')) {
        const oldPath = slots[slotKey].split('/public/accreditation-files/')[1];
        if (oldPath) {
          await supabase.storage.from("accreditation-files").remove([oldPath]);
        }
      }
      await GlobalSettingsAPI.setMany({
        [`event_${eventId}_${slotKey}_url`]: null,
        [`event_${eventId}_${slotKey}_updated_at`]: null
      });
      setSlots(prev => ({ ...prev, [slotKey]: null }));
      setTimestamps(prev => ({ ...prev, [slotKey]: null }));
      onToast?.("File deleted", "success");
    } catch (err) {
      onToast?.("Delete failed", "error");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SLOTS.map(slot => {
        const config = colorMap[slot.color];
        const isUp = uploading[slot.key];
        const hasFile = !!slots[slot.key];

        return (
          <div key={slot.key} className={`relative group p-6 rounded-2xl border-2 transition-all duration-500 overflow-hidden ${hasFile ? `${config.border} bg-slate-900/40` : `border-slate-800 border-dashed ${config.dashed} bg-slate-950/20`}`}>
            {/* Background elements omitted for brevity */}
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl bg-slate-900 border ${hasFile ? config.border : 'border-slate-800'}`}>
                    <FileText className={`w-5 h-5 ${hasFile ? config.text : 'text-slate-600'}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-widest text-[11px]">{slot.label}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{hasFile ? 'Live Document Attached' : 'Empty Slot'}</p>
                  </div>
                </div>

                {hasFile ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" className={`rounded-lg gap-2 text-[10px] font-black uppercase ${config.bg}`}>
                        <a href={slots[slot.key]} target="_blank" rel="noopener noreferrer">
                          <Download className="w-3.5 h-3.5" /> View
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(slot.key)} className="rounded-lg gap-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10">
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
                    <input type="file" onChange={(e) => handleUpload(e, slot)} disabled={isUp} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <Button variant="outline" className="w-full py-6 bg-slate-900 hover:bg-slate-850 border-slate-800 border-dashed rounded-xl gap-3">
                      <div className="p-2 rounded-lg bg-slate-950">
                        <Upload className={`w-4 h-4 ${isUp ? 'animate-bounce text-cyan-400' : 'text-slate-500'}`} />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{isUp ? 'Processing...' : `Attach ${slot.label}`}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}



