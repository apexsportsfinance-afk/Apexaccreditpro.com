import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Edit, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { exportToExcel, exportTableToPDF } from "./ExportUtils";
import { bulkDownloadPDFs } from "./cardExport";

export default function BulkOperations({ selectedRows, filteredData, event, zones, onClearSelection, onBulkEdit }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState("status");
  const [editValue, setEditValue] = useState("");
  const [downloading, setDownloading] = useState(false);

  const selectAllFiltered = () => onClearSelection(filteredData.map(r => r.id));

  const handleBulkDownload = async () => {
    if (selectedRows.length === 0) return;
    setDownloading(true);
    const selectedData = filteredData.filter(r => selectedRows.includes(r.id));
    await bulkDownloadPDFs(selectedData, event, zones, "a6");
    setDownloading(false);
  };

  const handleExportExcel = () => {
    const dataToExport = selectedRows.length > 0 ? filteredData.filter(r => selectedRows.includes(r.id)) : filteredData;
    exportToExcel(dataToExport, `accreditations-${event?.name || "export"}`);
  };

  const handleExportPDF = async () => {
    const dataToExport = selectedRows.length > 0 ? filteredData.filter(r => selectedRows.includes(r.id)) : filteredData;
    const columns = [
      { key: "accreditationId", header: "ID" }, { key: "badgeNumber", header: "Badge" },
      { key: "firstName", header: "First Name" }, { key: "lastName", header: "Last Name" },
      { key: "role", header: "Role" }, { key: "club", header: "Club" },
      { key: "nationality", header: "Country" }, { key: "status", header: "Status" },
    ];
    await exportTableToPDF(dataToExport, columns, "Accreditations List");
  };

  const handleBulkEditSubmit = () => {
    onBulkEdit(selectedRows, { [editField]: editValue });
    setShowEditModal(false);
    setEditValue("");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="flex items-center gap-2 mr-auto">
        <span className="text-slate-300 font-medium">{selectedRows.length} selected</span>
        {selectedRows.length > 0 && <button onClick={() => onClearSelection([])} className="text-sm text-cyan-400 hover:text-cyan-300">Clear</button>}
        <button onClick={selectAllFiltered} className="text-sm text-cyan-400 hover:text-cyan-300 ml-2">Select All ({filteredData.length})</button>
      </div>

      {selectedRows.length > 0 && (
        <>
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)} icon={Edit}>Bulk Edit</Button>
          <Button variant="secondary" size="sm" onClick={handleBulkDownload} loading={downloading} icon={Download}>Download Cards</Button>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={handleExportExcel} icon={FileSpreadsheet}>Export Excel</Button>
      <Button variant="ghost" size="sm" onClick={handleExportPDF} icon={FileText}>Export PDF</Button>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Bulk Edit" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Field</label>
            <select value={editField} onChange={(e) => setEditField(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white">
              <option value="status">Status</option>
              <option value="role">Role</option>
              <option value="zoneCode">Zone Code</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Value</label>
            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Enter new value..." />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleBulkEditSubmit}>Apply to {selectedRows.length} records</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
