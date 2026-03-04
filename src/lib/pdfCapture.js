import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
  const originalCssText = element.style.cssText;

  try {
    document.body.appendChild(element);
    element.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: ${actualWidth}px !important;
      height: ${actualHeight}px !important;
      min-width: ${actualWidth}px !important;
      min-height: ${actualHeight}px !important;
      max-width: ${actualWidth}px !important;
      max-height: ${actualHeight}px !important;
      transform: none !important;
      margin: 0 !important;
      z-index: 999999 !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
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

    await document.fonts.ready;
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

    element.style.cssText = originalCssText;
  }
};

// Generate QR code as data URL at high resolution
const generateQRCodeDataUrl = async (accId, size = 512) => {
  const verifyUrl = `${window.location.origin}/verify/${accId}`;
  return await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: "#0f172a", light: "#ffffff" }
  });
};

// Overlay QR code onto canvas at specified position
const overlayQROnCanvas = async (canvas, qrDataUrl, x, y, size) => {
  return new Promise((resolve) => {
    const ctx = canvas.getContext("2d");
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      // Draw white background with border
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 6, y - 6, size + 12, size + 12);
      // Draw QR code crisp
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, x, y, size, size);
      ctx.imageSmoothingEnabled = true;
      resolve(canvas);
    };
    qrImg.onerror = () => resolve(canvas);
    qrImg.src = qrDataUrl;
  });
};

// Get accreditation ID from the element for QR generation
const getAccreditationIdFromElement = (element) => {
  const qrContainer = element.querySelector("[data-qr-code]");
  if (qrContainer) {
    const img = qrContainer.querySelector("img");
    if (img && img.src) {
      // Extract ID from the QR URL embedded in the data URL
      // Since we generate QR from verify URL, we need to get the ID from elsewhere
    }
  }
  // Return from window context or data attribute
  return element.getAttribute("data-accreditation-id") || null;
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const element = document.getElementById(frontId);
    
    // Hide QR during capture
    const qrElements = element?.querySelectorAll("[data-qr-code]") || [];
    qrElements.forEach((qrEl) => {
      qrEl.style.visibility = "hidden";
    });
    
    const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
    
    // Restore QR visibility
    qrElements.forEach((qrEl) => {
      qrEl.style.visibility = "visible";
    });
    
    // Overlay fresh QR code at high resolution
    const accId = element?.getAttribute("data-accreditation-id");
    if (accId) {
      const qrDataUrl = await generateQRCodeDataUrl(accId, 512);
      // QR position: x≈14px, y≈256px in original, scaled by 3
      const scale = 3;
      await overlayQROnCanvas(frontCanvas, qrDataUrl, 14 * scale, 256 * scale, 88 * scale);
    }
    
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
  const element = document.getElementById(frontId);
  
  // Hide QR during capture
  const qrElements = element?.querySelectorAll("[data-qr-code]") || [];
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "hidden";
  });
  
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  // Restore QR visibility
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "visible";
  });
  
  // Overlay fresh QR code
  const accId = element?.getAttribute("data-accreditation-id");
  if (accId) {
    const qrDataUrl = await generateQRCodeDataUrl(accId, 512);
    const scale = 3;
    await overlayQROnCanvas(canvas, qrDataUrl, 14 * scale, 256 * scale, 88 * scale);
  }
  
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
  const element = document.getElementById(frontId);
  
  // Hide QR during capture
  const qrElements = element?.querySelectorAll("[data-qr-code]") || [];
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "hidden";
  });
  
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  // Restore QR visibility
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "visible";
  });
  
  // Overlay fresh QR code
  const accId = element?.getAttribute("data-accreditation-id");
  if (accId) {
    const qrDataUrl = await generateQRCodeDataUrl(accId, 512);
    const scale = 3;
    await overlayQROnCanvas(canvas, qrDataUrl, 14 * scale, 256 * scale, 88 * scale);
  }
  
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
  const element = document.getElementById(frontId);
  const scale = IMAGE_SIZES[size]?.scale || 2;
  
  // Hide QR during capture
  const qrElements = element?.querySelectorAll("[data-qr-code]") || [];
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "hidden";
  });
  
  const { canvas } = await captureElement(frontId, scale);
  
  // Restore QR visibility
  qrElements.forEach((qrEl) => {
    qrEl.style.visibility = "visible";
  });
  
  // Overlay fresh QR code
  const accId = element?.getAttribute("data-accreditation-id");
  if (accId) {
    const qrDataUrl = await generateQRCodeDataUrl(accId, 512);
    await overlayQROnCanvas(canvas, qrDataUrl, 14 * scale, 256 * scale, 88 * scale);
  }
  
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
