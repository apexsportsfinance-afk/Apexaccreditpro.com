import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Size configurations
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)", unit: "mm" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)", unit: "mm" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)", unit: "mm" },
  card: { width: 320, height: 454, label: "Card (320×454 px)", unit: "px" }, // PIXEL-perfect size
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

  // Store original parent/styles
  const originalParent = element.parentNode;
  const originalNextSibling = element.nextSibling;
  const originalStyles = {
    position: element.style.position,
    transform: element.style.transform,
    zIndex: element.style.zIndex,
    boxShadow: element.style.boxShadow,
  };

  try {
    // Move to body to escape modal transforms
    document.body.appendChild(element);
    element.style.position = 'absolute';
    element.style.transform = 'none';
    element.style.zIndex = '999999';
    element.style.boxShadow = 'none';
    element.style.top = '0';
    element.style.left = '0';

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

    await new Promise(r => setTimeout(r, 100));

    // Capture at high resolution
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 320,   // Force exact width
      height: 454,  // Force exact height
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
    Object.assign(element.style, originalStyles);
  }
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const frontCanvas = await captureElement(frontId, 3);
    const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
    
    // CRITICAL FIX: Use pixel units to maintain exact aspect ratio
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: sizeConfig.unit,  // Use "px" for card size, "mm" for paper sizes
      format: [sizeConfig.width, sizeConfig.height],
      compress: false,
      hotfixes: ["px_scaling"]
    });

    // Add image at exact dimensions without stretching
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      0, 
      0, 
      sizeConfig.width, 
      sizeConfig.height
    );

    // Add back if exists
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        0, 
        0, 
        sizeConfig.width, 
        sizeConfig.height
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
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: sizeConfig.unit,
    format: [sizeConfig.width, sizeConfig.height],
    hotfixes: ["px_scaling"]
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);

  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: sizeConfig.unit,
    format: [sizeConfig.width, sizeConfig.height],
    compress: false,
    hotfixes: ["px_scaling"]
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);

  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
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
