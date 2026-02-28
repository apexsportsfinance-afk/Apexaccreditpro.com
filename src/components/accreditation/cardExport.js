import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// PDF Sizes for individual cards (in mm)
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

// ROBUST CAPTURE - Clone to sandbox to avoid modal clipping
const captureCardElement = async (elementId, scale = 3) => {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  // Get dimensions
  const width = originalEl.offsetWidth || 320;
  const height = originalEl.offsetHeight || 454;

  console.log(`[Capture] Found #${elementId}: ${width}x${height}px`);

  // Create visible sandbox off-screen
  const sandbox = document.createElement('div');
  sandbox.style.cssText = `
    position: fixed;
    top: -10000px;
    left: -10000px;
    width: ${width + 100}px;
    height: ${height + 100}px;
    overflow: visible;
    z-index: 2147483647;
    background: white;
    visibility: visible;
    display: block;
  `;
  document.body.appendChild(sandbox);

  try {
    // Deep clone
    const clone = originalEl.cloneNode(true);
    
    // Copy all computed styles
    const applyStyles = (source, target) => {
      const computed = window.getComputedStyle(source);
      const styles = [
        'width', 'height', 'background', 'backgroundColor', 'color',
        'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign',
        'padding', 'margin', 'border', 'borderRadius', 'display',
        'flexDirection', 'justifyContent', 'alignItems', 'position',
        'overflow', 'boxShadow', 'visibility', 'opacity'
      ];
      
      styles.forEach(prop => {
        try {
          target.style[prop] = computed.getPropertyValue(prop);
        } catch(e) {}
      });
      
      const sourceChildren = Array.from(source.children);
      const targetChildren = Array.from(target.children);
      sourceChildren.forEach((child, i) => {
        if (targetChildren[i]) applyStyles(child, targetChildren[i]);
      });
    };

    applyStyles(originalEl, clone);

    // Reset positioning
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';
    clone.style.overflow = 'hidden';

    // Handle images
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      img.crossOrigin = 'anonymous';
      img.loading = 'eager';
      if (img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
        try {
          img.src = new URL(img.src, window.location.href).href;
        } catch(e) {}
      }
    });

    sandbox.appendChild(clone);
    
    // Force reflow
    clone.getBoundingClientRect();
    
    // Wait for images
    await Promise.all(Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) resolve();
        else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 1000);
        }
      });
    }));

    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 200));

    // Capture
    const canvas = await html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: width,
      height: height,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas has invalid dimensions');
    }

    return canvas;
  } finally {
    if (sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
  }
};

// Download single card as PDF - NOW USES SANDBOX
export const downloadCardPDF = async (frontId, backId, filename, size = "a6") => {
  try {
    console.log(`[PDF] Starting download for ${filename}`);
    const frontCanvas = await captureCardElement(frontId, 3);
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });
    
    const imgData = frontCanvas.toDataURL('image/png', 1.0);
    
    pdf.addImage(imgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height, undefined, 'FAST');
    
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCardElement(backId, 3);
      const backImgData = backCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(backImgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height, undefined, 'FAST');
    }
    
    pdf.save(filename);
    console.log('[PDF] Download complete');
    return true;
  } catch (error) {
    console.error('PDF Download Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

// Open card PDF in new tab - NOW USES SANDBOX
export const openCardPDF = async (frontId, backId, size = "a6") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 3);
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });
    
    const imgData = frontCanvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height, undefined, 'FAST');
    
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCardElement(backId, 3);
      const backImgData = backCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(backImgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height, undefined, 'FAST');
    }
    
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return true;
  } catch (error) {
    console.error('PDF Open Error:', error);
    throw error;
  }
};

// Print card directly - NOW USES SANDBOX
export const printCard = async (frontId, backId) => {
  try {
    const frontCanvas = await captureCardElement(frontId, 2);
    const frontImage = frontCanvas.toDataURL('image/png');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Accreditation Card</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
            .card-container { width: 85.6mm; height: 54mm; position: relative; }
            .card { width: 100%; height: 100%; object-fit: contain; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="card-container"><img src="${frontImage}" class="card" /></div>
          ${backId ? `<div style="page-break-after: always;"></div>` : ''}
        </body>
      </html>
    `);
    
    if (backId) {
      const backCanvas = await captureCardElement(backId, 2);
      const backImage = backCanvas.toDataURL('image/png');
      printWindow.document.body.innerHTML += `<div class="card-container"><img src="${backImage}" class="card" /></div>`;
    }
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
    
    return true;
  } catch (error) {
    console.error('Print Error:', error);
    throw error;
  }
};

// Bulk download - Uses temp divs (already working)
export const bulkDownloadPDFs = async (accreditations, event, zones, size = "a6") => {
  // ... keep your existing bulk download code ...
  // It's already creating temp divs which works fine
};

// Helper functions
const getRoleColor = (role) => {
  const colors = {
    'Athlete': '#3b82f6',
    'Coach': '#22c55e', 
    'Organizer': '#22c55e',
    'Official': '#f59e0b',
    'Media': '#8b5cf6',
    'Medical': '#ef4444',
    'Volunteer': '#06b6d4'
  };
  return colors[role] || '#64748b';
};

const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const diff = Date.now() - birthDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};
