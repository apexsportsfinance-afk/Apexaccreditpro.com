import React, { useState, useRef, useEffect } from "react";
import { X, Upload, ShieldAlert, FileText, CheckCircle, Loader2 } from "lucide-react";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { TeamAPI } from "../../services/teamApi";
import { TeamPortalAPI } from "../../services/teamPortalApi";
import { useAuth } from "../../contexts/AuthContext";

const FALLBACK_DOC_TYPES = [
  "Trade License",
  "Passport Copy",
  "National ID",
  "Team Roster",
  "Insurance",
  "Medical Clearance",
  "Other"
];

export default function DocumentUploadModal({
  isOpen, onClose, teamId, eventId, onUploadComplete, isPortal = false,
  // availableDocTypes: array of { doc_type, is_required } or strings — comes from event_document_requirements
  availableDocTypes = null,
  // existingDocs: currently uploaded docs to filter dropdown
  existingDocs = [],
  // preSelectedDocType: pre-fill the dropdown (used for re-upload of a rejected doc)
  preSelectedDocType = ""
}) {
  const [docType, setDocType] = useState(preSelectedDocType || "");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setDocType(preSelectedDocType || "");
      setFile(null);
    }
  }, [isOpen, preSelectedDocType]);

  if (!isOpen) return null;

  // Build the base list of doc types
  const baseTypes = availableDocTypes
    ? availableDocTypes.map(d => (typeof d === 'string' ? d : d.doc_type))
    : FALLBACK_DOC_TYPES;

  // Filter: remove types that are already uploaded with status approved or pending
  // Keep types that are rejected (allow re-upload) or not uploaded yet
  const uploadedNonRejected = new Set(
    existingDocs
      .filter(d => d.status === 'approved' || d.status === 'pending')
      .map(d => d.doc_type)
  );

  const filteredDocTypes = baseTypes.filter(t => !uploadedNonRejected.has(t));

  // If preSelectedDocType is set (re-upload), ensure it's in the list
  if (preSelectedDocType && !filteredDocTypes.includes(preSelectedDocType)) {
    filteredDocTypes.unshift(preSelectedDocType);
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) { setFile(null); return; }

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      toast.error(`Invalid file type (.${extension}). Only PDF, JPG, PNG, and WEBP are allowed.`);
      e.target.value = '';
      setFile(null);
      return;
    }

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(selectedFile.type)) {
      toast.error("Invalid file content type. This file appears unsafe.");
      e.target.value = '';
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!docType) { toast.error("Please select a document type"); return; }
    if (!file) { toast.error("Please select a file to upload"); return; }
    if (!eventId || !teamId) { toast.error("Missing system context (event or team ID)"); return; }

    try {
      setUploading(true);
      let newDoc;
      if (isPortal) {
        newDoc = await TeamPortalAPI.uploadPortalDocument(teamId, eventId, docType, file, user.id);
      } else {
        const safeFolder = `team-documents/${eventId}/${teamId}`;
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { url } = await uploadToStorage(file, safeFolder, safeFileName);
        newDoc = await TeamAPI.addTeamDocument(teamId, eventId, docType, url);
      }
      toast.success("Document uploaded securely!");
      if (onUploadComplete) onUploadComplete(newDoc);
      handleClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setDocType(preSelectedDocType || "");
    setFile(null);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {preSelectedDocType ? `Re-upload: ${preSelectedDocType}` : "Upload Document"}
              </h2>
              <p className="text-xs text-slate-400">Securely upload official team files</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Document Type *</label>
            {preSelectedDocType ? (
              <div className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium">
                {preSelectedDocType}
              </div>
            ) : (
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                disabled={uploading}
              >
                <option value="">Select type...</option>
                {filteredDocTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            )}
            {filteredDocTypes.length === 0 && !preSelectedDocType && (
              <p className="text-xs text-emerald-400 mt-2">All required documents have been uploaded.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select File *</label>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${file ? 'border-primary-500 bg-primary-500/5' : 'border-white/10 hover:border-primary-500/50 bg-white/[0.02]'}
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
              />
              {file ? (
                <div className="flex flex-col items-center">
                  <CheckCircle className="w-12 h-12 text-primary-500 mb-3" />
                  <p className="text-white font-medium break-all">{file.name}</p>
                  <p className="text-sm text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-slate-500 mb-3" />
                  <p className="text-white font-medium">Click to browse files</p>
                  <p className="text-xs text-slate-400 mt-2">PDF, JPG, PNG, WEBP only</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-200 font-medium mb-1">Strict Security Enforced</p>
              <p className="text-red-200/70">Scripts and executables (HTML, JS, PHP, EXE) are permanently blocked. All uploads are securely isolated.</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} loading={uploading} disabled={!file || !docType || uploading}>
            {uploading ? "Uploading Securely..." : "Upload Document"}
          </Button>
        </div>
      </div>
    </div>
  );
}
