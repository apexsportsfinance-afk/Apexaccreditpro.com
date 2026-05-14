import React, { useState, useEffect } from "react";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  RefreshCw, Trash2, Eye, Loader2, FileText, Edit3, X, Save, Download
} from "lucide-react";
import { SportEventsAPI, MeetProgrammesAPI } from "../../lib/broadcastApi";
import { parseExcelEvents } from "../../lib/excelParser";
import * as XLSX from "xlsx";
import { extractTextFromPdf, parsePdfEventsFromText } from "../../lib/pdfParser";
import { supabase } from "../../lib/supabase";

export default function SportEventsManager({ eventId, onToast }) {
  const [events, setEvents] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [pendingProgramme, setPendingProgramme] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // For inline editing committed events
  const [inlineEditing, setInlineEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (eventId) loadAll();
  }, [eventId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [evs, progs] = await Promise.all([
        SportEventsAPI.getByEventId(eventId),
        MeetProgrammesAPI.getByEventId(eventId, 5)
      ]);
      setEvents(evs);
      setProgrammes(progs);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress("Parsing Excel...");
    try {
      const parsed = await parseExcelEvents(file);
      if (parsed.length === 0) throw new Error("No events found in Excel file");
      await SportEventsAPI.bulkUpsert(eventId, parsed);
      await loadAll();
      onToast?.(`${parsed.length} events imported from Excel`, "success");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setUploading(false);
      setUploadProgress("");
      e.target.value = "";
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onToast?.("PDF must be under 20 MB", "error");
      return;
    }
    setUploading(true);

    try {
      // Step 1: Extract text from PDF client-side
      setUploadProgress("Extracting text from PDF...");
      const rawText = await extractTextFromPdf(file);

      // Step 2: Parse events from extracted text
      setUploadProgress("Parsing events from text...");
      const parsed = parsePdfEventsFromText(rawText);

      // Step 3: Upload file to storage
      setUploadProgress("Uploading PDF to storage...");
      const filename = `programmes/${eventId}/prog-${Date.now()}.pdf`;
      const { data, error } = await supabase.storage
        .from("accreditation-files")
        .upload(filename, file, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("accreditation-files")
        .getPublicUrl(data.path);

      // Step 4: Save programme record
      setUploadProgress("Saving programme record...");
      const prog = await MeetProgrammesAPI.create(eventId, urlData.publicUrl, parsed);

      setPendingProgramme(prog);
      setPendingEvents(parsed);
      await loadAll();

      if (parsed.length === 0) {
        onToast?.(
          "PDF uploaded but no events could be auto-extracted. Please review and add events manually, or use Excel upload.",
          "warning"
        );
      } else {
        onToast?.(
          `PDF uploaded. ${parsed.length} events extracted — review and commit to apply.`,
          "info"
        );
      }
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setUploading(false);
      setUploadProgress("");
      e.target.value = "";
    }
  };

  const updatePendingEvent = (idx, field, value) => {
    setPendingEvents((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removePendingEvent = (idx) => {
    setPendingEvents((prev) => prev.filter((_, i) => i !== idx));
  };

  const commitProgramme = async () => {
    if (!pendingProgramme) return;
    setCommitting(true);
    try {
      await MeetProgrammesAPI.commit(pendingProgramme.id, eventId, pendingEvents);
      await SportEventsAPI.bulkUpsert(eventId, pendingEvents);
      setPendingProgramme(null);
      setPendingEvents([]);
      await loadAll();
      onToast?.("Programme committed. All athlete event dates updated.", "success");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setCommitting(false);
    }
  };

  const clearAllEvents = async () => {
    if (!confirm("Delete all sport events for this meet? Athlete selections will be preserved.")) return;
    await SportEventsAPI.deleteByEventId(eventId);
    await loadAll();
    onToast?.("Events cleared", "success");
  };

  const handleDownloadTemplate = (format = 'csv') => {
    const headers = ["EventCode", "EventName", "Gender", "AgeMin", "AgeMax", "Session", "Date", "StartTime", "Venue"];
    const demoRow1 = ["EVT-01", "100m Freestyle", "Male", "14", "99", "1", "2026-05-10", "09:00", "Main Pool"];
    const demoRow2 = ["EVT-02", "100m Freestyle", "Female", "14", "99", "1", "2026-05-10", "09:15", "Main Pool"];
    
    if (format === 'csv') {
      const csvContent = [
        headers.join(","),
        demoRow1.join(","),
        demoRow2.join(",")
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "Sport_Events_Template.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'excel') {
      const ws = XLSX.utils.aoa_to_sheet([headers, demoRow1, demoRow2]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Sport_Events_Template.xlsx");
    }
  };

  const startInlineEdit = (ev) => {
    setInlineEditing(ev.id);
    setEditForm({ ...ev });
  };

  const cancelInlineEdit = () => {
    setInlineEditing(null);
    setEditForm({});
  };

  const saveInlineEdit = async () => {
    try {
      await SportEventsAPI.bulkUpsert(eventId, [editForm]);
      setInlineEditing(null);
      await loadAll();
      onToast?.("Event updated successfully", "success");
    } catch (err) {
      onToast?.("Failed to update event: " + err.message, "error");
    }
  };

  const handleEditFormChange = (e, field) => {
    setEditForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 font-extralight text-lg py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading events...
      </div>
    );
  }

  return (
    <div id="sport-events-manager" className="space-y-6">
      {/* Upload actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-6 transition-colors ${uploading ? "opacity-50 border-gray-700" : "border-gray-600 focus-within:border-blue-500"}`}>
          <label className={`absolute inset-0 z-10 w-full h-full cursor-pointer ${uploading ? "cursor-not-allowed text-transparent" : "text-transparent"}`}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleExcelUpload}
              disabled={uploading}
            />
          </label>
          <div className="relative z-0 flex flex-col items-center pointer-events-none">
            <FileSpreadsheet className="w-7 h-7 text-blue-400 mb-2 pointer-events-auto" />
            <span className="text-white font-extralight text-lg pointer-events-auto cursor-pointer">
              {uploading ? uploadProgress || "Working..." : "Upload Excel"}
            </span>
            <span className="text-gray-500 font-extralight text-lg mt-1 text-center px-2 pointer-events-auto">
              EventCode, EventName, Gender, AgeMin, AgeMax, Session, Date, StartTime, Venue
            </span>
          </div>
          <div className="absolute top-2 right-2 z-20 flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadTemplate('csv'); }}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-blue-400 px-2 py-1 rounded text-sm transition-colors border border-gray-700"
              disabled={uploading}
              title="Download CSV Template"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadTemplate('excel'); }}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-green-400 px-2 py-1 rounded text-sm transition-colors border border-gray-700"
              disabled={uploading}
              title="Download Excel Template"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-6 cursor-pointer transition-colors ${uploading ? "opacity-50 cursor-not-allowed border-gray-700" : "border-gray-600 hover:border-purple-500"}`}>
          {uploading ? (
            <Loader2 className="w-7 h-7 text-purple-400 mb-2 animate-spin" />
          ) : (
            <Upload className="w-7 h-7 text-purple-400 mb-2" />
          )}
          <span className="text-white font-extralight text-lg">
            {uploading ? uploadProgress || "Processing..." : "Upload Meet Programme PDF"}
          </span>
          <span className="text-gray-500 font-extralight text-lg mt-1 text-center px-2">
            Auto-extracts event numbers and names — review before committing
          </span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handlePdfUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Pending programme preview with editable events */}
      {pendingProgramme && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-300 font-extralight text-lg">
                PDF parsed — {pendingEvents.length} events extracted
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={commitProgramme}
                disabled={committing || pendingEvents.length === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {committing ? "Committing..." : "Commit & Apply"}
              </button>
              <button
                onClick={() => { setPendingProgramme(null); setPendingEvents([]); }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>

          {pendingEvents.length === 0 ? (
            <div className="bg-orange-900/30 border border-orange-600 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-orange-400" />
                <span className="text-orange-300 font-extralight text-lg font-medium">
                  No events auto-detected
                </span>
              </div>
              <p className="text-gray-400 font-extralight text-lg">
                The PDF text could not be matched to a structured event list.
                This happens when PDFs use complex tables, images, or non-standard layouts.
              </p>
              <p className="text-gray-400 font-extralight text-lg mt-2">
                <strong className="text-white">Recommended:</strong> Export your event list to Excel and use the Excel upload instead for reliable extraction.
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-96 rounded-lg border border-gray-700">
              <table className="w-full text-lg font-extralight">
                <thead className="bg-gray-900 sticky top-0">
                  <tr>
                    {["#", "Code", "Event Name", "Gender", "Date", "Time", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-gray-400 font-extralight">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingEvents.map((ev, i) => (
                    <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/20">
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        {editingEvent === i ? (
                          <input
                            className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-lg"
                            value={ev.eventCode}
                            onChange={(e) => updatePendingEvent(i, "eventCode", e.target.value)}
                          />
                        ) : (
                          <span className="text-blue-300">{ev.eventCode}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingEvent === i ? (
                          <input
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-lg"
                            value={ev.eventName}
                            onChange={(e) => updatePendingEvent(i, "eventName", e.target.value)}
                          />
                        ) : (
                          <span className="text-white">{ev.eventName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-300">{ev.gender || "-"}</td>
                      <td className="px-3 py-2 text-gray-300">{ev.date || "-"}</td>
                      <td className="px-3 py-2 text-gray-300">{ev.startTime || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingEvent(editingEvent === i ? null : i)}
                            className="p-1 text-blue-400 hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removePendingEvent(i)}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Committed events table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <span className="text-white font-extralight text-lg">{events.length} Events Loaded</span>
          <div className="flex gap-2">
            <button onClick={loadAll} className="p-2 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {events.length > 0 && (
              <button
                onClick={clearAllEvents}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 font-extralight text-lg transition-colors px-2"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
        </div>
        {events.length === 0 ? (
          <div className="py-12 text-center text-gray-500 font-extralight text-lg">
            No events loaded. Upload Excel or PDF to begin.
          </div>
        ) : (
          <div className="overflow-auto max-h-72">
            <table className="w-full text-lg font-extralight">
              <thead className="bg-gray-900">
                <tr>
                  {["Code", "Event", "Gender", "Age (Min-Max)", "Session", "Date", "Time", "Venue", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-gray-400 font-extralight">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={ev.id || i} className="border-t border-gray-700 hover:bg-gray-700/30">
                    {inlineEditing === ev.id ? (
                      <>
                        <td className="px-2 py-2">
                          <input className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.eventCode || ''} onChange={(e) => handleEditFormChange(e, 'eventCode')} />
                        </td>
                        <td className="px-2 py-2">
                          <input className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.eventName || ''} onChange={(e) => handleEditFormChange(e, 'eventName')} />
                        </td>
                        <td className="px-2 py-2">
                          <input className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.gender || ''} onChange={(e) => handleEditFormChange(e, 'gender')} />
                        </td>
                        <td className="px-2 py-2 flex items-center gap-1 mt-1">
                          <input className="w-12 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" placeholder="Min" value={editForm.ageMin || ''} onChange={(e) => handleEditFormChange(e, 'ageMin')} />
                          <span className="text-gray-500">-</span>
                          <input className="w-12 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" placeholder="Max" value={editForm.ageMax || ''} onChange={(e) => handleEditFormChange(e, 'ageMax')} />
                        </td>
                        <td className="px-2 py-2">
                          <input className="w-12 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.session || ''} onChange={(e) => handleEditFormChange(e, 'session')} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="date" className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.date || ''} onChange={(e) => handleEditFormChange(e, 'date')} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="time" className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.startTime || ''} onChange={(e) => handleEditFormChange(e, 'startTime')} />
                        </td>
                        <td className="px-2 py-2">
                          <input className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white" value={editForm.venue || ''} onChange={(e) => handleEditFormChange(e, 'venue')} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-2">
                            <button onClick={saveInlineEdit} className="text-green-400 hover:text-green-300" title="Save">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-gray-400 hover:text-gray-300" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-blue-300">{ev.eventCode}</td>
                        <td className="px-4 py-2 text-white">{ev.eventName}</td>
                        <td className="px-4 py-2 text-gray-300">{ev.gender || "-"}</td>
                        <td className="px-4 py-2 text-gray-300">
                          {ev.ageMin || ev.ageMax ? `${ev.ageMin || 0}–${ev.ageMax || "∞"}` : "-"}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{ev.session || "-"}</td>
                        <td className="px-4 py-2 text-gray-300">{ev.date || "-"}</td>
                        <td className="px-4 py-2 text-gray-300">{ev.startTime || "-"}</td>
                        <td className="px-4 py-2 text-gray-300">{ev.venue || "-"}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => startInlineEdit(ev)}
                            className="p-1 text-blue-400 hover:text-blue-300 bg-gray-800 rounded border border-gray-700 hover:border-blue-500/50 transition-colors"
                            title="Edit Event"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Version history */}
      {programmes.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="text-white font-extralight text-lg mb-3">Programme History (last 5)</h4>
          <div className="space-y-2">
            {programmes.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-gray-900 rounded px-3 py-2">
                <span className="text-gray-300 font-extralight text-lg">
                  v{p.version} — {new Date(p.created_at).toLocaleString()} — {p.status}
                </span>
                <a
                  href={p.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-extralight text-lg"
                >
                  <Eye className="w-4 h-4" /> View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
