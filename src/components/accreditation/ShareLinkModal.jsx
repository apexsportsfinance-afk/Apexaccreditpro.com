import React from "react";
import { Check, Copy } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function ShareLinkModal({
  isOpen,
  onClose,
  accreditation,
  shareLinkData,
  setShareLinkData,
  generateShareLink,
  updatingExpiry,
  generatedLink,
  copyShareLink,
  linkCopied
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Accreditation Link"
    >
      <div className="p-6 space-y-4">
        <p className="text-lg text-slate-400 font-extralight">
          Generate a shareable link for{" "}
          <span className="text-white font-medium">
            {accreditation?.firstName} {accreditation?.lastName}
          </span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Expiry Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={shareLinkData.expiryDate}
              onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryDate: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Expiry Time
            </label>
            <input
              type="time"
              value={shareLinkData.expiryTime}
              onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryTime: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
            />
          </div>
        </div>

        <Button
          onClick={generateShareLink}
          loading={updatingExpiry}
          disabled={updatingExpiry}
          className="w-full"
        >
          Generate Link
        </Button>

        {generatedLink && (
          <div className="space-y-2">
            <label className="block text-lg font-medium text-slate-300">
              Generated Link
            </label>
            <div className="flex gap-2">
              <input
                id="share-link-input"
                type="text"
                readOnly
                value={generatedLink}
                className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-lg focus:outline-none"
              />
              <Button
                onClick={copyShareLink}
                icon={linkCopied ? Check : Copy}
                variant={linkCopied ? "success" : "secondary"}
              >
                {linkCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
