import React from "react";
import StorageImage from "../ui/StorageImage";
import StorageLink from "../ui/StorageLink";
import { FileText, Download } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function RejectAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  rejectData,
  setRejectData,
  rejecting,
  confirmReject,
  handleDownloadAllDocs
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Accreditation"
    >
      <div className="p-6 space-y-4">
        <p className="text-lg text-slate-300">
          Reject accreditation for{" "}
          <span className="font-semibold text-white">
            {accreditation?.firstName} {accreditation?.lastName}
          </span>
        </p>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <h4 className="text-lg font-medium text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Attached Documents
          </h4>
          <div className="flex gap-4">
            {accreditation?.photoUrl && (
              <StorageLink href={accreditation.photoUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors">
                <StorageImage src={accreditation.photoUrl} alt="Photo" className="w-full h-full object-cover" />
              </StorageLink>
            )}
            {accreditation?.idDocumentUrl && (
              <StorageLink href={accreditation.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                {accreditation.idDocumentUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <StorageImage src={accreditation.idDocumentUrl} alt="ID" className="w-full h-full object-cover" />}
              </StorageLink>
            )}
            {accreditation?.eidUrl && (
              <StorageLink href={accreditation.eidUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                {accreditation.eidUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <StorageImage src={accreditation.eidUrl} alt="EID" className="w-full h-full object-cover" />}
              </StorageLink>
            )}
            {accreditation?.medicalUrl && (
              <StorageLink href={accreditation.medicalUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                {accreditation.medicalUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <StorageImage src={accreditation.medicalUrl} alt="Med" className="w-full h-full object-cover" />}
              </StorageLink>
            )}
            {(!accreditation?.photoUrl && !accreditation?.idDocumentUrl && !accreditation?.eidUrl && !accreditation?.medicalUrl) && (
              <p className="text-sm text-slate-500">No documents attached</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={() => handleDownloadAllDocs(accreditation)}
            className="mt-1"
          >
            Download All
          </Button>
        </div>

        <div>
          <label className="block text-lg font-medium text-slate-300 mb-1.5">
            Rejection Remarks <span className="text-red-400">*</span>
          </label>
          <textarea
            value={rejectData.remarks}
            onChange={(e) => setRejectData((prev) => ({ ...prev, remarks: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-primary-800/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
            placeholder="Provide a reason for rejection..."
          />
        </div>

        {/* Email Notification Toggle */}
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={rejectData.sendEmail}
              onChange={(e) => setRejectData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
            />
            <div>
              <p className="text-lg font-medium text-white">Send Email Notification</p>
              <p className="text-sm text-slate-400">Inform the athlete/coach about the rejection via email</p>
            </div>
          </label>
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={rejecting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmReject}
            className="flex-1"
            loading={rejecting}
            disabled={rejecting}
          >
            {rejecting ? "Rejecting..." : "Confirm Rejection"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
