import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ─────────────────────────────────────────────
   PDF PAGE SIZES (mm)
───────────────────────────────────────────── */
export const PDF_SIZES = {
  card: { width: 85.6, height: 54, label: "ID Card (85.6×54 mm)" },
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

const captureElement = async (el, scale) => {
  await waitForImages(el);

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false
  });

  if (!canvas || canvas.width === 0) {
    throw new Error(`Canvas capture failed for #${el.id}`);
  }

  return canvas;
};

const addCenteredImageToPDF = (pdf, canvas, pageWidth, pageHeight) => {
  const imgRatio = canvas.width / canvas.height;
  const pageRatio = pageWidth / pageHeight;

  let renderWidth, renderHeight;

  if (imgRatio > pageRatio) {
    renderWidth = pageWidth;
    renderHeight = pageWidth / imgRatio;
  } else {
    renderHeight = pageHeight;
    renderWidth = pageHeight * imgRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
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

const buildPDF = async (frontId, backId, scale, selectedSize) => {
  const frontEl = document.getElementById(frontId);
  if (!frontEl) throw new Error(`#${frontId} not found`);

  const size = PDF_SIZES[selectedSize] || PDF_SIZES.card;

  const pdf = new jsPDF({
    unit: "mm",
    format: [size.width, size.height],
    orientation: size.height >= size.width ? "portrait" : "landscape",
    compress: true
  });

  const frontCanvas = await captureElement(frontEl, scale);
  addCenteredImageToPDF(pdf, frontCanvas, size.width, size.height);

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      pdf.addPage([size.width, size.height]);
      const backCanvas = await captureElement(backEl, scale);
      addCenteredImageToPDF(pdf, backCanvas, size.width, size.height);
    }
  }

  return pdf;
};

/* ─────────────────────────────────────────────
   PUBLIC EXPORTS
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
  if (!frontEl) throw new Error(`#${frontId} not found`);

  const frontCanvas = await captureElement(frontEl, scale);

  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontCanvas.toDataURL("image/png", 1);
  a1.click();

  if (backId) {
    const backEl = document.getElementById(backId);
    if (backEl) {
      const backCanvas = await captureElement(backEl, scale);
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backCanvas.toDataURL("image/png", 1);
      a2.click();
    }
  }
};
