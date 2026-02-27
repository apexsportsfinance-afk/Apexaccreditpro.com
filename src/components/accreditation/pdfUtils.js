import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────
   PAPER SIZES (mm)
───────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
  a6:   { width: 105,  height: 148, label: "A6 (105×148 mm)" },
  a5:   { width: 148,  height: 210, label: "A5 (148×210 mm)" },
  a4:   { width: 210,  height: 297, label: "A4 (210×297 mm)" }
};

/* ─────────────────────────────────────────────
   IMAGE QUALITY (600 DPI default)
───────────────────────────────────────────── */
export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD" },
  p1280: { scale: 4,    label: "1280" },
  "4k":  { scale: 6.25, label: "4K (600 DPI)" }
};

const CARD_WIDTH_PX  = 320;
const CARD_HEIGHT_PX = 454;

/* ─────────────────────────────────────────────
   Wait for images
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
   Capture LIVE element
───────────────────────────────────────────── */
const captureLiveElement = async (el, scale) => {
  await waitForImages(el);

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
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 30000,
      scrollX: -scrollX,
      scrollY: -scrollY
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
   Add card image centered into selected page
───────────────────────────────────────────── */
const addCardToPDF = (pdf, canvas, pageWidth, pageHeight) => {
  const imgRatio  = CARD_WIDTH_PX / CARD_HEIGHT_PX;
  const pageRatio = pageWidth / pageHeight;

  let renderWidth, renderHeight;

  if (imgRatio > pageRatio) {
    renderWidth  = pageWidth;
    renderHeight = pageWidth / imgRatio;
  } else {
    renderHeight = pageHeight;
    renderWidth  = pageHeight * imgRatio;
  }

  const x = (pageWidth  - renderWidth)  / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(
    canvas.toDataURL("image/png", 1),
    "PNG",
    x,
    y,
    renderWidth,
    renderHeight,
    undefined,
    "FAST"
  );
};

/* ─────────────────────────────────────────────
   Build PDF based on selected size
───────────────────────────────────────────── */
const buildPDF = async (
  frontId,
  backId,
  scale,
  selectedSize = "card"
) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found`);

  const size = PDF_SIZES[selectedSize] || PDF_SIZES.card;

  const pdf = new jsPDF({
    orientation: size.height >= size.width ? "portrait" : "landscape",
    unit: "mm",
    format: [size.width, size.height],
    compress: true
  });

  const frontCanvas = await captureLiveElement(frontEl, scale);
  addCardToPDF(pdf, frontCanvas, size.width, size.height);

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([size.width, size.height]);
      const backCanvas = await captureLiveElement(backEl, scale);
      addCardToPDF(pdf, backCanvas, size.width, size.height);
    }
  }

  return pdf;
};

/* ─────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────── */

export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName,
  scale = IMAGE_SIZES["4k"].scale,
  selectedSize = "card"
) => {
  const pdf = await buildPDF(frontId, backId, scale, selectedSize);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId,
  backId,
  scale = IMAGE_SIZES["4k"].scale,
  selectedSize = "card"
) => {
  const pdf = await buildPDF(frontId, backId, scale, selectedSize);
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
    a2.download = `${base
