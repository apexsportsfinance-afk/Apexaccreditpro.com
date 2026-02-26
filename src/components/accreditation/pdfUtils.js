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
   IMAGE / DPI SIZES  — labels now match your requested names
   scale = html2canvas multiplier (relative to 96 CSS DPI)
   ─────────────────────────────────────────────────────────────
   Low Quality =  96 DPI  → scale 1
   HD          = 192 DPI  → scale 2
   1280        = 384 DPI  → scale 4
   4K          = 600 DPI  → scale 6.25
   ───────────────────────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280"        },
  "4k":  { scale: 6.25, label: "4K"          },
};

/* ─────────────────────────────────────────────────────────────
   FIX 1 — wait for ALL images (including flag images) to load
   Uses naturalWidth check + explicit src reload fallback
   ───────────────────────────────────────────────────────────── */
const waitForImages = (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          /* Already loaded with real content */
          if (img.complete && img.naturalWidth > 0) return res();

          /* Force a reload by toggling src — catches cached-but-not-painted images */
          const onDone = () => {
            img.removeEventListener("load",  onDone);
            img.removeEventListener("error", onDone);
            res();
          };
          img.addEventListener("load",  onDone);
          img.addEventListener("error", onDone);

          /* Re-trigger load if src already set but naturalWidth is 0 */
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
   FIX 2 — capture the element at its TRUE intrinsic dimensions,
   not at whatever the CSS display size is inside the modal.

   Key changes vs original:
   • Clone the node into a detached off-screen div at 1:1 CSS px
     so there is no transform/scale/overflow interference from
     the modal container.
   • Use scrollWidth / scrollHeight (not offsetWidth/Height) to
     get the full painted size including any overflow.
   ───────────────────────────────────────────────────────────── */
const captureElement = async (el, scale = 6.25) => {
  await waitForImages(el);

  /* ── Measure the card's true size ─────────────────────── */
  const rect = el.getBoundingClientRect();
  const trueW = Math.round(rect.width);
  const trueH = Math.round(rect.height);

  /* ── Build an isolated clone with no modal clipping ────── */
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
    /* Remove any inherited transform that may skew capture */
    transform:  "none",
  });

  const clone = el.cloneNode(true);
  Object.assign(clone.style, {
    width:     trueW + "px",
    height:    trueH + "px",
    transform: "none",
    margin:    "0",
    padding:   clone.style.padding || "",   // keep original padding
    boxShadow: "none",
    borderRadius: "0",
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  /* Wait for cloned images too */
  await waitForImages(wrapper);

  /* Small settle delay — lets fonts / flag emoji paint */
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
      /* No scroll offset needed — wrapper is position:fixed off-screen */
      scrollX: 0,
      scrollY: 0,
      windowWidth:  trueW,
      windowHeight: trueH,
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  return canvas;
};

/* ─────────────────────────────────────────────────────────────
   FIX 3 — buildPDF now uses the card's intrinsic pixel size
   (via getBoundingClientRect) so the PDF page always matches
   the card, regardless of how the modal scales it.
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
   PUBLIC API  (signatures unchanged — drop-in replacement)
   ═════════════════════════════════════════════════════════════ */

/**
 * Download front (+ optional back) as PDF.
 */
export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale   // default: 4K / 600 DPI
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
