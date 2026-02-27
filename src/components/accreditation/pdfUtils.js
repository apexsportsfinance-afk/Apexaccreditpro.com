import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────
   IMAGE / DPI PRESETS
   96 DPI  = scale 1
   192 DPI = scale 2
   384 DPI = scale 4
   600 DPI = scale 6.25 ✅
───────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD" },
  p1280: { scale: 4,    label: "1280" },
  "4k":  { scale: 6.25, label: "4K (600 DPI)" }
};

/* ─────────────────────────────────────────────
   WAIT FOR ALL IMAGES INSIDE ELEMENT
───────────────────────────────────────────── */
const waitForImages = async (root) => {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      img =>
        new Promise(res => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.onload = img.onerror = res;
        })
    )
  );
};

/* ─────────────────────────────────────────────
   CAPTURE LIVE ELEMENT (NO CLONES ❗)
   ✅ This fixes your error permanently
───────────────────────────────────────────── */
const captureLiveElement = async (el, scale) => {
  const CARD_W = 320;
  const CARD_H = 454;

  await waitForImages(el);

  // Temporarily remove overflow clipping from parents
  const parents = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    parents.push({ el: node, overflow: node.style.overflow });
    node.style.overflow = "visible";
    node = node.parentElement;
  }

  const rect = el.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let canvas;
  try {
    canvas = await html2canvas(document.body, {
      scale,
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: CARD_W,
      height: CARD_H,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 30000,
      scrollX: -scrollX,
      scrollY: -scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    });
  } finally {
    parents.forEach(p => (p.el.style.overflow = p.overflow));
  }

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error(`Canvas capture failed for #${el.id}`);
  }

  return canvas;
};

/* ─────────────────────────────────────────────
   BUILD PDF (EXACT CARD SIZE)
───────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found`);

  const CARD_W = 320;
  const CARD_H = 454;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [CARD_W, CARD_H],
    compress: true,
    hotfixes: ["px_scaling"]
  });

  const frontCanvas = await captureLiveElement(frontEl, scale);
  pdf.addImage(
    frontCanvas.toDataURL("image/png", 1),
    "PNG",
    0,
    0,
    CARD_W,
    CARD_H,
    undefined,
    "FAST"
  );

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([CARD_W, CARD_H]);
      const backCanvas = await captureLiveElement(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1),
        "PNG",
        0,
        0,
        CARD_W,
        CARD_H,
        undefined,
        "FAST"
      );
    }
  }

  return pdf;
};

/* ─────────────────────────────────────────────
   PUBLIC API (USED BY YOUR UI)
───────────────────────────────────────────── */
export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const pdf = await buildPDF(frontId, backId, scale);
  window.open(pdf.output("bloburl"), "_blank");
};

export const downloadAsImages = async (
  frontId,
  backId,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const front = document.getElementById(frontId);
  const back  = backId ? document.getElementById(backId) : null;

  const frontCanvas = await captureLiveElement(front, scale);
  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1);
  a1.click();

  if (back) {
    const backCanvas = await captureLiveElement(back, scale);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = backCanvas.toDataURL("image/png", 1);
    a2.click();
  }
};
