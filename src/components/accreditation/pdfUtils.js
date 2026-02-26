import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ── paper size presets (kept for external use) ─────────── */
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

/* ── wait for every <img> inside an element to load ─────── */
const waitForImages = (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => { img.onload = res; img.onerror = res; })
    )
  );
};

/* ── capture one DOM element → canvas at 600 DPI ────────── */
const SCALE = 600 / 96; // ≈ 6.25 — 600 DPI equivalent

const captureElement = async (el) => {
  await waitForImages(el);

  return html2canvas(el, {
    scale:SCALE,
    backgroundColor: "#ffffff",
    useCORS:         true,
    allowTaint:      false,
    logging:         false,
    // Freeze the element's own scroll position so nothing shifts
    scrollX:  -window.scrollX,
    scrollY:  -window.scrollY,
    onclone: (doc, clone) => {
      // Remove box-shadow so it doesn't bleed into the PDF image
      clone.style.boxShadow = "none";
      clone.style.borderRadius = "0";
    },
  });
};

/* ── build a jsPDF whose page size == card pixel size ────── */
const buildPDF = async (frontEl, backEl) => {
  const w = frontEl.offsetWidth;
  const h = frontEl.offsetHeight;

  const pdf = new jsPDF({
    orientation: h >= w ? "portrait" : "landscape",
    unit:        "px",
    format:      [w, h],   // page = exact card size → zero margins
    compress:    true,
  });

  // Front page
  const frontCanvas = await captureElement(frontEl);
  pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", 0, 0, w, h);

  // Back page (optional)
  if (backEl) {
    pdf.addPage([w, h]);
    const backCanvas = await captureElement(backEl);
    pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
  }

  return pdf;
};

/* ══════════════════════════════════════════════════════════PUBLIC API══════════════════════════════════════════════════════════ */

/**
 * Download front (+ optional back) card as a PDF.
 * @param {string} frontId   - id of the front card DOM element
 * @param {string|null} backId - id of the back card DOM element (or null)
 * @param {string} fileName  - e.g. "John_Doe_Badge.pdf"
 */
export const downloadCapturedPDF = async (frontId, backId, fileName) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf = await buildPDF(front, back);
  pdf.save(fileName);
};

/**
 * Open the PDF in a new browser tab.
 */
export const openCapturedPDFInTab = async (frontId, backId) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf  = await buildPDF(front, back);
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
};

/**
 * Return the PDF as a Blob (useful for upload / email).
 */
export const getCapturedPDFBlob = async (frontId, backId) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error(`Element #${frontId} not found`);

  const pdf = await buildPDF(front, back);
  return pdf.output("blob");
};
