/**
 * pdfUtils.js
 * ============================================================
 * Pixel-perfect card capture pipeline:
 *
 *  1. Convert ALL external <img> src → base64 data URL BEFORE
 *     html2canvas runs. This is the only reliable CORS fix.
 *  2. Capture the LIVE DOM element (never a clone).
 *  3. Strip overflow:hidden on ancestors so html2canvas can see
 *     the full card (modals clip it otherwise).
 *  4. ALWAYS restore the original src + styles after capture.
 *  5. Build jsPDF in mm units, fitting the card image to the
 *     chosen paper size with zero margins.
 *  6. Print via a dedicated hidden <iframe> that contains only
 *     the card images — zero interference from the app CSS.
 * ============================================================
 */

import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";

/* ─────────────────────────────────────────────────────────────
   CARD DIMENSIONS — must match AccreditationCardPreview inline styles
   ───────────────────────────────────────────────────────────── */
const CARD_W_PX = 320;
const CARD_H_PX = 454;

/* ─────────────────────────────────────────────────────────────
   PAPER SIZES  (millimetres)
   ───────────────────────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6,  height: 54,  label: "ID Card (85.6×54 mm)"  },
  a6:   { width: 105,   height: 148, label: "A6 (105×148 mm)"       },
  a5:   { width: 148,   height: 210, label: "A5 (148×210 mm)"       },
  a4:   { width: 210,   height: 297, label: "A4 (210×297 mm)"       },
};

/* ─────────────────────────────────────────────────────────────
   CAPTURE SCALE FACTORS
   scale=1 → 96 DPI  |  scale=2 → 192 DPI  |  scale=6.25 → 600 DPI
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280p"       },
  "4k":  { scale: 6.25, label: "600 DPI"     },
};

/* ═════════════════════════════════════════════════════════════
   INTERNAL UTILITY — url → base64 data URL
   ═════════════════════════════════════════════════════════════
   Tries fetch first (fast, works when CORS headers present),
   falls back to Image+canvas (works for same-origin or CDNs
   that allow anonymous crossOrigin).
   Returns null if both fail — image will be hidden, not tainted.
*/
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url)                        return resolve(null);
    if (url.startsWith("data:"))     return resolve(url);  // already inlined
    if (url.startsWith("blob:"))     return resolve(url);  // blob URL — fine

    /* ── Method 1: fetch ── */
    fetch(url, {
      mode:        "cors",
      cache:       "force-cache",
      credentials: "omit",
    })
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
        /* ── Method 2: Image element + canvas ── */
        const img   = new Image();
        img.crossOrigin = "anonymous";

        const timer = setTimeout(() => {
          img.onload = img.onerror = null;
          resolve(null);
        }, 10_000);

        img.onload = () => {
          clearTimeout(timer);
          try {
            const c   = document.createElement("canvas");
            c.width   = img.naturalWidth  || 1;
            c.height  = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch {
            // Canvas tainted (strict CORS) — hide the image instead
            resolve(null);
          }
        };

        img.onerror = () => { clearTimeout(timer); resolve(null); };

        // Cache-bust so the browser doesn't serve a cached opaque response
        const sep = url.includes("?") ? "&" : "?";
        img.src = `${url}${sep}_cb=${Date.now()}`;
      });
  });

/* ═════════════════════════════════════════════════════════════
   INTERNAL UTILITY — inline all <img> src in element
   Returns a restore function — ALWAYS call it after capture.
   ═════════════════════════════════════════════════════════════ */
const inlineElementImages = async (root) => {
  const imgs    = Array.from(root.querySelectorAll("img"));
  const restore = []; // { img, originalSrc, wasHidden }

  await Promise.all(
    imgs.map(async (img) => {
      const originalSrc = img.getAttribute("src") || "";

      // Already a data/blob URL — nothing to do
      if (!originalSrc || originalSrc.startsWith("data:") || originalSrc.startsWith("blob:")) {
        return;
      }

      const b64 = await urlToBase64(originalSrc);

      restore.push({
        img,
        originalSrc,
        originalVisibility: img.style.visibility,
        wasInlined: !!b64,
      });

      if (b64) {
        img.setAttribute("src", b64);
        // Give the browser a tick to mark the image as complete
        await new Promise((res) => {
          if (img.complete) return res();
          img.onload  = res;
          img.onerror = res;
        });
      } else {
        // Hide rather than let it taint the canvas
        img.style.visibility = "hidden";
      }
    })
  );

  // Return a restore callback
  return () => {
    restore.forEach(({ img, originalSrc, originalVisibility }) => {
      img.setAttribute("src", originalSrc);
      img.style.visibility = originalVisibility;
    });
  };
};

/* ═════════════════════════════════════════════════════════════
   CORE — capture a live DOM element as HTMLCanvasElement
   ═════════════════════════════════════════════════════════════

   Why we capture document.body instead of the element directly:

   html2canvas walks the COMPUTED layout of the page. When you
   pass `el` directly it re-computes layout from `el` as root,
   which causes flex/grid containers to re-measure and produce
   wrong dimensions. Passing document.body + {x, y, width, height}
   gives a correct viewport-relative crop of exactly the card.

   Ancestor overflow:hidden must be removed temporarily or the
   crop coordinates fall outside the clipping rect and produce
   a blank canvas.
*/
const captureLiveElement = async (el, scale) => {
  /* ── 1. Strip overflow on all scrollable/modal ancestors ── */
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

  /* ── 2. Patch the card's own styles for clean capture ── */
  const cardSaved = {
    overflow:     el.style.overflow,
    boxShadow:    el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  };
  el.style.overflow     = "hidden"; // card keeps its own clip
  el.style.boxShadow    = "none";   // shadows cause artefacts at edges
  el.style.borderRadius = "0";      // rounded corners clip in html2canvas

  /* ── 3. Inline all images (CORS-safe base64) ── */
  const restoreImages = await inlineElementImages(el);

  /* ── 4. Let the browser repaint with new styles ── */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));

  /* ── 5. Compute absolute document position of card ── */
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
      useCORS:         false,        // images are already base64 — no CORS needed
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
    /* ── 6. ALWAYS restore DOM — even if capture threw ── */
    el.style.overflow     = cardSaved.overflow;
    el.style.boxShadow    = cardSaved.boxShadow;
    el.style.borderRadius = cardSaved.borderRadius;
    ancestors.forEach(({ el: a, inlineOverflow }) => {
      a.style.overflow = inlineOverflow;
    });
    restoreImages();  // restore original src attributes
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Capture returned empty canvas for #${el.id}.\n` +
      `Rect: ${JSON.stringify({ left: rect.left, top: rect.top, w: rect.width, h: rect.height })}\n` +
      `Scroll: (${scrollX}, ${scrollY})\n` +
      `Hint: Make sure the card is fully visible on screen before capturing.`
    );
  }

  return canvas;
};

/* ═════════════════════════════════════════════════════════════
   INTERNAL — build jsPDF document (mm page, card image fills page)
   ═════════════════════════════════════════════════════════════ */
const buildPDF = async (frontId, backId, scale, sizeKey = "a6") => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) {
    throw new Error(
      `#${frontId} not found in DOM.\n` +
      `Make sure the AccreditationCardPreview is rendered and visible.`
    );
  }

  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
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
    size.width,
    size.height,
    undefined,
    "FAST"
  );

  /* Back page (optional) */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([size.width, size.height], isLandscape ? "landscape" : "portrait");
      const backCanvas = await captureLiveElement(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG",
        0, 0,
        size.width,
        size.height,
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
 *
 * @param {string} frontId    DOM id of the front card element
 * @param {string} backId     DOM id of the back card element
 * @param {string} fileName   Output filename, e.g. "John_Doe.pdf"
 * @param {number} scale      html2canvas scale (from IMAGE_SIZES)
 * @param {string} sizeKey    Key from PDF_SIZES, e.g. "a6"
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
 * Open front + back as PDF in a new browser tab.
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {number} scale
 * @param {string} sizeKey
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
    // Popup blocked fallback
    const a = document.createElement("a");
    a.href   = url;
    a.target = "_blank";
    a.rel    = "noopener noreferrer";
    a.click();
  }
};

/**
 * Return the PDF as a raw Blob (for custom upload / email).
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {number} scale
 * @param {string} sizeKey
 * @returns {Promise<Blob>}
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
 * Download front and back as separate high-resolution PNG files.
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {string} baseName   Filename without extension, e.g. "John_Doe_Badge"
 * @param {number} scale
 */
export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) {
    throw new Error(`#${frontId} not found in DOM.`);
  }

  /* Capture and download front */
  const frontCanvas = await captureLiveElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  document.body.appendChild(a1);
  a1.click();
  document.body.removeChild(a1);

  /* Capture and download back */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 500)); // stagger to avoid browser blocking
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

/**
 * Print front + back cards pixel-perfectly.
 *
 * Strategy: capture both cards as PNG images, inject them into a
 * minimal hidden <iframe> with dedicated @page CSS that matches the
 * card's aspect ratio and removes all browser margins. Then call
 * print() on that iframe. The main app is never touched.
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {number} scale   Use "hd" (scale=2) for print — saves memory
 */
export const printCards = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["hd"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) {
    throw new Error(`#${frontId} not found in DOM.`);
  }

  /* Capture front */
  const frontCanvas = await captureLiveElement(frontEl, scale);
  const frontDataUrl = frontCanvas.toDataURL("image/png", 1.0);

  /* Capture back */
  let backDataUrl = null;
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backCanvas = await captureLiveElement(backEl, scale);
      backDataUrl = backCanvas.toDataURL("image/png", 1.0);
    }
  }

  /*
   * Card aspect ratio: 320 / 454 ≈ 0.704
   * We use a page size that preserves this ratio.
   * 85.6mm × 121.5mm keeps the exact 320:454 ratio at CR80-ish width.
   *
   * The browser will scale the page to the physical printer paper size,
   * but the image itself has no whitespace or distortion.
   */
  const PAGE_W_MM = 85.6;
  const PAGE_H_MM = (CARD_H_PX / CARD_W_PX) * PAGE_W_MM; // ≈ 121.5 mm

  const backPageHtml = backDataUrl
    ? `<div class="page">
         <img src="${backDataUrl}" />
       </div>`
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width:  ${PAGE_W_MM}mm;
      height: ${PAGE_H_MM}mm;
      background: #fff;
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
  <div class="page">
    <img src="${frontDataUrl}" />
  </div>
  ${backPageHtml}
</body>
</html>`;

  /* Create a hidden iframe and print from it */
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

  /* Wait for images to load inside the iframe then print */
  await new Promise((resolve) => {
    const win = iframe.contentWindow;
    const images = iframeDoc.querySelectorAll("img");
    let loaded = 0;
    const total = images.length;

    if (total === 0) return resolve();

    const onLoad = () => {
      loaded++;
      if (loaded >= total) resolve();
    };

    images.forEach((img) => {
      if (img.complete) { onLoad(); return; }
      img.onload  = onLoad;
      img.onerror = onLoad; // don't hang on error
    });

    // Safety timeout
    setTimeout(resolve, 5000);
  });

  /* Small delay for final render then print */
  await new Promise((r) => setTimeout(r, 200));

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    console.error("iframe print failed, falling back to window.open:", e);
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
        printWin.close();
      }, 500);
    }
  }

  /* Remove iframe after a delay (give browser time to spool the job) */
  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }, 30_000);
};

/* Backward-compat alias */
export const downloadBothCardsAsImages = downloadAsImages;
