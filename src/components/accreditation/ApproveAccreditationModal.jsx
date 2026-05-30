import React from "react";
import { User, Plus, FileText, Eye, Download, Check } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { getCountryCode3 } from "../../lib/utils";

export default function ApproveAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  zones = [],
  currentEvent = null,
  eventCategories = [],
  categoryDocuments = {},
  approveData,
  setApproveData,
  approving,
  confirmApprove,
  pdfSize,
  setPdfSize,
  handleDownloadAllDocs
}) {
  const renderParticipatingSports = (acc) => {
    const sports = acc?.selected_sports || acc?.selectedSports;
    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      return <p className="text-slate-500 italic text-sm">No sports selected</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {sports.map((sport, idx) => (
          <span key={idx} className="px-2 py-1 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded text-xs font-semibold">
            {sport}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve Accreditation"
    >
      <div className="p-6 space-y-4">
        {/* Profile Header */}
        <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-cyan-500/30 flex-shrink-0 bg-slate-900">
            {accreditation?.photoUrl ? (
              <img src={accreditation.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <User className="w-10 h-10" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white truncate">
              {accreditation?.firstName} {accreditation?.lastName}
            </h3>
            <p className="text-lg text-cyan-400 font-medium">
              {accreditation?.role} • {getCountryCode3(accreditation?.nationality)}
            </p>
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {accreditation?.club}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Participating Sports */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Participating Sports
            </h4>
            {renderParticipatingSports(accreditation)}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Review Documents
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
              {(() => {
                const role = accreditation?.role;
                const catData = eventCategories.find(c => (c.category?.name || c.name) === role);
                const catId = catData?.category_id || role;
                const categorySpecificDocs = categoryDocuments[catId];

                let docs = categorySpecificDocs || [...(currentEvent?.requiredDocuments || [])];

                // Ensure picture and passport are always in the review list if the URLs exist
                if (accreditation?.photoUrl && !docs.find(d => (d.id === 'picture' || d === 'picture'))) {
                  docs = [{ id: 'picture', label: 'Photo' }, ...docs];
                }
                if (accreditation?.idDocumentUrl && !docs.find(d => (d.id === 'passport' || d === 'passport'))) {
                  docs = [...docs, { id: 'passport', label: 'ID / Passport' }];
                }

                // If still empty, use defaults
                if (docs.length === 0) {
                  docs = [
                    { id: "picture", label: "Photo" },
                    { id: "passport", label: "Passport" }
                  ];
                }

                return docs.map(doc => {
                  const docId = typeof doc === 'string' ? doc : doc.id;
                  const docLabel = (typeof doc === 'object' ? doc.label : null) || docId;

                  // Skip picture/photo as they are handled elsewhere or showing at top
                  if (
                    docId.toLowerCase() === 'picture' ||
                    docId.toLowerCase() === 'photo' ||
                    docLabel.toLowerCase() === 'picture' ||
                    docLabel.toLowerCase() === 'photo'
                  ) return null;

                  const eventDoc = (currentEvent?.requiredDocuments || []).find(d => d.id === docId);
                  const label = (typeof doc === 'object' ? doc.label : null) || eventDoc?.label || (docId ? docId.charAt(0).toUpperCase() + docId.slice(1) : "Document");

                  const isPassport = docId === 'passport';
                  const isPicture = docId === 'picture';
                  const url = isPicture
                    ? accreditation?.photoUrl
                    : isPassport
                      ? accreditation?.idDocumentUrl
                      : accreditation?.documents?.[docId];

                  return (
                    <div key={docId} className="space-y-1">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">{label}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block relative group">
                          <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group-hover:border-primary-500 transition-colors flex items-center justify-center">
                            {url.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-8 h-8 text-slate-500" />
                            ) : (
                              <img src={url} alt={label} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className="w-full h-24 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                          EMPTY
                        </div>
                      )}
                    </div>
                  );
                });

              })()}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={Download}
              onClick={() => handleDownloadAllDocs(accreditation)}
              className="w-full mt-3 text-lg"
            >
              Download All Documents
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-lg font-medium text-slate-300">
                Zone Access <span className="text-red-400">*</span>
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
          </div>

          {/* PDF Size Selection */}
          <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
            <label className="block text-lg font-bold text-white uppercase tracking-wider">
              PDF Badge Size <span className="text-red-400">*</span>
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

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={approveData.sendEmail}
                onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
              />
              <div>
                <p className="text-lg font-medium text-white">Send Email Notification</p>
                <p className="text-sm text-slate-400">Send approval email with PDF attachment to the athlete/coach</p>
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
            onClick={confirmApprove}
            className="flex-1"
            loading={approving}
            disabled={approving}
          >
            {approving ? "Approving..." : "Confirm Approval"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
