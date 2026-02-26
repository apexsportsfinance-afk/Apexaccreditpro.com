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
   INTERNAL — convert external URL to base64 data URL
   Handles CORS via fetch, falls back to Image+canvas
   ───────────────────────────────────────────────────────────── */
const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
      return resolve(url);
    }
    fetch(url, { mode: "cors", cache: "force-cache" })
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
      .then(resolve)
      .catch(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width  = img.naturalWidth  || 80;
            c.height = img.naturalHeight || 60;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
        setTimeout(() => resolve(null), 8000);
      });
  });

/* ─────────────────────────────────────────────────────────────
   INTERNAL — replace every external <img> src with base64
   so html2canvas never sees a cross-origin URL
   ───────────────────────────────────────────────────────────── */
const inlineImages = async (root) => {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const b64 = await urlToBase64(src);
      if (b64) {
        img.setAttribute("src", b64);
      } else {
        img.style.visibility = "hidden"; // hide rather than taint canvas
      }
    })
  );
  // Wait for all images to report loaded
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete) return res();
          img.onload  = res;
          img.onerror = res;
        })
    )
  );
};

/* ─────────────────────────────────────────────────────────────
   CORE CAPTURE STRATEGY
   ═══════════════════════════════════════════════════════════════

   The problem with every previous approach:
   ┌─────────────────────────────────────────────────────────┐
   │ html2canvas renders by walking the DOM tree and painting │
   │ each element using its computed CSS position on screen.  │
   │ A cloneNode() copy has NO computed layout — its         │
   │ getBoundingClientRect() returns {0,0,0,0} because it    │
   │ was never laid out by the browser's layout engine.      │
   │ This is why clones always produce empty canvases.       │
   └─────────────────────────────────────────────────────────┘

   The ONLY reliable approach is to capture the LIVE element
   that the browser has already laid out. We just need to:

   1. Temporarily remove CSS that causes clipping (overflow:hidden
      on the card and its modal ancestors)
   2. Capture at the correct document coordinates
   3. Restore all styles afterward

   This works because the card has FIXED dimensions (320×454px)
   set as inline styles, so the layout is fully determined.
   ───────────────────────────────────────────────────────────── */
const captureLiveElement = async (el, scale) => {
  const CARD_W = 320;
  const CARD_H = 454;

  // ── Step 1: collect all ancestors and save their overflow ──
  const ancestors = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    ancestors.push({ el: node, overflow: node.style.overflow });
    node.style.overflow = "visible";
    node = node.parentElement;
  }

  // ── Step 2: save and patch the card element itself ──
  const savedStyles = {
    overflow:     el.style.overflow,
    boxShadow:    el.style.boxShadow,
    borderRadius: el.style.borderRadius,
  };
  el.style.overflow     = "hidden"; // keep card's own clip for correct look
  el.style.boxShadow    = "none";
  el.style.borderRadius = "0";

  // ── Step 3: inline all images in the LIVE element ──
  await inlineImages(el);

  // Allow browser to repaint after style changes
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));

  // ── Step 4: get live position ──
  const rect = el.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const absX = rect.left + scrollX;
  const absY = rect.top  + scrollY;

  let canvas;
  try {
    canvas = await html2canvas(document.body, {
      scale,
      x:               absX,
      y:               absY,
      width:           CARD_W,
      height:          CARD_H,
      useCORS:         false,  // images already inlined as base64
      allowTaint:      false,
      backgroundColor: "#ffffff",
      logging:         false,
      imageTimeout:    30000,
      removeContainer: true,
      scrollX:         -scrollX,
      scrollY:         -scrollY,
      windowWidth:     document.documentElement.scrollWidth,
      windowHeight:    document.documentElement.scrollHeight,
    });
  } finally {
    // ── Step 5: restore ALL saved styles ──
    el.style.overflow     = savedStyles.overflow;
    el.style.boxShadow    = savedStyles.boxShadow;
    el.style.borderRadius = savedStyles.borderRadius;
    ancestors.forEach(({ el: a, overflow }) => { a.style.overflow = overflow; });
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `Canvas capture returned empty result for #${el.id}. ` +
      `Element rect: ${JSON.stringify(rect)}`
    );
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF with front and optional back page
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found in DOM`);

  const CARD_W = 320;
  const CARD_H = 454;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit:        "px",
    format:      [CARD_W, CARD_H],
    compress:    true,
    hotfixes:    ["px_scaling"],
  });

  // Capture front
  const frontCanvas = await captureLiveElement(frontEl, scale);
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
      const backCanvas = await captureLiveElement(backEl, scale);
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
  const pdf = await buildPDF(frontId, backId, scale);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf  = await buildPDF(frontId, backId, scale);
  window.open(pdf.output("bloburl"), "_blank");
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

  const frontCanvas = await captureLiveElement(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      await new Promise((r) => setTimeout(r, 300));
      const backCanvas = await captureLiveElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href     = backCanvas.toDataURL("image/png", 1.0);
      a2.click();
    }
  }
};

/** Alias for components that import downloadAsImages */
export const downloadAsImages = downloadBothCardsAsImages;
