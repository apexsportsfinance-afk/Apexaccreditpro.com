import React from "react";
import {
  ImageIcon,
  Download,
  Plus,
  Clock,
  Timer,
  Edit,
  CheckCircle,
  XCircle,
  Eye,
  Link
} from "lucide-react";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import {
  getCountryCode3,
  formatDate,
  calculateAge,
  getExpirationLabel
} from "../../lib/utils";

export default function AccreditationDetailsModal({
  isOpen,
  onClose,
  accreditation,
  athleteEvents = [],
  currentEvent = null,
  imageDownloadingId = null,
  isViewer = false,
  handleDownloadPhoto,
  handleDownloadAllDocs,
  handleOpenEdit,
  handleApprove,
  handleReject,
  handlePreviewPDF,
  handleOpenShareLink
}) {
  const renderParticipatingSports = (acc) => {
    const sports = acc?.selected_sports || acc?.selectedSports;
    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      return <p className="text-slate-500 italic text-sm">No sports selected</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {sports.map((sport, idx) => (
          <Badge key={idx} variant="primary" className="bg-primary-500/10 text-primary-400 border-primary-500/20">
            {sport}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accreditation Details"
      size="lg"
    >
      {accreditation && (
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-6">
            {accreditation.photoUrl ? (
              <img
                src={accreditation.photoUrl}
                alt=""
                className="w-32 h-40 rounded-lg object-cover border-2 border-primary-500/30"
              />
            ) : (
              <div className="w-32 h-40 rounded-lg bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {accreditation.firstName?.[0]}
                  {accreditation.lastName?.[0]}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white">
                {accreditation.firstName} {accreditation.lastName}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <Badge>
                  {accreditation.role}
                </Badge>
                <Badge variant={accreditation.status === "approved" ? "success" : accreditation.status === "rejected" ? "danger" : "warning"}>
                  {accreditation.status}
                </Badge>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-lg text-slate-400">
                  <span className="text-slate-500">Club:</span> {accreditation.club}
                </p>
                <p className="text-lg text-slate-400">
                  <span className="text-slate-500">Email:</span> {accreditation.email}
                </p>
                <p className="text-lg text-slate-400">
                  <span className="text-slate-500">Nationality:</span> {getCountryCode3(accreditation.nationality)}
                </p>
                <p className="text-lg text-slate-400">
                  <span className="text-slate-500">Gender:</span> {accreditation.gender}
                </p>
                <p className="text-lg text-slate-400">
                  <span className="text-slate-500">DOB:</span>{" "}
                  {formatDate(accreditation.dateOfBirth)}
                  {currentEvent && (
                    <span className="text-slate-500">
                      {" "}(Age: {calculateAge(accreditation.dateOfBirth, currentEvent.ageCalculationYear) || "---"})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {accreditation.status === "approved" && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold text-emerald-400">Approval Details</h4>
                {accreditation.expiresAt && (
                  <Badge className="whitespace-nowrap">
                    {getExpirationLabel(accreditation.expiresAt)}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-lg text-slate-500">Accreditation ID</p>
                  <p className="text-lg font-mono text-white">{accreditation.accreditationId}</p>
                </div>
                <div>
                  <p className="text-lg text-slate-500">Badge Number</p>
                  <p className="text-lg font-mono text-white">{accreditation.badgeNumber}</p>
                </div>
                <div>
                  <p className="text-lg text-slate-500">Zone Access</p>
                  <p className="text-lg font-mono text-white">{accreditation.zoneCode}</p>
                </div>
                <div>
                  <p className="text-lg text-slate-500">Valid Until</p>
                  <p className="text-lg font-mono text-white">
                    {accreditation.expiresAt
                      ? formatDate(accreditation.expiresAt)
                      : "No expiration"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {accreditation.status === "rejected" && accreditation.remarks && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-red-400 mb-2">Rejection Remarks</h4>
              <p className="text-lg text-slate-300">{accreditation.remarks}</p>
            </div>
          )}

          {/* Uploaded Documents Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-cyan-400 mb-3">Uploaded Documents</h4>
            <div className="flex flex-wrap gap-3">
              {accreditation.photoUrl ? (
                <button
                  onClick={() => handleDownloadPhoto(accreditation)}
                  disabled={imageDownloadingId === accreditation.id}
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 rounded-lg text-orange-300 transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-lg font-medium">Download Photo</span>
                </button>
              ) : (
                <span className="text-lg text-slate-500">No photo uploaded</span>
              )}
              <button
                onClick={() => handleDownloadAllDocs(accreditation)}
                disabled={imageDownloadingId === accreditation.id || (!accreditation.photoUrl && !accreditation.idDocumentUrl)}
                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-300 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="text-lg font-medium">Download All Documents</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6">
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Participating Sports
            </h4>
            {renderParticipatingSports(accreditation)}
          </div>

          {athleteEvents.length > 0 && (
            <div className="border-t border-slate-700/50 pt-6">
              <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Competition Schedule (Hy-Tek)
              </h4>
              <div className="space-y-3">
                {athleteEvents.map((ev, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{ev.event_code}</span>
                        <span className="text-sm font-bold text-white truncate">{ev.event_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded uppercase">
                          Heat {ev.heat} • Lane {ev.lane}
                        </span>
                        {ev.session_name && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{ev.session_name}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {ev.call_room_time && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Call Room</span>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-black">{ev.call_room_time}</span>
                          </div>
                        </div>
                      )}
                      {ev.race_time && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Race Time</span>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-100/20 rounded text-blue-400">
                            <Timer className="w-3 h-3" />
                            <span className="text-xs font-black">{ev.race_time}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={Edit}
              className="flex-1"
              disabled={isViewer}
              title={isViewer ? "Viewing Only" : ""}
              onClick={() => {
                onClose();
                handleOpenEdit(accreditation);
              }}
            >
              Edit Details
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              variant="success"
              icon={CheckCircle}
              disabled={isViewer}
              onClick={() => {
                onClose();
                handleApprove(accreditation);
              }}
              className="flex-1"
            >
              {accreditation.status === "approved" ? "Re-approve" : "Approve"}
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              disabled={isViewer}
              onClick={() => {
                onClose();
                handleReject(accreditation);
              }}
              className="flex-1"
            >
              Reject
            </Button>
          </div>

          <div className="flex gap-3">
            {(accreditation.status === "approved" || accreditation.role?.toLowerCase() === "athlete") && (
              <>
                <Button
                  variant="primary"
                  icon={Eye}
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    handlePreviewPDF(accreditation);
                  }}
                >
                  Preview and Download PDF
                </Button>
                <Button
                  variant="secondary"
                  icon={Link}
                  className="flex-1"
                  disabled={isViewer}
                  title={isViewer ? "Viewing Only" : ""}
                  onClick={() => {
                    onClose();
                    handleOpenShareLink(accreditation);
                  }}
                >
                  Share Link
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
