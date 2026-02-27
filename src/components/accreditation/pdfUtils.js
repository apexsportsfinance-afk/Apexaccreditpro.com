/**
 * pdfUtils.js
 * ============================================================
 * Pixel-perfect card capture pipeline:
 *
 *  1. Convert ALL external <img> src to base64 BEFORE html2canvas.
 *  2. Capture the LIVE DOM element (never a clone).
 *  3. Strip overflow:hidden on ancestors (modals clip the card).
 *  4. ALWAYS restore original src + styles after capture.
 *  5. Build jsPDF in mm units, card image fills page, zero margins.
 *  6. Print via hidden <iframe> — zero app CSS interference.
 * ============================================================
 */

import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";

/* ─── Card pixel dimensions — must match AccreditationCardPreview ─── */
const CARD_W_PX = 320;
const CARD_H_PX = 454;

/* ─── Paper sizes (mm) ─── */
export const PDF_SIZES = {
  card: { width: 85.6,  height: 54,  label: "ID Card (85.6×54 mm)"  },
  a6:   { width: 105,   height: 148, label: "A6 (105×148 mm)"       },
  a5:   { width: 148,   height: 210, label: "A5 (148×210 mm)"       },
  a4:   { width: 210,   height: 297, label: "A4 (210×297 mm)"       },
};

/* ─── Capture scale factors ─── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280p"       },
  "4k":  { scale: 6.25, label: "600 DPI"     },
};

/* ═══════════════════════════════════════════════════════════
   UTILITY — Convert any URL to base64 data URL
   Tries fetch first, falls back to Image+canvas.
   Returns null if both fail (image hidden, canvas not tainted).
   ═══════════════════════════════════════════════════════════ */
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url)                    return resolve(null);
    if (url.startsWith("data:")) return resolve(url);
    if (url.startsWith("blob:")) return resolve(url);

    /* Method 1 — fetch (works when server sends CORS headers) */
    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(
        (blob) =>
          new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.onerror  = () => res(null);
            reader.readAsDataURL(blob);
          })
      )
      .then((b64) => {
        if (b64) return resolve(b64);
        throw new Error("empty");
      })
      .catch(() => {
        /* Method 2 — Image element + canvas */
        const img = new Image();
        img.crossOrigin = "anonymous";

        const timer = setTimeout(() => {
          img.onload = img.onerror = null;
          resolve(null);
        }, 10_000);

        img.onload = () => {
          clearTimeout(timer);
          try {
            const c = document.createElement("canvas");
            c.width  = img.naturalWidth  || 1;
            c.height = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch {
            resolve(null); // canvas tainted — hide the image
          }
        };

        img.onerror = () => { clearTimeout(timer); resolve(null); };

        const sep = url.includes("?") ? "&" : "?";
        img.src = `${url}${sep}_cb=${Date.now()}`;
      });
  });

/* ═══════════════════════════════════════════════════════════
   UTILITY — Inline all <img> inside an element as base64.
   Returns a restore() function — MUST be called after capture.
   ═══════════════════════════════════════════════════════════ */
const inlineElementImages = async (root) => {
  const imgs    = Array.from(root.querySelectorAll("img"));
  const restore = [];

  await Promise.all(
    imgs.map(async (img) => {
      const originalSrc        = img.getAttribute("src") || "";
      const originalVisibility = img.style.visibility;

      if (!originalSrc || originalSrc.startsWith("data:") || originalSrc.startsWith("blob:")) {
        return; // nothing to do
      }

      const b64 = await urlToBase64(originalSrc);

      restore.push({ img, originalSrc, originalVisibility });

      if (b64) {
        img.setAttribute("src", b64);
        await new Promise((res) => {
          if (img.complete) return res();
          img.onload  = res;
          img.onerror = res;
        });
      } else {
        img.style.visibility = "hidden"; // hide rather than taint canvas
      }
    })
  );

  return () => {
    restore.forEach(({ img, originalSrc, originalVisibility }) => {
      img.setAttribute("src", originalSrc);
      img.style.visibility = originalVisibility;
    });
  };
};

/* ═══════════════════════════════════════════════════════════
   CORE — Capture a live DOM element as HTMLCanvasElement
   ═══════════════════════════════════════════════════════════ */
const captureLiveElement = async (el, scale) => {
  /* 1. Strip overflow on scrollable/modal ancestors */
  const ancestors = [];
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const computed = window.getComputedStyle(node).overflow;
    if (computed === "hidden" || computed === "scroll" || computed === "auto") {
      ancestors.push({ el: node, inlineOverflow: node.style.overflow });
      node.style.overflow = "visible";
    }
    node = node.parentElement;
  }

  /* 2. Patch the card's own styles for clean capture */
  const cardSaved = {
    overflow:     el.style.overflow,
    boxShadow:    el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  };
  el.style.overflow     = "hidden";
  el.style.boxShadow    = "none";
  el.style.borderRadius = "0";

  /* 3. Inline all images as base64 */
  const restoreImages = await inlineElementImages(el);

  /* 4. Let browser repaint */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));

  /* 5. Compute absolute document coordinates */
  const rect    = el.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const absX    = Math.round(rect.left + scrollX);
  const absY    = Math.round(rect.top  + scrollY);

  let canvas;
  try {
    canvas = await html2canvas(document.body, {
      scale,
      x:               absX,
      y:               absY,
      width:           CARD_W_PX,
      height:          CARD_H_PX,
      useCORS:         false,       // images already base64 — no CORS needed
      allowTaint:      false,
      backgroundColor: "#ffffff",
      logging:         false,
      imageTimeout:    30_000,
      removeContainer: true,
      scrollX:         -scrollX,
      scrollY:         -scrollY,
      windowWidth:     document.documentElement.scrollWidth,
      windowHeight:    document.documentElement.scrollHeight,
    });
  } finally {
    /* 6. ALWAYS restore DOM even if capture threw */
    el.style.overflow     = cardSaved.overflow;
    el.style.boxShadow    = cardSaved.boxShadow;
    el.style.borderRadius = cardSaved.borderRadius;
    ancestors.forEach(({ el: a, inlineOverflow }) => {
      a.style.overflow = inlineOverflow;
    });
    restoreImages();
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Capture returned empty canvas for #${el.id}. ` +
      `Rect: ${JSON.stringify({ left: rect.left, top: rect.top, w: rect.width, h: rect.height })}. ` +
      `Make sure the card is fully visible on screen before capturing.`
    );
  }

  return canvas;
};

/* ═══════════════════════════════════════════════════════════
   INTERNAL — Build jsPDF document
   ═══════════════════════════════════════════════════════════ */
const buildPDF = async (frontId, backId, scale, sizeKey = "a6") => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) {
    throw new Error(
      `#${frontId} not found in DOM. ` +
      `Make sure AccreditationCardPreview is rendered and visible on screen.`
    );
  }

  const size        = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const isLandscape = size.width > size.height;

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit:        "mm",
    format:      [size.width, size.height],
    compress:    true,
  });

  /* Front page */
  const frontCanvas = await captureLiveElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG",
    0, 0,
    size.width, size.height,
    undefined,
    "FAST"
  );

  /* Back page */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage(
        [size.width, size.height],
        isLandscape ? "landscape" : "portrait"
      );
      const backCanvas = await captureLiveElement(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG",
        0, 0,
        size.width, size.height,
        undefined,
        "FAST"
      );
    }
  }

  return pdf;
};

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════ */

export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  const url = pdf.output("bloburl");
  const win = window.open(url, "_blank");
  if (!win) {
    // Popup blocked fallback
    const a   = document.createElement("a");
    a.href    = url;
    a.target  = "_blank";
    a.rel     = "noopener noreferrer";
    a.click();
  }
};

export const getCapturedPDFBlob = async (
  frontId,
  backId,
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  return pdf.output("blob");
};

export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

  const frontCanvas = await captureLiveElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  document.body.appendChild(a1);
  a1.click();
  document.body.removeChild(a1);

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 500));
      const backCanvas = await captureLiveElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href     = backCanvas.toDataURL("image/png", 1.0);
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
    }
  }
};

export const printCards = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["hd"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

  const frontCanvas  = await captureLiveElement(frontEl, scale);
  const frontDataUrl = frontCanvas.toDataURL("image/png", 1.0);

  let backDataUrl = null;
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backCanvas = await captureLiveElement(backEl, scale);
      backDataUrl = backCanvas.toDataURL("image/png", 1.0);
    }
  }

  /* Page size that preserves 320:454 card aspect ratio at CR80 width */
  const PAGE_W_MM = 85.6;
  const PAGE_H_MM = parseFloat(((CARD_H_PX / CARD_W_PX) * PAGE_W_MM).toFixed(2));

  const backPageHtml = backDataUrl
    ? `<div class="page"><img src="${backDataUrl}" /></div>`
    : "";

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Accreditation Card</title>
  <style>
    @page {
      size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm;
      margin: 0;
    }
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width:  ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    img {
      width:  ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      display: block;
      object-fit: fill;
    }
  </style>
</head>
<body>
  <div class="page"><img src="${frontDataUrl}" /></div>
  ${backPageHtml}
</body>
</html>`;

  /* Inject into hidden iframe and print */
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

  /* Wait for iframe images to load */
  await new Promise((resolve) => {
    const images = Array.from(iframeDoc.querySelectorAll("img"));
    if (images.length === 0) return resolve();
    let loaded = 0;
    const onDone = () => { if (++loaded >= images.length) resolve(); };
    images.forEach((img) => {
      if (img.complete) { onDone(); return; }
      img.onload  = onDone;
      img.onerror = onDone;
    });
    setTimeout(resolve, 5000); // safety timeout
  });

  await new Promise((r) => setTimeout(r, 200));

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    /* Fallback: open in new window and print */
    const pw = window.open("", "_blank");
    if (pw) {
      pw.document.write(printHtml);
      pw.document.close();
      setTimeout(() => { pw.focus(); pw.print(); pw.close(); }, 600);
    }
  }

  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 30_000);
};

/* Backward-compat alias */
export const downloadBothCardsAsImages = downloadAsImages;
