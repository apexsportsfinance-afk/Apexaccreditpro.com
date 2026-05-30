import React from "react";
import { Check } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function BulkApproveModal({
  isOpen,
  onClose,
  selectedRowsCount,
  zones = [],
  approveData,
  setApproveData,
  approving,
  confirmBulkApprove,
  pdfSize,
  setPdfSize
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Approve Accreditations"
    >
      <div className="p-6 space-y-4">
        <p className="text-lg text-slate-300">
          Approve <span className="font-semibold text-white">{selectedRowsCount}</span> selected accreditations
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-lg font-medium text-slate-300">
              Zone Access for All <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: zones.map((z) => z.code) }))}
                className="text-lg text-cyan-400 hover:text-cyan-300"
              >
                Select All
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: [] }))}
                className="text-lg text-slate-400 hover:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>
          {zones && zones.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {zones.map((zone) => {
                const isSelected = (approveData.zoneCodes || []).includes(zone.code);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => {
                      setApproveData((prev) => {
                        const current = prev.zoneCodes || [];
                        if (current.includes(zone.code)) {
                          return { ...prev, zoneCodes: current.filter((z) => z !== zone.code) };
                        } else {
                          return { ...prev, zoneCodes: [...current, zone.code] };
                        }
                      });
                    }}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${isSelected
                        ? "border-primary-500 bg-primary-500/20"
                        : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ backgroundColor: zone.color || "#2563eb" }}
                      >
                        {zone.code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-lg font-medium truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                          {zone.name}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-lg text-amber-400">No zones defined for this event.</p>
            </div>
          )}
          <p className="text-lg text-slate-500">
            {approveData.zoneCodes?.length || 0} zone(s) selected
          </p>

          {/* Bulk PDF Size Selection */}
          <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
            <label className="block text-lg font-bold text-white uppercase tracking-wider">
              PDF Badge Size for All <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: "a4", label: "A4" },
                { id: "a5", label: "A5" },
                { id: "a6", label: "A6" },
                { id: "pvc140", label: "PVC 140" },
                { id: "card", label: "Card" }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setPdfSize(s.id)}
                  className={`py-2 rounded-lg border-2 font-black transition-all ${
                    pdfSize === s.id
                      ? "border-primary-500 bg-primary-500/20 text-white"
                      : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email Notification Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={approveData.sendEmail}
                onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
              />
              <div>
                <p className="text-lg font-medium text-white">Send Email Notifications</p>
                <p className="text-sm text-slate-400">Send approval emails with PDFs to all selected applicants</p>
              </div>
            </label>
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={approving}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={confirmBulkApprove}
            className="flex-1"
            loading={approving}
            disabled={approving}
          >
            {approving ? "Approving..." : "Approve All"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
