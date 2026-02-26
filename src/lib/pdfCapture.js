import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280"        },
  "4k":  { scale: 6.25, label: "4K"          },
};

/* ─── Convert any external URL → base64 data URL ─── */
const toBase64 = (url) =>
  new Promise((resolve) => {
    if (!url || url.startsWith("data:")) return resolve(url);
    fetch(url, { mode: "cors", cache: "force-cache" })
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror  = () => resolve(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // Fallback: Image + canvas
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width  = img.naturalWidth  || 80;
            c.height = img.naturalHeight || 60;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
        setTimeout(() => resolve(null), 8000);
      });
  });

/* ─── Inline every <img> src as base64 ─── */
const inlineAllImages = async (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.src || img.src.startsWith("data:")) return;
      const b64 = await toBase64(img.src);
      if (b64) img.src = b64;
      else img.style.display = "none"; // hide broken images
    })
  );
};

/* ─── Wait for all images to finish loading ─── */
const waitForImages = (el) =>
  Promise.all(
    Array.from(el.querySelectorAll("img")).map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.addEventListener("load",  res, { once: true });
          img.addEventListener("error", res, { once: true });
        })
    )
  );

/* ─────────────────────────────────────────────────────────────
   CORE CAPTURE
   
   Deep-clones the element into a brand-new absolutely-positioned
   container that is:
     • appended directly to <body> (outside any modal/portal)
     • positioned off-screen (top: -99999px)
     • given a fixed width/height matching the original card
     • has ALL overflow/clip/transform styles removed

   This guarantees html2canvas always sees a clean, fully-painted
   element regardless of what the modal is doing.
   ───────────────────────────────────────────────────────────── */
const captureElementOffscreen = async (el, scale = 6.25) => {
  // Get the card's intended size from its inline styles
  // (the card uses fixed inline width/height: 320px / 454px)
  const CARD_W = parseInt(el.style.width)  || el.offsetWidth  || 320;
  const CARD_H = parseInt(el.style.height) || el.offsetHeight || 454;

  // Create off-screen host
  const host = document.createElement("div");
  Object.assign(host.style, {
    position:   "fixed",
    top:        "-999999px",
    left:       "-999999px",
    width:      CARD_W + "px",
    height:     CARD_H + "px",
    overflow:   "visible",
    zIndex:     "-9999",
    pointerEvents: "none",
    background: "#ffffff",
  });

  // Deep-clone the card
  const clone = el.cloneNode(true);
  Object.assign(clone.style, {
    position:     "relative",
    top:          "0",
    left:         "0",
    width:        CARD_W + "px",
    height:       CARD_H + "px",
    transform:    "none",
    margin:       "0",
    boxShadow:    "none",
    borderRadius: "0",
    overflow:     "hidden",   // keep card's own overflow:hidden for correct rendering
    flexShrink:   "0",
  });

  // Remove id to avoid duplicate-id issues
  clone.removeAttribute("id");

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    // Inline all images in the clone as base64
    await inlineAllImages(clone);
    await waitForImages(clone);

    // Extra settle for fonts/canvas-drawn elements
    await new Promise((r) => setTimeout(r, 200));

    const canvas = await html2canvas(clone, {
      scale,
      width:           CARD_W,
      height:          CARD_H,
      useCORS:         false,   // all images are already base64
      allowTaint:      false,
      backgroundColor: "#ffffff",
      logging:         false,
      imageTimeout:    30000,
      removeContainer: true,
      scrollX:         0,
      scrollY:         0,
      windowWidth:     CARD_W,
      windowHeight:    CARD_H,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`Capture returned empty canvas for element.`);
    }

    return canvas;
  } finally {
    // Always clean up
    document.body.removeChild(host);
  }
};

/* ─── Build PDF from front + back card elements ─── */
const buildPDF = async (frontId, backId, scale = 6.25) => {
  const frontEl = document.getElementById(frontId);
  const backEl  = backId ? document.getElementById(backId) : null;

  if (!frontEl) throw new Error(`Element #${frontId} not found in DOM`);

  const FRONT_W = parseInt(frontEl.style.width)  || frontEl.offsetWidth  || 320;
  const FRONT_H = parseInt(frontEl.style.height) || frontEl.offsetHeight || 454;

  const pdf = new jsPDF({
    orientation: FRONT_H >= FRONT_W ? "portrait" : "landscape",
    unit:        "px",
    format:      [FRONT_W, FRONT_H],
    compress:    true,
    hotfixes:    ["px_scaling"],
  });

  const frontCanvas = await captureElementOffscreen(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, FRONT_W, FRONT_H,
    undefined, "FAST"
  );

  if (backEl) {
    const BACK_W = parseInt(backEl.style.width)  || backEl.offsetWidth  || 320;
    const BACK_H = parseInt(backEl.style.height) || backEl.offsetHeight || 454;
    pdf.addPage([BACK_W, BACK_H]);
    const backCanvas = await captureElementOffscreen(backEl, scale);
    pdf.addImage(
      backCanvas.toDataURL("image/png", 1.0),
      "PNG", 0, 0, BACK_W, BACK_H,
      undefined, "FAST"
    );
  }

  return pdf;
};

/* ═══════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════ */

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
  const backEl  = backId ? document.getElementById(backId) : null;
  if (!frontEl) throw new Error(`Element #${frontId} not found in DOM`);

  const frontCanvas = await captureElementOffscreen(frontEl, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href     = frontCanvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backEl) {
    await new Promise((r) => setTimeout(r, 300));
    const backCanvas = await captureElementOffscreen(backEl, scale);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href     = backCanvas.toDataURL("image/png", 1.0);
    a2.click();
  }
};

export const downloadAsImages = downloadBothCardsAsImages;
