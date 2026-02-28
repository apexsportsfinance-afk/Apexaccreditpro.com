import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)", dpi: 72 },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)", dpi: 72 },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)", dpi: 72 },
  card: { width: 320, height: 454, label: "Exact Card Size", dpi: 96 }, // Screen DPI
};

export const IMAGE_SIZES = {
  low:    { scale: 1,  label: "Low Quality" },
  medium: { scale: 2,  label: "Medium" },
  hd:     { scale: 3,  label: "HD" },
  high:   { scale: 4,  label: "High" },
  "4k":   { scale: 6,  label: "4K" },
};

const captureElement = async (elementId, scale = 3) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const rect = element.getBoundingClientRect();
  const actualWidth = Math.round(rect.width);
  const actualHeight = Math.round(rect.height);

  const originalParent = element.parentNode;
  const originalNextSibling = element.nextSibling;
  
  try {
    document.body.appendChild(element);
    element.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: ${actualWidth}px !important;
      height: ${actualHeight}px !important;
      transform: none !important;
      margin: 0 !important;
      z-index: 999999 !important;
      box-shadow: none !important;
    `;

    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img => 
        new Promise(resolve => {
          if (img.complete) resolve();
          else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 500); }
        })
      )
    );

    await new Promise(r => setTimeout(r, 200));

    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: actualWidth,
      height: actualHeight,
      x: 0,
      y: 0
    });

    return { canvas, width: actualWidth, height: actualHeight };

  } finally {
    if (originalNextSibling) originalParent.insertBefore(element, originalNextSibling);
    else originalParent.appendChild(element);
    
    element.style.cssText = '';
  }
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
    
    // CRITICAL FIX: Calculate PDF dimensions at exactly 72 DPI
    // PDF uses 72 DPI by default, so we convert pixels to points (1:1 ratio)
    const pdfWidth = width;   // pixels = points at 72 DPI
    const pdfHeight = height; // pixels = points at 72 DPI
    
    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? "l" : "p",
      unit: "pt",  // Points - 1 point = 1/72 inch = 1 pixel at 72 DPI
      format: [pdfWidth, pdfHeight],
      compress: false,
      putOnlyUsedFonts: true,
      floatPrecision: 16
    });
    
    // Add image at EXACT pixel dimensions
    pdf.addImage(
      frontCanvas.toDataURL('image/png'), 
      'PNG', 
      0, 
      0, 
      pdfWidth, 
      pdfHeight,
      undefined,
      'NONE'  // No compression
    );

    if (backId) {
      const { canvas: backCanvas, width: bw, height: bh } = await captureElement(backId, 3);
      pdf.addPage([bw, bh]);
      pdf.addImage(
        backCanvas.toDataURL('image/png'), 
        'PNG', 
        0, 
        0, 
        bw, 
        bh,
        undefined,
        'NONE'
      );
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  const pdf = new jsPDF({
    orientation: width > height ? "l" : "p",
    unit: "pt",
    format: [width, height]
  });
  
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);

  if (backId) {
    const { canvas: bc, width: bw, height: bh } = await captureElement(backId, 3);
    pdf.addPage([bw, bh]);
    pdf.addImage(bc.toDataURL('image/png'), 'PNG', 0, 0, bw, bh);
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  const pdf = new jsPDF({
    orientation: width > height ? "l" : "p",
    unit: "pt",
    format: [width, height],
    compress: false
  });
  
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);

  if (backId) {
    const { canvas: bc, width: bw, height: bh } = await captureElement(backId, 3);
    pdf.addPage([bw, bh]);
    pdf.addImage(bc.toDataURL('image/png'), 'PNG', 0, 0, bw, bh);
  }

  return pdf.output('blob');
};

export const downloadAsImages = async (frontId, backId, baseName, size = "hd") => {
  const { canvas } = await captureElement(frontId, IMAGE_SIZES[size]?.scale || 2);
  
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = canvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    await new Promise(r => setTimeout(r, 300));
    const { canvas: bc } = await captureElement(backId, IMAGE_SIZES[size]?.scale || 2);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = bc.toDataURL("image/png", 1.0);
    a2.click();
  }
};

export default {
  PDF_SIZES,
  IMAGE_SIZES,
  downloadCapturedPDF,
  openCapturedPDFInTab,
  getCapturedPDFBlob,
  downloadAsImages
};
