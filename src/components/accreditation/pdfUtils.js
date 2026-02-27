import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import React from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "./AccreditationCardPreview";

const CARD_W_PX = 320;
const CARD_H_PX = 454;

export const PDF_SIZES = {
  card: { width: 85.6, height: 54, label: "ID Card (85.6×54 mm)" },
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

// Convert image URL to base64 to avoid CORS issues
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith("data:") || url.startsWith("blob:")) return resolve(url);

    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.onerror = () => res(null);
            reader.readAsDataURL(blob);
          })
      )
      .then((b64) => {
        if (b64) return resolve(b64);
        throw new Error();
      })
      .catch(() => {
        // Fallback for images that fail fetch (e.g., cross-origin without cors headers)
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => {
          img.onload = img.onerror = null;
          resolve(null);
        }, 8000);
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
        img.onerror = () => {
          clearTimeout(t);
          resolve(null);
        };
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
      });
  });

// Replace all image src with base64 versions
const inlineAllImages = async (container) => {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const b64 = await urlToBase64(src);
      if (b64) {
        img.setAttribute("src", b64);
      } else {
        img.style.visibility = "hidden";
      }
    })
  );
  
  // Wait for all images to actually load
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 3000);
        })
    )
  );
};

// Render cards offscreen in a clean container
const renderOffscreenCard = (accreditation, event, zones) =>
  new Promise((resolve, reject) => {
    const SUFFIX = `_offscreen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create clean offscreen container
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 700px;
      height: 500px;
      overflow: visible;
      visibility: visible;
      opacity: 1;
      z-index: -1;
      pointer-events: none;
      background: transparent;
    `;
    
    document.body.appendChild(container);
    
    const root = createRoot(container);
    
    const cleanup = () => {
      try { root.unmount(); } catch (_) {}
      try {
        if (container.parentNode) document.body.removeChild(container);
      } catch (_) {}
    };

    // Render the card inner component
    root.render(
      React.createElement("div", { 
        style: { display: "flex", flexDirection: "row", gap: "20px" }
      }, 
        React.createElement(CardInner, {
          accreditation,
          event,
          zones,
          idSuffix: SUFFIX,
        })
      )
    );

    // Poll for render completion
    let attempts = 0;
    const MAX_ATTEMPTS = 100; // 10 seconds max
    
    const poll = async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        cleanup();
        return reject(new Error("Card render timeout"));
      }

      const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
      const backEl = document.getElementById(`accreditation-back-card${SUFFIX}`);

      if (!frontEl || frontEl.getBoundingClientRect().width === 0) {
        return setTimeout(poll, 100);
      }

      try {
        // Inline images before capture
        await inlineAllImages(container);
        
        // Extra frame for paint
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 300));
        
        resolve({ frontEl, backEl, cleanup, suffix: SUFFIX });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    setTimeout(poll, 100);
  });

// Capture element to canvas
const captureEl = async (el, scale) => {
  const canvas = await html2canvas(el, {
    scale,
    useCORS: false, // Images already inlined
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 30000,
    removeContainer: true,
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

// Build PDF with front and back pages
const buildPDF = async (accreditation, event, zones, scale, sizeKey) => {
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const isLandscape = size.width > size.height;

  const { frontEl, backEl, cleanup } = await renderOffscreenCard(
    accreditation, event, zones
  );

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [size.width, size.height],
    compress: true,
  });

  try {
    // Front page
    const frontCanvas = await captureEl(frontEl, scale);
    pdf.addImage(
      frontCanvas.toDataURL("image/png", 1.0),
      "PNG", 0, 0, size.width, size.height,
      undefined, "FAST"
    );

    // Back page
    if (backEl) {
      pdf.addPage([size.width, size.height], isLandscape ? "landscape" : "portrait");
      const backCanvas = await captureEl(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG", 0, 0, size.width, size.height,
        undefined, "FAST"
      );
    }
  } finally {
    cleanup();
  }

  return pdf;
};

// Capture to data URLs
const captureCardDataUrls = async (accreditation, event, zones, scale) => {
  const { frontEl, backEl, cleanup } = await renderOffscreenCard(
    accreditation, event, zones
  );

  let frontDataUrl = null;
  let backDataUrl = null;

  try {
    const frontCanvas = await captureEl(frontEl, scale);
    frontDataUrl = frontCanvas.toDataURL("image/png", 1.0);

    if (backEl) {
      const backCanvas = await captureEl(backEl, scale);
      backDataUrl = backCanvas.toDataURL("image/png", 1.0);
    }
  } finally {
    cleanup();
  }

  return { frontDataUrl, backDataUrl };
};

// Public APIs
export const downloadCapturedPDF = async (
  accreditation, event, zones,
  fileName,
  scale = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  accreditation, event, zones,
  scale = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  const url = pdf.output("bloburl");
  window.open(url, "_blank");
};

export const getCapturedPDFBlob = async (
  accreditation, event, zones,
  scale = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  return pdf.output("blob");
};

export const downloadAsImages = async (
  accreditation, event, zones,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const { frontDataUrl, backDataUrl } = await captureCardDataUrls(
    accreditation, event, zones, scale
  );

  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontDataUrl;
  document.body.appendChild(a1);
  a1.click();
  document.body.removeChild(a1);

  if (backDataUrl) {
    await new Promise((r) => setTimeout(r, 500));
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = backDataUrl;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
  }
};

export const printCards = async (
  accreditation, event, zones,
  scale = IMAGE_SIZES["hd"].scale
) => {
  const { frontDataUrl, backDataUrl } = await captureCardDataUrls(
    accreditation, event, zones, scale
  );

  const PAGE_W_MM = 85.6;
  const PAGE_H_MM = parseFloat(((CARD_H_PX / CARD_W_PX) * PAGE_W_MM).toFixed(2));

  const backPageHtml = backDataUrl
    ? `<div class="page"><img src="${backDataUrl}" /></div>`
    : "";

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Accreditation Card</title>
  <style>
    @page { size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm; margin: 0; }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: avoid; }
    img { width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; display: block; object-fit: fill; }
  </style>
</head>
<body>
  <div class="page"><img src="${frontDataUrl}"/></div>
  ${backPageHtml}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

  await new Promise((resolve) => {
    const images = Array.from(iframeDoc.querySelectorAll("img"));
    if (!images.length) return resolve();
    let loaded = 0;
    const done = () => { if (++loaded >= images.length) resolve(); };
    images.forEach((img) => {
      if (img.complete) { done(); return; }
      img.onload = done;
      img.onerror = done;
    });
    setTimeout(resolve, 5000);
  });

  await new Promise((r) => setTimeout(r, 250));

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    const pw = window.open("", "_blank");
    if (pw) {
      pw.document.write(printHtml);
      pw.document.close();
      setTimeout(() => { pw.focus(); pw.print(); pw.close(); }, 600);
    }
  }

  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 30000);
};

export const downloadBothCardsAsImages = downloadAsImages;
