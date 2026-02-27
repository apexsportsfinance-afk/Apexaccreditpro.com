import React, { useState } from "react";
import { Download, Loader2, X, Eye, Image, Printer } from "lucide-react";
import {
  downloadCapturedPDF,
  openCapturedPDFInTab,
  downloadAsImages,
  printCards,
  PDF_SIZES,
  IMAGE_SIZES,
} from "./pdfUtils";

export default function BadgeGenerator({ accreditation, event, zones = [], onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [previewing,  setPreviewing]  = useState(false);
  const [imgDownload, setImgDownload] = useState(false);
  const [printing,    setPrinting]    = useState(false);
  const [error,       setError]       = useState(null);

  const [pdfSize, setPdfSize] = useState("a6");
  const [imgSize, setImgSize] = useState("hd");

  const buildFileName = (ext = "pdf") => {
    const first = (accreditation?.firstName || "Unknown").replace(/\s+/g, "_");
    const last  = (accreditation?.lastName  || "Unknown").replace(/\s+/g, "_");
    const badge = accreditation?.badgeNumber || "card";
    return `${first}_${last}_Badge_${badge}.${ext}`;
  };

  const scale = IMAGE_SIZES[imgSize]?.scale ?? IMAGE_SIZES["hd"].scale;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadCapturedPDF(
        accreditation, event, zones,
        buildFileName("pdf"),
        scale,
        pdfSize
      );
    } catch (err) {
      console.error("PDF download error:", err);
      setError(err?.message || "Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      await openCapturedPDFInTab(
        accreditation, event, zones,
        scale,
        pdfSize
      );
    } catch (err) {
      console.error("PDF preview error:", err);
      setError(err?.message || "Failed to open PDF preview. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleImageDownload = async () => {
    setImgDownload(true);
    setError(null);
    try {
      const baseName = buildFileName("").replace(/\.$/, "");
      await downloadAsImages(
        accreditation, event, zones,
        baseName,
        scale
      );
    } catch (err) {
      console.error("Image download error:", err);
      setError(err?.message || "Failed to download images. Please try again.");
    } finally {
      setImgDownload(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    setError(null);
    try {
      await printCards(
        accreditation, event, zones,
        IMAGE_SIZES["hd"].scale
      );
    } catch (err) {
      console.error("Print error:", err);
      setError(err?.message || "Failed to print. Please try again.");
    } finally {
      setPrinting(false);
    }
  };

  const busy = downloading || previewing || imgDownload || printing;

  const btn = (color) =>
    `flex items-center justify-center gap-2 px-5 py-3 rounded-lg
     text-white text-sm font-semibold transition-all active:scale-95
     disabled:opacity-50 disabled:cursor-not-allowed ${color}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Generate Accreditation PDF</h3>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-sm text-slate-300">
        PDF is captured directly from the card data —{" "}
        <span className="text-cyan-400 font-semibold">pixel-perfect output every time.</span>
        <p className="mt-1 text-slate-400 text-xs">
          Card is rendered offscreen for capture — no modal or scroll interference.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-950/60 border border-rose-700/50 px-4 py-3 text-sm text-rose-300">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">PDF Size</label>
          <select
            value={pdfSize}
            onChange={(e) => setPdfSize(e.target.value)}
            disabled={busy}
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          >
            {Object.entries(PDF_SIZES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Image Quality</label>
          <select
            value={imgSize}
            onChange={(e) => setImgSize(e.target.value)}
            disabled={busy}
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          >
            {Object.entries(IMAGE_SIZES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleDownload} disabled={busy} className={btn("bg-cyan-600 hover:bg-cyan-700")}>
          {downloading
            ? <><Loader2 size={16} className="animate-spin" /><span>Generating…</span></>
            : <><Download size={16} /><span>Download PDF ({PDF_SIZES[pdfSize]?.label?.split(" ")[0]})</span></>}
        </button>

        <button onClick={handlePreview} disabled={busy} className={btn("bg-slate-700 hover:bg-slate-600")}>
          {previewing
            ? <><Loader2 size={16} className="animate-spin" /><span>Opening…</span></>
            : <><Eye size={16} /><span>Open in New Tab</span></>}
        </button>

        <button onClick={handleImageDownload} disabled={busy} className={btn("bg-violet-700 hover:bg-violet-600")}>
          {imgDownload
            ? <><Loader2 size={16} className="animate-spin" /><span>Exporting…</span></>
            : <><Image size={16} /><span>Download as Images ({IMAGE_SIZES[imgSize]?.label})</span></>}
        </button>

        <button onClick={handlePrint} disabled={busy} className={btn("bg-slate-700 hover:bg-slate-600")}>
          {printing
            ? <><Loader2 size={16} className="animate-spin" /><span>Preparing…</span></>
            : <><Printer size={16} /><span>Print Card</span></>}
        </button>
      </div>

      <p className="text-xs text-slate-500 font-mono truncate">📄 {buildFileName()}</p>
    </div>
  );
}
