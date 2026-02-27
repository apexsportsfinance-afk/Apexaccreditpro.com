import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────
   PAPER SIZES (mm)
───────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6, height: 54, label: "ID Card" },
  a6: { width: 105, height: 148, label: "A6" },
  a5: { width: 148, height: 210, label: "A5" },
  a4: { width: 210, height: 297, label: "A4" }
};

/* 600 DPI default */
export const IMAGE_SIZES = {
  low: { scale: 1, label: "Low" },
  hd: { scale: 2, label: "HD" },
  p1280: { scale: 4, label: "1280" },
  "4k": { scale: 6.25, label: "600 DPI" }
};

const CARD_W = 320;
const CARD_H = 454;

/* ─────────────────────────────────────────────
   WAIT FOR IMAGES
───────────────────────────────────────────── */
const waitForImages = async (root) => {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.onload = img.onerror = res;
        })
    )
  );
};

/* ─────────────────────────────────────────────
   ENGINE 1: Isolated container capture (PRIMARY)
───────────────────────────────────────────── */
const captureUsingIsolatedContainer = async (el, scale) => {
  const wrapper = document.createElement("div");

  Object.assign(wrapper.style, {
    position: "fixed",
    top: "-10000px",
    left: "-10000px",
    width: CARD_W + "px",
    height: CARD_H + "px",
    overflow: "visible",
    background: "#ffffff",
    zIndex: "-1"
  });

  const clone = el.cloneNode(true);

  Object.assign(clone.style, {
    width: CARD_W + "px",
    height: CARD_H + "px",
    transform: "none"
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  await waitForImages(wrapper);
  await new Promise((r) => setTimeout(r, 100));

  let canvas;
  try {
    canvas = await html2canvas(wrapper, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  if (!canvas || canvas.width === 0) {
    throw new Error("Engine1 failed");
  }

  return canvas;
};

/* ─────────────────────────────────────────────
   ENGINE 2: Direct element capture (FALLBACK)
───────────────────────────────────────────── */
const captureDirect = async (el, scale) => {
  await waitForImages(el);

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false
  });

  if (!canvas || canvas.width === 0) {
    throw new Error("Engine2 failed");
  }

  return canvas;
};

/* ─────────────────────────────────────────────
   SMART CAPTURE (tries both)
───────────────────────────────────────────── */
const smartCapture = async (el, scale) => {
  try {
    return await captureUsingIsolatedContainer(el, scale);
  } catch (e1) {
    try {
      return await captureDirect(el, scale);
    } catch (e2) {
      throw new Error("All capture engines failed");
    }
  }
};

/* ─────────────────────────────────────────────
   Add card centered to page
───────────────────────────────────────────── */
const addCardToPDF = (pdf, canvas, pageW, pageH) => {
  const ratio = CARD_W / CARD_H;
  const pageRatio = pageW / pageH;

  let renderW, renderH;

  if (ratio > pageRatio) {
    renderW = pageW;
    renderH = pageW / ratio;
  } else {
    renderH = pageH;
    renderW = pageH * ratio;
  }

  const x = (pageW - renderW) / 2;
  const y = (pageH - renderH) / 2;

  pdf.addImage(
    canvas.toDataURL("image/png", 1),
    "PNG",
    x,
    y,
    renderW,
    renderH,
    undefined,
    "FAST"
  );
};

/* ─────────────────────────────────────────────
   BUILD PDF
───────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale, sizeKey) => {
  const front = document.getElementById(frontId);
  if (!front) throw new Error("Front card not found");

  const size = PDF_SIZES[sizeKey] || PDF_SIZES.card;

  const pdf = new jsPDF({
    unit: "mm",
    format: [size.width, size.height],
    orientation: size.height >= size.width ? "portrait" : "landscape"
  });

  const frontCanvas = await smartCapture(front, scale);
  addCardToPDF(pdf, frontCanvas, size.width, size.height);

  if (backId) {
    const back = document.getElementById(backId);
    if (back) {
      pdf.addPage([size.width, size.height]);
      const backCanvas = await smartCapture(back, scale);
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
