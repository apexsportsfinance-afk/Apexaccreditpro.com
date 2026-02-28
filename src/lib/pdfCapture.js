import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 320, height: 454, label: "Exact Card (320×454)", unit: "px" },
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

  // Measure ACTUAL rendered dimensions
  const rect = element.getBoundingClientRect();
  const actualWidth = Math.round(rect.width);
  const actualHeight = Math.round(rect.height);

  const originalParent = element.parentNode;
  const originalNextSibling = element.nextSibling;
  
  try {
    // Move to body
    document.body.appendChild(element);
    element.style.position = 'fixed';
    element.style.transform = 'none';
    element.style.zIndex = '999999';
    element.style.boxShadow = 'none';
    element.style.top = '0';
    element.style.left = '0';
    element.style.margin = '0';
    element.style.width = `${actualWidth}px`;
    element.style.height = `${actualHeight}px`;

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
      width: actualWidth,
      height: actualHeight,
      x: 0,
      y: 0
    });

    return { canvas, width: actualWidth, height: actualHeight };

  } finally {
    // Restore
    if (originalNextSibling) originalParent.insertBefore(element, originalNextSibling);
    else originalParent.appendChild(element);
    
    element.style.position = '';
    element.style.transform = '';
    element.style.zIndex = '';
    element.style.boxShadow = '';
    element.style.top = '';
    element.style.left = '';
    element.style.margin = '';
    element.style.width = '';
    element.style.height = '';
  }
};

export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
    
    let pdf;
    
    if (sizeKey === "card") {
      // EXACT CARD SIZE: Create PDF with exact pixel dimensions
      pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "px",  // Pixel units
        format: [width, height],  // Exact match to image
        compress: false
      });
      
      // Fill entire page with image (no stretching)
      pdf.addImage(
        frontCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        0, 
        0, 
        width, 
        height
      );
    } else {
      // Paper sizes (A4, A5, A6): Scale to fit
      const sizeConfig = PDF_SIZES[sizeKey];
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [sizeConfig.width, sizeConfig.height],
        compress: false
      });
      
      // Calculate scale to fit maintaining aspect ratio
      const pxToMm = 0.264583;
      const imgWidthMm = width * pxToMm;
      const imgHeightMm = height * pxToMm;
      
      const scale = Math.min(
        sizeConfig.width / imgWidthMm,
        sizeConfig.height / imgHeightMm
      );
      
      const finalWidth = imgWidthMm * scale;
      const finalHeight = imgHeightMm * scale;
      const x = (sizeConfig.width - finalWidth) / 2;
      const y = (sizeConfig.height - finalHeight) / 2;
      
      pdf.addImage(
        frontCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        x, 
        y, 
        finalWidth, 
        finalHeight
      );
    }

    // Add back page if exists
    if (backId) {
      const { canvas: backCanvas, width: backW, height: backH } = await captureElement(backId, 3);
      
      if (sizeKey === "card") {
        pdf.addPage([backW, backH]);
        pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, backW, backH);
      } else {
        const sizeConfig = PDF_SIZES[sizeKey];
        pdf.addPage([sizeConfig.width, sizeConfig.height]);
        
        const pxToMm = 0.264583;
        const imgWidthMm = backW * pxToMm;
        const imgHeightMm = backH * pxToMm;
        const scale = Math.min(sizeConfig.width / imgWidthMm, sizeConfig.height / imgHeightMm);
        
        pdf.addImage(
          backCanvas.toDataURL('image/png'), 
          'PNG', 
          (sizeConfig.width - imgWidthMm * scale) / 2, 
          (sizeConfig.height - imgHeightMm * scale) / 2, 
          imgWidthMm * scale, 
          imgHeightMm * scale
        );
      }
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  let pdf;
  if (sizeKey === "card") {
    pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [width, height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
  } else {
    const sizeConfig = PDF_SIZES[sizeKey];
    pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [sizeConfig.width, sizeConfig.height] });
    const pxToMm = 0.264583;
    const scale = Math.min(sizeConfig.width / (width * pxToMm), sizeConfig.height / (height * pxToMm));
    const finalW = width * pxToMm * scale;
    const finalH = height * pxToMm * scale;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (sizeConfig.width - finalW) / 2, (sizeConfig.height - finalH) / 2, finalW, finalH);
  }

  if (backId) {
    const { canvas: backCanvas, width: bw, height: bh } = await captureElement(backId, 3);
    if (sizeKey === "card") {
      pdf.addPage([bw, bh]);
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, bw, bh);
    } else {
      const sizeConfig = PDF_SIZES[sizeKey];
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const pxToMm = 0.264583;
      const scale = Math.min(sizeConfig.width / (bw * pxToMm), sizeConfig.height / (bh * pxToMm));
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', (sizeConfig.width - bw * pxToMm * scale) / 2, (sizeConfig.height - bh * pxToMm * scale) / 2, bw * pxToMm * scale, bh * pxToMm * scale);
    }
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);
  
  let pdf;
  if (sizeKey === "card") {
    pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [width, height], compress: false });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
  } else {
    const sizeConfig = PDF_SIZES[sizeKey];
    pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [sizeConfig.width, sizeConfig.height], compress: false });
    const pxToMm = 0.264583;
    const scale = Math.min(sizeConfig.width / (width * pxToMm), sizeConfig.height / (height * pxToMm));
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (sizeConfig.width - width * pxToMm * scale) / 2, (sizeConfig.height - height * pxToMm * scale) / 2, width * pxToMm * scale, height * pxToMm * scale);
  }

  if (backId) {
    const { canvas: backCanvas, width: bw, height: bh } = await captureElement(backId, 3);
    if (sizeKey === "card") {
      pdf.addPage([bw, bh]);
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, bw, bh);
    } else {
      const sizeConfig = PDF_SIZES[sizeKey];
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const pxToMm = 0.264583;
      const scale = Math.min(sizeConfig.width / (bw * pxToMm), sizeConfig.height / (bh * pxToMm));
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', (sizeConfig.width - bw * pxToMm * scale) / 2, (sizeConfig.height - bh * pxToMm * scale) / 2, bw * pxToMm * scale, bh * pxToMm * scale);
    }
  }

  return pdf.output('blob');
};

export const downloadAsImages = async (frontId, backId, baseName, size = "hd") => {
  const scale = IMAGE_SIZES[size]?.scale || 2;
  const { canvas } = await captureElement(frontId, scale);
  
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = canvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    await new Promise(r => setTimeout(r, 300));
    const { canvas: backCanvas } = await captureElement(backId, scale);
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
