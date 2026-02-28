import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// HTML Card dimensions (pixels)
const CARD_WIDTH_PX = 320;
const CARD_HEIGHT_PX = 454;

// Convert pixels to mm (standard: 96px = 25.4mm)
const pxToMm = (px) => px * 25.4 / 96;

// Exact card size in mm
const CARD_WIDTH_MM = pxToMm(CARD_WIDTH_PX);  // ~84.67mm
const CARD_HEIGHT_MM = pxToMm(CARD_HEIGHT_PX); // ~120.13mm

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)", useExactCardSize: false },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)", useExactCardSize: false },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)", useExactCardSize: false },
  card: { width: CARD_WIDTH_MM, height: CARD_HEIGHT_MM, label: "Exact Card Size", useExactCardSize: true },
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

  const originalParent = element.parentNode;
  const originalNextSibling = element.nextSibling;
  
  try {
    // Move to body to escape modal transforms
    document.body.appendChild(element);
    element.style.position = 'absolute';
    element.style.transform = 'none';
    element.style.zIndex = '999999';
    element.style.boxShadow = 'none';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = `${CARD_WIDTH_PX}px`;
    element.style.height = `${CARD_HEIGHT_PX}px`;

    // Wait for images
    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img => 
        new Promise(resolve => {
          if (img.complete) resolve();
          else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 500); }
        })
      )
    );

    await new Promise(r => setTimeout(r, 150));

    // Capture at exact dimensions
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0) throw new Error('Canvas capture failed');
    
    return canvas;

  } finally {
    // Restore element
    if (originalNextSibling) {
      originalParent.insertBefore(element, originalNextSibling);
    } else {
      originalParent.appendChild(element);
    }
    // Reset styles
    element.style.position = '';
    element.style.transform = '';
    element.style.zIndex = '';
    element.style.boxShadow = '';
    element.style.top = '';
    element.style.left = '';
    element.style.width = '';
    element.style.height = '';
  }
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const frontCanvas = await captureElement(frontId, 3);
    const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
    
    let pageWidth, pageHeight, imgWidth, imgHeight;
    
    if (sizeConfig.useExactCardSize || sizeKey === "card") {
      // CRITICAL: Use exact card dimensions so PDF looks exactly like HTML
      pageWidth = CARD_WIDTH_MM;
      pageHeight = CARD_HEIGHT_MM;
      imgWidth = CARD_WIDTH_MM;
      imgHeight = CARD_HEIGHT_MM;
    } else {
      // For A4/A5/A6 - scale down to fit while maintaining aspect ratio
      pageWidth = sizeConfig.width;
      pageHeight = sizeConfig.height;
      
      // Calculate scale to fit card into page
      const scaleX = pageWidth / CARD_WIDTH_MM;
      const scaleY = pageHeight / CARD_HEIGHT_MM;
      const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio
      
      imgWidth = CARD_WIDTH_MM * scale;
      imgHeight = CARD_HEIGHT_MM * scale;
    }
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight],
      compress: false
    });

    // Add image at calculated dimensions (no stretching!)
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      0, 
      0, 
      imgWidth, 
      imgHeight
    );

    // Add back if exists
    if (backId) {
      pdf.addPage([pageWidth, pageHeight]);
      const backCanvas = await captureElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        0, 
        0, 
        imgWidth, 
        imgHeight
      );
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "card") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
  
  let pageWidth, pageHeight, imgWidth, imgHeight;
  
  if (sizeConfig.useExactCardSize || sizeKey === "card") {
    pageWidth = CARD_WIDTH_MM;
    pageHeight = CARD_HEIGHT_MM;
    imgWidth = CARD_WIDTH_MM;
    imgHeight = CARD_HEIGHT_MM;
  } else {
    pageWidth = sizeConfig.width;
    pageHeight = sizeConfig.height;
    const scaleX = pageWidth / CARD_WIDTH_MM;
    const scaleY = pageHeight / CARD_HEIGHT_MM;
    const scale = Math.min(scaleX, scaleY);
    imgWidth = CARD_WIDTH_MM * scale;
    imgHeight = CARD_HEIGHT_MM * scale;
  }
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidth, pageHeight]
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([pageWidth, pageHeight]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
  
  let pageWidth, pageHeight, imgWidth, imgHeight;
  
  if (sizeConfig.useExactCardSize || sizeKey === "card") {
    pageWidth = CARD_WIDTH_MM;
    pageHeight = CARD_HEIGHT_MM;
    imgWidth = CARD_WIDTH_MM;
    imgHeight = CARD_HEIGHT_MM;
  } else {
    pageWidth = sizeConfig.width;
    pageHeight = sizeConfig.height;
    const scaleX = pageWidth / CARD_WIDTH_MM;
    const scaleY = pageHeight / CARD_HEIGHT_MM;
    const scale = Math.min(scaleX, scaleY);
    imgWidth = CARD_WIDTH_MM * scale;
    imgHeight = CARD_HEIGHT_MM * scale;
  }
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidth, pageHeight],
    compress: false
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([pageWidth, pageHeight]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
  }

  return pdf.output('blob');
};

export const downloadAsImages = async (frontId, backId, baseName, size = "hd") => {
  const scale = IMAGE_SIZES[size]?.scale || 2;
  const frontCanvas = await captureElement(frontId, scale);
  
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    await new Promise(r => setTimeout(r, 300));
    const backCanvas = await captureElement(backId, scale);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = backCanvas.toDataURL("image/png", 1.0);
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
