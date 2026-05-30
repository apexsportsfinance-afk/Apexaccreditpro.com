import React from "react";
import { AlertCircle } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function DeleteAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  deleting,
  confirmDeleteAccreditation
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !deleting && onClose()}
      title="Delete Accreditation"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-lg font-semibold text-red-400">Permanently delete this accreditation?</p>
            <p className="text-lg text-slate-300 font-extralight mt-1">
              This will permanently remove the accreditation for{" "}
              <span className="text-white font-medium">
                {accreditation?.firstName} {accreditation?.lastName}
              </span>. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmDeleteAccreditation}
            className="flex-1"
            loading={deleting}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
