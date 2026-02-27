import React, { useState } from "react";
import { Download, Loader2, X, ExternalLink, Printer } from "lucide-react";
// CRITICAL: Change this import from pdfUtils to cardExport
import { 
  downloadCardPDF, 
  openCardPDF, 
  printCard,
  PDF_SIZES
} from "./cardExport";

export default function BadgeGenerator({ accreditation, event, zones = [], onClose, children }) {
  const [loading, setLoading] = useState(false);
  const [pdfSize, setPdfSize] = useState("a6");

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
    downloadCardPDF(
      accreditation, event, zones, 
      `${accreditation?.firstName}_${accreditation?.lastName}_Badge_${accreditation?.badgeNumber || "card"}.pdf`,
      4,
      pdfSize
    )
  );

  const handleOpenInTab = () => withLoading(() => 
    openCardPDF(accreditation, event, zones, 4, pdfSize)
  );

  const handlePrint = () => withLoading(() => 
    printCard(accreditation, event, zones, 2, pdfSize)
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

      <div className="flex justify-center">
        {children}
      </div>

      <div className="mb-4">
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

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleDownloadPDF} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>

        <button onClick={handleOpenInTab} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Open in New Tab
        </button>

        <button onClick={handlePrint} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Print Card
        </button>
      </div>
    </div>
  );
}
