import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ---------- Paper sizes in mm (portrait orientation) ---------- */
export const PDF_SIZES = {
  a4: { width: 210, height: 297, label: "A4 (210x297 mm)" },
  a5: { width: 148, height: 210, label: "A5 (148x210 mm)" },
  a6: { width: 105, height: 148, label: "A6 (105x148 mm)" },
  card: { width: 85.6, height: 54, label: "ID Card (85.6x54 mm)" }
};

export const IMAGE_SIZES = {
  small: { scale: 1, label: "Small (1x)" },
  medium: { scale: 2, label: "Medium (2x)" },
  large: { scale: 3, label: "Large (3x)" },
  xlarge: { scale: 4, label: "XLarge (4x)" }
};

/* ---------- Wait for all images to finish loading ---------- */
const waitForImages = async (element) => {
  const imgs = element.querySelectorAll("img");
  await Promise.all(
    Array.from(imgs).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          })
    )
  );
  await new Promise((r) => setTimeout(r, 200));
};

/* ---------- Core capture using devicePixelRatio ---------- */
const captureElement = async (element, canvasScale) => {
  await waitForImages(element);
  const canvas = await html2canvas(element, {
    scale: canvasScale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    logging: false
  });
  return canvas;
};

/* ---------- Get elements by ID ---------- */
const getCardElements = (frontId, backId) => {
  const front = document.getElementById(frontId);
  const back = backId ? document.getElementById(backId) : null;
  if (!front) throw new Error("Front card element not found: " + frontId);
  return { front, back };
};

/* ---------- Compute the optimal canvas scale ---------- */
const computeScale = (element, size) => {
  const dpr = window.devicePixelRatio || 1;
  const pxPerMm = 96 / 25.4;
  const rect = element.getBoundingClientRect();
  const targetWidthPx = size.width * pxPerMm * dpr;
  const scale = targetWidthPx / rect.width;
  return Math.max(scale, dpr);
};

/* ---------- Build a two-page PDF from front+back ---------- */
const buildPDF = async (frontEl, backEl, size) => {
  const scale = computeScale(frontEl, size);
  const isLandscape = size.width > size.height;
  const orientation = isLandscape ? "landscape" : "portrait";
  const pageW = isLandscape ? size.height : size.width;
  const pageH = isLandscape ? size.width : size.height;

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: [pageW, pageH]
  });

  const frontCanvas = await captureElement(frontEl, scale);
  const frontImg = frontCanvas.toDataURL("image/png", 1.0);
  pdf.addImage(frontImg, "PNG", 0, 0, size.width, size.height, "", "FAST");

  if (backEl) {
    pdf.addPage([pageW, pageH], orientation);
    const backCanvas = await captureElement(backEl, scale);
    const backImg = backCanvas.toDataURL("image/png", 1.0);
    pdf.addImage(backImg, "PNG", 0, 0, size.width, size.height, "", "FAST");
  }

  return pdf;
};

/* ---------- Public API ---------- */

export const captureCardAsPDF = async (
  frontCardId,
  backCardId,
  sizeKey = "a6",
  fileName = "accreditation.pdf"
) => {
  const { front, back } = getCardElements(frontCardId, backCardId);
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const pdf = await buildPDF(front, back, size);
  pdf.save(fileName);
  return true;
};

export const downloadCapturedPDF = async (
  frontId,
  backId,
  name,
  size = "a6"
) => captureCardAsPDF(frontId, backId, size, name);

export const openCapturedPDFInTab = async (
  frontId,
  backId,
  sizeKey = "a6"
) => {
  const { front, back } = getCardElements(frontId, backId);
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const pdf = await buildPDF(front, back, size);
  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const newTab = window.open("", "_blank");
  if (newTab) {
    newTab.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } else {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  }
};

export const getCapturedPDFBlob = async (
  frontCardId,
  backCardId,
  sizeKey = "a6"
) => {
  const { front, back } = getCardElements(frontCardId, backCardId);
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const pdf = await buildPDF(front, back, size);
  return pdf.output("blob");
};

const downloadCanvasAsImage = (canvas, fileName) => {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png", 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadBothCardsAsImages = async (
  frontCardId,
  backCardId,
  baseFileName = "card",
  sizeKey = "medium"
) => {
  const { front, back } = getCardElements(frontCardId, backCardId);
  const sizeOpt = IMAGE_SIZES[sizeKey] || IMAGE_SIZES.medium;

  const frontCanvas = await captureElement(front, sizeOpt.scale);
  downloadCanvasAsImage(frontCanvas, `${baseFileName}_front.png`);

  if (back) {
    const backCanvas = await captureElement(back, sizeOpt.scale);
    downloadCanvasAsImage(backCanvas, `${baseFileName}_back.png`);
  }
};

export const captureCardAsImage = async (cardId) => {
  const el = document.getElementById(cardId);
  if (!el) throw new Error("Element not found: " + cardId);
  const canvas = await captureElement(el, window.devicePixelRatio || 1);
  return canvas.toDataURL("image/png", 1);
};
