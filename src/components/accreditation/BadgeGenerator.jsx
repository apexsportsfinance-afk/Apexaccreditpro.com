import React, { useState } from "react";
import { Download, Loader2, X, Eye, Image, Printer } from "lucide-react";
import {
  downloadCapturedPDF,
  openCapturedPDFInTab,
  downloadAsImages,
  PDF_SIZES,
  IMAGE_SIZES,
} from "./pdfUtils";

/**
 * BadgeGenerator
 *
 * Captures the live AccreditationCardPreview DOM nodes
 * via html2canvas — pixel-perfect, no manual redraw.
 *
 * Requires these IDs in the DOM:
 *   #accreditation-front-card
 *   #accreditation-back-card
 */
export default function BadgeGenerator({ accreditation, onClose }) {
  const [downloading,  setDownloading]  = useState(false);
  const [previewing,   setPreviewing]   = useState(false);
  const [imgDownload,  setImgDownload]  = useState(false);
  const [printing,     setPrinting]     = useState(false);
  const [error,        setError]        = useState(null);

  /* default selections */
  const [pdfSize,  setPdfSize]  = useState("a6");
  const [imgSize,  setImgSize]  = useState("4k"); // 4K = 600 DPI default

  /* ── helpers ─────────────────────────────────────────── */
  const buildFileName = (ext = "pdf") => {
    const first = (accreditation?.firstName  || "Unknown").replace(/\s+/g, "_");
    const last  = (accreditation?.lastName   || "Unknown").replace(/\s+/g, "_");
    const badge = accreditation?.badgeNumber || "card";
    return `${first}_${last}_Badge_${badge}.${ext}`;
  };

  const cardExists = () => {
    const el = document.getElementById("accreditation-front-card");
    if (!el) {
      setError("Card preview not found. Make sure the preview is fully visible before downloading.");
      return false;
    }
    return true;
  };

  const scale = IMAGE_SIZES[imgSize]?.scale ?? IMAGE_SIZES["4k"].scale;

  /* ── download PDF ─────────────────────────────────────── */
  const handleDownload = async () => {
    if (!cardExists()) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadCapturedPDF(
        "accreditation-front-card",
        "accreditation-back-card",
        buildFileName("pdf"),
        scale
      );
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /* ── open in new tab ──────────────────────────────────── */
  const handlePreview = async () => {
    if (!cardExists()) return;
    setPreviewing(true);
    setError(null);
    try {
      await openCapturedPDFInTab(
        "accreditation-front-card",
        "accreditation-back-card",
        scale
      );
    } catch (err) {
      console.error(err);
      setError("Failed to open PDF preview. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  /* ── download as images ───────────────────────────────── */
  const handleImageDownload = async () => {
    if (!cardExists()) return;
    setImgDownload(true);
    setError(null);
    try {
      const baseName = buildFileName("").replace(/\.$/, "");
      await downloadAsImages(
        "accreditation-front-card",
        "accreditation-back-card",
        baseName,
        scale
      );
    } catch (err) {
      console.error(err);
      setError("Failed to download images. Please try again.");
    } finally {
      setImgDownload(false);
    }
  };

  /* ── print ────────────────────────────────────────────── */
  const handlePrint = () => {
    window.print();
  };

  const busy = downloading || previewing || imgDownload || printing;

  /* ── shared button style ──────────────────────────────── */
  const btn = (color) =>
    `flex items-center justify-center gap-2 px-5 py-3 rounded-lg
     text-white text-sm font-semibold transition-all active:scale-95
     disabled:opacity-50 disabled:cursor-not-allowed ${color}`;

  return (
    <div className="space-y-5">

      {/* header */}
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

      {/* info banner */}
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-sm text-slate-300">
        PDF is captured directly from the live preview —
        <span className="text-cyan-400 font-semibold"> what you see is exactly what you get.</span>
        <p className="mt-1 text-slate-400 text-xs">
          Ensure the card preview is fully visible on screen before downloading.
        </p>
      </div>

      {/* error */}
      {error && (
        <div className="rounded-lg bg-rose-950/60 border border-rose-700/50 px-4 py-3 text-sm text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* ── SIZE SELECTORS ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* PDF Size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            PDF Size
          </label>
          <select
            value={pdfSize}
            onChange={(e) => setPdfSize(e.target.value)}
            disabled={busy}
            className="bg-slate-800 border border-slate-600 text-white text-sm
                       rounded-lg px-3 py-2 focus:outline-none focus:ring-2
                       focus:ring-cyan-500 disabled:opacity-50"
          >
            {Object.entries(PDF_SIZES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        {/* Image / DPI Size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Image Size
          </label>
          <select
            value={imgSize}
            onChange={(e) => setImgSize(e.target.value)}
            disabled={busy}
            className="bg-slate-800 border border-slate-600 text-white text-sm
                       rounded-lg px-3 py-2 focus:outline-none focus:ring-2
                       focus:ring-cyan-500 disabled:opacity-50"
          >
            {Object.entries(IMAGE_SIZES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Download PDF */}
        <button
          onClick={handleDownload}
          disabled={busy}
          className={btn("bg-cyan-600 hover:bg-cyan-700")}
        >
          {downloading
            ? <><Loader2 size={16} className="animate-spin" /><span>Generating…</span></>
            : <><Download size={16} /><span>Download PDF ({PDF_SIZES[pdfSize]?.label?.split(" ")[0]})</span></>
          }
        </button>

        {/* Open in New Tab */}
        <button
          onClick={handlePreview}
          disabled={busy}
          className={btn("bg-slate-700 hover:bg-slate-600")}
        >
          {previewing
            ? <><Loader2 size={16} className="animate-spin" /><span>Opening…</span></>
            : <><Eye size={16} /><span>Open in New Tab</span></>
          }
        </button>

        {/* Download as Images */}
        <button
          onClick={handleImageDownload}
          disabled={busy}
          className={btn("bg-violet-700 hover:bg-violet-600")}
        >
          {imgDownload
            ? <><Loader2 size={16} className="animate-spin" /><span>Exporting…</span></>
            : <><Image size={16} /><span>Download as Images ({IMAGE_SIZES[imgSize]?.label?.split(" ")[0]})</span></>
          }
        </button>

        {/* Print Card */}
        <button
          onClick={handlePrint}
          disabled={busy}
          className={btn("bg-slate-700 hover:bg-slate-600")}
        >
          <Printer size={16} />
          <span>Print Card</span>
        </button>
      </div>

      {/* file name preview */}
      <p className="text-xs text-slate-500 font-mono truncate">
        📄 {buildFileName()}
      </p>
    </div>
  );
}
