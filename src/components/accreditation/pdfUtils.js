import React from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { COUNTRIES, getCountryName, calculateAge } from "../../lib/utils";
import QRCode from "qrcode";
import { Document, Page, View, Text, Image as PDFImage, StyleSheet } from "@react-pdf/renderer";

// Size configurations
export const PDF_SIZES = {
  card: { width: 85.6, height: 121.6, label: "ID Card" },
  a6: { width: 105, height: 148, label: "A6" },
  a5: { width: 148, height: 210, label: "A5" },
  a4: { width: 210, height: 297, label: "A4" },
};

export const IMAGE_SIZES = {
  low: { scale: 1, label: "Low Quality" },
  hd: { scale: 2, label: "HD" },
  p1280: { scale: 4, label: "1280p" },
  "4k": { scale: 6.25, label: "600 DPI" },
};

// Convert URL to base64
const toBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith("data:")) return resolve(url);
    
    fetch(url, { mode: "cors", cache: "force-cache" })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => new Promise(res => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.onerror = () => res(null);
        reader.readAsDataURL(blob);
      }))
      .then(resolve)
      .catch(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => resolve(null), 8000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth || 1;
            c.height = img.naturalHeight || 1;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          } catch { resolve(null); }
        };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now();
      });
  });

// Preload all images
const preloadImages = async (accreditation, event) => {
  const countryData = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const flagUrl = countryData?.flag ? `https://flagcdn.com/w80/${countryData.flag.toLowerCase()}.png` : null;
  
  const verifyId = accreditation?.accreditationId || accreditation?.badgeNumber || "unknown";
  const verifyUrl = `${window.location.origin}/verify/${verifyId}`;
  
  let qrBase64 = null;
  try {
    qrBase64 = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 200,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch (e) { console.error("QR error:", e); }

  const [photo, logo, flag, backTemplate, ...sponsors] = await Promise.all([
    toBase64(accreditation?.photoUrl),
    toBase64(event?.logoUrl),
    toBase64(flagUrl),
    toBase64(event?.backTemplateUrl),
    ...(event?.sponsorLogos || []).slice(0, 6).map(toBase64),
  ]);

  return { photo, logo, flag, backTemplate, qrBase64, sponsors: sponsors.filter(Boolean) };
};

// PDF Component
const AccreditationPDF = ({ accreditation, event, zones, sizeKey }) => {
  const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;
  const pts = { width: size.width * 2.83465, height: size.height * 2.83465 };
  
  const roleColors = {
    athlete: "#2563eb", coach: "#0d9488", media: "#d97706",
    official: "#7c3aed", medical: "#e11d48", staff: "#475569",
    vip: "#b45309", organizer: "#059669"
  };
  
  const roleColor = zones?.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase())?.color 
    || roleColors[accreditation?.role?.toLowerCase()] 
    || "#475569";
    
  const zoneCodes = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
  const countryName = getCountryName(accreditation?.nationality);
  const age = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;
    
  const nameLen = `${accreditation?.firstName || ""} ${accreditation?.lastName || ""}`.trim().length;
  const nameSize = nameLen > 28 ? 11 : nameLen > 22 ? 13 : nameLen > 16 ? 15 : 17;
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`.toUpperCase();

  const styles = StyleSheet.create({
    page: { width: pts.width, height: pts.height, backgroundColor: "#ffffff", fontFamily: "Helvetica" },
    header: { height: pts.height * 0.22, backgroundColor: "#7dd3fc", alignItems: "center", justifyContent: "center" },
    headerLogo: { maxHeight: pts.height * 0.15, objectFit: "contain" },
    roleBanner: { height: pts.height * 0.09, backgroundColor: roleColor, alignItems: "center", justifyContent: "center" },
    roleText: { color: "#ffffff", fontSize: pts.width * 0.04, fontFamily: "Helvetica-Bold" },
    body: { flex: 1, flexDirection: "row", padding: pts.width * 0.03 },
    leftCol: { width: pts.width * 0.35, alignItems: "center" },
    photoBox: { width: pts.width * 0.3, height: pts.height * 0.28, border: "1 solid #cbd5e1", padding: 2 },
    photo: { width: "100%", height: "100%", objectFit: "cover" },
    meta: { marginTop: 4, fontSize: pts.width * 0.025 },
    qr: { width: pts.width * 0.18, height: pts.width * 0.18, marginTop: 6 },
    rightCol: { flex: 1, paddingLeft: pts.width * 0.03 },
    name: { fontSize: nameSize, color: "#1e3a8a", fontFamily: "Helvetica-Bold" },
    club: { fontSize: pts.width * 0.03, color: "#334155", marginTop: 4 },
    detail: { fontSize: pts.width * 0.025, color: "#475569", marginTop: 2 },
    flagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    flag: { width: pts.width * 0.12, height: pts.width * 0.08 },
    country: { fontSize: pts.width * 0.035, color: "#1e40af", fontFamily: "Helvetica-Bold" },
    zoneRow: { height: pts.height * 0.06, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 2, paddingRight: 4 },
    zoneBadge: { width: pts.width * 0.07, height: pts.width * 0.07, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
    zoneText: { color: "#ffffff", fontSize: pts.width * 0.03, fontFamily: "Helvetica-Bold" },
    sponsorRow: { height: pts.height * 0.08, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, borderTop: "0.5 solid #e2e8f0" },
    sponsorImg: { height: pts.height * 0.05, width: pts.width * 0.15, objectFit: "contain" },
    backPage: { width: "100%", height: "100%", backgroundColor: "#0f172a", padding: pts.width * 0.05 },
    backHeader: { fontSize: pts.width * 0.04, color: "#ffffff", textAlign: "center", marginBottom: 8, fontFamily: "Helvetica-Bold" },
    backItem: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4, backgroundColor: "rgba(255,255,255,0.1)", padding: 4, borderRadius: 4 },
    backCode: { width: pts.width * 0.08, height: pts.width * 0.08, backgroundColor: "#0891b2", alignItems: "center", justifyContent: "center", borderRadius: 4 },
    backCodeText: { color: "#ffffff", fontSize: pts.width * 0.03, fontFamily: "Helvetica-Bold" },
    backName: { color: "#ffffff", fontSize: pts.width * 0.03 },
    important: { marginTop: "auto", backgroundColor: "rgba(245,158,11,0.2)", padding: 6, borderRadius: 4, border: "0.5 solid rgba(245,158,11,0.5)" },
    impTitle: { color: "#fbbf24", fontSize: pts.width * 0.03, fontFamily: "Helvetica-Bold" },
    impText: { color: "#e2e8f0", fontSize: pts.width * 0.025 },
  });

  return React.createElement(Document, null,
    // Front Page
    React.createElement(Page, { size: [pts.width, pts.height], style: styles.page },
      React.createElement(View, { style: styles.header },
        logo && React.createElement(PDFImage, { src: logo, style: styles.headerLogo })
      ),
      React.createElement(View, { style: styles.roleBanner },
        React.createElement(Text, { style: styles.roleText }, (accreditation?.role || "PARTICIPANT").toUpperCase())
      ),
      React.createElement(View, { style: styles.body },
        React.createElement(View, { style: styles.leftCol },
          React.createElement(View, { style: styles.photoBox },
            photo ? React.createElement(PDFImage, { src: photo, style: styles.photo }) : null
          ),
          React.createElement(Text, { style: styles.meta }, `ID: ${accreditation?.accreditationId?.split("-")?.pop() || "---"}`),
          React.createElement(Text, { style: styles.meta }, `BADGE: ${accreditation?.badgeNumber || "---"}`),
          qrBase64 && React.createElement(PDFImage, { src: qrBase64, style: styles.qr })
        ),
        React.createElement(View, { style: styles.rightCol },
          React.createElement(Text, { style: styles.name }, fullName),
          React.createElement(Text, { style: styles.club }, accreditation?.club || "Club Name"),
          React.createElement(Text, { style: styles.detail }, `${age !== null ? age + " Y | " : ""}${accreditation?.gender || ""}`),
          React.createElement(View, { style: styles.flagRow },
            flag && React.createElement(PDFImage, { src: flag, style: styles.flag }),
            React.createElement(Text, { style: styles.country }, countryName)
          )
        )
      ),
      React.createElement(View, { style: styles.zoneRow },
        zoneCodes.length > 0 ? zoneCodes.slice(0, 4).map((code, i) => 
          React.createElement(View, { key: i, style: styles.zoneBadge },
            React.createElement(Text, { style: styles.zoneText }, code)
          )
        ) : null
      ),
      React.createElement(View, { style: styles.sponsorRow },
        sponsors?.map((s, i) => React.createElement(PDFImage, { key: i, src: s, style: styles.sponsorImg }))
      )
    ),
    
    // Back Page
    React.createElement(Page, { size: [pts.width, pts.height], style: styles.page },
      backTemplate ? 
        React.createElement(PDFImage, { src: backTemplate, style: { width: "100%", height: "100%", objectFit: "cover" } }) :
        React.createElement(View, { style: styles.backPage },
          React.createElement(Text, { style: styles.backHeader }, event?.name || "Event Name"),
          zoneCodes.map((code, i) => {
            const zoneInfo = zones?.find(z => z.code === code);
            return React.createElement(View, { key: i, style: styles.backItem },
              React.createElement(View, { style: styles.backCode },
                React.createElement(Text, { style: styles.backCodeText }, code)
              ),
              React.createElement(Text, { style: styles.backName }, zoneInfo?.name || code)
            );
          }),
          React.createElement(View, { style: styles.important },
            React.createElement(Text, { style: styles.impTitle }, "IMPORTANT"),
            React.createElement(Text, { style: styles.impText }, "This accreditation must be worn visibly at all times. Access is restricted to authorized zones only.")
          )
        )
    )
  );
};

// Generate PDF Blob
const generateBlob = async (accreditation, event, zones, sizeKey) => {
  const imgs = await preloadImages(accreditation, event);
  const doc = React.createElement(AccreditationPDF, { 
    accreditation, 
    event, 
    zones, 
    sizeKey,
    ...imgs 
  });
  return await pdf(doc).toBlob();
};

// Public APIs
export const downloadCapturedPDF = async (accreditation, event, zones, fileName, scale, sizeKey) => {
  const blob = await generateBlob(accreditation, event, zones, sizeKey);
  saveAs(blob, fileName);
};

export const openCapturedPDFInTab = async (accreditation, event, zones, scale, sizeKey) => {
  const blob = await generateBlob(accreditation, event, zones, sizeKey);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const printCards = async (accreditation, event, zones, scale, sizeKey) => {
  const blob = await generateBlob(accreditation, event, zones, sizeKey);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank", "width=800,height=600");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    }, { once: true });
  }
};

// For images, we use html2canvas on the preview component (separate from PDF)
export const downloadAsImages = async (accreditation, event, zones, baseName, scale) => {
  // Dynamically import html2canvas only for this function
  const html2canvas = (await import("html2canvas")).default;
  
  // Create offscreen container
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;";
  document.body.appendChild(container);
  
  // Import CardInner dynamically
  const { CardInner } = await import("./AccreditationCardPreview");
  const { createRoot } = await import("react-dom/client");
  
  const SUFFIX = `_img_${Date.now()}`;
  const root = createRoot(container);
  
  root.render(React.createElement("div", { style: { display: "flex", gap: "20px" } },
    React.createElement(CardInner, { accreditation, event, zones, idSuffix: SUFFIX })
  ));
  
  // Wait for render
  await new Promise(r => setTimeout(r, 500));
  
  try {
    const frontEl = document.getElementById(`accreditation-front-card${SUFFIX}`);
    const backEl = document.getElementById(`accreditation-back-card${SUFFIX}`);
    
    if (frontEl) {
      const frontCanvas = await html2canvas(frontEl, { scale, useCORS: false, backgroundColor: "#ffffff" });
      const a1 = document.createElement("a");
      a1.download = `${baseName}_front.png`;
      a1.href = frontCanvas.toDataURL();
      a1.click();
    }
    
    if (backEl) {
      await new Promise(r => setTimeout(r, 300));
      const backCanvas = await html2canvas(backEl, { scale, useCORS: false, backgroundColor: "#ffffff" });
      const a2 = document.createElement("a");
      a2.download = `${baseName}_back.png`;
      a2.href = backCanvas.toDataURL();
      a2.click();
    }
  } finally {
    root.unmount();
    container.remove();
  }
};
