import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const bulkDownloadPDFs = async (accreditations, event, zones, size = "a6") => {
  if (!accreditations || accreditations.length === 0) return;
  
  const zip = new JSZip();
  const folder = zip.folder("accreditation-cards");
  
  for (const acc of accreditations) {
    try {
      // Create a temporary div for rendering
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div style="width: 320px; height: 454px; background: white; padding: 20px; font-family: Arial;">
          <h3>${acc.firstName} ${acc.lastName}</h3>
          <p>${acc.role} - ${acc.club}</p>
          <p>ID: ${acc.accreditationId || acc.id}</p>
          ${acc.photoUrl ? `<img src="${acc.photoUrl}" style="width: 100px; height: 100px; object-fit: cover;" />` : ''}
        </div>
      `;
      document.body.appendChild(tempDiv);
      
      // Capture as canvas
      const canvas = await html2canvas(tempDiv, { scale: 2 });
      document.body.removeChild(tempDiv);
      
      // Convert to PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [320, 454]
      });
      
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 320, 454);
      
      // Add to zip
      const pdfBlob = pdf.output('blob');
      const fileName = `${acc.firstName}_${acc.lastName}_${acc.badgeNumber || acc.id}.pdf`;
      folder.file(fileName, pdfBlob);
      
    } catch (err) {
      console.error(`Failed to process ${acc.firstName} ${acc.lastName}:`, err);
    }
  }
  
  // Download zip
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `accreditation-cards-${event?.name || 'export'}.zip`);
};
