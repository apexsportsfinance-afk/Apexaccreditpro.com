/**
 * pdfUtils.js  —  Pixel-perfect capture of AccreditationCardPreview
 *
 * Strategy:
 *  1. Pre-convert every external <img> src to a base64 data URL
 *     BEFORE html2canvas runs — this eliminates all CORS/taint issues.
 *  2. Capture the LIVE DOM element (not a clone) so layout is correct.
 *  3. Temporarily strip overflow:hidden on ancestor modals/scrollers
 *     so html2canvas can see the full card at its natural position.
 *  4. Build jsPDF in pixel units at the exact card size (320×454 px).
 *  5. For print — inject a dedicated <style> tag that hides the rest
 *     of the UI and sets the page size to the card's proportions.
 */

import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────── */
/** Pixel dimensions that match the inline styles in AccreditationCardPreview */
const CARD_W = 320;
const CARD_H = 454;

/* ─────────────────────────────────────────────────────────────
   PAPER SIZES  (used only when the caller wants a specific page)
   ───────────────────────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6,  height: 54,  label: "ID Card (85.6×54 mm)" },
  a6:   { width: 105,   height: 148, label: "A6 (105×148 mm)"      },
  a5:   { width: 148,   height: 210, label: "A5 (148×210 mm)"      },
  a4:   { width: 210,   height: 297, label: "A4 (210×297 mm)"      },
};

/* ─────────────────────────────────────────────────────────────
   IMAGE / DPI SCALE FACTORS
   html2canvas `scale` controls how many device pixels per CSS px.
   scale=1 → 96 DPI, scale=2 → 192 DPI (HD), scale=6.25 → 600 DPI
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280p"       },
  "4k":  { scale: 6.25, label: "600 DPI"     },
};

/* ═════════════════════════════════════════════════════════════
   STEP 1 — Convert external URLs to base64 data URLs
   This is the ONLY reliable way to avoid canvas taint with
   html2canvas when images are served from different origins.
   ═════════════════════════════════════════════════════════════ */

/**
 * Fetch a URL and return a base64 data URL.
 * Falls back to Image+canvas if fetch is blocked by CORS.
 * Returns null if both methods fail (image will be hidden).
 *
 * @param {string} url
 * @returns {Promise<string|null>}
 */
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    // Already inlined — nothing to do
    if (url.startsWith("data:") || url.startsWith("blob:")) return resolve(url);

    /* Method 1: fetch (works when the server sends CORS headers) */
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
        throw new Error("FileReader produced null");
      })
      .catch(() => {
        /* Method 2: Image element + canvas
           Works for same-origin or images with `crossOrigin` header */
        const img = new Image();
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
            // Canvas tainted even with crossOrigin — give up
            resolve(null);
          }
        };

        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };

        // Cache-bust to avoid stale cached responses without CORS headers
        const sep = url.includes("?") ? "&" : "?";
        img.src = `${url}${sep}_cb=${Date.now()}`;
      });
  });

/**
 * Walk every <img> inside `root` and replace its src with a
 * base64 data URL.  Images that cannot be inlined are hidden
 * so they don't cause canvas SecurityError.
 *
 * IMPORTANT: we store the original src so we can restore it
 * afterward — the live DOM must be left unchanged.
 *
 * @param {HTMLElement} root
 * @returns {Promise<Array<{img:HTMLImageElement, original:string}>>}
 */
const inlineImages = async (root) => {
  const imgs    = Array.from(root.querySelectorAll("img"));
  const records = []; // { img, original, hidden }

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;

      const b64 = await urlToBase64(src);
      records.push({ img, original: src, hidden: !b64 });

      if (b64) {
        img.setAttribute("src", b64);
        // Force the browser to treat it as loaded
        await new Promise((res) => {
          if (img.complete) return res();
          img.onload  = res;
          img.onerror = res;
        });
      } else {
        // Hide rather than taint the canvas
        img.style.visibility = "hidden";
      }
    })
  );

  return records;
};

/**
 * Restore the live DOM to its original state after capture.
 *
 * @param {Array<{img:HTMLImageElement, original:string, hidden:boolean}>} records
 */
const restoreImages = (records) => {
  for (const { img, original, hidden } of records) {
    img.setAttribute("src", original);
    if (hidden) img.style.visibility = "";
  }
};

/* ═════════════════════════════════════════════════════════════
   STEP 2 — Capture the LIVE element with html2canvas
   ═════════════════════════════════════════════════════════════ */

/**
 * Capture a live DOM element pixel-perfectly.
 *
 * Problems solved:
 *  - Ancestor `overflow:hidden` clips the element for html2canvas
 *    → we temporarily set ancestors to `overflow:visible`
 *  - The element itself must keep `overflow:hidden` for correct look
 *  - Box-shadow and border-radius cause artifacts at capture edges
 *    → removed during capture, restored after
 *  - Cross-origin images → pre-inlined as base64 above
 *
 * @param {HTMLElement} el    The live DOM element to capture
 * @param {number}      scale html2canvas scale factor
 * @returns {Promise<HTMLCanvasElement>}
 */
const captureLiveElement = async (el, scale) => {
  /* ── Collect ancestors that may clip ── */
  const ancestors = [];
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    ancestors.push({ el: node, overflow: node.style.overflow });
    node.style.overflow = "visible";
    node = node.parentElement;
  }

  /* ── Patch the card element itself ── */
  const saved = {
    overflow:     el.style.overflow,
    boxShadow:    el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  };
  el.style.overflow     = "hidden"; // keep card's internal clip
  el.style.boxShadow    = "none";
  el.style.borderRadius = "0";

  /* ── Inline all images (CORS-safe) ── */
  const imgRecords = await inlineImages(el);

  /* ── Let the browser repaint ── */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 100));

  /* ── Compute absolute document coordinates ── */
  const rect  = el.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const absX = rect.left + scrollX;
  const absY = rect.top  + scrollY;

  let canvas;
  try {
    canvas = await html2canvas(document.body, {
      scale,
      x:           absX,
      y:           absY,
      width:       CARD_W,
      height:      CARD_H,
      /* Images are already base64 — no CORS requests needed */
      useCORS:         false,
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
    /* ── Always restore the DOM ── */
    el.style.overflow     = saved.overflow;
    el.style.boxShadow    = saved.boxShadow;
    el.style.borderRadius = saved.borderRadius;
    ancestors.forEach(({ el: a, overflow }) => (a.style.overflow = overflow));
    restoreImages(imgRecords);
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Canvas capture returned empty result for #${el.id}.\n` +
      `Element rect: ${JSON.stringify(rect)}\n` +
      `Scroll: ${scrollX}, ${scrollY}`
    );
  }

  return canvas;
};

/* ═════════════════════════════════════════════════════════════
   STEP 3 — Build jsPDF from captured canvases
   ═════════════════════════════════════════════════════════════ */

/**
 * Build a jsPDF document containing front (and optional back) card.
 *
 * We use pixel units so the PDF page exactly matches the card's
 * CSS pixel dimensions (320×454). The `hotfixes` option corrects
 * a long-standing jsPDF bug where px dimensions are halved.
 *
 * @param {string} frontId
 * @param {string|null} backId
 * @param {number} scale
 * @returns {Promise<jsPDF>}
 */
const buildPDF = async (frontId, backId, scale) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`Element #${frontId} not found in DOM. Make sure the card preview is visible.`);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit:        "px",
    format:      [CARD_W, CARD_H],
    compress:    true,
    hotfixes:    ["px_scaling"],  // Fixes jsPDF halving px dimensions
  });

  /* Front page */
  const frontCanvas = await captureLiveElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG",
    0, 0, CARD_W, CARD_H,
    undefined,
    "FAST"
  );

  /* Back page (optional) */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([CARD_W, CARD_H]);
      const backCanvas = await captureLiveElement(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG",
        0, 0, CARD_W, CARD_H,
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
 * Download front+back as a PDF file.
 *
 * @param {string} frontId       DOM id of front card element
 * @param {string} backId        DOM id of back card element
 * @param {string} fileName      e.g. "John_Doe_Badge.pdf"
 * @param {number} [scale=6.25]  html2canvas scale (see IMAGE_SIZES)
 */
export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  pdf.save(fileName);
};

/**
 * Open front+back PDF in a new browser tab.
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {number} [scale=6.25]
 */
export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  window.open(pdf.output("bloburl"), "_blank");
};

/**
 * Return the PDF as a raw Blob (for custom upload/email flows).
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {number} [scale=6.25]
 * @returns {Promise<Blob>}
 */
export const getCapturedPDFBlob = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  return pdf.output("blob");
};

/**
 * Download front and back as separate PNG files.
 *
 * @param {string} frontId
 * @param {string} backId
 * @param {string} baseName   e.g. "John_Doe_Badge"  (no extension)
 * @param {number} [scale=6.25]
 */
export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`Element #${frontId} not found in DOM.`);

  const frontCanvas = await captureLiveElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 400)); // short gap between triggers
      const backCanvas = await captureLiveElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href     = backCanvas.toDataURL("image/png", 1.0);
      a2.click();
    }
  }
};

/** Alias kept for backward compat */
export const downloadBothCardsAsImages = downloadAsImages;
