import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────────────────────
   PAPER SIZES
   ───────────────────────────────────────────────────────────── */
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

/* ─────────────────────────────────────────────────────────────
   IMAGE / DPI SIZES
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280"        },
  "4k":  { scale: 6.25, label: "4K"          },
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — Create off-screen sandbox for clean capture
   This avoids modal clipping issues entirely
   ───────────────────────────────────────────────────────────── */
const createSandbox = () => {
  const sandbox = document.createElement('div');
  sandbox.id = 'pdf-capture-sandbox';
  sandbox.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: visible;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    background: white;
  `;
  document.body.appendChild(sandbox);
  return sandbox;
};

const removeSandbox = () => {
  const existing = document.getElementById('pdf-capture-sandbox');
  if (existing) document.body.removeChild(existing);
};

const cloneToSandbox = (originalEl) => {
  // Get computed styles
  const computed = window.getComputedStyle(originalEl);
  const width = originalEl.offsetWidth || 320;
  const height = originalEl.offsetHeight || 454;
  
  // Create clone
  const clone = originalEl.cloneNode(true);
  clone.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${width}px;
    height: ${height}px;
    transform: none;
    margin: 0;
    opacity: 1;
    visibility: visible;
    overflow: hidden;
    box-shadow: none;
  `;
  
  // Copy all computed styles recursively
  const copyStyles = (source, target) => {
    const sourceComputed = window.getComputedStyle(source);
    const importantStyles = [
      'background', 'backgroundColor', 'backgroundImage', 'color',
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign',
      'padding', 'margin', 'border', 'borderRadius', 'display',
      'flexDirection', 'justifyContent', 'alignItems', 'gap',
      'position', 'width', 'height', 'top', 'left', 'right', 'bottom'
    ];
    
    importantStyles.forEach(prop => {
      try {
        target.style[prop] = sourceComputed[prop];
      } catch(e) {}
    });
    
    // Handle children
    const sourceChildren = source.children;
    const targetChildren = target.children;
    for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
      copyStyles(sourceChildren[i], targetChildren[i]);
    }
  };
  
  copyStyles(originalEl, clone);
  
  // Handle images - ensure they're loaded
  const images = clone.querySelectorAll('img');
  images.forEach(img => {
    img.crossOrigin = 'anonymous';
    // Convert src to absolute if relative
    if (img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
      img.src = new URL(img.src, window.location.href).href;
    }
  });
  
  return { clone, width, height };
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — Capture element using sandbox method
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 3) => {
  if (!el) throw new Error('Element not found');
  
  // Clean up any existing sandbox
  removeSandbox();
  
  // Create fresh sandbox
  const sandbox = createSandbox();
  
  // Clone element to sandbox
  const { clone, width, height } = cloneToSandbox(el);
  sandbox.appendChild(clone);
  
  // Wait for images to load
  const images = clone.querySelectorAll('img');
  await Promise.all(Array.from(images).map(img => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 500); // Timeout fallback
      }
    });
  }));
  
  // Small delay for fonts/layout
  await new Promise(r => setTimeout(r, 100));
  
  let canvas;
  try {
    // Capture the clone in sandbox
    canvas = await html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: width,
      height: height,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0
    });
    
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas capture returned empty result');
    }
    
    return { canvas, width, height };
  } finally {
    // Always cleanup
    removeSandbox();
  }
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF with front and optional back page
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM`);

  // Use fixed card dimensions
  const CARD_W = 320;
  const CARD_H = 454;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit:        "px",
    format:      [CARD_W, CARD_H],
    compress:    false, // Better quality
    hotfixes:    ["px_scaling"],
  });

  // Capture front using sandbox method
  const { canvas: frontCanvas } = await captureElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, CARD_W, CARD_H,
    undefined, "FAST"
  );

  // Capture back (if present)
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([CARD_W, CARD_H]);
      const { canvas: backCanvas } = await captureElement(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG", 0, 0, CARD_W, CARD_H,
        undefined, "FAST"
      );
    }
  }

  return pdf;
};

/* ═════════════════════════════════════════════════════════════
   PUBLIC API
   ═════════════════════════════════════════════════════════════ */

export const downloadCapturedPDF = async (
  frontId, backId, fileName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  try {
    const pdf = await buildPDF(frontId, backId, scale);
    pdf.save(fileName);
  } catch (error) {
    console.error('PDF Download Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  try {
    const pdf = await buildPDF(frontId, backId, scale);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    console.error('PDF Open Error:', error);
    throw error;
  }
};

export const getCapturedPDFBlob = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  return pdf.output("blob");
};

export const downloadBothCardsAsImages = async (
  frontId, backId, baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM`);

  const { canvas: frontCanvas } = await captureElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 300));
      const { canvas: backCanvas } = await captureElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backCanvas.toDataURL("image/png", 1.0);
      a2.click();
    }
  }
};

/** Alias for components that import downloadAsImages */
export const downloadAsImages = downloadBothCardsAsImages;
