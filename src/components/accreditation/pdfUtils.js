/**
 * pdfUtils.js — Final Definitive Version
 * =========================================
 * Renders AccreditationCardPreview into a fresh
 * div directly on document.body — completely outside
 * any modal, scroll container, or overflow:hidden.
 * html2canvas captures THAT element — guaranteed clean.
 * =========================================
 */

import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";
import React        from "react";
import { createRoot } from "react-dom/client";
import { CardInner } from "./AccreditationCardPreview";

const CARD_W_PX = 320;
const CARD_H_PX = 454;

export const PDF_SIZES = {
  card: { width: 85.6,  height: 54,  label: "ID Card (85.6×54 mm)"  },
  a6:   { width: 105,   height: 148, label: "A6 (105×148 mm)"       },
  a5:   { width: 148,   height: 210, label: "A5 (148×210 mm)"       },
  a4:   { width: 210,   height: 297, label: "A4 (210×297 mm)"       },
};

export const IMAGE_SIZES = {
  low:   { scale: 1,    label: "Low Quality" },
  hd:    { scale: 2,    label: "HD"          },
  p1280: { scale: 4,    label: "1280p"       },
  "4k":  { scale: 6.25, label: "600 DPI"     },
};

/* ═════════════════════════════════════════════════════════════
   Render CardInner into a fresh offscreen container on body.
   Waits for images + QR to load, then resolves with
   { frontEl, backEl, cleanup }
   ═════════════════════════════════════════════════════════════ */
const renderOffscreenCard = (accreditation, event, zones) =>
  new Promise((resolve, reject) => {
    const SUFFIX = `_capture_${Date.now()}`;

    /* Container sits offscreen but IS in the document flow */
    const container = document.createElement("div");
    container.style.cssText = [
      "position:absolute",
      "left:-9999px",
      "top:0",
      "width:700px",          // wide enough for both cards side by side
      "height:460px",
      "overflow:visible",
      "visibility:visible",
      "opacity:1",
      "z-index:-1",
      "pointer-events:none",
      "background:transparent",
    ].join(";");

    document.body.appendChild(container);

    const root = createRoot(container);

    const cleanup = () => {
      try { root.unmount(); } catch {}
      try { if (container.parentNode) document.body.removeChild(container); } catch {}
    };

    root.render(
      React.createElement(CardInner, {
        accreditation,
        event,
        zones,
        idSuffix: SUFFIX,
      })
    );

    /* Poll until both card elements are rendered and have correct size */
    let attempts = 0;
    const MAX    = 60; // 6 seconds max

    const poll = () => {
      attempts++;
      if (attempts > MAX) {
        cleanup();
        return reject(new Error("Card render timed out. Please try again."));
      }

      const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
      const backEl  = document.getElementById(`accreditation-back-card${SUFFIX}`);

      if (!frontEl || frontEl.getBoundingClientRect().width === 0) {
        return setTimeout(poll, 100);
      }

      /* Wait for all images inside to load */
      const imgs = Array.from(container.querySelectorAll("img"));
      const allLoaded = imgs.every(
        (img) => img.complete && img.naturalWidth > 0
      );
