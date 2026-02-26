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
   INTERNAL — wait for every <img> to fully load/paint
   ───────────────────────────────────────────────────────────── */
const waitForImages = (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          const onDone = () => {
            img.removeEventListener("load",  onDone);
            img.removeEventListener("error", onDone);
            res();
          };
          img.addEventListener("load",  onDone);
          img.addEventListener("error", onDone);
          /* Re-trigger load for cached-but-not-painted images */
          if (img.src) {
            const src = img.src;
            img.src = "";
            img.src = src;
          }
        })
    )
  );
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — capture element in an isolated off-screen clone
   so modal clipping / transforms don't affect the output
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 6.25) => {
  await waitForImages(el);

  /* True rendered size — unaffected by parent transforms */
  const rect = el.getBoundingClientRect();
  const trueW = Math.round(rect.width);
  const trueH = Math.round(rect.height);

  /* Off-screen wrapper — no modal clipping */
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position:   "fixed",
    top:        "-99999px",
    left:       "-99999px",
    width:      trueW + "px",
    height:     trueH + "px",
    overflow:   "visible",
    zIndex:     "-1",
    background: "#ffffff",
    transform:  "none",
  });

  const clone = el.cloneNode(true);
  Object.assign(clone.style, {
    width:        trueW + "px",
    height:       trueH + "px",
    transform:    "none",
    margin:       "0",
    boxShadow:    "none",
    borderRadius: "0",
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  /* Wait for cloned images + settle delay for fonts/flags */
  await waitForImages(wrapper);
  await new Promise((r) => setTimeout(r, 150));

  let canvas;
  try {
    canvas = await html2canvas(wrapper, {
      scale,
      width:           trueW,
      height:          trueH,
      backgroundColor: "#ffffff",
      useCORS:         true,
      allowTaint:      false,
      logging:         false,
      imageTimeout:    30000,
      removeContainer: true,
      scrollX:         0,
      scrollY:         0,
      windowWidth:     trueW,
      windowHeight:    trueH,
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   INTERNAL — build jsPDF from front + optional back element
   ───────────────────────────────────────────────────────────── */
const buildPDF = async (frontEl, backEl, scale = 6.25) => {
  /* Use getBoundingClientRect for consistent true size */
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
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1.0),
    "PNG", 0, 0, wPx, hPx,
    undefined, "FAST"
  );

  if (backEl) {
    pdf.addPage([wPx, hPx]);
    const backCanvas = await captureElement(backEl, scale);
    pdf.addImage(
      backCanvas.toDataURL("image/png", 1.0),
      "PNG", 0, 0, wPx, hPx,
      undefined, "FAST"
    );
  }

  return pdf;
};

/* ═════════════════════════════════════════════════════════════
   PUBLIC API
   ═════════════════════════════════════════════════════════════ */

/** Download front + optional back as a PDF file */
export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");
  const pdf = await buildPDF(front, back, scale);
  pdf.save(fileName);
};

/** Open PDF in a new browser tab */
export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");
  const pdf  = await buildPDF(front, back, scale);
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
};

/** Return PDF as a Blob (for upload / email) */
export const getCapturedPDFBlob = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");
  const pdf = await buildPDF(front, back, scale);
  return pdf.output("blob");
};

/** Download front + back as separate PNG image files
 *  — this is the export Accreditations.jsx was missing */
export const downloadBothCardsAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card not found");

  /* Front image */
  const frontCanvas = await captureElement(front, scale);
  const frontLink   = document.createElement("a");
  frontLink.download = `${baseName}_front.png`;
  frontLink.href     = frontCanvas.toDataURL("image/png", 1.0);
  frontLink.click();

  /* Back image */
  if (back) {
    await new Promise((r) => setTimeout(r, 300));
    const backCanvas = await captureElement(back, scale);
    const backLink   = document.createElement("a");
    backLink.download = `${baseName}_back.png`;
    backLink.href     = backCanvas.toDataURL("image/png", 1.0);
    backLink.click();
  }
};

/** Alias — some components import this name instead */
export const downloadAsImages = downloadBothCardsAsImages;
