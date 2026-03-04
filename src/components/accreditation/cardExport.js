import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import React from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "./AccreditationCardPreview";
import QRCode from "qrcode";

const CARD_W_PX = 320;
const CARD_H_PX = 454;

export const PDF_SIZES = {
  card: { width: 85.6, height: 54, label: "ID Card (85.6×54 mm)" },
  a6: { width: 105, height: 148, label: "A6 (105×148 mm)" },
  a5: { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a4: { width: 210, height: 297, label: "A4 (210×297 mm)" },
};

export const IMAGE_SIZES = {
  low: { scale: 1, label: "Low Quality" },
  hd: { scale: 2, label: "HD" },
  p1280: { scale: 4, label: "1280p" },
  "4k": { scale: 6.25, label: "600 DPI" },
};

const urlToBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith("data:")) return resolve(url);
    if (url.startsWith("blob:")) return resolve(url);

    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.onerror = () => res(null);
            reader.readAsDataURL(blob);
          })
      )
      .then((b64) => {
        if (b64) return resolve(b64);
        throw new Error();
      })
      .catch(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => {
          img.onload = img.onerror = null;
          resolve(null);
        }, 8000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth || 1;
            c.height = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => {
          clearTimeout(t);
          resolve(null);
        };
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
      });
  });

const inlineAllImages = async (container) => {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const b64 = await urlToBase64(src);
      if (b64) {
        img.setAttribute("src", b64);
      } else {
        img.style.visibility = "hidden";
      }
    })
  );
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 3000);
        })
    )
  );
};

const renderOffscreenCard = (accreditation, event, zones) =>
  new Promise((resolve, reject) => {
    const SUFFIX = `_cap_${Date.now()}`;

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;" +
      "left:-9999px;" +
      "top:0;" +
      "width:700px;" +
      "height:960px;" +
      "overflow:visible;" +
      "visibility:visible;" +
      "opacity:1;" +
      "z-index:-1;" +
      "pointer-events:none;";
    document.body.appendChild(container);

    const root = createRoot(container);

    const cleanup = () => {
      try {
        root.unmount();
      } catch (_) {}
      try {
        if (container.parentNode) document.body.removeChild(container);
      } catch (_) {}
    };

    root.render(
      React.createElement(CardInner, {
        accreditation,
        event,
        zones,
        idSuffix: SUFFIX,
      })
    );

    let attempts = 0;
    const MAX = 80;

    const poll = async () => {
      attempts++;
      if (attempts > MAX) {
        cleanup();
        return reject(new Error("Card render timed out. Please try again."));
      }

      const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
      const backEl = document.getElementById(`accreditation-back-card${SUFFIX}`);

      if (!frontEl || frontEl.getBoundingClientRect().width === 0) {
        return setTimeout(poll, 100);
      }

      await inlineAllImages(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 200));

      resolve({ frontEl, backEl, cleanup });
    };

    setTimeout(poll, 100);
  });

const captureEl = async (el, scale) => {
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 30000,
    removeContainer: true,
    width: CARD_W_PX,
    height: CARD_H_PX,
    windowWidth: CARD_W_PX,
    windowHeight: CARD_H_PX,
  });

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Canvas capture failed. Please try again.");
  }

  return canvas;
};

export const buildPDF = async (accreditation, event, zones, scale, sizeKey) => {
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const isLandscape = size.width > size.height;

  const { frontEl, backEl, cleanup } = await renderOffscreenCard(
    accreditation,
    event,
    zones
  );

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [size.width, size.height],
    compress: true,
  });

  try {
    const frontCanvas = await captureEl(frontEl, scale);
    pdf.addImage(
      frontCanvas.toDataURL("image/png", 1.0),
      "PNG",
      0,
      0,
      size.width,
      size.height,
      undefined,
      "FAST"
    );

    if (backEl) {
      pdf.addPage([size.width, size.height], isLandscape ? "landscape" : "portrait");
      const backCanvas = await captureEl(backEl, scale);
      pdf.addImage(
        backCanvas.toDataURL("image/png", 1.0),
        "PNG",
        0,
        0,
        size.width,
        size.height,
        undefined,
        "FAST"
      );
    }
  } finally {
    cleanup();
  }

  return pdf;
};

const captureCardDataUrls = async (accreditation, event, zones, scale) => {
  const { frontEl, backEl, cleanup } = await renderOffscreenCard(
    accreditation,
    event,
    zones
  );

  let frontDataUrl = null;
  let backDataUrl = null;

  try {
    const frontCanvas = await captureEl(frontEl, scale);
    frontDataUrl = frontCanvas.toDataURL("image/png", 1.0);

    if (backEl) {
      const backCanvas = await captureEl(backEl, scale);
      backDataUrl = backCanvas.toDataURL("image/png", 1.0);
    }
  } finally {
    cleanup();
  }

  return { frontDataUrl, backDataUrl };
};

export const downloadCardPDF = async (
  accreditation,
  event,
  zones,
  fileName,
  scale = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  pdf.save(fileName);
};

export const openCardPDF = async (
  accreditation,
  event,
  zones,
  scale = IMAGE_SIZES["4k"].scale,
  sizeKey = "a6"
) => {
  const pdf = await buildPDF(accreditation, event, zones, scale, sizeKey);
  const url = pdf.output("bloburl");
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
};

export const printCard = async (
  accreditation,
  event,
  zones,
  scale = IMAGE_SIZES["hd"].scale,
  sizeKey = "a6"
) => {
  const { frontDataUrl, backDataUrl } = await captureCardDataUrls(
    accreditation,
    event,
    zones,
    scale
  );

  const PAGE_W_MM = 85.6;
  const PAGE_H_MM = parseFloat(((CARD_H_PX / CARD_W_PX) * PAGE_W_MM).toFixed(2));

  const backPageHtml = backDataUrl
    ? `<div class="page"><img src="${backDataUrl}"></div>`
    : "";

  const printHtml = `<!DOCTYPE html>
<html>
<head>
<title>Accreditation Card</title>
<style>
@page { size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm; margin: 0; }
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${PAGE_W_MM}mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; display: flex; align-items: center; justify-content: center; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: avoid; }
img { width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; display: block; object-fit: fill; }
</style>
</head>
<body>
<div class="page"><img src="${frontDataUrl}"></div>
${backPageHtml}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHtml);
  iframeDoc.close();

  await new Promise((resolve) => {
    const images = Array.from(iframeDoc.querySelectorAll("img"));
    if (!images.length) return resolve();
    let loaded = 0;
    const done = () => {
      if (++loaded >= images.length) resolve();
    };
    images.forEach((img) => {
      if (img.complete) {
        done();
        return;
      }
      img.onload = done;
      img.onerror = done;
    });
    setTimeout(resolve, 5000);
  });

  await new Promise((r) => setTimeout(r, 250));

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    const pw = window.open("", "_blank");
    if (pw) {
      pw.document.write(printHtml);
      pw.document.close();
      setTimeout(() => {
        pw.focus();
        pw.print();
        pw.close();
      }, 600);
    }
  }

  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 30000);
};

export const downloadAsImages = async (
  accreditation,
  event,
  zones,
  baseName,
  scale = IMAGE_SIZES["4k"].scale
) => {
  const { frontDataUrl, backDataUrl } = await captureCardDataUrls(
    accreditation,
    event,
    zones,
    scale
  );

  const a1 = document.createElement("a");
  a1.download = `${baseName}_front.png`;
  a1.href = frontDataUrl;
  document.body.appendChild(a1);
  a1.click();
  document.body.removeChild(a1);

  if (backDataUrl) {
    await new Promise((r) => setTimeout(r, 500));
    const a2 = document.createElement("a");
    a2.download = `${baseName}_back.png`;
    a2.href = backDataUrl;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
  }
};

/**
 * Bulk download PDFs for multiple accreditations as a ZIP archive
 */
export const bulkDownloadPDFs = async (
  accreditations,
  event,
  zones,
  sizeKey = "a6"
) => {
  if (!accreditations || accreditations.length === 0) return;

  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const scale = IMAGE_SIZES["4k"].scale;

    for (let i = 0; i < accreditations.length; i++) {
      const acc = accreditations[i];
      try {
        const pdf = await buildPDF(acc, event, zones, scale, sizeKey);
        const pdfBlob = pdf.output("blob");
        const fileName = `${acc.firstName || "Unknown"}_${acc.lastName || "Unknown"}_${acc.badgeNumber || acc.id || i}.pdf`;
        zip.file(fileName, pdfBlob);
      } catch (err) {
        console.warn(`Failed to generate PDF for ${acc.firstName} ${acc.lastName}:`, err);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accreditations-${event?.name || "cards"}-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error("Bulk download error:", err);
    throw new Error("Failed to create bulk download: " + (err.message || "Unknown error"));
  }
};

export default {
  PDF_SIZES,
  IMAGE_SIZES,
  downloadCardPDF,
  openCardPDF,
  printCard,
  downloadAsImages,
  bulkDownloadPDFs,
};
