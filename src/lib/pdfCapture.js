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
   INTERNAL — wait for every <img> in an element to load
   ───────────────────────────────────────────────────────────── */
const waitForImages = (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.addEventListener("load",  res, { once: true });
          img.addEventListener("error", res, { once: true });
        })
    )
  );
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — capture the OUTER wrapper (#accreditation-card-preview)
   as a single canvas, then crop out each card by its position
   relative to the wrapper.

   WHY: Both cards live inside a flex container. Trying to capture
   a child element (#accreditation-front-card) directly fails because
   html2canvas measures coordinates relative to the document, but the
   parent flex container clips/offsets the result. Capturing the full
   wrapper and cropping is 100% reliable.
   ───────────────────────────────────────────────────────────── */
const captureWrapper = async (wrapperId, scale = 6.25) => {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) throw new Error(`Wrapper element #${wrapperId} not found`);

  await waitForImages(wrapper);

  // Scroll wrapper into view
  wrapper.scrollIntoView({ block: "center", inline: "center" });
  await new Promise((r) => setTimeout(r, 120));

  const canvas = await html2canvas(wrapper, {
    scale,
    useCORS:         true,
    allowTaint:      false,
    backgroundColor: null,   // transparent — wrapper bg is irrelevant
    logging:         false,
    imageTimeout:    30000,
    removeContainer: true,
    scrollX:         0,
    scrollY:         0,
    onclone: (clonedDoc, clonedEl) => {
      // Strip overflow/clip from wrapper and all parents in clone
      let node = clonedEl;
      while (node && node !== clonedDoc.body) {
        node.style.overflow   = "visible";
        node.style.clipPath   = "none";
        node.style.transform  = "none";
        node.style.opacity    = "1";
        node.style.visibility = "visible";
        node = node.parentElement;
      }
      // Make the wrapper itself scrollable-height
      clonedEl.style.overflow = "visible";
      return waitForImages(clonedEl);
    },
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Capture returned an empty canvas. Ensure the card preview is visible on screen.");
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — crop a canvas to a sub-rectangle defined by
   the position of childEl relative to parentEl
   ───────────────────────────────────────────────────────────── */
const cropCanvasToChild = (fullCanvas, parentEl, childEl, scale) => {
  const parentRect = parentEl.getBoundingClientRect();
  const childRect  = childEl.getBoundingClientRect();

  // Position of child relative to parent (in CSS px)
  const relX = childRect.left - parentRect.left;
  const relY = childRect.top  - parentRect.top;
  const relW = childRect.width;
  const relH = childRect.height;

  // Scale up to canvas pixels
  const cx = Math.round(relX * scale);
  const cy = Math.round(relY * scale);
  const cw = Math.round(relW * scale);
  const ch = Math.round(relH * scale);

  // Clamp to canvas bounds
  const safeX = Math.max(0, cx);
  const safeY = Math.max(0, cy);
  const safeW = Math.min(cw, fullCanvas.width  - safeX);
  const safeH = Math.min(ch, fullCanvas.height - safeY);

  if (safeW <= 0 || safeH <= 0) {
    throw new Error(
      `Card "${childEl.id}" could not be cropped from the capture. ` +
      `Bounds: x=${safeX} y=${safeY} w=${safeW} h=${safeH}`
    );
  }

  const cropped = document.createElement("canvas");
  cropped.width  = safeW;
  cropped.height = safeH;
  const ctx = cropped.getContext("2d");
  ctx.drawImage(fullCanvas, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH);
  return cropped;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — capture both cards and return { front, back }
   canvases, plus their CSS pixel dimensions
   ───────────────────────────────────────────────────────────── */
const captureBothCards = async (frontId, backId, scale = 6.25) => {
  const WRAPPER_ID = "accreditation-card-preview";

  const wrapperEl = document.getElementById(WRAPPER_ID);
  const frontEl   = document.getElementById(frontId);
  const backEl    = backId ? document.getElementById(backId) : null;

  if (!wrapperEl) throw new Error(`Wrapper #${WRAPPER_ID} not found. Is AccreditationCardPreview mounted?`);
  if (!frontEl)   throw new Error(`Front card #${frontId} not found`);

  // Capture the full wrapper as one canvas
  const fullCanvas = await captureWrapper(WRAPPER_ID, scale);

  // Crop out front card
  const frontCanvas = cropCanvasToChild(fullCanvas, wrapperEl, frontEl, scale);
  const frontW = frontEl.getBoundingClientRect().width;
  const frontH = frontEl.getBoundingClientRect().height;

  // Crop out back card (if present)
  let backCanvas = null;
  let backW = 0, backH = 0;
  if (backEl) {
    backCanvas = cropCanvasToChild(fullCanvas, wrapperEl, backEl, scale);
    backW = backEl.getBoundingClientRect().width;
    backH = backEl.getBoundingClientRect().height;
  }

  return { frontCanvas, frontW, frontH, backCanvas, backW, backH };
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF from cropped canvases
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale = 6.25) => {
  const { frontCanvas, frontW, frontH, backCanvas, backW, backH } =
    await captureBothCards(frontId, backId, scale);

  const pdf = new jsPDF({
    orientation: frontH >= frontW ? "portrait" : "landscape",
    unit:        "px",
    format:      [frontW, frontH],
    compress:    true,
    hotfixes:    ["px_scaling"],
  });

  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, frontW, frontH,
    undefined, "FAST"
  );

  if (backCanvas) {
    pdf.addPage([backW || frontW, backH || frontH]);
    pdf.addImage(
      backCanvas.toDataURL("image/png", 1.0),
      "PNG", 0, 0, backW || frontW, backH || frontH,
      undefined, "FAST"
    );
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
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
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
  const { frontCanvas, backCanvas } = await captureBothCards(frontId, backId, scale);

  const frontLink   = document.createElement("a");
  frontLink.download = `${baseName}_front.png`;
  frontLink.href     = frontCanvas.toDataURL("image/png", 1.0);
  frontLink.click();

  if (backCanvas) {
    await new Promise((r) => setTimeout(r, 300));
    const backLink   = document.createElement("a");
    backLink.download = `${baseName}_back.png`;
    backLink.href     = backCanvas.toDataURL("image/png", 1.0);
    backLink.click();
  }
};

/** Alias */
export const downloadAsImages = downloadBothCardsAsImages;
