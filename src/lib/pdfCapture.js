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
   INTERNAL — convert a single external URL → base64 data URL.
   This is the core CORS fix: by inlining every external image
   as base64 BEFORE html2canvas sees it, the canvas never
   becomes tainted and toDataURL() always succeeds.
   ───────────────────────────────────────────────────────────── */
const toBase64 = (url) =>
  new Promise((resolve) => {
    if (!url || url.startsWith("data:")) return resolve(url);

    // Try fetch first (works when server sends CORS headers)
    fetch(url, { mode: "cors", cache: "force-cache" })
      .then((r) => r.blob())
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
        // Fetch failed — fall back to Image + offscreen canvas
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
            resolve(null); // tainted even here — skip image
          }
        };
        img.onerror = () => resolve(null);
        img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
        setTimeout(() => resolve(null), 8000);
      });
  });

/* ─────────────────────────────────────────────────────────────
   INTERNAL — inline ALL <img> src attributes in an element
   tree as base64 before html2canvas captures it.
   ───────────────────────────────────────────────────────────── */
const inlineAllImages = async (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.src || img.src.startsWith("data:")) return;
      const b64 = await toBase64(img.src);
      if (b64) img.src = b64;
      // If b64 is null (failed), hide the image so it doesn't taint canvas
      else {
        img.style.visibility = "hidden";
      }
    })
  );
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — wait for every <img> to finish loading
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
   INTERNAL — capture a single element cleanly.

   Flow:
   1. Inline all images as base64 (prevents canvas taint)
   2. Capture with html2canvas using onclone to strip
      overflow/clip from every parent in the modal stack
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 6.25) => {
  // Step 1 — inline images BEFORE cloning so the clone inherits b64 srcs
  await inlineAllImages(el);
  await waitForImages(el);

  const w = el.offsetWidth;
  const h = el.offsetHeight;

  if (!w || !h) {
    throw new Error(
      `Element #${el.id} has zero dimensions. Make sure it is visible on screen.`
    );
  }

  // Step 2 — capture
  const canvas = await html2canvas(el, {
    scale,
    useCORS:         false,  // not needed — images are already base64
    allowTaint:      false,
    backgroundColor: "#ffffff",
    logging:         false,
    imageTimeout:    30000,
    removeContainer: true,
    scrollX:         0,
    scrollY:         0,
    onclone: (_doc, clonedEl) => {
      // Walk every ancestor in the clone and remove clipping
      let node = clonedEl;
      while (node && node.tagName !== "BODY") {
        node.style.overflow   = "visible";
        node.style.clipPath   = "none";
        node.style.transform  = "none";
        node.style.opacity    = "1";
        node.style.visibility = "visible";
        node = node.parentElement;
      }
      clonedEl.style.boxShadow  = "none";
      clonedEl.style.width      = w + "px";
      clonedEl.style.height     = h + "px";
      clonedEl.style.position   = "relative";
      clonedEl.style.top        = "0";
      clonedEl.style.left       = "0";
    },
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error(
      `html2canvas returned empty canvas for #${el.id}. ` +
      "Ensure the card is fully visible and not hidden behind other elements."
    );
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontEl, backEl, scale = 6.25) => {
  const w = frontEl.offsetWidth;
  const h = frontEl.offsetHeight;

  const pdf = new jsPDF({
    orientation: h >= w ? "portrait" : "landscape",
    unit:        "px",
    format:      [w, h],
    compress:    true,
    hotfixes:    ["px_scaling"],
  });

  const frontCanvas = await captureElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, w, h,
    undefined, "FAST"
  );

  if (backEl) {
    const bw = backEl.offsetWidth;
    const bh = backEl.offsetHeight;
    pdf.addPage([bw, bh]);
    const backCanvas = await captureElement(backEl, scale);
    pdf.addImage(
      backCanvas.toDataURL("image/png", 1.0),
      "PNG", 0, 0, bw, bh,
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
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);
  const pdf = await buildPDF(front, back, scale);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);
  const pdf  = await buildPDF(front, back, scale);
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
};

export const getCapturedPDFBlob = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);
  const pdf = await buildPDF(front, back, scale);
  return pdf.output("blob");
};

export const downloadBothCardsAsImages = async (
  frontId, backId, baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const frontCanvas = await captureElement(front, scale);
  const frontLink   = document.createElement("a");
  frontLink.download = `${baseName}_front.png`;
  frontLink.href     = frontCanvas.toDataURL("image/png", 1.0);
  frontLink.click();

  if (back) {
    await new Promise((r) => setTimeout(r, 300));
    const backCanvas = await captureElement(back, scale);
    const backLink   = document.createElement("a");
    backLink.download = `${baseName}_back.png`;
    backLink.href     = backCanvas.toDataURL("image/png", 1.0);
    backLink.click();
  }
};

/** Alias for any component that imports downloadAsImages */
export const downloadAsImages = downloadBothCardsAsImages;
