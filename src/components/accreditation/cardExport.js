import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// PDF Sizes for individual cards
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

// Helper to capture card element
const captureCard = async (elementId, scale = 2) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);
  
  return await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false
  });
};

// Download single card as PDF
export const downloadCardPDF = async (frontId, backId, filename, size = "a6") => {
  const frontCanvas = await captureCard(frontId);
  
  const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
  const pdf = new jsPDF({
    orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
    unit: "mm",
    format: [sizeConfig.width, sizeConfig.height]
  });
  
  const imgData = frontCanvas.toDataURL('image/png');
  const imgWidth = sizeConfig.width;
  const imgHeight = (frontCanvas.height * imgWidth) / frontCanvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  
  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureCard(backId);
    const backImgData = backCanvas.toDataURL('image/png');
    pdf.addImage(backImgData, 'PNG', 0, 0, imgWidth, imgHeight);
  }
  
  pdf.save(filename);
};

// Open card PDF in new tab
export const openCardPDF = async (frontId, backId, size = "a6") => {
  const frontCanvas = await captureCard(frontId);
  
  const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
  const pdf = new jsPDF({
    orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
    unit: "mm",
    format: [sizeConfig.width, sizeConfig.height]
  });
  
  const imgData = frontCanvas.toDataURL('image/png');
  const imgWidth = sizeConfig.width;
  const imgHeight = (frontCanvas.height * imgWidth) / frontCanvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  
  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureCard(backId);
    const backImgData = backCanvas.toDataURL('image/png');
    pdf.addImage(backImgData, 'PNG', 0, 0, imgWidth, imgHeight);
  }
  
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

// Print card directly
export const printCard = async (frontId, backId) => {
  const frontCanvas = await captureCard(frontId);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Accreditation Card</title>
        <style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .card { max-width: 100%; height: auto; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <img src="${frontCanvas.toDataURL('image/png')}" class="card" />
        ${backId ? `<div style="page-break-after: always;"></div>` : ''}
      </body>
    </html>
  `);
  
  if (backId) {
    const backCanvas = await captureCard(backId);
    printWindow.document.body.innerHTML += `<img src="${backCanvas.toDataURL('image/png')}" class="card" />`;
  }
  
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
};

// Bulk download multiple cards as ZIP
export const bulkDownloadPDFs = async (accreditations, event, zones, size = "a6") => {
  if (!accreditations || accreditations.length === 0) return;
  
  const zip = new JSZip();
  const folder = zip.folder("accreditation-cards");
  const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
  
  for (const acc of accreditations) {
    try {
      // Create temporary container for rendering
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = `
        <div id="temp-card-${acc.id}" style="width: 320px; height: 454px; background: white; padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 15px;">
            ${acc.photoUrl ? `<img src="${acc.photoUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />` : 
              `<div style="width: 80px; height: 80px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; center; margin: 0 auto; color: white; font-size: 24px; font-weight: bold;">${acc.firstName?.[0]}${acc.lastName?.[0]}</div>`}
          </div>
          <h3 style="margin: 0 0 10px 0; font-size: 18px; text-align: center;">${acc.firstName} ${acc.lastName}</h3>
          <p style="margin: 5px 0; font-size: 14px; color: #666; text-align: center;">${acc.role}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #999; text-align: center;">${acc.club}</p>
          ${acc.accreditationId ? `<p style="margin: 10px 0; font-size: 12px; font-family: monospace; text-align: center;">ID: ${acc.accreditationId}</p>` : ''}
          ${acc.badgeNumber ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold; text-align: center; color: #2563eb;">${acc.badgeNumber}</p>` : ''}
        </div>
      `;
      
      document.body.appendChild(tempContainer);
      
      // Capture the card
      const canvas = await html2canvas(document.getElementById(`temp-card-${acc.id}`), {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(tempContainer);
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [sizeConfig.width, sizeConfig.height]
      });
      
      const imgData = canvas.toDataURL('image/png');
      const aspectRatio = canvas.height / canvas.width;
      const pdfWidth = sizeConfig.width;
      const pdfHeight = pdfWidth * aspectRatio;
      
      // Center the image
      const x = (sizeConfig.width - pdfWidth) / 2;
      const y = (sizeConfig.height - pdfHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
      
      // Add to zip
      const pdfBlob = pdf.output('blob');
      const safeName = `${acc.firstName}_${acc.lastName}_${acc.badgeNumber || acc.id}`.replace(/[^a-z0-9]/gi, '_');
      folder.file(`${safeName}.pdf`, pdfBlob);
      
    } catch (err) {
      console.error(`Failed to process ${acc.firstName} ${acc.lastName}:`, err);
    }
  }
  
  // Download zip
  const content = await zip.generateAsync({ type: "blob" });
  const eventName = (event?.name || 'export').replace(/[^a-z0-9]/gi, '_');
  saveAs(content, `accreditation-cards-${eventName}.zip`);
};
