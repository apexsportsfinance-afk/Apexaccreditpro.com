import React from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { COUNTRIES, getCountryName, calculateAge } from "../../lib/utils";
import QRCode from "qrcode";
import { Document, Page, View, Text, Image as PDFImage, StyleSheet } from "@react-pdf/renderer";

export const PDF_SIZES = {
  card: { width: 85.6, height: 121.6, label: "ID Card" },
  a6: { width: 105, height: 148, label: "A6" },
  a5: { width: 148, height: 210, label: "A5" },
  a4: { width: 210, height: 297, label: "A4" },
};

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
      .catch(() => resolve(null));
  });

const AccreditationPDF = ({ accreditation, event, zones, sizeKey, images }) => {
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
    React.createElement(Page, { size: [pts.width, pts.height], style: styles.page },
      React.createElement(View, { style: styles.header },
        images.logo && React.createElement(PDFImage, { src: images.logo, style: styles.headerLogo })
      ),
      React.createElement(View, { style: styles.roleBanner },
        React.createElement(Text, { style: styles.roleText }, (accreditation?.role || "PARTICIPANT").toUpperCase())
      ),
      React.createElement(View, { style: styles.body },
        React.createElement(View, { style: styles.leftCol },
          React.createElement(View, { style: styles.photoBox },
            images.photo ? React.createElement(PDFImage, { src: images.photo, style: styles.photo }) : null
          ),
          React.createElement(Text, { style: styles.meta }, `ID: ${accreditation?.accreditationId?.split("-")?.pop() || "---"}`),
          React.createElement(Text, { style: styles.meta }, `BADGE: ${accreditation?.badgeNumber || "---"}`),
          images.qrBase64 && React.createElement(PDFImage, { src: images.qrBase64, style: styles.qr })
        ),
        React.createElement(View, { style: styles.rightCol },
          React.createElement(Text, { style: styles.name }, fullName),
          React.createElement(Text, { style: styles.club }, accreditation?.club || "Club Name"),
          React.createElement(Text, { style: styles.detail }, `${age !== null ? age + " Y | " : ""}${accreditation?.gender || ""}`),
          React.createElement(View, { style: styles.flagRow },
            images.flag && React.createElement(PDFImage, { src: images.flag, style: styles.flag }),
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
        images.sponsors?.map((s, i) => React.createElement(PDFImage, { key: i, src: s, style: styles.sponsorImg }))
      )
    ),
    
    React.createElement(Page, { size: [pts.width, pts.height], style: styles.page },
      images.backTemplate ? 
        React.createElement(PDFImage, { src: images.backTemplate, style: { width: "100%", height: "100%", objectFit: "cover" } }) :
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
            React.createElement(Text, { style: styles.impText }, "This accreditation must be worn visibly at all times.")
          )
        )
    )
  );
};

const preloadImages = async (accreditation, event) => {
  const countryData = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const flagUrl = countryData?.flag ? `https://flagcdn.com/w80/${countryData.flag.toLowerCase()}.png` : null;
  const verifyId = accreditation?.accreditationId || accreditation?.badgeNumber || "unknown";
  const verifyUrl = `${window.location.origin}/verify/${verifyId}`;
  let qrBase64 = null;
  try {
    qrBase64 = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: "H", margin: 1, width: 200, color: { dark: "#0f172a", light: "#ffffff" } });
  } catch (e) {}
  const [photo, logo, flag, backTemplate, ...sponsors] = await Promise.all([
    toBase64(accreditation?.photoUrl), toBase64(event?.logoUrl), toBase64(flagUrl),
    toBase64(event?.backTemplateUrl), ...(event?.sponsorLogos || []).slice(0, 6).map(toBase64),
  ]);
  return { photo, logo, flag, backTemplate, qrBase64, sponsors: sponsors.filter(Boolean) };
};

export const generatePDFBlob = async (accreditation, event, zones, sizeKey = "a6") => {
  const images = await preloadImages(accreditation, event);
  const doc = React.createElement(AccreditationPDF, { accreditation, event, zones, sizeKey, images });
  return await pdf(doc).toBlob();
};

export const downloadCardPDF = async (accreditation, event, zones, fileName, scale, sizeKey) => {
  const blob = await generatePDFBlob(accreditation, event, zones, sizeKey);
  saveAs(blob, fileName);
};

export const openCardPDF = async (accreditation, event, zones, scale, sizeKey) => {
  const blob = await generatePDFBlob(accreditation, event, zones, sizeKey);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const printCard = async (accreditation, event, zones, scale, sizeKey) => {
  const blob = await generatePDFBlob(accreditation, event, zones, sizeKey);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) printWindow.onload = () => printWindow.print();
};

export const bulkDownloadPDFs = async (accreditations, event, zones, sizeKey = "a6", onProgress) => {
  const zip = new JSZip();
  const folder = zip.folder("accreditation-cards");
  for (let i = 0; i < accreditations.length; i++) {
    const acc = accreditations[i];
    const blob = await generatePDFBlob(acc, event, zones, sizeKey);
    const fileName = `${acc.firstName}_${acc.lastName}_${acc.badgeNumber || acc.id}.pdf`;
    folder.file(fileName, blob);
    if (onProgress) onProgress(i + 1, accreditations.length);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, `accreditation-cards-${event?.name || "event"}.zip`);
};
