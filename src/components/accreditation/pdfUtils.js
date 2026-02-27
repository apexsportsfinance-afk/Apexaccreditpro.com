/**
 * pdfUtils.js — Definitive Final Version
 * =========================================
 * Uses html2canvas(element) directly — not document.body.
 * No coordinate math. No clones. No scroll offset issues.
 * Images pre-converted to base64 to avoid CORS canvas taint.
 * Print via hidden iframe with captured PNG images.
 * =========================================
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
   UTILITY — URL → base64 data URL
   ═════════════════════════════════════════════════════════════ */
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url)                    return resolve(null);
    if (url.startsWith("data:")) return resolve(url);
    if (url.startsWith("blob:")) return resolve(url);

    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.onerror  = () => res(null);
            reader.readAsDataURL(blob);
          })
      )
      .then((b64) => { if (b64) return resolve(b64); throw new Error(); })
      .catch(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => { img.onload = img.onerror = null; resolve(null); }, 8000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth || 1;
            c.height = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch { resolve(null); }
        };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
      });
  });

/* ═════════════════════════════════════════════════════════════
   CORE — Inline all images in element, capture, then restore
   Passes the ELEMENT directly to html2canvas — not body.
   This is the only reliable method regardless of scroll/modal.
   ═════════════════════════════════════════════════════════════ */
const captureElement = async (el, scale) => {
  if (!el) throw new Error("Element not found");

  /* ── Step 1: Save original src of every img ── */
  const imgs = Array.from(el.querySelectorAll("img"));
  const originals = imgs.map((img) => ({
    img,
    src:        img.getAttribute("src") || "",
    visibility: img.style.visibility,
  }));

  /* ── Step 2: Convert all external images to base64 in parallel ── */
  await Promise.all(
    originals.map(async ({ img, src }) => {
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const b64 = await urlToBase64(src);
      if (b64) {
        img.setAttribute("src", b64);
      } else {
        img.style.visibility = "hidden";
      }
    })
  );

  /* ── Step 3: Wait for all images to report loaded ── */
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.onload  = res;
          img.onerror = res;
          setTimeout(res, 3000);
        })
    )
  );

  /* ── Step 4: Save element styles, patch for clean capture ── */
  const saved = {
    overflow:     el.style.overflow,
    boxShadow:    el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  };
  el.style.overflow     = "hidden";
  el.style.boxShadow    = "none";
  el.style.borderRadius = "0";

  /* ── Step 5: Temporarily make ALL ancestor overflow visible ── */
  const ancestors = [];
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const style    = window.getComputedStyle(node);
    const overflow = style.overflow;
    const overflowY = style.overflowY;
    if (overflow === "hidden" || overflow === "scroll" || overflow === "auto" ||
        overflowY === "hidden" || overflowY === "scroll" || overflowY === "auto") {
      ancestors.push({
        el:              node,
        overflow:        node.style.overflow,
        overflowY:       node.style.overflowY,
        maxHeight:       node.style.maxHeight,
        height:          node.style.height,
      });
      node.style.overflow  = "visible";
      node.style.overflowY = "visible";
      node.style.maxHeight = "none";
    }
    node = node.parentElement;
  }

  /* ── Step 6: Repaint ── */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));

  /* ── Step 7: Capture element DIRECTLY — not document.body ── */
  let canvas;
  try {
    canvas = await html2canvas(el, {
      scale,
      useCORS:         false,
      allowTaint:      false,
      backgroundColor: "#ffffff",
      logging:         false,
      imageTimeout:    30_000,
      removeContainer: true,
      width:           CARD_W_PX,
      height:          CARD_H_PX,
      windowWidth:     CARD_W_PX,
      windowHeight:    CARD_H_PX,
    });
  } finally {
    /* ── Step 8: ALWAYS restore everything ── */
    el.style.overflow     = saved.overflow;
    el.style.boxShadow    = saved.boxShadow;
    el.style.borderRadius = saved.borderRadius;

    ancestors.forEach(({ el: a, overflow, overflowY, maxHeight }) => {
      a.style.overflow  = overflow;
      a.style.overflowY = overflowY;
      a.style.maxHeight = maxHeight;
    });

    originals.forEach(({ img, src, visibility }) => {
      if (src) img.setAttribute("src", src);
      img.style.visibility = visibility;
    });
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Capture failed — canvas is empty. ` +
      `Make sure the card preview is visible on screen.`
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

  /* Front */
  const frontCanvas = await captureElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, size.width, size.height,
    undefined, "FAST"
  );

  /* Back */
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
        "PNG", 0, 0, size.width, size.height,
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
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId, backId,
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

export const getCapturedPDFBlob = async (
  frontId, backId,
  scale   = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(frontId, backId, scale, sizeKey);
  return pdf.output("blob");
};

export const downloadAsImages = async (
  frontId, backId, baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

  const frontCanvas = await captureElement(frontEl, scale);
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

export const printCards = async (
  frontId, backId,
  scale = IMAGE_SIZES["hd"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM.`);

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
    img {
      width: ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      display: block;
      object-fit: fill;
    }
  </style>
</head>
<body>
  <div class="page"><img src="${frontDataUrl}"/></div>
  ${backPageHtml}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

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

export const downloadBothCardsAsImages = downloadAsImages;
