/**
 * Uses html2canvas to render the visually rich SpectatorTicketCard into a PDF.
 */

let jsPDF = null;
let html2canvas = null;
let SpectatorTicketCard = null;
let ReactModule = null;
let createRoot = null;

async function initLibs() {
  if (jsPDF && html2canvas && SpectatorTicketCard && ReactModule && createRoot) return;
  const jspdfModule = await import("jspdf");
  jsPDF = jspdfModule.jsPDF;
  html2canvas = (await import("html2canvas")).default;
  const cardModule = await import("../components/public/SpectatorTicketCard");
  SpectatorTicketCard = cardModule.SpectatorTicketCard;
  ReactModule = await import("react");
  const reactDomModule = await import("react-dom/client");
  createRoot = reactDomModule.createRoot;
}

export const generatePdfForTicket = async (order, event, qrCodeUrl) => {
  await initLibs();

  const SUFFIX = `_email_ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const wrapper = document.createElement("div");
  wrapper.id = `ticket-wrapper${SUFFIX}`;
  wrapper.style.cssText =
    "position:absolute;left:-9999px;top:0;width:360px;min-height:700px;overflow:visible;visibility:visible;opacity:1;z-index:-1;pointer-events:none;background:transparent;";
  
  const container = document.createElement("div");
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  const root = createRoot(container);
  root.render(
    ReactModule.createElement(SpectatorTicketCard, {
      order,
      event,
      qrCodeUrl,
      idSuffix: SUFFIX
    })
  );

  await new Promise((r) => setTimeout(r, 200));

  // wait for QR
  await new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const qrImg = container.querySelector("img[data-qr-code='true']");
      if (qrImg && qrImg.getAttribute("src")?.startsWith("data:")) {
        return resolve(true);
      }
      if (Date.now() - start > 5000) return resolve(false);
      setTimeout(check, 30);
    };
    check();
  });

  const wrapperEl = document.getElementById(`ticket-wrapper${SUFFIX}`);
  const cardEl = document.getElementById(`spectator-ticket-card${SUFFIX}`);
  
  if (!cardEl || !wrapperEl) {
    root.unmount();
    wrapper.remove();
    throw new Error("Ticket Card render failed");
  }

  // Inline images
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

  await new Promise(r => setTimeout(r, 200));
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 200));

  const captureOpts = {
    scale: 3.125, // Using exact HD scale from Accreditation system
    useCORS: true,
    allowTaint: true,
    backgroundColor: null, // Transparent to mimic Accreditation cards
    logging: false,
    width: 360,
    height: wrapperEl.scrollHeight || 650,
    windowWidth: 360,
    windowHeight: wrapperEl.scrollHeight || 650,
  };

  const canvas = await html2canvas(wrapperEl, captureOpts);

  // Bypassing jsPDF entirely as requested by user -> Direct Image Output
  const imgData = canvas.toDataURL("image/png", 1.0);

  root.unmount();
  wrapper.remove();

  return imgData;
};

export const generateTicketAttachment = async (order, event, qrCodeUrl) => {
  try {
    const pngBase64DataUrl = await generatePdfForTicket(order, event, qrCodeUrl);
    
    // Extract base64 part
    const imageBase64 = pngBase64DataUrl.split(",")[1];
    
    const sanitizeName = (order.customer_name || "Customer").replace(/[^a-z0-9]/gi, '_');
    const fileName = `${sanitizeName}_Spectator_Ticket.png`;
    
    return { pdfBase64: imageBase64, pdfFileName: fileName };
  } catch (err) {
    console.error("[Image] Ticket Generation failed:", err);
    return null;
  }
};
