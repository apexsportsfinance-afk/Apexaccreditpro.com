import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Edit, CheckCircle, Mail } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import { exportToExcel, exportTableToPDF } from "./ExportUtils";
import { bulkDownloadPDFs } from "./cardExport";
import ComposeEmailModal from "./ComposeEmailModal";

export default function BulkOperations({ 
  selectedRows, 
  filteredData, 
  event, 
  zones, 
  onClearSelection,
  onBulkEdit,
  onBulkApprove,
  eventCategories = []
}) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState("status");
  const [editValue, setEditValue] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const selectAllFiltered = () => onClearSelection(filteredData.map(r => r.id));

  const handleBulkDownload = async () => {
    if (selectedRows.length === 0) return;
    setDownloading(true);
    try {
      const selectedData = filteredData.filter(r => selectedRows.includes(r.id));
      await bulkDownloadPDFs(selectedData, event, zones, "a6");
    } catch (err) {
      console.error("Bulk download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = selectedRows.length > 0 
      ? filteredData.filter(r => selectedRows.includes(r.id)) 
      : filteredData;
    exportToExcel(dataToExport, `accreditations-${event?.name || "export"}`);
  };

  const handleExportPDF = async () => {
    const dataToExport = selectedRows.length > 0 
      ? filteredData.filter(r => selectedRows.includes(r.id)) 
      : filteredData;
    const columns = [
      { key: "accreditationId", header: "ID" }, 
      { key: "badgeNumber", header: "Badge" },
      { key: "firstName", header: "First Name" }, 
      { key: "lastName", header: "Last Name" },
      { key: "role", header: "Role" }, 
      { key: "club", header: "Club" },
      { key: "nationality", header: "Country" }, 
      { key: "status", header: "Status" },
    ];
    await exportTableToPDF(dataToExport, columns, "Accreditations List");
  };

  const handleBulkEditSubmit = () => {
    if (!editValue.trim()) return;
    onBulkEdit(selectedRows, { [editField]: editValue });
    setShowEditModal(false);
    setEditValue("");
    setEditField("status");
  };

  // Get options based on selected field
  const getFieldOptions = () => {
    switch (editField) {
      case "status":
        return [
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" }
        ];
      case "role":
        if (eventCategories && eventCategories.length > 0) {
          return eventCategories.map(cat => {
            const categoryData = cat.category || cat;
            const name = categoryData?.name || cat?.name;
            return name ? { value: name, label: name } : null;
          }).filter(Boolean);
        }
        return [
          { value: "Athlete", label: "Athlete" },
          { value: "Coach", label: "Coach" },
          { value: "Official", label: "Official" },
          { value: "Team Manager", label: "Team Manager" },
          { value: "Medical", label: "Medical" },
          { value: "Media", label: "Media" },
          { value: "VIP", label: "VIP" },
          { value: "Volunteer", label: "Volunteer" }
        ];
      case "zoneCode":
        if (zones && zones.length > 0) {
          return [
            ...zones.map(z => ({ value: z.code, label: `${z.code} - ${z.name}` })),
            { value: zones.map(z => z.code).join(","), label: "All Zones" }
          ];
        }
        return [];
      default:
        return [];
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-slate-300 font-medium">{selectedRows.length} selected</span>
          {selectedRows.length > 0 && (
            <button 
              onClick={() => onClearSelection([])} 
              className="text-lg text-cyan-400 hover:text-cyan-300"
            >
              Clear
            </button>
          )}
          <button 
            onClick={selectAllFiltered} 
            className="text-lg text-cyan-400 hover:text-cyan-300 ml-2"
          >
            Select All ({filteredData.length})
          </button>
        </div>

        {selectedRows.length > 0 && (
          <>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowEditModal(true)} 
              icon={Edit}
            >
              Bulk Edit
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onBulkApprove}
              icon={CheckCircle}
            >
              Bulk Approve
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleBulkDownload} 
              loading={downloading} 
              icon={Download}
            >
              Download Cards
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEmailModal(true)}
              icon={Mail}
            >
              Bulk Email
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={handleExportExcel} icon={FileSpreadsheet}>
          Export Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportPDF} icon={FileText}>
          Export PDF
        </Button>
      </div>

      {/* Bulk Edit Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        title="Bulk Edit Accreditations"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-300">
            Edit <span className="font-semibold text-white">{selectedRows.length}</span> selected accreditations
          </p>
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">Field to Edit</label>
            <select 
              value={editField} 
              onChange={(e) => {
                setEditField(e.target.value);
                setEditValue("");
              }}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="status">Status</option>
              <option value="role">Role / Category</option>
              <option value="zoneCode">Zone Access</option>
            </select>
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-2">New Value</label>
            <Select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              options={getFieldOptions()}
              placeholder={`Select new ${editField === "zoneCode" ? "zone" : editField}...`}
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-lg text-amber-400">
              <strong>Warning:</strong> This will update the {editField} for all {selectedRows.length} selected records. 
              This action affects both pending and approved accreditations.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkEditSubmit}
              disabled={!editValue.trim()}
            >
              Apply to {selectedRows.length} Records
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Email Compose Modal */}
      <ComposeEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipients={filteredData.filter(r => selectedRows.includes(r.id))}
        event={event}
        zones={zones}
        isBulk={true}
      />
    </>
  );
}
