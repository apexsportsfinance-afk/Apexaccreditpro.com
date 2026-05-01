import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { calculateAge } from "../../lib/utils";

import { GlobalSettingsAPI } from "../../lib/broadcastApi";

/**
 * Export data to Excel file
 */
export const exportToExcel = async (data, filename = "export", event = null, passedConfigs = []) => {
  if (!data || data.length === 0) return;

  // 1. Fetch fresh configs directly from the database to ensure zero stale data
  let customFieldConfigs = passedConfigs;
  if (event?.id) {
    try {
      const fetched = await GlobalSettingsAPI.get(`event_${event.id}_custom_fields`);
      if (fetched) {
        const parsed = JSON.parse(fetched);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customFieldConfigs = parsed;
        }
      }
    } catch (e) {
      console.error("Export: Failed to fetch fresh custom field configs:", e);
    }
  }

  // Helper to get friendly name
  const getFriendlyName = (key) => {
    if (!customFieldConfigs || !Array.isArray(customFieldConfigs)) return key;
    
    const clean = (str) => String(str || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const targetKey = clean(key);
    
    if (!targetKey) return key;

    // Aggressive search: match if targetKey is anywhere in cf.id, cf.name or cf.label
    const config = customFieldConfigs.find(cf => {
      if (!cf) return false;
      const cid = clean(cf.id);
      const cname = clean(cf.name);
      const clabel = clean(cf.label);
      
      return (cid && (targetKey === cid || targetKey.includes(cid) || cid.includes(targetKey))) ||
             (cname && (targetKey === cname || targetKey.includes(cname) || cname.includes(targetKey))) ||
             (clabel && (targetKey === clabel || targetKey.includes(clabel) || clabel.includes(targetKey)));
    });
    
    if (config) {
      const label = config.label || config.name || config.placeholder;
      if (label) return label;
    }

    // EMERGENCY HARDCODED MAPPING (as a final fail-safe for current event)
    const emergencyMapping = {
      "1777270895366": "Phone Number",
      "1777270969735": "City / Emirate",
      "1777270704606": "Weapon Type",
      "1777270830180": "Level / Category",
      "1777270929998": "Emirates ID"
    };

    const match = Object.keys(emergencyMapping).find(mKey => targetKey.includes(mKey));
    if (match) return emergencyMapping[match];
    
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  const allCustomFieldKeys = new Set();
  data.forEach(row => {
    if (row.customFields && typeof row.customFields === 'object') {
      Object.keys(row.customFields).forEach(key => allCustomFieldKeys.add(key));
    }
  });

  const exportData = data.map((row) => {
    const rowData = {
      "Accreditation ID": row.accreditationId || "",
      "Badge Number": row.badgeNumber || "",
      "First Name": row.firstName || "",
      "Last Name": row.lastName || "",
      "Gender": row.gender || "",
      "Date of Birth": row.dateOfBirth || "",
      "Age": (row.dateOfBirth && event?.ageCalculationYear) ? calculateAge(row.dateOfBirth, event.ageCalculationYear) : "",
      "Nationality": row.nationality || "",
      "Club": row.club || "",
      "Role": row.role || "",
    };

    allCustomFieldKeys.forEach(key => {
      const header = getFriendlyName(key);
      rowData[header] = row.customFields?.[key] || "";
    });

    rowData["Email"] = row.email || "";
    rowData["Status"] = row.status || "";
    rowData["Zone Access"] = row.zoneCode || "";
    rowData["Created At"] = row.createdAt || "";

    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Accreditations");

  // Auto-size columns
  const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15)
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Export table data to PDF
 */
export const exportTableToPDF = async (data, columns, title = "Export") => {
  if (!data || data.length === 0) return;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // Add title
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  // Prepare table data
  const headers = columns.map((col) => col.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) return "";
      return String(value);
    })
  );

  // Generate table
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 35,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { top: 35, right: 14, bottom: 20, left: 14 },
    styles: {
      overflow: "linebreak",
      cellPadding: 3
    }
  });

  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
};

export default {
  exportToExcel,
  exportTableToPDF
};
