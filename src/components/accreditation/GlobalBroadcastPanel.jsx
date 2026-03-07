import React, { useState, useEffect, useRef } from "react";
import { Globe, Upload, Save, Trash2, Clock, Users, FileText, MessageSquare } from "lucide-react";
import { GlobalSettingsAPI, EventSettingsAPI } from "../../lib/broadcastApi";
import { supabase } from "../../lib/supabase";
import { uploadToStorage } from "../../lib/uploadToStorage";

const SUB_TABS = [
  { id: "global", label: "Event Broadcast Message", icon: Globe },
  { id: "athlete", label: "Athlete QR Broadcast", icon: Users }
];

export default function GlobalBroadcastPanel({ eventId, onToast }) {
  const [activeSubTab, setActiveSubTab] = useState("global");

  return (
    <div id="global-broadcast-panel" className="space-y-4">
      {/* Sub-tab navigation */}
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

/* ─── Event Broadcast Message Page ─────────────────────────── */
function GlobalBroadcastPage({ eventId, onToast }) {
  const [message, setMessage] = useState("");
  const [globalPdfUrl, setGlobalPdfUrl] = useState("");
  const [eventResultPdfUrl, setEventResultPdfUrl] = useState("");
  const [pdfUpdatedAt, setPdfUpdatedAt] = useState(null);
  const [eventResultUpdatedAt, setEventResultUpdatedAt] = useState(null);
  const [msgUpdatedAt, setMsgUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [eventResultUploading, setEventResultUploading] = useState(false);

  const globalPdfInputRef = useRef(null);
  const eventResultInputRef = useRef(null);

  useEffect(() => { if (eventId) loadSettings(); }, [eventId]);

  const loadSettings = async () => {
    const all = await EventSettingsAPI.getAll(eventId);
    setMessage(all["broadcast_message"] || "");
    setGlobalPdfUrl(all["pdf_url"] || "");
    setEventResultPdfUrl(all["event_result_pdf_url"] || "");
    setPdfUpdatedAt(all["pdf_updated_at"] || null);
    setEventResultUpdatedAt(all["event_result_pdf_updated_at"] || null);
    setMsgUpdatedAt(all["message_updated_at"] || null);
  };

  const saveMessage = async () => {
    if (message.length > 2000) { onToast?.("Message exceeds 2000 characters", "error"); return; }
    setSaving(true);
    try {
      await EventSettingsAPI.setMany(eventId, {
        broadcast_message: message,
        message_updated_at: new Date().toISOString()
      });
      setMsgUpdatedAt(new Date().toISOString());
      onToast?.("Event message published", "success");
    } catch { onToast?.("Failed to save message", "error"); }
    finally { setSaving(false); }
  };

  const uploadPdf = async (file, settingKey, updatedAtKey, setUrl, setTs, setUploading) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onToast?.("PDF must be under 10 MB", "error"); return; }
    setUploading(true);
    try {
      const result = await uploadToStorage(file, "broadcasts");
      const now = new Date().toISOString();
      await EventSettingsAPI.setMany(eventId, { [settingKey]: result.url, [updatedAtKey]: now });
      setUrl(result.url);
      setTs(now);
      onToast?.("PDF uploaded successfully", "success");
    } catch (err) { onToast?.("Upload failed: " + (err.message || ""), "error"); }
    finally { setUploading(false); }
  };

  const removePdf = async (settingKey, updatedAtKey, setUrl, setTs) => {
    await EventSettingsAPI.setMany(eventId, { [settingKey]: "", [updatedAtKey]: "" });
    setUrl(""); setTs(null);
    onToast?.("PDF removed", "success");
  };

  const formatUTC = (ts) => ts ? new Date(ts).toUTCString().replace(" GMT", " UTC") : null;

  return (
    <div className="space-y-6">
      {/* Broadcast Message */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-extralight text-white">Event QR Broadcast Message</h3>
        </div>
        <p className="text-gray-400 font-extralight text-lg mb-3">
          Shown on every QR scan page for this event instantly after publishing.
        </p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={2000}
          rows={6}
          placeholder="Enter global broadcast message..."
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white font-extralight text-lg resize-none focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-500 font-extralight text-lg">{message.length}/2000</span>
          {msgUpdatedAt && (
            <span className="text-gray-500 font-extralight text-lg flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last published: {formatUTC(msgUpdatedAt)}
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={saveMessage}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Publishing..." : "Publish Message"}
          </button>
          {message && (
            <button
              onClick={() => setMessage("")}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* PDF Slots — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global PDF Slot */}
        <PdfSlotCard
          label="Global PDF Slot"
          description="Visible to all QR scan pages."
          color="green"
          url={globalPdfUrl}
          updatedAt={pdfUpdatedAt}
          uploading={pdfUploading}
          inputRef={globalPdfInputRef}
          onUpload={file => uploadPdf(file, "pdf_url", "pdf_updated_at", setGlobalPdfUrl, setPdfUpdatedAt, setPdfUploading)}
          onRemove={() => removePdf("pdf_url", "pdf_updated_at", setGlobalPdfUrl, setPdfUpdatedAt)}
          formatUTC={formatUTC}
        />

        {/* Event Result PDF Slot */}
        <PdfSlotCard
          label="Event Result PDF"
          description="Specific event result shown on QR scan pages for this event."
          color="purple"
          url={eventResultPdfUrl}
          updatedAt={eventResultUpdatedAt}
          uploading={eventResultUploading}
          inputRef={eventResultInputRef}
          onUpload={file => uploadPdf(file, "event_result_pdf_url", "event_result_pdf_updated_at", setEventResultPdfUrl, setEventResultUpdatedAt, setEventResultUploading)}
          onRemove={() => removePdf("event_result_pdf_url", "event_result_pdf_updated_at", setEventResultPdfUrl, setEventResultUpdatedAt)}
          formatUTC={formatUTC}
        />
      </div>
    </div>
  );
}

/* ─── Reusable PDF Slot Card ─────────────────────────────────── */
function PdfSlotCard({ label, description, color, url, updatedAt, uploading, inputRef, onUpload, onRemove, formatUTC }) {
  const colorMap = {
    green: { border: "border-green-500", bg: "bg-green-600 hover:bg-green-700", text: "text-green-400", dashed: "hover:border-green-500", icon: "text-green-400" },
    purple: { border: "border-purple-500", bg: "bg-purple-600 hover:bg-purple-700", text: "text-purple-400", dashed: "hover:border-purple-500", icon: "text-purple-400" }
  };
  const c = colorMap[color] || colorMap.green;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { onUpload(file); e.target.value = ""; }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Upload className={`w-5 h-5 ${c.icon}`} />
        <h3 className="text-lg font-extralight text-white">{label}</h3>
      </div>
      <p className="text-gray-400 font-extralight text-lg mb-4">{description}</p>

      {url ? (
        <div className="space-y-2">
          <div className={`border ${c.border} rounded-lg px-4 py-3 bg-gray-900`}>
            <p className="text-white font-extralight text-lg">PDF Active</p>
            {updatedAt && (
              <p className="text-gray-400 font-extralight text-lg flex items-center gap-1 mt-1">
                <Clock className="w-4 h-4" />
                Updated: {formatUTC(updatedAt)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className={`${c.bg} text-white px-3 py-1.5 rounded font-extralight text-lg transition-colors`}>
              View
            </a>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-extralight text-lg cursor-pointer transition-colors">
              Replace
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </label>
            <button onClick={onRemove}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-extralight text-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-600 ${c.dashed} rounded-lg py-8 cursor-pointer transition-colors`}>
          <Upload className={`w-8 h-8 ${c.icon} mb-2`} />
          <span className="text-gray-300 font-extralight text-lg">
            {uploading ? "Uploading..." : `Click to upload ${label}`}
          </span>
          <span className="text-gray-500 font-extralight text-lg mt-1">Max 10 MB · PDF only</span>
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

/* ─── Athlete QR Broadcast Page ──────────────────────────────── */
function AthleteQRBroadcastPage({ eventId, onToast }) {
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (eventId) loadSettings(); }, [eventId]);

  const loadSettings = async () => {
    const all = await EventSettingsAPI.getAll(eventId);
    setMessage(all["athlete_qr_broadcast_message"] || "");
    setUpdatedAt(all["athlete_qr_broadcast_updated_at"] || null);
  };

  const saveMessage = async () => {
    if (message.length > 2000) { onToast?.("Message exceeds 2000 characters", "error"); return; }
    setSaving(true);
    try {
      await EventSettingsAPI.setMany(eventId, {
        athlete_qr_broadcast_message: message,
        athlete_qr_broadcast_updated_at: new Date().toISOString()
      });
      setUpdatedAt(new Date().toISOString());
      onToast?.("Athlete QR broadcast published", "success");
    } catch { onToast?.("Failed to save message", "error"); }
    finally { setSaving(false); }
  };

  const formatUTC = (ts) => ts ? new Date(ts).toUTCString().replace(" GMT", " UTC") : null;

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-extralight text-white">Athlete QR Broadcast Message</h3>
        </div>
        <p className="text-gray-400 font-extralight text-lg mb-3">
          Shown specifically on Athlete QR scan pages instantly after publishing.
        </p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={2000}
          rows={6}
          placeholder="Enter athlete-specific broadcast message..."
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white font-extralight text-lg resize-none focus:outline-none focus:border-orange-500"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-500 font-extralight text-lg">{message.length}/2000</span>
          {updatedAt && (
            <span className="text-gray-500 font-extralight text-lg flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last published: {formatUTC(updatedAt)}
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={saveMessage}
            disabled={saving}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Publishing..." : "Publish Message"}
          </button>
          {message && (
            <button
              onClick={() => setMessage("")}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
