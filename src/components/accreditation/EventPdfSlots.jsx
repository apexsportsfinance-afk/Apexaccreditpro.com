import React, { useState, useEffect } from "react";
import { FileText, Upload, Trash2, Download, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";

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
      onToast?.("PDF must be under 10 MB", "error");
      return;
    }
    setUploading(prev => ({ ...prev, [slot.key]: true }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const filename = `event-pdfs/${eventId}/${slot.key}-${Date.now()}.pdf`;
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
      setSlots(prev => ({ ...prev, [slot.key]: urlData.publicUrl }));
      setTimestamps(prev => ({ ...prev, [slot.key]: now }));
      onToast?.(`${slot.label} PDF uploaded`, "success");
    } catch (err) {
      onToast?.("Upload failed: " + err.message, "error");
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
      e.target.value = "";
    }
  };

  const handleRemove = async (slot) => {
    await GlobalSettingsAPI.setMany({
      [`event_${eventId}_${slot.key}_url`]: "",
      [`event_${eventId}_${slot.key}_updated_at`]: ""
    });
    setSlots(prev => ({ ...prev, [slot.key]: null }));
    setTimestamps(prev => ({ ...prev, [slot.key]: null }));
    onToast?.(`${slot.label} PDF removed`, "success");
  };

  return (
    <div id="event-pdf-slots" className="space-y-4">
      <p className="text-gray-400 font-extralight text-lg">
        Upload Heat Sheet and Event Result PDFs for this event. Visible on QR scan pages for this event.
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
                <span className="text-white font-extralight text-lg">{slot.label} PDF</span>
              </div>
              {url ? (
                <div className="space-y-2">
                  <div className={`border ${c.border} rounded-lg px-3 py-2 bg-gray-900`}>
                    <p className="text-white font-extralight text-lg">PDF Active</p>
                    {updatedAt && (
                      <p className="text-gray-400 font-extralight text-lg flex items-center gap-1 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-1 ${c.bg} text-white px-3 py-1.5 rounded font-extralight text-lg transition-colors`}>
                      <Download className="w-3.5 h-3.5" /> View
                    </a>
                    <label className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded font-extralight text-lg cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Replace
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e => handleUpload(e, slot)} />
                    </label>
                    <button onClick={() => handleRemove(slot)}
                      className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded font-extralight text-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-600 ${c.dashed} rounded-lg py-5 cursor-pointer transition-colors`}>
                  <Upload className={`w-6 h-6 ${c.text} mb-1`} />
                  <span className="text-gray-300 font-extralight text-lg">
                    {isUploading ? "Uploading..." : `Upload ${slot.label}`}
                  </span>
                  <span className="text-gray-500 font-extralight text-lg mt-0.5">Max 10 MB</span>
                  <input type="file" accept=".pdf" className="hidden"
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
