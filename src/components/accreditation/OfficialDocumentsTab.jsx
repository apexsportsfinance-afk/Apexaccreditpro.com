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
  FileBox,
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
        setDocs(JSON.parse(data));
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
        id: crypto.randomUUID(),
        name: file.name,
        url: urlData.publicUrl,
        type: ext,
        size: (file.size / 1024).toFixed(1) + " KB",
        createdAt: new Date().toISOString()
      };

      await persistDocs([newDoc, ...docs]);
      onToast?.("Document uploaded successfully", "success");
    } catch (err) {
      console.error(err);
      onToast?.(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Permanently delete this document from the portal?")) return;
    
    const docToDelete = docs.find(d => d.id === id);
    if (!docToDelete) return;

    try {
      // Try to delete from storage if possible
      if (docToDelete.url.includes('/public/accreditation-files/')) {
        const path = docToDelete.url.split('/public/accreditation-files/')[1];
        if (path) {
          await supabase.storage.from("accreditation-files").remove([path]);
        }
      }

      const updated = docs.filter(d => d.id !== id);
      await persistDocs(updated);
      onToast?.("Document removed", "success");
    } catch (err) {
      onToast?.("Removal failed", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-white font-black uppercase tracking-widest text-lg flex items-center gap-3">
            <FileBox className="w-6 h-6 text-cyan-400" />
            Official Event Documents
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1">Upload and manage PDFs, Excel sheets, and CSV documents for DIAC 2026.</p>
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

      {/* Document Grid/List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-slate-900/40 border border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : docs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => (
            <div 
              key={doc.id} 
              className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl group hover:border-white/20 hover:bg-slate-900/80 transition-all duration-300 shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                  {getFileIcon(doc.type)}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => window.open(doc.url, '_blank')}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Preview / Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-white font-bold text-sm truncate pr-4" title={doc.name}>
                  {doc.name}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>{doc.type}</span>
                  <span>•</span>
                  <span>{doc.size}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-600 font-bold uppercase">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </div>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
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
