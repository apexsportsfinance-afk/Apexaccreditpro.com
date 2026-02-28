import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Size configurations - all in mm for consistency
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" }, // Standard ID card
};

export const IMAGE_SIZES = {
  low:    { scale: 1,  label: "Low Quality" },
  medium: { scale: 2,  label: "Medium" },
  hd:     { scale: 3,  label: "HD" },
  high:   { scale: 4,  label: "High" },
  "4k":   { scale: 6,  label: "4K" },
};

// Fixed card dimensions (for capture)
const CARD_WIDTH = 320;
const CARD_HEIGHT = 454;

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
    element.style.width = `${CARD_WIDTH}px`;
    element.style.height = `${CARD_HEIGHT}px`;

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

    // Capture at high resolution
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
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

// Helper to calculate image dimensions maintaining aspect ratio
const calculateImageDimensions = (canvasWidth, canvasHeight, pageWidth, pageHeight) => {
  const canvasRatio = canvasWidth / canvasHeight;
  const pageRatio = pageWidth / pageHeight;
  
  let imgWidth, imgHeight, x, y;
  
  if (canvasRatio > pageRatio) {
    // Canvas is wider relative to page - fit to width
    imgWidth = pageWidth;
    imgHeight = pageWidth / canvasRatio;
    x = 0;
    y = (pageHeight - imgHeight) / 2; // Center vertically
  } else {
    // Canvas is taller relative to page - fit to height
    imgHeight = pageHeight;
    imgWidth = pageHeight * canvasRatio;
    x = (pageWidth - imgWidth) / 2; // Center horizontally
    y = 0;
  }
  
  return { imgWidth, imgHeight, x, y };
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "a6") => {
  try {
    const frontCanvas = await captureElement(frontId, 3);
    const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
    
    // Create PDF at selected paper size
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });

    // Calculate dimensions maintaining aspect ratio
    const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
      CARD_WIDTH, 
      CARD_HEIGHT, 
      sizeConfig.width, 
      sizeConfig.height
    );

    // Add image centered on page, maintaining aspect ratio
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      x, 
      y, 
      imgWidth, 
      imgHeight
    );

    // Add back if exists
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        x, 
        y, 
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

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "a6") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [sizeConfig.width, sizeConfig.height]
  });

  const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
    CARD_WIDTH, 
    CARD_HEIGHT, 
    sizeConfig.width, 
    sizeConfig.height
  );

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "a6") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [sizeConfig.width, sizeConfig.height],
    compress: false
  });

  const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
    CARD_WIDTH, 
    CARD_HEIGHT, 
    sizeConfig.width, 
    sizeConfig.height
  );

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);
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
