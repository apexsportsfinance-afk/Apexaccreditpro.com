import React, { useState } from "react";
import { X, XCircle } from "lucide-react";
import Button from "../ui/Button";

export default function RejectDocumentModal({ isOpen, onClose, onConfirm, docType }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Reject Document</h2>
              {docType && <p className="text-xs text-slate-400">{docType}</p>}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason for rejection <span className="text-slate-500">(shown to the team)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Document is expired, image is unclear, wrong document type..."
              rows={4}
              className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-colors resize-none"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Rejecting..." : "Reject Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
