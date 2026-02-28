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
   ROBUST CAPTURE USING CLONE IN VISIBLE BUT OFF-SCREEN CONTAINER
   ───────────────────────────────────────────────────────────── */

const captureCardElement = async (elementId, scale = 3) => {
  // 1. Find original element
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  // 2. Get dimensions
  const rect = originalEl.getBoundingClientRect();
  const width = Math.max(rect.width, originalEl.offsetWidth, 320);
  const height = Math.max(rect.height, originalEl.offsetHeight, 454);

  console.log(`[PDF Capture] Found #${elementId}: ${width}x${height}px`);

  // 3. Create visible sandbox (not opacity:0 which can skip rendering)
  // Position it off-screen but visible so browser actually renders it
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
    // 4. Deep clone with inline styles
    const clone = originalEl.cloneNode(true);
    
    // Apply all computed styles as inline styles
    const applyStyles = (source, target) => {
      const computed = window.getComputedStyle(source);
      
      // Critical styles for proper rendering
      const styles = [
        'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
        'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
        'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign', 'textTransform',
        'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
        'border', 'borderRadius', 'borderWidth', 'borderColor', 'borderStyle',
        'display', 'flexDirection', 'justifyContent', 'alignItems', 'alignContent', 'gap', 'flexWrap',
        'position', 'top', 'left', 'right', 'bottom', 'zIndex',
        'overflow', 'overflowX', 'overflowY',
        'boxShadow', 'textShadow',
        'visibility', 'opacity', 'transform', 'transformOrigin'
      ];
      
      styles.forEach(prop => {
        try {
          const val = computed.getPropertyValue(prop);
          if (val && val !== 'none' && val !== 'auto' && val !== 'normal') {
            target.style[prop] = val;
          }
        } catch(e) {}
      });
      
      // Copy children recursively
      const sourceChildren = Array.from(source.children);
      const targetChildren = Array.from(target.children);
      sourceChildren.forEach((child, i) => {
        if (targetChildren[i]) {
          applyStyles(child, targetChildren[i]);
        }
      });
    };

    applyStyles(originalEl, clone);

    // 5. Reset positioning for the clone
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';
    clone.style.overflow = 'hidden'; // Keep card's own overflow

    // 6. Handle images - ensure absolute URLs
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      img.crossOrigin = 'anonymous';
      if (img.src) {
        try {
          // Convert to absolute URL
          const absoluteUrl = new URL(img.src, window.location.href).href;
          img.src = absoluteUrl;
        } catch(e) {}
      }
      // Remove lazy loading
      img.loading = 'eager';
      img.decoding = 'sync';
    });

    // 7. Add to sandbox
    sandbox.appendChild(clone);

    // 8. Force layout calculation
    clone.getBoundingClientRect(); // Force reflow
    
    // 9. Wait for images to actually load
    const imgElements = Array.from(clone.querySelectorAll('img'));
    await Promise.all(imgElements.map(img => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
        } else {
          const onLoad = () => { img.onload = null; img.onerror = null; resolve(); };
          const onError = () => { img.onload = null; img.onerror = null; resolve(); };
          img.onload = onLoad;
          img.onerror = onError;
          // Fallback timeout
          setTimeout(() => { img.onload = null; img.onerror = null; resolve(); }, 2000);
        }
      });
    }));

    // 10. Wait for fonts
    await document.fonts.ready;
    
    // Extra wait for any CSS transitions/animations to settle
    await new Promise(r => setTimeout(r, 200));

    console.log(`[PDF Capture] Starting capture at scale ${scale}...`);

    // 11. Capture
    const canvas = await html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: true, // Enable logging for debugging
      width: width,
      height: height,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height
    });

    console.log(`[PDF Capture] Canvas created: ${canvas.width}x${canvas.height}`);

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`Canvas has invalid dimensions: ${canvas?.width}x${canvas?.height}`);
    }

    return { canvas, width, height };

  } catch (error) {
    console.error('[PDF Capture] Error:', error);
    throw error;
  } finally {
    // 12. Cleanup
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  }
};

/* ─────────────────────────────────────────────────────────────
   BUILD PDF
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale) => {
  const CARD_W = 320;
  const CARD_H = 454;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit:        "px",
    format:      [CARD_W, CARD_H],
    compress:    false,
    hotfixes:    ["px_scaling"],
  });

  // Capture front
  console.log('[PDF] Capturing front card...');
  const { canvas: frontCanvas } = await captureCardElement(frontId, scale);
  
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, CARD_W, CARD_H,
    undefined, "FAST"
  );

  // Capture back
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      console.log('[PDF] Capturing back card...');
      pdf.addPage([CARD_W, CARD_H]);
      const { canvas: backCanvas } = await captureCardElement(backId, scale);
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

export const downloadCapturedPDF = async (frontId, backId, fileName, scale = IMAGE_SIZES["4k"].scale) => {
  try {
    console.log(`[PDF] Starting download for ${fileName}...`);
    const pdf = await buildPDF(frontId, backId, scale);
    pdf.save(fileName);
    console.log('[PDF] Download complete');
  } catch (error) {
    console.error('[PDF] Download failed:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, scale = IMAGE_SIZES["4k"].scale) => {
  try {
    const pdf = await buildPDF(frontId, backId, scale);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    console.error('[PDF] Open in tab failed:', error);
    throw error;
  }
};

export const getCapturedPDFBlob = async (frontId, backId, scale = IMAGE_SIZES["4k"].scale) => {
  const pdf = await buildPDF(frontId, backId, scale);
  return pdf.output("blob");
};

export const downloadBothCardsAsImages = async (frontId, backId, baseName, scale = IMAGE_SIZES["4k"].scale) => {
  const { canvas: frontCanvas } = await captureCardElement(frontId, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise(r => setTimeout(r, 300));
      const { canvas: backCanvas } = await captureCardElement(backId, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backCanvas.toDataURL("image/png", 1.0);
      a2.click();
    }
  }
};

export const downloadAsImages = downloadBothCardsAsImages;
