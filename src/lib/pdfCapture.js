import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210x297 mm)", dpi: 72 },
  a5:   { width: 148, height: 210, label: "A5 (148x210 mm)", dpi: 72 },
  a6:   { width: 105, height: 148, label: "A6 (105x148 mm)", dpi: 72 },
  card: { width: 320, height: 454, label: "Exact Card Size", dpi: 96 },
};

export const IMAGE_SIZES = {
  low:    { scale: 1,  label: "Low Quality" },
  medium: { scale: 2,  label: "Medium" },
  hd:     { scale: 3,  label: "HD" },
  high:   { scale: 4,  label: "High" },
  "4k":   { scale: 6,  label: "4K" },
  dpi300: { scale: 3.125, label: "300 DPI" },
};

/**
 * Wait for the QR code data: img to be ready inside an element.
 * Polls every 80ms with an 8-second timeout.
 */
const waitForQRInElement = (element, timeoutMs = 8000) =>
  new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const qrImg = element.querySelector("img[data-qr-code='true']");
      if (qrImg && qrImg.getAttribute("src")?.startsWith("data:")) {
        return resolve(true);
      }
      if (Date.now() - start > timeoutMs) {
        return resolve(false);
      }
      setTimeout(check, 30); // Faster polling
    };
    check();
  });

/**
 * Capture a visible DOM element using html2canvas.
 * Uses cloneNode to avoid detaching the live React element.
 */
const captureElement = async (elementId, scale = 3) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Wait for QR before capturing
  await waitForQRInElement(element, 8000);

  const rect = element.getBoundingClientRect();
  const actualWidth = Math.round(rect.width) || 320;
  const actualHeight = Math.round(rect.height) || 454;

  // Inline all external images to base64 first (prevents CORS taint)
  const imgs = Array.from(element.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute("src") || "";
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
    try {
      const resp = await fetch(src, { mode: "cors", cache: "force-cache", credentials: "omit" });
      if (resp.ok) {
        const blob = await resp.blob();
        const b64 = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.onerror = () => res(null);
          reader.readAsDataURL(blob);
        });
        if (b64) img.setAttribute("src", b64);
      }
    } catch {
      /* skip failed images */
    }
  }));

  // Wait for all images to be loaded
  await Promise.all(imgs.map(img =>
    new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2000);
    })
  ));

  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 60));

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: actualWidth,
    height: actualHeight,
    windowWidth: actualWidth,
    windowHeight: actualHeight,
  });

  return { canvas, width: actualWidth, height: actualHeight };
};

  export const downloadCapturedPDF = async (frontId, backId, fileName, sizeKey = "card") => {
  try {
    const { canvas: frontCanvas, width, height } = await captureElement(frontId, 3);
    const pdfWidth = width;
    const pdfHeight = height;

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? "l" : "p",
      unit: "pt",
      format: [pdfWidth, pdfHeight],
      compress: true,
      putOnlyUsedFonts: true,
      floatPrecision: 16
    });

    pdf.addImage(
      frontCanvas.toDataURL("image/png", 1.0),
      "PNG",
      0, 0, pdfWidth, pdfHeight,
      undefined,
      "MEDIUM"
    );

    if (backId) {
      const { canvas: backCanvas, width: bw, height: bh } = await captureElement(backId, 3);
      pdf.addPage([bw, bh]);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG",
        0, 0, bw, bh,
        undefined,
        "MEDIUM"
      );
    }

    pdf.save(fileName);
  } catch (error) {
    console.error("PDF Error:", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const openCapturedPDFInTab = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);

  const pdf = new jsPDF({
    orientation: width > height ? "l" : "p",
    unit: "pt",
    format: [width, height],
    compress: true
  });

  pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, width, height, undefined, "MEDIUM");

  if (backId) {
    const { canvas: bc, width: bw, height: bh } = await captureElement(backId, 3);
    pdf.addPage([bw, bh]);
    pdf.addImage(bc.toDataURL("image/png", 1.0), "PNG", 0, 0, bw, bh, undefined, "MEDIUM");
  }

  window.open(pdf.output("bloburl"), "_blank");
};

export const getCapturedPDFBlob = async (frontId, backId, sizeKey = "card") => {
  const { canvas, width, height } = await captureElement(frontId, 3);

  const pdf = new jsPDF({
    orientation: width > height ? "l" : "p",
    unit: "pt",
    format: [width, height],
    compress: true
  });

  pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, width, height, undefined, "MEDIUM");

  if (backId) {
    const { canvas: bc, width: bw, height: bh } = await captureElement(backId, 3);
    pdf.addPage([bw, bh]);
    pdf.addImage(bc.toDataURL("image/png", 1.0), "PNG", 0, 0, bw, bh, undefined, "MEDIUM");
  }

  return pdf.output("blob");
};

export const downloadAsImages = async (frontId, backId, baseName, size = "hd") => {
  const scale = IMAGE_SIZES[size]?.scale || 2;

  const { canvas } = await captureElement(frontId, scale);

  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = canvas.toDataURL("image/png", 1.0);
  a1.click();

  if (backId) {
    await new Promise(r => setTimeout(r, 300));
    const { canvas: bc } = await captureElement(backId, IMAGE_SIZES[size]?.scale || 2);
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = bc.toDataURL("image/png", 1.0);
    a2.click();
  }
};

export default {
  PDF_SIZES,
  IMAGE_SIZES,
  downloadCapturedPDF,
  openCapturedPDFInTab,
  getCapturedPDFBlob,
  downloadAsImages
};
