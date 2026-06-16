import React, { useState, useEffect } from "react";
import { X, FileText, Plus, Trash2, GripVertical, AlertCircle } from "lucide-react";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { TeamAPI } from "../../services/teamApi";

const DEFAULT_DOC_TYPES = [
  "Trade License",
  "Passport Copy",
  "National ID",
  "Team Roster",
  "Insurance",
  "Medical Clearance",
  "Other"
];

export default function DocumentRequirementsModal({ isOpen, onClose, eventId, eventName }) {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDocType, setNewDocType] = useState("");
  const [customInput, setCustomInput] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (isOpen && eventId) {
      loadRequirements();
    }
  }, [isOpen, eventId]);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const data = await TeamAPI.getEventDocumentRequirements(eventId);
      setRequirements(data.length > 0 ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load document requirements");
    } finally {
      setLoading(false);
    }
  };

  const addDocType = (type) => {
    const trimmed = type.trim();
    if (!trimmed) return;
    if (requirements.some(r => r.doc_type.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This document type already exists");
      return;
    }
    setRequirements(prev => [
      ...prev,
      { doc_type: trimmed, is_required: true, description: "", sort_order: prev.length }
    ]);
    setNewDocType("");
    setCustomInput("");
  };

  const removeDocType = (index) => {
    setRequirements(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRequired = (index) => {
    setRequirements(prev => prev.map((r, i) =>
      i === index ? { ...r, is_required: !r.is_required } : r
    ));
  };

  const updateDescription = (index, value) => {
    setRequirements(prev => prev.map((r, i) =>
      i === index ? { ...r, description: value } : r
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await TeamAPI.saveEventDocumentRequirements(eventId, requirements.map((r, i) => ({
        ...r,
        sort_order: i
      })));
      toast.success("Document requirements saved");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save requirements");
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = DEFAULT_DOC_TYPES.filter(
    t => !requirements.some(r => r.doc_type.toLowerCase() === t.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Document Requirements</h2>
              {eventName && <p className="text-xs text-slate-400 mt-0.5">{eventName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-200/80">
                  Define which documents teams must upload for this event. Teams will see this list and their upload status. Required documents are flagged on the portal.
                </p>
              </div>

              {/* Current list */}
              {requirements.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configured Document Types</p>
                  {requirements.map((req, index) => (
                    <div key={index} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                        <FileText className="w-4 h-4 text-primary-500 shrink-0" />
                        <span className="flex-1 font-semibold text-white text-sm">{req.doc_type}</span>
                        <button
                          onClick={() => toggleRequired(index)}
                          className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
                            req.is_required
                              ? 'bg-red-500/20 border-red-500/30 text-red-300'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {req.is_required ? 'Required' : 'Optional'}
                        </button>
                        <button
                          onClick={() => removeDocType(index)}
                          className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="pl-11">
                        <input
                          type="text"
                          value={req.description || ""}
                          onChange={(e) => updateDescription(index, e.target.value)}
                          placeholder="Optional hint for teams (e.g. 'Must be valid for 6 months')"
                          className="w-full bg-[#0a0b10] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/40 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No document types configured yet. Add types below.
                </div>
              )}

              {/* Add from presets */}
              {availableToAdd.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Add</p>
                  <div className="flex flex-wrap gap-2">
                    {availableToAdd.map(type => (
                      <button
                        key={type}
                        onClick={() => addDocType(type)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/10 hover:border-primary-500/30 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom type */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add Custom Type</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addDocType(customInput)}
                    placeholder="e.g. Club Registration Certificate"
                    className="flex-1 bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <button
                    onClick={() => addDocType(customInput)}
                    disabled={!customInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">{requirements.length} document type{requirements.length !== 1 ? 's' : ''} configured</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={loading}>
              {saving ? "Saving..." : "Save Requirements"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
