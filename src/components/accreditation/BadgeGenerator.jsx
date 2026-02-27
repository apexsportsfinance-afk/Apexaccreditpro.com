import React, { useState } from "react";
import { Download, Loader2, X, ExternalLink, Printer, Image as ImageIcon } from "lucide-react";
import { 
  downloadCapturedPDF, 
  openCapturedPDFInTab, 
  downloadAsImages, 
  printCards,
  PDF_SIZES,
  IMAGE_SIZES 
} from "./pdfUtils";

export default function BadgeGenerator({ accreditation, event, zones = [], onClose, children }) {
  const [loading, setLoading] = useState(false);
  const [pdfSize, setPdfSize] = useState("a6");
  const [imageQuality, setImageQuality] = useState("p1280");

  const withLoading = async (fn) => {
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || "Failed to generate"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => withLoading(() => 
    downloadCapturedPDF(
      accreditation, event, zones, 
      `${accreditation?.firstName}_${accreditation?.lastName}_Badge_${accreditation?.badgeNumber || "card"}.pdf`,
      IMAGE_SIZES[imageQuality]?.scale,
      pdfSize
    )
  );

  const handleOpenInTab = () => withLoading(() => 
    openCapturedPDFInTab(accreditation, event, zones, IMAGE_SIZES[imageQuality]?.scale, pdfSize)
  );

  const handleDownloadImages = () => withLoading(() => 
    downloadAsImages(
      accreditation, event, zones, 
      `${accreditation?.firstName}_${accreditation?.lastName}_Card`,
      IMAGE_SIZES[imageQuality]?.scale
    )
  );

  const handlePrint = () => withLoading(() => 
    printCards(accreditation, event, zones, IMAGE_SIZES["hd"].scale)
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Accreditation Card Preview</h3>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex justify-center">
        {children}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">PDF Size</label>
          <select 
            value={pdfSize} 
            onChange={(e) => setPdfSize(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            {Object.entries(PDF_SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Image Quality</label>
          <select 
            value={imageQuality} 
            onChange={(e) => setImageQuality(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            {Object.entries(IMAGE_SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleDownloadPDF} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>

        <button onClick={handleOpenInTab} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Open in New Tab
        </button>

        <button onClick={handleDownloadImages} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          Download Images
        </button>

        <button onClick={handlePrint} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Print Card
        </button>
      </div>
    </div>
  );
}
