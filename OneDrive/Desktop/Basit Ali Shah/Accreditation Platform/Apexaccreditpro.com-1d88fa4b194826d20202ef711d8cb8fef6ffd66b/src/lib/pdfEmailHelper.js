/**
 * Shared PDF generation utilities for email attachments.
 * Used by both ComposeEmailModal and Accreditations approval flow.
 */

let jsPDF = null;
let html2canvas = null;
let CardInner = null;
let ReactModule = null;
let createRoot = null;

/**
 * Lazy-load libraries once
 */
async function initLibs() {
  if (jsPDF && html2canvas && CardInner && ReactModule && createRoot) return;
  const jspdfModule = await import("jspdf");
  jsPDF = jspdfModule.jsPDF;
  html2canvas = (await import("html2canvas")).default;
  const cardModule = await import("../components/accreditation/AccreditationCardPreview");
  CardInner = cardModule.CardInner;
  ReactModule = await import("react");
  const reactDomModule = await import("react-dom/client");
  createRoot = reactDomModule.createRoot;
}

/**
 * Generate a PDF blob for an accreditation card (offscreen render + capture)
 */
export const generatePdfForAccreditation = async (accreditation, event, zones) => {
  await initLibs();

  const SUFFIX = `_email_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:700px;height:960px;overflow:visible;visibility:visible;opacity:1;z-index:-1;pointer-events:none;";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    ReactModule.createElement(CardInner, {
      accreditation,
      event,
      zones,
      idSuffix: SUFFIX,
    })
  );

  // Wait for initial render
  await new Promise((r) => setTimeout(r, 150));

  // Polling for QR code with faster interval
  await new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const qrImg = container.querySelector("img[data-qr-code='true']");
      if (qrImg && qrImg.getAttribute("src")?.startsWith("data:")) {
        return resolve(true);
      }
      if (Date.now() - start > 5000) {
        return resolve(false);
      }
      setTimeout(check, 30);
    };
    check();
  });

  const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
  const backEl = document.getElementById(`accreditation-back-card${SUFFIX}`);

  if (!frontEl) {
    root.unmount();
    container.remove();
    throw new Error("Card render failed");
  }

  // Inline images to base64 for html2canvas
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      try {
        const resp = await fetch(src, { mode: "cors", cache: "force-cache", credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          const reader = new FileReader();
          const b64 = await new Promise((res) => {
            reader.onloadend = () => res(reader.result);
            reader.onerror = () => res(null);
            reader.readAsDataURL(blob);
          });
          if (b64) img.setAttribute("src", b64);
        }
      } catch {
        /* skip */
      }
    })
  );

  // Final minor wait for layout stability
  await new Promise((r) => setTimeout(r, 100));

  const captureOpts = {
    scale: 3.125, // Updated to 3.125 for 300 DPI support
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: 320,
    height: 454,
    windowWidth: 320,
    windowHeight: 454,
  };

  const frontCanvas = await html2canvas(frontEl, captureOpts);

  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: [105, 148],
    compress: true,
  });

  pdf.addImage(frontCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 105, 148, undefined, "FAST");

  if (backEl) {
    const backCanvas = await html2canvas(backEl, captureOpts);
    pdf.addPage([105, 148], "portrait");
    pdf.addImage(backCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 105, 148, undefined, "FAST");
  }

  root.unmount();
  container.remove();

  return pdf;
};

/**
 * Convert a jsPDF blob to raw base64 string (without data: prefix)
 */
export const blobToRawBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      // Remove "data:application/pdf;base64,"
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Generate PDF and return base64 + filename ready for email attachment
 * Returns { pdfBase64, pdfFileName } or null if generation fails
 */
export const generatePdfAttachment = async (accreditation, event, zones) => {
  try {
    const pdf = await generatePdfForAccreditation(accreditation, event, zones);
    const pdfBlob = pdf.output("blob");
    const pdfBase64 = await blobToRawBase64(pdfBlob);
    const pdfFileName = `${accreditation.firstName}_${accreditation.lastName}_Accreditation_${accreditation.badgeNumber || "card"}.pdf`;
    return { pdfBase64, pdfFileName };
  } catch (err) {
    console.warn(`[PDF] Generation failed for ${accreditation.firstName} ${accreditation.lastName}:`, err);
    return null;
  }
};
