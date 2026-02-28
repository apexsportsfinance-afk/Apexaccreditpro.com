import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 320, height: 454, label: "Exact Card (320×454 px)", unit: "px" },
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

  // MEASURE ACTUAL DIMENSIONS
  const rect = element.getBoundingClientRect();
  const actualWidth = Math.round(rect.width);
  const actualHeight = Math.round(rect.height);
  
  console.log(`[Capture] Actual dimensions: ${actualWidth}x${actualHeight}px`);

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
    // Force exact dimensions
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

    // Capture at actual dimensions
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

    if (!canvas || canvas.width === 0) throw new Error('Canvas capture failed');
    
    return { canvas, width: actualWidth, height: actualHeight };

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
    const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
    const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
    
    let pdfWidth, pdfHeight, imgWidth, imgHeight;
    
    if (sizeKey === "card" || sizeConfig.unit === "px") {
      // Use exact pixel dimensions
      pdfWidth = width;
      pdfHeight = height;
      imgWidth = width;
      imgHeight = height;
    } else {
      // For paper sizes, scale to fit while maintaining aspect ratio
      pdfWidth = sizeConfig.width;
      pdfHeight = sizeConfig.height;
      
      // Calculate scale to fit within page
      const scaleX = pdfWidth / (width * 0.264583); // px to mm
      const scaleY = pdfHeight / (height * 0.264583);
      const scale = Math.min(scaleX, scaleY, 1); // Don't upscale
      
      imgWidth = width * scale * 0.264583;
      imgHeight = height * scale * 0.264583;
    }
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: sizeKey === "card" ? "px" : "mm",
      format: [pdfWidth, pdfHeight],
      compress: false,
      hotfixes: ["px_scaling"]
    });

    // Add image maintaining exact aspect ratio
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      0, 
      0, 
      imgWidth, 
      imgHeight
    );

    if (backId) {
      pdf.addPage([pdfWidth, pdfHeight]);
      const { canvas: backCanvas, width: backWidth, height: backHeight } = await captureElement(backId, 3);
      
      let backImgWidth = backWidth;
      let backImgHeight = backHeight;
      
      if (sizeKey !== "card" && sizeConfig.unit !== "px") {
        const scaleX = pdfWidth / (backWidth * 0.264583);
        const scaleY = pdfHeight / (backHeight * 0.264583);
        const scale = Math.min(scaleX, scaleY, 1);
        backImgWidth = backWidth * scale * 0.264583;
        backImgHeight = backHeight * scale * 0.264583;
      }
      
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        0, 
        0, 
        backImgWidth, 
        backImgHeight
      );
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "card") => {
  const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
  
  let pdfWidth = sizeKey === "card" ? width : sizeConfig.width;
  let pdfHeight = sizeKey === "card" ? height : sizeConfig.height;
  let imgWidth = width;
  let imgHeight = height;
  
  if (sizeKey !== "card" && sizeConfig.unit !== "px") {
    const scale = Math.min(pdfWidth / (width * 0.264583), pdfHeight / (height * 0.264583), 1);
    imgWidth = width * scale * 0.264583;
    imgHeight = height * scale * 0.264583;
  }
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: sizeKey === "card" ? "px" : "mm",
    format: [pdfWidth, pdfHeight],
    hotfixes: ["px_scaling"]
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([pdfWidth, pdfHeight]);
    const { canvas: backCanvas, width: backWidth, height: backHeight } = await captureElement(backId, 3);
    let backImgWidth = backWidth;
    let backImgHeight = backHeight;
    if (sizeKey !== "card" && sizeConfig.unit !== "px") {
      const scale = Math.min(pdfWidth / (backWidth * 0.264583), pdfHeight / (backHeight * 0.264583), 1);
      backImgWidth = backWidth * scale * 0.264583;
      backImgHeight = backHeight * scale * 0.264583;
    }
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, backImgWidth, backImgHeight);
  }

  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[sizeKey] || PDF_SIZES.card;
  
  let pdfWidth = sizeKey === "card" ? width : sizeConfig.width;
  let pdfHeight = sizeKey === "card" ? height : sizeConfig.height;
  let imgWidth = width;
  let imgHeight = height;
  
  if (sizeKey !== "card" && sizeConfig.unit !== "px") {
    const scale = Math.min(pdfWidth / (width * 0.264583), pdfHeight / (height * 0.264583), 1);
    imgWidth = width * scale * 0.264583;
    imgHeight = height * scale * 0.264583;
  }
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: sizeKey === "card" ? "px" : "mm",
    format: [pdfWidth, pdfHeight],
    compress: false,
    hotfixes: ["px_scaling"]
  });

  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

  if (backId) {
    pdf.addPage([pdfWidth, pdfHeight]);
    const { canvas: backCanvas, width: backWidth, height: backHeight } = await captureElement(backId, 3);
    let backImgWidth = backWidth;
    let backImgHeight = backHeight;
    if (sizeKey !== "card" && sizeConfig.unit !== "px") {
      const scale = Math.min(pdfWidth / (backWidth * 0.264583), pdfHeight / (backHeight * 0.264583), 1);
      backImgWidth = backWidth * scale * 0.264583;
      backImgHeight = backHeight * scale * 0.264583;
    }
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, backImgWidth, backImgHeight);
  }

  return pdf.output('blob');
};

export const downloadAsImages = async (frontId, backId, baseName, size = "hd") => {
  const scale = IMAGE_SIZES[size]?.scale || 2;
  const { canvas: frontCanvas } = await captureElement(frontId, scale);
  
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1.0);
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
