import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const exportToExcel = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(row => ({
    'ID': row.accreditationId || row.id,
    'Badge': row.badgeNumber || '',
    'First Name': row.firstName,
    'Last Name': row.lastName,
    'Email': row.email,
    'Role': row.role,
    'Club': row.club,
    'Country': row.nationality,
    'Status': row.status,
    'Zone': row.zoneCode || '',
    'Created': row.createdAt
  })));
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Accreditations");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportTableToPDF = async (data, columns, title) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  
  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  
  // Prepare table data
  const headers = columns.map(col => col.header);
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return value !== undefined && value !== null ? String(value) : '';
    })
  );
  
  // Generate table
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 40,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });
  
  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
};
