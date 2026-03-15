import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Export data to Excel file
 */
export const exportToExcel = (data, filename = "export") => {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const exportData = data.map((row) => ({
    "Accreditation ID": row.accreditationId || "",
    "Badge Number": row.badgeNumber || "",
    "First Name": row.firstName || "",
    "Last Name": row.lastName || "",
    "Gender": row.gender || "",
    "Date of Birth": row.dateOfBirth || "",
    "Nationality": row.nationality || "",
    "Club": row.club || "",
    "Role": row.role || "",
    "Email": row.email || "",
    "Status": row.status || "",
    "Zone Access": row.zoneCode || "",
    "Created At": row.createdAt || ""
  }));

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
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

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
