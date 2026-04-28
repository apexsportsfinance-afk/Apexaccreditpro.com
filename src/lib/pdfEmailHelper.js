import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as ReactModule from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "../components/accreditation/AccreditationCardPreview";

/**
 * Shared PDF generation utilities for email attachments.
 * Used by both ComposeEmailModal and Accreditations approval flow.
 */

// Simple module-level image cache to speed up repeated generations
const imageCache = new Map();

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
  let onlyFrontPage = false;
  try {
    const { GlobalSettingsAPI } = await import("./broadcastApi");
    if (event?.id) {
      const [bg, cf, onlyFront] = await Promise.all([
        GlobalSettingsAPI.get(`event_${event.id}_front_bg`),
        GlobalSettingsAPI.get(`event_${event.id}_custom_fields`),
        GlobalSettingsAPI.get(`event_${event.id}_only_front_page`)
      ]);
      if (bg) frontBackgroundUrl = bg;
      onlyFrontPage = onlyFront === "true" || onlyFront === true;
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
      customFieldConfigs,
      onlyFrontPage
    })
  );

  // Faster initial wait
  await new Promise((r) => setTimeout(r, 100));

  // Polling for QR code with faster interval and lower timeout
  await new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const qrImg = container.querySelector("[data-qr-code='true'] img");
      if (qrImg && qrImg.getAttribute("src")?.startsWith("data:")) return resolve(true);
      if (Date.now() - start > 3000) return resolve(false); // Reduced from 5s to 3s
      setTimeout(check, 20); // Faster polling
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

  // Inline images with cache support
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      
      // Use cache if available
      if (imageCache.has(src)) {
        img.setAttribute("src", imageCache.get(src));
        return;
      }

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
          if (b64) {
            img.setAttribute("src", b64);
            imageCache.set(src, b64); // Cache for future use
          }
        }
      } catch { /* skip */ }
    })
  );

  await new Promise((r) => setTimeout(r, 50)); // Reduced from 100ms

  const captureOpts = {
    scale: 3.125,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: 320,
    height: 454,
    windowWidth: 320,
    windowHeight: 454,
  };

  // Parallel capture for front and back
  const [frontCanvas, backCanvas] = await Promise.all([
    html2canvas(frontEl, captureOpts),
    backEl ? html2canvas(backEl, captureOpts) : Promise.resolve(null)
  ]);

  const pdf = new jsPDF({
    orientation: pdfW > pdfH ? "l" : "p",
    unit,
    format: [pdfW, pdfH],
    compress: true,
  });

  pdf.addImage(frontCanvas.toDataURL("image/png", 1.0), "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");

  if (backCanvas) {
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
  let onlyFrontPage = false;
  try {
    const { GlobalSettingsAPI } = await import("./broadcastApi");
    if (event?.id) {
      const [bg, cf, onlyFront] = await Promise.all([
        GlobalSettingsAPI.get(`event_${event.id}_front_bg`),
        GlobalSettingsAPI.get(`event_${event.id}_custom_fields`),
        GlobalSettingsAPI.get(`event_${event.id}_only_front_page`)
      ]);
      if (bg) frontBackgroundUrl = bg;
      onlyFrontPage = onlyFront === "true" || onlyFront === true;
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
      customFieldConfigs,
      onlyFrontPage
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
