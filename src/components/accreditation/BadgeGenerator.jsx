import React, { useState } from "react";
import { Download, Loader2, X, FileText, Eye } from "lucide-react";
import { downloadCapturedPDF, openCapturedPDFInTab } from "./pdfUtils"; // adjust path to match your structure

/**
 * BadgeGenerator
 *
 * ✅ Pixel-perfect PDF — captures the LIVE preview DOM nodes
 *    via html2canvas, never manually redraws anything.
 *
 * Prerequisites:
 *   • <AccreditationCardPreview> must already be mounted in the same
 *     page so that #accreditation-front-card and
 *     #accreditation-back-card exist in the DOM.
 *
 * Props:
 *   accreditation  – full accreditation record object
 *   onClose        – optional () => void  (renders ✕ button)
 */
export default function BadgeGenerator({ accreditation, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [previewing,  setPreviewing]  = useState(false);
  const [error,       setError]       = useState(null);

  /* ── build a safe file name ──────────────────────────── */
  const buildFileName = () => {
    const first = (accreditation?.firstName  || "Unknown").replace(/\s+/g, "_");
    const last  = (accreditation?.lastName   || "Unknown").replace(/\s+/g, "_");
    const badge = accreditation?.badgeNumber || "card";
    return `${first}_${last}_Badge_${badge}.pdf`;
  };

  /* ── guard: are the card elements present? ───────────── */
  const cardExists = () => {
    const el = document.getElementById("accreditation-front-card");
    if (!el) {
      setError("Card preview not found. Make sure the preview is visible on screen before downloading.");
      return false;
    }
    return true;
  };

  /* ── download handler ────────────────────────────────── */
  const handleDownload = async () => {
    if (!cardExists()) return;
    setDownloading(true);
    setError(null);

    try {
      await downloadCapturedPDF(
        "accreditation-front-card",
        "accreditation-back-card",
        buildFileName()
      );
    } catch (err) {
      console.error("PDF download error:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /* ── open-in-tab handler ─────────────────────────────── */
  const handlePreview = async () => {
    if (!cardExists()) return;
    setPreviewing(true);
    setError(null);

    try {
      await openCapturedPDFInTab(
        "accreditation-front-card",
        "accreditation-back-card"
      );
    } catch (err) {
      console.error("PDF preview error:", err);
      setError("Failed to open PDF preview. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const busy = downloading || previewing;

  return (
    <div className="space-y-5">

      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">
          Generate Accreditation PDF
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* ── info banner ── */}
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-sm text-slate-300">
        <p>
          The PDF is captured directly from the live preview — 
          <span className="text-cyan-400 font-semibold"> what you see is exactly what you get.</span>
        </p>
        <p className="mt-1 text-slate-400 text-xs">
          Make sure the card preview is fully visible on screen before generating.
        </p>
      </div>

      {/* ── error message ── */}
      {error && (
        <div className="rounded-lg bg-rose-950/60 border border-rose-700/50 px-4 py-3 text-sm text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* ── action buttons ── */}
      <div className="flex gap-3 flex-wrap">

        {/* Download PDF */}
        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg
                     hover:bg-emerald-700 active:scale-95 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          {downloading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Generating PDF…</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Download PDF</span>
            </>
          )}
        </button>

        {/* Preview in new tab */}
        <button
          onClick={handlePreview}
          disabled={busy}
          className="flex items-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg
                     hover:bg-slate-600 active:scale-95 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          {previewing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Opening…</span>
            </>
          ) : (
            <>
              <Eye size={16} />
              <span>Preview in Tab</span>
            </>
          )}
        </button>
      </div>

      {/* ── file name preview ── */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <FileText size={13} />
        <span className="font-mono">{buildFileName()}</span>
      </div>
    </div>
  );
}
