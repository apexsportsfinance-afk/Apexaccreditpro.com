import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Clock, 
  Plus, 
  FileSpreadsheet, 
  FileCode,
  Files,
  MoreVertical,
  ChevronRight
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import Button from "../ui/Button";

const getFileIcon = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'pdf') return <FileText className="w-5 h-5 text-red-400" />;
  if (t === 'csv' || t === 'xls' || t === 'xlsx') return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  return <FileCode className="w-5 h-5 text-blue-400" />;
};

export default function OfficialDocumentsTab({ eventId, onToast }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    loadDocs();
  }, [eventId]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await GlobalSettingsAPI.get(`event_${eventId}_official_docs`);
      if (data) {
        const parsed = JSON.parse(data);
        console.log("Official Documents Loaded:", parsed.length);
        setDocs(parsed);
      } else {
        setDocs([]);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const persistDocs = async (newDocs) => {
    try {
      await GlobalSettingsAPI.set(`event_${eventId}_official_docs`, JSON.stringify(newDocs));
      setDocs(newDocs);
    } catch (err) {
      onToast?.("Failed to save document list", "error");
    }
  };

  const handleUpload = async (e) => {
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
      const filename = `official-docs/${eventId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Determine content type
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
        createdAt: new Date().toISOString()
      };

      const latestData = await GlobalSettingsAPI.get(`event_${eventId}_official_docs`);
      const existingArray = latestData ? JSON.parse(latestData) : [];
      const updatedArray = [newDoc, ...existingArray];
      
      await persistDocs(updatedArray);
      onToast?.("Document uploaded successfully", "success");
    } catch (err) {
      console.error(err);
      onToast?.(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Permanently delete this document from the portal?")) return;
    
    const docToDelete = docs.find(d => d.id === id);
    if (!docToDelete) return;

    try {
      if (docToDelete.url.includes('/public/accreditation-files/')) {
        const path = docToDelete.url.split('/public/accreditation-files/')[1];
        if (path) {
          await supabase.storage.from("accreditation-files").remove([path]);
        }
      }

      const latestData = await GlobalSettingsAPI.get(`event_${eventId}_official_docs`);
      const currentArray = latestData ? JSON.parse(latestData) : [];
      const updated = currentArray.filter(d => d.id !== id);
      await persistDocs(updated);
      onToast?.("Document removed", "success");
    } catch (err) {
      onToast?.("Removal failed", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-glass border border-white/10 rounded-md backdrop-blur-sm">
        <div>
          <h2 className="text-white font-heading font-black uppercase tracking-widest text-h2 flex items-center gap-3">
            <Files className="w-5 h-5 text-primary" />
            Official Event Assets
          </h2>
          <p className="text-slate-400 text-meta font-medium mt-1">
            NAMESPACE: <span className="text-primary font-mono select-all bg-primary/10 px-1 rounded">{eventId}</span> • MANAGE TOURNAMENT REPOSITORY
          </p>
        </div>

        <div className="relative group">
          <input 
            type="file" 
            onChange={handleUpload} 
            disabled={uploading}
            accept=".pdf,.csv,.xls,.xlsx"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          />
          <Button 
            loading={uploading}
            className="w-full md:w-auto bg-gradient-to-br from-cyan-600 to-blue-700 shadow-xl shadow-cyan-900/20 gap-2 font-black uppercase tracking-wider text-xs px-6 py-3.5"
          >
            {uploading ? 'Uploading...' : (
              <>
                <Upload className="w-4 h-4" />
                Add Document
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-24 bg-slate-900/40 border border-white/5 rounded-md animate-pulse" />
          ))}
        </div>
      ) : docs.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 gap-2.5">
          {docs.map(doc => (
            <div 
              key={doc.id} 
              className="bg-glass border border-white/5 p-2.5 rounded-md group hover:border-primary/30 hover:bg-slate-900/80 transition-all duration-300 shadow-lg"
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
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
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
                  <span className="text-primary">{doc.type}</span>
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
            <FileCode className="w-12 h-12 text-slate-700" />
          </div>
          <h3 className="text-white/60 font-black uppercase tracking-widest text-sm">No official documents yet</h3>
          <p className="text-slate-600 text-xs mt-2">Upload your first PDF, CSV, or Excel sheet to get started.</p>
        </div>
      )}
    </div>
  );
}
