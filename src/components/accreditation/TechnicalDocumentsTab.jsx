import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Clock, 
  FileSpreadsheet, 
  FileCode,
  Files,
  ChevronRight,
  Filter
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { EventsAPI } from "../../lib/storage";
import Button from "../ui/Button";
import { cn } from "../../lib/utils";
import SearchableSelect from "../ui/SearchableSelect";

const getFileIcon = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'pdf') return <FileText className="w-5 h-5 text-indigo-400" />;
  if (t === 'csv' || t === 'xls' || t === 'xlsx') return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  return <FileCode className="w-5 h-5 text-blue-400" />;
};

export default function TechnicalDocumentsTab({ eventId, onToast, disabled }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sports, setSports] = useState(["General"]);
  const [selectedSport, setSelectedSport] = useState("General");

  useEffect(() => {
    if (!eventId) return;
    loadAll();
  }, [eventId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // 1. Load Sports for this event
      let eventSports = [];
      const gsSports = await GlobalSettingsAPI.get(`event_${eventId}_sport`);
      
      if (gsSports) {
        if (typeof gsSports === 'string' && gsSports.startsWith('[')) {
          try {
            eventSports = JSON.parse(gsSports);
          } catch(e) {
            eventSports = [gsSports];
          }
        } else if (Array.isArray(gsSports)) {
          eventSports = gsSports;
        } else if (typeof gsSports === 'string') {
          eventSports = [gsSports];
        }
      }

      // Fallback to table column if GS is empty
      if (eventSports.length === 0) {
        const event = await EventsAPI.getById(eventId);
        if (event?.sportList && event.sportList.length > 0) {
          eventSports = event.sportList;
        }
      }

      setSports(["General", ...eventSports]);

      // 2. Load Documents
      const data = await GlobalSettingsAPI.get(`event_${eventId}_technical_docs`);
      if (data) {
        setDocs(JSON.parse(data));
      } else {
        setDocs([]);
      }
    } catch (err) {
      console.error("Failed to load tab data:", err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const persistDocs = async (newDocs) => {
    if (disabled) return;
    try {
      await GlobalSettingsAPI.set(`event_${eventId}_technical_docs`, JSON.stringify(newDocs));
      setDocs(newDocs);
    } catch (err) {
      onToast?.("Failed to save technical document list", "error");
    }
  };

  const handleUpload = async (e) => {
    if (disabled) return;
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      onToast?.("File must be under 20 MB", "error");
      return;
    }

    setUploading(true);
    try {
      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const filename = `technical-docs/${eventId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      let contentType = "application/octet-stream";
      if (ext === 'pdf') contentType = "application/pdf";
      else if (ext === 'csv') contentType = "text/csv";
      else if (ext === 'xlsx') contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (ext === 'xls') contentType = "application/vnd.ms-excel";

      const { data, error } = await supabase.storage
        .from("accreditation-files")
        .upload(filename, uint8, { 
          upsert: true, 
          contentType 
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("accreditation-files")
        .getPublicUrl(data.path);

      const newDoc = {
        id: Date.now().toString(),
        name: file.name,
        type: ext,
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
        url: urlData.publicUrl,
        createdAt: new Date().toISOString(),
        sport: selectedSport // Tag with selected sport
      };

      const latestData = await GlobalSettingsAPI.get(`event_${eventId}_technical_docs`);
      const existingArray = latestData ? JSON.parse(latestData) : [];
      const updatedArray = [newDoc, ...existingArray];
      
      await persistDocs(updatedArray);
      onToast?.("Result document uploaded successfully", "success");
    } catch (err) {
      console.error(err);
      onToast?.(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (disabled) return;
    if (!confirm("Permanently delete this result document?")) return;
    
    const docToDelete = docs.find(d => d.id === id);
    if (!docToDelete) return;

    try {
      if (docToDelete.url.includes('/public/accreditation-files/')) {
        const path = docToDelete.url.split('/public/accreditation-files/')[1];
        if (path) {
          await supabase.storage.from("accreditation-files").remove([path]);
        }
      }

      const latestData = await GlobalSettingsAPI.get(`event_${eventId}_technical_docs`);
      const currentArray = latestData ? JSON.parse(latestData) : [];
      const updated = currentArray.filter(d => d.id !== id);
      await persistDocs(updated);
      onToast?.("Document removed", "success");
    } catch (err) {
      onToast?.("Removal failed", "error");
    }
  };

  // Filtering Logic
  const filteredDocs = docs.filter(doc => {
    const docSport = doc.sport || "General";
    return docSport === selectedSport;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-glass border border-white/10 rounded-md backdrop-blur-sm">
        <div>
          <h2 className="text-white font-heading font-black uppercase tracking-widest text-h2 flex items-center gap-3">
            <Files className="w-5 h-5 text-indigo-400" />
            Result Documents
          </h2>
          <p className="text-slate-400 text-meta font-medium mt-1">
            REPOSITORY: <span className="text-indigo-400 font-mono select-all bg-indigo-400/10 px-1 rounded">{eventId}</span> • MANAGE RESULT ASSETS
          </p>
        </div>

        <div className="relative group">
          {!disabled && (
            <input 
              type="file" 
              onChange={handleUpload} 
              disabled={uploading}
              accept=".pdf,.csv,.xls,.xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            />
          )}
          <Button 
            loading={uploading}
            disabled={disabled}
            className={cn(
              "w-full md:w-auto bg-gradient-to-br from-indigo-600 to-blue-700 shadow-xl shadow-indigo-900/20 gap-2 font-black uppercase tracking-wider text-xs px-6 py-3.5",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {uploading ? 'Uploading...' : (
              <>
                <Upload className="w-4 h-4" />
                {disabled ? "View Only" : "Add Result Doc"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sport Selector Dropdown */}
      <div className="flex flex-col gap-3 max-w-md">
        <div className="flex items-center gap-2 px-2">
          <Filter className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filter by Sport ({sports.length})</span>
        </div>
        <div className="px-2">
          <SearchableSelect
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            options={sports.map(sport => ({
              label: `${sport} (${docs.filter(d => (d.sport || "General") === sport).length})`,
              value: sport
            }))}
            placeholder="Select a sport to filter results"
            className="w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-slate-900/40 border border-white/5 rounded-md animate-pulse" />
          ))}
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 gap-2.5">
          {filteredDocs.map(doc => (
            <div 
              key={doc.id} 
              className={cn(
                "bg-glass border border-white/5 p-2.5 rounded-md group hover:bg-slate-900/80 transition-all duration-300 shadow-lg",
                !disabled && "hover:border-indigo-400/30"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-1.5 bg-slate-950/50 rounded-lg border border-white/5">
                  {getFileIcon(doc.type)}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => window.open(doc.url, '_blank')}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    disabled={disabled}
                    className={cn(
                      "p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors",
                      disabled && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-0.5 mt-2">
                <h4 className="text-white font-heading font-black text-meta uppercase truncate pr-1" title={doc.name}>
                  {doc.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[7px] text-slate-500 font-black uppercase tracking-tighter">
                  <span className="text-indigo-400">{doc.type}</span>
                  <span className="opacity-20">|</span>
                  <span>{doc.size}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[8px] text-slate-600 font-bold uppercase">
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </div>
                <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border-2 border-dashed border-white/5 rounded-3xl">
          <div className="p-5 bg-slate-900/50 rounded-full mb-6">
            <FileText className="w-12 h-12 text-slate-700" />
          </div>
          <h3 className="text-white/60 font-black uppercase tracking-widest text-sm">No documents for {selectedSport}</h3>
          <p className="text-slate-600 text-xs mt-2">Upload result PDFs specifically for {selectedSport}.</p>
        </div>
      )}
    </div>
  );
}
