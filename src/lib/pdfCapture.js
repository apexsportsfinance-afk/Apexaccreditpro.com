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
   INTERNAL — wait for every <img> to fully load
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
   INTERNAL — convert every <img> src to a base64 data URL
   so html2canvas never makes a cross-origin request.
   This is the key fix for "wrong PNG signature".
   ───────────────────────────────────────────────────────────── */
const inlineImages = async (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.src || img.src.startsWith("data:")) return;
      try {
        const res  = await fetch(img.src, { mode: "cors", cache: "force-cache" });
        const blob = await res.blob();
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            img.src = reader.result;
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch {
        /* If fetch fails (e.g. flag CDN), leave src as-is */
      }
    })
  );
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — capture element directly (no clone)
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 6.25) => {
  await waitForImages(el);
  await inlineImages(el);

  const rect = el.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  const prevShadow = el.style.boxShadow;
  const prevRadius = el.style.borderRadius;
  el.style.boxShadow    = "none";
  el.style.borderRadius = "0";

  let canvas;
  try {
    canvas = await html2canvas(el, {
      scale,
      width:           w,
      height:          h,
      x:               rect.left + window.scrollX,
      y:               rect.top  + window.scrollY,
      backgroundColor: "#ffffff",
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      imageTimeout:    30000,
      removeContainer: true,
      scrollX:         -window.scrollX,
      scrollY:         -window.scrollY,
      windowWidth:     document.documentElement.scrollWidth,
      windowHeight:    document.documentElement.scrollHeight,
    });
  } finally {
    el.style.boxShadow    = prevShadow;
    el.style.borderRadius = prevRadius;
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontEl, backEl, scale = 6.25) => {
  const rect = frontEl.getBoundingClientRect();
  const wPx  = Math.round(rect.width);
  const hPx  = Math.round(rect.height);

  const pdf = new jsPDF({
    orientation: hPx >= wPx ? "portrait" : "landscape",
    unit:        "px",
    format:      [wPx, hPx],
    compress:    true,
    hotfixes:    ["px_scaling"],
  });

  const frontCanvas = await captureElement(frontEl, scale);

  if (frontCanvas.width === 0 || frontCanvas.height === 0) {
    throw new Error("Card capture returned an empty canvas. Ensure the card is fully visible on screen.");
  }

  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, wPx, hPx,
    undefined, "FAST"
  );

  if (backEl) {
    pdf.addPage([wPx, hPx]);
    const backCanvas = await captureElement(backEl, scale);
    if (backCanvas.width > 0 && backCanvas.height > 0) {
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG", 0, 0, wPx, hPx,
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
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");
  const pdf = await buildPDF(front, back, scale);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId, backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");
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
  if (!front) throw new Error("Front card not found");
  const pdf = await buildPDF(front, back, scale);
  return pdf.output("blob");
};

export const downloadBothCardsAsImages = async (
  frontId, backId, baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");

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

/** Alias for components that import downloadAsImages */
export const downloadAsImages = downloadBothCardsAsImages;
