import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  medium:{ scale: 2,    label: "Medium"      },
  hd:    { scale: 3,    label: "HD"          },
  high:  { scale: 4,    label: "High"        },
  "4k":  { scale: 6,    label: "4K"          },
};

const captureElement = async (elementId, scale = 3) => {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) throw new Error(`Element #${elementId} not found`);

  const originalParent = originalEl.parentNode;
  const originalNextSibling = originalEl.nextSibling;
  const originalStyles = {
    position: originalEl.style.position,
    transform: originalEl.style.transform,
    zIndex: originalEl.style.zIndex,
    boxShadow: originalEl.style.boxShadow
  };

  try {
    document.body.appendChild(originalEl);
    originalEl.style.position = 'absolute';
    originalEl.style.transform = 'none';
    originalEl.style.zIndex = '999999';
    originalEl.style.boxShadow = 'none';
    originalEl.style.top = '0';
    originalEl.style.left = '0';

    const images = originalEl.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      return new Promise(resolve => {
        if (img.complete) resolve();
        else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 500); }
      });
    }));

    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(originalEl, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 320,
      height: 454,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0) {
      throw new Error('Canvas capture failed');
    }

    return canvas;

  } finally {
    if (originalNextSibling) {
      originalParent.insertBefore(originalEl, originalNextSibling);
    } else {
      originalParent.appendChild(originalEl);
    }
    Object.assign(originalEl.style, originalStyles);
  }
};

export const downloadCapturedPDF = async (frontId, backId, fileName, size = "a6") => {
  try {
    const frontCanvas = await captureElement(frontId, 3);
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });

    pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);

    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureElement(backId, 3);
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, size = "a6") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [sizeConfig.width, sizeConfig.height] });
  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
  
  if (backId) {
    pdf.addPage([sizeConfig.width, sizeConfig.height]);
    const backCanvas = await captureElement(backId, 3);
    pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
  }
  
  window.open(pdf.output('bloburl'), '_blank');
};

export const getCapturedPDFBlob = async (frontId, backId, size = "a6") => {
  const frontCanvas = await captureElement(frontId, 3);
  const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [sizeConfig.width, sizeConfig.height],
    compress: false
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
  a1.href = frontCanvas.toDataURL("image/png");
  a1.click();

  if (backId) {
    await new Promise(r => setTimeout(r, 300));
    const backCanvas = await captureElement(backId, scale);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = backCanvas.toDataURL("image/png");
    a2.click();
  }
};
