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
      onToast?.(`${slot.label} file uploaded`, "success");
    } catch (err) {
      onToast?.("Upload failed: " + err.message, "error");
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
      e.target.value = "";
    }
  };

  const handleRemove = async (slot) => {
    try {
      if (slot.key === "heat_sheet" || slot.key === "event_result") {
         const { AthleteEventsAPI } = await import('../../lib/broadcastApi');
         const deletedCount = await AthleteEventsAPI.clearEventsForMeet(eventId);
         if (deletedCount > 0) {
            onToast?.(`Cleared ${deletedCount} cached athlete events`, "info");
         }
      }

      await GlobalSettingsAPI.setMany({
        [`event_${eventId}_${slot.key}_url`]: "",
        [`event_${eventId}_${slot.key}_updated_at`]: ""
      });
      setSlots(prev => ({ ...prev, [slot.key]: null }));
      setTimestamps(prev => ({ ...prev, [slot.key]: null }));
      onToast?.(`${slot.label} file removed`, "success");
    } catch (err) {
      onToast?.(`Error removing file: ${err.message}`, "error");
    }
  };

  return (
    <div id="event-pdf-slots" className="space-y-4">
      <p className="text-gray-400 font-extralight text-lg">
        Upload Heat Sheet and Event Result files (PDF, HTML, Excel, CSV) for this event. Visible on QR scan pages for this event.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map(slot => {
          const url = slots[slot.key];
          const updatedAt = timestamps[slot.key];
          const c = colorMap[slot.color];
          const isUploading = uploading[slot.key];
          return (
            <div key={slot.key} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className={`w-5 h-5 ${c.text}`} />
                <span className="text-white font-extralight text-lg">{slot.label} (PDF, HTML, Excel, CSV)</span>
              </div>
              {url ? (
                <div className="space-y-4">
                  {/* Active File Display */}
                  <div className={`border border-gray-600 ${c.bg} bg-opacity-10 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${c.bg}`}>
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">File Active</p>
                        {updatedAt && (
                          <p className="text-gray-400 font-light text-xs flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(updatedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors text-sm">
                        <Download className="w-4 h-4" /> View
                      </a>
                      <button onClick={() => handleRemove(slot)}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded transition-colors text-sm">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Keep Upload Button Available */}
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-600 ${c.dashed} rounded-lg py-5 cursor-pointer hover:bg-white/5 transition-colors`}>
                    <Upload className={`w-6 h-6 ${c.text} mb-1 opacity-70`} />
                    <span className="text-gray-300 font-extralight text-sm">
                      {isUploading ? "Uploading..." : `Replace ${slot.label}`}
                    </span>
                    <span className="text-gray-500 text-xs mt-0.5">Max 10 MB (.pdf, .html, .xlsx, .csv)</span>
                    <input type="file" accept=".pdf,.html,.htm,.xlsx,.xls,.csv" className="hidden"
                      onChange={e => handleUpload(e, slot)} disabled={isUploading} />
                  </label>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-600 ${c.dashed} rounded-lg py-5 cursor-pointer transition-colors`}>
                  <Upload className={`w-6 h-6 ${c.text} mb-1`} />
                  <span className="text-gray-300 font-extralight text-lg">
                    {isUploading ? "Uploading..." : `Upload ${slot.label}`}
                  </span>
                  <span className="text-gray-500 font-extralight text-lg mt-0.5">Max 10 MB (.pdf, .html, .xlsx, .csv)</span>
                  <input type="file" accept=".pdf,.html,.htm,.xlsx,.xls,.csv" className="hidden"
                    onChange={e => handleUpload(e, slot)} disabled={isUploading} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
