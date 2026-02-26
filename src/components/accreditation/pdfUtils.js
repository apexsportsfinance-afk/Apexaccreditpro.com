import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────────────────────
   PAPER SIZES
   ───────────────────────────────────────────────────────────── */
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54, label: "ID Card (85.6×54 mm)" },
};

/* ─────────────────────────────────────────────────────────────
   IMAGE / DPI SIZES
   scale = canvas multiplier relative to 96 CSS DPI
   ─────────────────────────────────────────────────────────────
   Low   =  96 DPI  → scale 1   (fast, small file)
   HD    = 192 DPI  → scale 2   (standard screen quality)
   1280  = 384 DPI  → scale 4   (high quality print)
   4K    = 600 DPI  → scale 6.25 (maximum — press quality)
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:  { scale: 1,    label: "Low (96 DPI)"   },
  hd:   { scale: 2,    label: "HD (192 DPI)"   },
  p1280:{ scale: 4,    label: "1280 (384 DPI)" },
  "4k": { scale: 6.25, label: "4K (600 DPI)"   },
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — wait for every <img> in element to load
   ───────────────────────────────────────────────────────────── */
const waitForImages = (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload  = res;
            img.onerror = res;
          })
    )
  );
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — capture one DOM element → high-res canvas
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 6.25) => {
  await waitForImages(el);

  /* Temporarily hide box-shadow so it doesn't bleed into PDF */
  const originalShadow       = el.style.boxShadow;
  const originalBorderRadius = el.style.borderRadius;
  el.style.boxShadow         = "none";
  el.style.borderRadius      = "0";

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor:  "#ffffff",
    useCORS:          true,
    allowTaint:       false,
    logging:          false,
    imageTimeout:     20000,
    removeContainer:  true,
    /* Freeze scroll so nothing shifts during capture */
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
  });

  /* Restore original styles */
  el.style.boxShadow    = originalShadow;
  el.style.borderRadius = originalBorderRadius;

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build a jsPDF whose page == exact card size
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontEl, backEl, scale = 6.25) => {
  const wPx = frontEl.offsetWidth;
  const hPx = frontEl.offsetHeight;

  /*
    Unit "px" + format [wPx, hPx] means the PDF page is
    exactly the card's CSS pixel dimensions.
    No margins, no scaling — pixel-perfect clone.
  */
  const pdf = new jsPDF({
    orientation: hPx >= wPx ? "portrait" : "landscape",
    unit:        "px",
    format:      [wPx, hPx],
    compress:    true,
    hotfixes:    ["px_scaling"], // jsPDF fix for px unit accuracy
  });

  /* Front page */
  const frontCanvas = await captureElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG",
    0, 0,
    wPx, hPx,
    undefined,
    "FAST"
  );

  /* Back page (optional) */
  if (backEl) {
    pdf.addPage([wPx, hPx]);
    const backCanvas = await captureElement(backEl, scale);
    pdf.addImage(
      backCanvas.toDataURL("image/png", 1.0),
      "PNG",
      0, 0,
      wPx, hPx,
      undefined,
      "FAST"
    );
  }

  return pdf;
};

/* ═════════════════════════════════════════════════════════════
   PUBLIC API
   ═════════════════════════════════════════════════════════════ */

/**
 * Download front (+ optional back) as PDF.
 * @param {string}      frontId  - DOM id of front card element
 * @param {string|null} backId   - DOM id of back card element (null to skip)
 * @param {string}      fileName - e.g. "John_Doe_Badge.pdf"
 * @param {number}      scale    - capture scale (use IMAGE_SIZES[key].scale)
 */
export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale  // default: 4K / 600 DPI
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf = await buildPDF(front, back, scale);
  pdf.save(fileName);
};

/**
 * Open the PDF in a new browser tab.
 */
export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf  = await buildPDF(front, back, scale);
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
};

/**
 * Return PDF as a Blob (for upload / email).
 */
export const getCapturedPDFBlob = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf = await buildPDF(front, back, scale);
  return pdf.output("blob");
};

/**
 * Download front + back as separate PNG images.
 * @param {string}      frontId
 * @param {string|null} backId
 * @param {string}      baseName - file name without extension
 * @param {number}      scale
 */
export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  /* Front image */
  const frontCanvas = await captureElement(front, scale);
  const frontLink   = document.createElement("a");
  frontLink.download = `${baseName}_front.png`;
  frontLink.href     = frontCanvas.toDataURL("image/png", 1.0);
  frontLink.click();

  /* Back image */
  if (back) {
    await new Promise((r) => setTimeout(r, 300)); // brief delay between downloads
    const backCanvas = await captureElement(back, scale);
    const backLink   = document.createElement("a");
    backLink.download = `${baseName}_back.png`;
    backLink.href     = backCanvas.toDataURL("image/png", 1.0);
    backLink.click();
  }
};
