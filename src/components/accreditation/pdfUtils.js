/**
 * pdfUtils.js — Final Working Version
 * =====================================================
 * Root cause fix: Card is inside a modal with scroll.
 * getBoundingClientRect() inside a scrolled modal gives
 * wrong coordinates. Solution: clone the card, append
 * it directly to document.body at a fixed offscreen
 * position, capture it there, then remove the clone.
 * All images are pre-converted to base64 so the clone
 * has zero CORS issues.
 * =====================================================
 */

import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";

const CARD_W_PX = 320;
const CARD_H_PX = 454;

/* ─────────────────────────────────────────────────────────────
   PAPER SIZES (mm)
   ───────────────────────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6,  height: 54,  label: "ID Card (85.6×54 mm)"  },
  a6:   { width: 105,   height: 148, label: "A6 (105×148 mm)"       },
  a5:   { width: 148,   height: 210, label: "A5 (148×210 mm)"       },
  a4:   { width: 210,   height: 297, label: "A4 (210×297 mm)"       },
};

/* ─────────────────────────────────────────────────────────────
   IMAGE / DPI SIZES
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280p"       },
  "4k":  { scale: 6.25, label: "600 DPI"     },
};

/* ═════════════════════════════════════════════════════════════
   STEP 1 — Convert any URL → base64 data URL
   ═════════════════════════════════════════════════════════════ */
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url)                    return resolve(null);
    if (url.startsWith("data:")) return resolve(url);
    if (url.startsWith("blob:")) return resolve(url);

    /* Try fetch first */
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
        /* Fallback: Image + canvas */
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
            resolve(null);
          }
        };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        const sep = url.includes("?") ? "&" : "?";
        img.src = `${url}${sep}_cb=${Date.now()}`;
      });
  });

/* ═════════════════════════════════════════════════════════════
   STEP 2 — Pre-load ALL images in an element as base64
   Returns a map of { originalSrc → base64 }
   ═════════════════════════════════════════════════════════════ */
const buildImageMap = async (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  const map  = new Map();

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || map.has(src)) return;
      const b64 = await urlToBase64(src);
      map.set(src, b64);
    })
  );

  return map;
};

/* ═════════════════════════════════════════════════════════════
   STEP 3 — Clone element, inline all images, append offscreen
   Returns { clone, cleanup }
   ═════════════════════════════════════════════════════════════ */
const createOffscreenClone = async (el, imageMap) => {
  /* Deep clone the element */
  const clone = el.cloneNode(true);

  /* Apply exact same inline dimensions */
  clone.style.position   = "fixed";
  clone.style.left       = "-99999px";
  clone.style.top        = "0px";
  clone.style.width      = `${CARD_W_PX}px`;
  clone.style.height     = `${CARD_H_PX}px`;
  clone.style.overflow   = "hidden";
  clone.style.boxShadow  = "none";
  clone.style.borderRadius = "0";
  clone.style.zIndex     = "-9999";
  clone.style.visibility = "visible";
  clone.style.opacity    = "1";
  clone.style.transform  = "none";
  clone.removeAttribute("id"); // avoid duplicate IDs

  /* Replace all img src with base64 from the map */
  const cloneImgs = Array.from(clone.querySelectorAll("img"));
  cloneImgs.forEach((img) => {
    const src = img.getAttribute("src") || "";
    const b64 = imageMap.get(src);
    if (b64) {
      img.setAttribute("src", b64);
    } else if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
      img.style.visibility = "hidden";
    }
  });

  /* Append to body — now it has a real layout */
  document.body.appendChild(clone);

  /* Wait for images inside clone to load */
  await Promise.all(
    cloneImgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete) return res();
          img.onload  = res;
          img.onerror = res;
          setTimeout(res, 5000);
        })
    )
  );

  /* Let browser paint the clone */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));

  const cleanup = () => {
    if (clone.parentNode) {
      document.body.removeChild(clone);
    }
  };

  return { clone, cleanup };
};

/* ═════════════════════════════════════════════════════════════
   CORE — Capture element as HTMLCanvasElement
   Uses offscreen clone — immune to modal scroll issues
   ═════════════════════════════════════════════════════════════ */
const captureElement = async (el, scale) => {
  if (!el) throw new Error("Element not found");

  /* Pre-load all images from the LIVE element */
  const imageMap = await buildImageMap(el);

  /* Create offscreen clone with base64 images */
  const { clone, cleanup } = await createOffscreenClone(el, imageMap);

  let canvas;
  try {
    /* Clone is at fixed left:-99999px top:0 */
    /* Capture it directly — no scroll offset issues */
    canvas = await html2canvas(clone, {
      scale,
      useCORS:         false,
      allowTaint:      false,
      backgroundColor: "#ffffff",
      logging:         false,
      imageTimeout:    30_000,
      removeContainer: true,
      width:           CARD_W_PX,
      height:          CARD_H_PX,
    });
  } finally {
    cleanup();
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Capture failed for #${el.id || "unknown"}. ` +
      `Canvas size: ${canvas?.width}x${canvas?.height}. ` +
      `Make sure the card preview is rendered on screen.`
    );
  }

  return canvas;
};

/* ═════════════════════════════════════════════════════════════
   INTERNAL — Build jsPDF with front + back pages
   ═════════════════════════════════════════════════════════════ */
const buildPDF = async (frontId, backId, scale, sizeKey = "a6") => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) {
    throw new Error(
      `#${frontId} not found in DOM. ` +
      `Make sure AccreditationCardPreview is visible on screen.`
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

  /* Capture and add front page */
  const frontCanvas = await captureElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG",
    0, 0,
    size.width, size.height,
    undefined,
    "FAST"
  );

  /* Capture and add back page */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage(
        [size.width, size.height],
        isLandscape ? "landscape" : "portrait"
      );
      const backCanvas = await captureElement(backEl, scale);
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

/* ═════════════════════════════════════════════════════════════
   PUBLIC API
   ═════════════════════════════════════════════════════════════ */

/**
 * Download front + back as a single PDF file.
 */
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

/**
 * Open front + back PDF in a new browser tab.
 */
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
    const a  = document.createElement("a");
    a.href   = url;
    a.target = "_blank";
    a.rel    = "noopener noreferrer";
    a.click();
  }
};

/**
 * Return PDF as raw Blob.
 */
export const getCapturedPDFBlob = async (
  frontId,
  backId,
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  return pdf.output("blob");
};

/**
 * Download front and back as separate PNG files.
 */
export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

  /* Front PNG */
  const frontCanvas = await captureElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  document.body.appendChild(a1);
  a1.click();
  document.body.removeChild(a1);

  /* Back PNG */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 500));
      const backCanvas = await captureElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href     = backCanvas.toDataURL("image/png", 1.0);
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
    }
  }
};

/**
 * Print front + back cards pixel-perfectly.
 * Captures cards as PNG images then prints via hidden iframe.
 * Zero app CSS interference.
 */
export const printCards = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["hd"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

  /* Capture cards */
  const frontCanvas  = await captureElement(frontEl, scale);
  const frontDataUrl = frontCanvas.toDataURL("image/png", 1.0);

  let backDataUrl = null;
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backCanvas = await captureElement(backEl, scale);
      backDataUrl = backCanvas.toDataURL("image/png", 1.0);
    }
  }

  /* Page size preserving 320:454 card aspect ratio */
  const PAGE_W_MM = 85.6;
  const PAGE_H_MM = parseFloat(
    ((CARD_H_PX / CARD_W_PX) * PAGE_W_MM).toFixed(2)
  );

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
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
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

  /* Hidden iframe for printing */
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;" +
    "width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

  /* Wait for iframe images */
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
  }, 30_000);
};

/* Backward-compat alias */
export const downloadBothCardsAsImages = downloadAsImages;
