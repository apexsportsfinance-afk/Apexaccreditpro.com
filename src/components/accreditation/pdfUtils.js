import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────
   PAGE SIZES (mm)
───────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6, height: 54, label: "ID Card" },
  a6:   { width: 105,  height: 148, label: "A6" },
  a5:   { width: 148,  height: 210, label: "A5" },
  a4:   { width: 210,  height: 297, label: "A4" }
};

/* 600 DPI default */
export const IMAGE_SIZES = {
  low:   { scale: 1, label: "Low" },
  hd:    { scale: 2, label: "HD" },
  p1280: { scale: 4, label: "1280" },
  "4k":  { scale: 6.25, label: "600 DPI" }
};

/* ─────────────────────────────────────────────
   Wait for all images to load
───────────────────────────────────────────── */
const waitForImages = async (el) => {
  const imgs = Array.from(el.querySelectorAll("img"));
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
   CAPTURE CARD AS IMAGE
───────────────────────────────────────────── */
const captureCardAsImage = async (el, scale) => {
  await waitForImages(el);

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false
  });

  if (!canvas || canvas.width === 0) {
    throw new Error("Image capture failed");
  }

  return canvas.toDataURL("image/png", 1.0);
};

/* ─────────────────────────────────────────────
   BUILD PDF USING IMAGE
───────────────────────────────────────────── */
const buildPDF = async (frontId, backId, scale, sizeKey) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error("Front card not found");

  const size = PDF_SIZES[sizeKey] || PDF_SIZES.card;

  const pdf = new jsPDF({
    orientation: size.height >= size.width ? "portrait" : "landscape",
    unit: "mm",
    format: [size.width, size.height],
    compress: true
  });

  /* FRONT */
  const frontImg = await captureCardAsImage(frontEl, scale);

  pdf.addImage(
    frontImg,
    "PNG",
    0,
    0,
    size.width,
    size.height
  );

  /* BACK */
  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backImg = await captureCardAsImage(backEl, scale);
      pdf.addPage([size.width, size.height]);
      pdf.addImage(
        backImg,
        "PNG",
        0,
        0,
        size.width,
        size.height
      );
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
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error("Front card not found");

  const frontImg = await captureCardAsImage(frontEl, scale);

  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontImg;
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backImg = await captureCardAsImage(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backImg;
      a2.click();
    }
  }
};
