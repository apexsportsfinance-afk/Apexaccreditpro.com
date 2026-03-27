import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { AccreditationsAPI } from "./storage";
import { AttendanceAPI } from "./attendanceApi";

/**
 * Clean strings for filenames
 */
const sanitizeFilename = (name) => {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

/**
 * Given a club's full name, fetches ALL their registrants across all categories
 * and joins attendance data.
 */
async function fetchClubData(eventId, clubFull) {
  // 1. Fetch all accreditations for this event
  const allAccs = await AccreditationsAPI.getByEventId(eventId) || [];
  
  // 2. Fetch all attendance records for this event
  const allAttendance = await AttendanceAPI.getEventAttendance(eventId) || [];

  // Filter for THIS specific club (ignoring case/whitespace)
  const clubTerm = String(clubFull).trim().toLowerCase();
  const clubMembers = allAccs.filter(a => String(a.club || "").trim().toLowerCase() === clubTerm);

  // Map into the exact requested output format
  const formattedData = clubMembers.map((member, index) => {
    // Determine attendance string
    const memberAttendance = allAttendance.filter(att => att.athlete_id === member.id);
    let attendanceStr = "Not Arrived";
    
    if (memberAttendance.length > 0) {
      // Get most recent scan
      const latestRecord = [...memberAttendance].sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date))[0];
      const timeStr = new Date(latestRecord.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      attendanceStr = `Marked at ${timeStr}`;
    }

    // Determine status string (usually standard title case is fine)
    let accStatus = member.status === "approved" ? "Accreditation Issued" : "Pending";
    if (member.status === "rejected") accStatus = "Rejected";

    return {
      "Sr#": index + 1, // Reset to 1 per club file
      "Name": `${member.firstName || ""} ${member.lastName || ""}`.trim(),
      "Club Name": clubFull,
      "Category": member.role || "Athlete", // Ensure coaches/managers are mapped here
      "Accreditation Status": accStatus,
      "Attendance": attendanceStr
    };
  });

  return formattedData;
}

/**
 * Generates an Excel Blob for a single club
 */
function generateExcelBlob(clubFull, clubData) {
  const ws = XLSX.utils.json_to_sheet(clubData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * Generates a CSV Blob for a single club
 */
function generateCsvBlob(clubData) {
  const ws = XLSX.utils.json_to_sheet(clubData);
  const csvStr = XLSX.utils.sheet_to_csv(ws);
  return new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
}

/**
 * Generates a PDF Blob for a single club
 */
async function generatePdfBlob(clubFull, clubData) {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  
  const doc = new jsPDF("landscape");
  
  doc.setFontSize(18);
  doc.text(`Attendance Report: ${clubFull}`, 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  
  const headers = [["Sr#", "Name", "Club Name", "Category", "Accreditation Status", "Attendance"]];
  const body = clubData.map(row => [row["Sr#"], row["Name"], row["Club Name"], row["Category"], row["Accreditation Status"], row["Attendance"]]);
  
  doc.autoTable({
    startY: 35,
    head: headers,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: [14, 165, 233] }, // Cyan-500
    styles: { fontSize: 9 }
  });
  
  return doc.output('blob');
}

/**
 * Main Export Handler
 */
export async function generateClubExports(eventId, eventName, selectedClubs, format, updateProgress) {
  if (!selectedClubs || selectedClubs.length === 0) return;

  const dateStr = new Date().toISOString().split('T')[0];

  // If only 1 club is selected, download the single file natively
  if (selectedClubs.length === 1) {
    const clubName = selectedClubs[0];
    updateProgress(`Fetching data for ${clubName}...`);
    const clubData = await fetchClubData(eventId, clubName);
    
    updateProgress(`Generating ${format.toUpperCase()}...`);
    let blob;
    if (format === 'csv') blob = generateCsvBlob(clubData);
    else if (format === 'pdf') blob = await generatePdfBlob(clubName, clubData);
    else blob = generateExcelBlob(clubName, clubData);
    
    saveAs(blob, `${sanitizeFilename(clubName)}-Attendance-${dateStr}.${format}`);
    return;
  }

  // --- MULTI-CLUB / ZIP FLOW ---
  const JSZipModule = await import("jszip");
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();
  const folderName = `${sanitizeFilename(eventName)}-Club-Reports-${dateStr}`;
  const folder = zip.folder(folderName);

  for (let i = 0; i < selectedClubs.length; i++) {
    const clubFull = selectedClubs[i];
    updateProgress(`Generating file ${i + 1} of ${selectedClubs.length}: ${clubFull}...`);
    
    const clubData = await fetchClubData(eventId, clubFull);
    
    let blob;
    if (format === 'csv') blob = generateCsvBlob(clubData);
    else if (format === 'pdf') blob = await generatePdfBlob(clubFull, clubData);
    else blob = generateExcelBlob(clubFull, clubData);
    
    folder.file(`${sanitizeFilename(clubFull)}-Attendance-${dateStr}.${format}`, blob);
  }

  folder.file("README.txt", `Generated on: ${new Date().toLocaleString()}\nEvent: ${eventName}\nTotal Clubs Exported: ${selectedClubs.length}\nFormat: ${format.toUpperCase()}`);

  updateProgress(`Zipping ${selectedClubs.length} files together...`);

  const zipContent = await zip.generateAsync({ type: "blob" });
  saveAs(zipContent, `${sanitizeFilename(eventName)}-MultiClub-Export-${dateStr}.zip`);
}
