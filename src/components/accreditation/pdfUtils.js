import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import React from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "./AccreditationCardPreview";

const CARD_W_PX = 320;
const CARD_H_PX = 454;

export const PDF_SIZES = {
  card: { width: 85.6, height: 121.6, label: "ID Card (85.6×121.6 mm)" },
  a6: { width: 105, height: 148, label: "A6 (105×148 mm)" },
  a5: { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a4: { width: 210, height: 297, label: "A4 (210×297 mm)" },
};

export const IMAGE_SIZES = {
  low: { scale: 1, label: "Low Quality" },
  hd: { scale: 2, label: "HD" },
  p1280: { scale: 4, label: "1280p" },
  "4k": { scale: 6.25, label: "600 DPI" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith("data:") || url.startsWith("blob:")) return resolve(url);

    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => new Promise((res) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.onerror = () => res(null);
        reader.readAsDataURL(blob);
      }))
      .then(resolve)
      .catch(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => resolve(null), 8000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth || 1;
            c.height = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
      });
  });

const inlineAllImages = async (container) => {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const b64 = await urlToBase64(src);
      if (b64) img.setAttribute("src", b64);
      else img.style.visibility = "hidden";
    })
  );
  await Promise.all(
    imgs.map((img) => new Promise((res) => {
      if (img.complete && img.naturalWidth > 0) return res();
      img.onload = () => res();
      img.onerror = () => res();
      setTimeout(res, 5000);
    }))
  );
};

const renderOffscreenCard = (accreditation, event, zones) =>
  new Promise((resolve, reject) => {
    const SUFFIX = `_offscreen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 800px;
      height: 600px;
      overflow: visible;
      visibility: visible;
      opacity: 1;
      z-index: -1;
      pointer-events: none;
    `;
    
    document.body.appendChild(container);
    const root = createRoot(container);
    
    const cleanup = () => {
      try { root.unmount(); } catch (_) {}
      try { container.remove(); } catch (_) {}
    };

    root.render(
      React.createElement("div", { 
        style: { display: "flex", flexDirection: "row", gap: "20px", padding: "20px" }
      }, 
        React.createElement(CardInner, { accreditation, event, zones, idSuffix: SUFFIX })
      )
    );

    let attempts = 0;
    const checkReady = async () => {
      attempts++;
      if (attempts > 150) {
        cleanup();
        return reject(new Error("Card render timeout"));
      }

      const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
      const backEl = document.getElementById(`accreditation-back-card${SUFFIX}`);
      
      if (!frontEl) return setTimeout(checkReady, 100);

      const qrImg = frontEl.querySelector('img[alt="QR Verify"]');
      if (!qrImg && accreditation?.accreditationId) {
        return setTimeout(checkReady, 100);
      }

      try {
        await inlineAllImages(container);
      } catch (e) {
        console.warn("Image inlining warning:", e);
      }

      await sleep(300);
      
      resolve({ frontEl, backEl, cleanup });
    };

    setTimeout(checkReady, 150);
  });

const captureEl = async (el, scale) => {
  const canvas = await html2canvas(el, {
    scale,
    useCORS: false,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 30000,
    width: CARD_W_PX,
    height: CARD_H_PX,
    windowWidth: CARD_W_PX,
    windowHeight: CARD_H_PX,
  });

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Canvas capture returned empty result");
  }
  return canvas;
};

const buildPDF = async (accreditation, event, zones, scale, sizeKey) => {
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const isLandscape = size.width > size.height;
  const { frontEl, backEl, cleanup } = await renderOffscreenCard(accreditation, event, zones);

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [size.width, size.height],
    compress: true,
  });

  try {
    const frontCanvas = await captureEl(frontEl, scale);
    pdf.addImage(frontCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, size.width, size.height, undefined, "FAST");
    
    if (backEl) {
      pdf.addPage([size.width, size.height], isLandscape ? "landscape" : "portrait");
      const backCanvas = await captureEl(backEl, scale);
      pdf.addImage(backCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, size.width, size.height, undefined, "FAST");
    }
  } finally {
    cleanup();
  }
  return pdf;
};

export const downloadCapturedPDF = async (accreditation, event, zones, fileName, scale = IMAGE_SIZES["4k"].scale, sizeKey = "a6") => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (accreditation, event, zones, scale = IMAGE_SIZES["4k"].scale, sizeKey = "a6") => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  const url = pdf.output("bloburl");
  window.open(url, "_blank");
};

export const downloadAsImages = async (accreditation, event, zones, baseName, scale = IMAGE_SIZES["4k"].scale) => {
  const { frontEl, backEl, cleanup } = await renderOffscreenCard(accreditation, event, zones);
  
  try {
    const frontCanvas = await captureEl(frontEl, scale);
    const a1 = document.createElement("a");
    a1.download = `${baseName}_front.png`;
    a1.href = frontCanvas.toDataURL("image/png");
    document.body.appendChild(a1);
    a1.click();
    document.body.removeChild(a1);

    if (backEl) {
      await sleep(400);
      const backCanvas = await captureEl(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backCanvas.toDataURL("image/png");
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
    }
  } finally {
    cleanup();
  }
};

// FIXED: Print now uses the selected size and prints only the card
export const printCards = async (accreditation, event, zones, scale = IMAGE_SIZES["hd"].scale, sizeKey = "a6") => {
  const { frontEl, backEl, cleanup } = await renderOffscreenCard(accreditation, event, zones);
  
  try {
    const frontCanvas = await captureEl(frontEl, scale);
    const backCanvas = backEl ? await captureEl(backEl, scale) : null;
    
    // Use the selected PDF size for print page dimensions
    const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
    const pageW = size.width;
    const pageH = size.height;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Print</title>
<style>
@page { size: ${pageW}mm ${pageH}mm; margin: 0; }
body{margin:0;padding:0;background:#fff;}
.page{width:${pageW}mm;height:${pageH}mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden;}
.page:last-child{page-break-after:avoid;}
img{width:100%;height:100%;object-fit:contain;display:block;}
</style></head>
<body>
<div class="page"><img src="${frontCanvas.toDataURL()}"/></div>
${backCanvas ? `<div class="page"><img src="${backCanvas.toDataURL()}"/></div>` : ""}
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;";
    document.body.appendChild(iframe);
    
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    
    await sleep(600);
    
    // Ensure iframe is fully loaded before printing
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    
    // Fallback if onload doesn't fire
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Print failed:", e);
      }
    }, 800);
    
    setTimeout(() => iframe.remove(), 30000);
  } finally {
    cleanup();
  }
};
