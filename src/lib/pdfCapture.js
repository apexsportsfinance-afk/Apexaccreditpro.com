import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ---------- Paper sizes in mm ---------- */
export const PDF_SIZES = {
  a4: { width: 210, height: 297, label: "A4 (210x297 mm)" },
  a5: { width: 148, height: 210, label: "A5 (148x210 mm)" },
  a6: { width: 105, height: 148, label: "A6 (105x148 mm)" },
  card: { width: 85.6, height: 54, label: "ID Card (85.6x54 mm)" }
};

export const IMAGE_SIZES = {
  small: { scale: 1 },
  medium: { scale: 2 },
  large: { scale: 3 },
  xlarge: { scale: 4 }
};

/* ---------- Internal helpers ---------- */
const waitForImages = async (el) => {
  const imgs = el.querySelectorAll("img");
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        img.complete ||
        new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        })
    )
  );
};

/* ---------- 600 DPI capture ---------- */
const CAPTURE_DPI = 600;
const CSS_DPI = 96;
const DPI_SCALE = CAPTURE_DPI / CSS_DPI; // ≈ 6.25

const captureElement = async (element) => {
  await waitForImages(element);

  return await html2canvas(element, {
    scale: DPI_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false
  });
};

/* ---------- Build PDF from preview ---------- */
const buildPDF = async (frontEl, backEl) => {
  const widthPx = frontEl.offsetWidth;
  const heightPx = frontEl.offsetHeight;

  const pdf = new jsPDF({
    orientation: heightPx >= widthPx ? "portrait" : "landscape",
    unit: "px",
    format: [widthPx, heightPx],
    compress: true
  });

  const frontCanvas = await captureElement(frontEl);
  pdf.addImage(
    frontCanvas.toDataURL("image/png"),
    "PNG",
    0,
    0,
    widthPx,
    heightPx
  );

  if (backEl) {
    pdf.addPage([widthPx, heightPx]);
    const backCanvas = await captureElement(backEl);
    pdf.addImage(
      backCanvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      widthPx,
      heightPx
    );
  }

  return pdf;
};

/* ---------- PUBLIC API ---------- */

export const downloadCapturedPDF = async (
  frontId,
  backId,
  fileName
) => {
  const front = document.getElementById(frontId);
  const back = backId ? document.getElementById(backId) : null;

  if (!front) throw new Error("Front card not found");

  const pdf = await buildPDF(front, back);
  pdf.save(fileName);
};

export const openCapturedPDFInTab = async (
  frontId,
  backId
) => {
  const front = document.getElementById(frontId);
  const back = backId ? document.getElementById(backId) : null;

  if (!front) throw new Error("Front card not found");

  const pdf = await buildPDF(front, back);
  const blob = pdf.output("bloburl");
  window.open(blob, "_blank");
};

export const getCapturedPDFBlob = async (
  frontId,
  backId
) => {
  const front = document.getElementById(frontId);
  const back = backId ? document.getElementById(backId) : null;

  if (!front) throw new Error("Front card not found");

  const pdf = await buildPDF(front, back);
  return pdf.output("blob");
};
