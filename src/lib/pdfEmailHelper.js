import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as ReactModule from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "../components/accreditation/AccreditationCardPreview";

/**
 * Shared PDF generation utilities for email attachments.
 * Used by both ComposeEmailModal and Accreditations approval flow.
 */

/**
 * Generate a PDF blob for an accreditation card (offscreen render + capture)
 */
export const generatePdfForAccreditation = async (accreditation, event, zones, pdfSize = "a6") => {
  
  // Get dimensions from pdfCapture or fallback to A6
  const { PDF_SIZES } = await import("./pdfCapture");
  const size = PDF_SIZES[pdfSize?.toLowerCase()] || PDF_SIZES.a6;
  const unit = pdfSize === "card" ? "pt" : "mm";
  const pdfW = size.width;
  const pdfH = size.height;

  let frontBackgroundUrl = "";
  let customFieldConfigs = [];
  try {
    const { GlobalSettingsAPI } = await import("./broadcastApi");
    if (event?.id) {
      const [bg, cf] = await Promise.all([
        GlobalSettingsAPI.get(`event_${event.id}_front_bg`),
        GlobalSettingsAPI.get(`event_${event.id}_custom_fields`)
      ]);
      if (bg) frontBackgroundUrl = bg;
      if (cf) {
        try {
          customFieldConfigs = JSON.parse(cf);
        } catch (e) {
          console.error("[pdfEmailHelper] Failed to parse custom fields:", e);
        }
      }
    }
  } catch (e) {}

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
      frontBackgroundUrl,
      customFieldConfigs
    })
  );

  // Wait for initial render and React reconciliation
  await new Promise((r) => setTimeout(r, 150));

  // Polling for QR code with faster interval
  await new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      // The data-qr-code='true' attribute is on the div wrapper in CardInner
      const qrImg = container.querySelector("[data-qr-code='true'] img");
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

  // Final minor wait for layout stability and font settling
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
    orientation: pdfW > pdfH ? "l" : "p",
    unit,
    format: [pdfW, pdfH],
    compress: true,
  });

  pdf.addImage(frontCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");

  if (backEl) {
    const backCanvas = await html2canvas(backEl, captureOpts);
    pdf.addPage([pdfW, pdfH], pdfW > pdfH ? "l" : "p");
    pdf.addImage(backCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");
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
 * Generate image blobs for an accreditation card (offscreen render + capture)
 */
export const generateImagesForAccreditation = async (accreditation, event, zones, scale = 4) => {
  
  let frontBackgroundUrl = "";
  let customFieldConfigs = [];
  try {
    const { GlobalSettingsAPI } = await import("./broadcastApi");
    if (event?.id) {
      const [bg, cf] = await Promise.all([
        GlobalSettingsAPI.get(`event_${event.id}_front_bg`),
        GlobalSettingsAPI.get(`event_${event.id}_custom_fields`)
      ]);
      if (bg) frontBackgroundUrl = bg;
      if (cf) {
        try {
          customFieldConfigs = JSON.parse(cf);
        } catch (e) {
          console.error("[pdfEmailHelper] Failed to parse custom fields:", e);
        }
      }
    }
  } catch (e) {}

  const SUFFIX = `_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

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
      frontBackgroundUrl,
      customFieldConfigs
    })
  );

  await new Promise((r) => setTimeout(r, 150));

  // Poll for QR
  await new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const qrImg = container.querySelector("[data-qr-code='true'] img");
      if (qrImg && qrImg.getAttribute("src")?.startsWith("data:")) return resolve(true);
      if (Date.now() - start > 5000) return resolve(false);
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

  // Inline images
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute("src") || "";
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
    try {
      const resp = await fetch(src, { mode: "cors", cache: "force-cache" });
      if (resp.ok) {
        const blob = await resp.blob();
        const b64 = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        if (b64) img.setAttribute("src", b64);
      }
    } catch {}
  }));

  const captureOpts = {
    scale,
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
  const frontBlob = await new Promise(res => frontCanvas.toBlob(res, "image/png"));

  let backBlob = null;
  if (backEl) {
    const backCanvas = await html2canvas(backEl, captureOpts);
    backBlob = await new Promise(res => backCanvas.toBlob(res, "image/png"));
  }

  root.unmount();
  container.remove();

  return { frontBlob, backBlob };
};

/**
 * Generate PDF and return base64 + filename ready for email attachment
 * Returns { pdfBase64, pdfFileName } or null if generation fails
 */
export const generatePdfAttachment = async (accreditation, event, zones, pdfSize = "a6") => {
  try {
    const pdf = await generatePdfForAccreditation(accreditation, event, zones, pdfSize);
    const pdfBlob = pdf.output("blob");
    const pdfBase64 = await blobToRawBase64(pdfBlob);
    const pdfFileName = `${accreditation.firstName}_${accreditation.lastName}_Accreditation_${accreditation.badgeNumber || "card"}.pdf`;
    return { pdfBase64, pdfFileName, pdfBlob };
  } catch (err) {
    console.warn(`[PDF] Generation failed for ${accreditation.firstName} ${accreditation.lastName}:`, err);
    return null;
  }
};
