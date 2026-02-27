/**
 * AccreditationPrintModal.jsx
 * Complete replacement for BadgeGenerator + pdfUtils canvas approach.
 * Uses @react-pdf/renderer — no html2canvas, no DOM capture, no canvas errors.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image as PDFImage,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import {
  Download,
  Printer,
  ExternalLink,
  ImageIcon,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { getCountryName, calculateAge, COUNTRIES } from "../../lib/utils";
import QRCode from "qrcode";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const PDF_SIZES = {
  card: { w: 85.6,  h: 121.6, label: "ID Card (85.6×121.6 mm)" },
  a6:   { w: 105,   h: 148,   label: "A6 (105×148 mm)"         },
  a5:   { w: 148,   h: 210,   label: "A5 (148×210 mm)"         },
  a4:   { w: 210,   h: 297,   label: "A4 (210×297 mm)"         },
};

const IMAGE_SIZES = {
  "640":  { scale: 2, label: "640px"  },
  "1280": { scale: 4, label: "1280px" },
  "2560": { scale: 8, label: "2560px" },
};

const ROLE_HEX = {
  athlete:  "#2563eb",
  coach:    "#0d9488",
  media:    "#d97706",
  official: "#7c3aed",
  medical:  "#e11d48",
  staff:    "#475569",
  vip:      "#b45309",
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const getRoleColor = (role, zones) => {
  const match = zones?.find(
    (z) => z.name?.toLowerCase() === role?.toLowerCase()
  );
  return match?.color || ROLE_HEX[role?.toLowerCase()] || "#475569";
};

const getNameFontSize = (first, last) => {
  const len = `${first || ""} ${last || ""}`.trim().length;
  if (len > 28) return 11;
  if (len > 22) return 13;
  if (len > 16) return 15;
  return 17;
};

/* Convert any URL → base64 data URI (handles CORS) */
const toBase64 = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith("data:") || url.startsWith("blob:")) return resolve(url);

    fetch(url, { mode: "cors", cache: "force-cache", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise((res) => {
            const fr = new FileReader();
            fr.onloadend = () => res(fr.result);
            fr.onerror = () => res(null);
            fr.readAsDataURL(blob);
          })
      )
      .then(resolve)
      .catch(() => {
        const img = new window.Image();
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
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => {
          clearTimeout(t);
          resolve(null);
        };
        img.src = url + (url.includes("?") ? "&" : "?") + "_nc=" + Date.now();
      });
  });

/* Preload every image the PDF needs */
const preloadAll = async (accreditation, event) => {
  const countryData = COUNTRIES.find((c) => c.code === accreditation?.nationality);
  const flagUrl = countryData?.flag
    ? `https://flagcdn.com/w80/${countryData.flag.toLowerCase()}.png`
    : null;

  const verifyId =
    accreditation?.accreditationId ||
    accreditation?.badgeNumber ||
    accreditation?.id ||
    "unknown";
  const verifyUrl = `${window.location.origin}/verify/${verifyId}`;

  let qrBase64 = null;
  try {
    qrBase64 = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 200,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch (_) {}

  const sponsorUrls = (event?.sponsorLogos || []).slice(0, 6);

  const [photo, logo, flag, backTemplate, ...sponsors] = await Promise.all([
    toBase64(accreditation?.photoUrl),
    toBase64(event?.logoUrl),
    toBase64(flagUrl),
    toBase64(event?.backTemplateUrl),
    ...sponsorUrls.map(toBase64),
  ]);

  return { photo, logo, flag, backTemplate, qrBase64, sponsors };
};

/* ─────────────────────────────────────────────
   REACT-PDF STYLES
   (mirrors AccreditationCardPreview exactly)
───────────────────────────────────────────── */
const S = StyleSheet.create({
  page:          { backgroundColor: "#ffffff", fontFamily: "Helvetica" },

  /* FRONT */
  front:         { width: "100%", height: "100%", flexDirection: "column", backgroundColor: "#ffffff" },

  header:        { height: 80, alignItems: "center", justifyContent: "center",
                   backgroundColor: "#7dd3fc", paddingHorizontal: 16 },
  headerLogo:    { maxHeight: 70, objectFit: "contain" },

  gap:           { height: 4, backgroundColor: "#ffffff" },

  roleBanner:    { height: 32, alignItems: "center", justifyContent: "center" },
  roleText:      { color: "#ffffff", fontSize: 13, fontFamily: "Helvetica-Bold",
                   textTransform: "uppercase", letterSpacing: 3 },

  body:          { flex: 1, flexDirection: "row", padding: 10, backgroundColor: "#ffffff" },

  /* left column */
  leftCol:       { width: 90, flexDirection: "column", alignItems: "center" },
  photoBox:      { width: 82, height: 100, border: "1.5 solid #cbd5e1",
                   padding: 1.5, backgroundColor: "#ffffff" },
  photo:         { width: "100%", height: "100%", objectFit: "cover" },
  photoNone:     { width: "100%", height: "100%", backgroundColor: "#e2e8f0",
                   alignItems: "center", justifyContent: "center" },
  photoNoneTxt:  { fontSize: 7, color: "#94a3b8" },
  metaBox:       { marginTop: 6, width: "100%", paddingLeft: 2 },
  metaTxt:       { fontSize: 7.5, color: "#334155", fontFamily: "Helvetica" },
  metaBold:      { fontSize: 7.5, color: "#334155", fontFamily: "Helvetica-Bold" },
  qrImg:         { width: 56, height: 56, marginTop: 10 },

  /* right column */
  rightCol:      { flex: 1, paddingLeft: 12, flexDirection: "column" },
  nameText:      { color: "#1e3a8a", fontFamily: "Helvetica-Bold",
                   textTransform: "uppercase", lineHeight: 1.15 },
  clubText:      { fontSize: 10, color: "#334155", marginTop: 8 },
  roleSmall:     { fontSize: 8.5, color: "#64748b", marginTop: 3 },
  ageRow:        { flexDirection: "row", alignItems: "center", gap: 6,
                   marginTop: 8, fontSize: 9.5, color: "#475569" },
  pipe:          { color: "#cbd5e1" },
  flagRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  flagImg:       { width: 34, height: 22, borderRadius: 2, objectFit: "cover" },
  countryTxt:    { fontSize: 11, color: "#1e40af", fontFamily: "Helvetica-Bold" },

  /* zone row */
  zoneRow:       { height: 22, flexDirection: "row", alignItems: "center",
                   justifyContent: "flex-end", gap: 3,
                   paddingHorizontal: 10, backgroundColor: "#ffffff" },
  zoneBadge:     { width: 22, height: 22, backgroundColor: "#0f172a",
                   borderRadius: 3, alignItems: "center", justifyContent: "center" },
  zoneBadgeTxt:  { color: "#ffffff", fontSize: 9, fontFamily: "Helvetica-Bold" },
  noAccess:      { fontSize: 8, color: "#94a3b8" },

  /* sponsor row */
  sponsorRow:    { height: 30, flexDirection: "row", alignItems: "center",
                   justifyContent: "center", gap: 8, paddingHorizontal: 10,
                   borderTop: "0.5 solid #e2e8f0", backgroundColor: "#f8fafc" },
  sponsorImg:    { height: 22, width: 42, objectFit: "contain" },
  sponsorNone:   { fontSize: 6.5, color: "#94a3b8", fontStyle: "italic" },

  /* BACK */
  back:          { width: "100%", height: "100%", backgroundColor: "#0f172a",
                   padding: 16, flexDirection: "column" },
  backHeader:    { alignItems: "center", marginBottom: 16 },
  backTitle:     { fontSize: 13, color: "#ffffff", fontFamily: "Helvetica-Bold",
                   backgroundColor: "#0891b2", paddingHorizontal: 16,
                   paddingVertical: 5, borderRadius: 20 },
  accessLabel:   { fontSize: 9, color: "#94a3b8", fontFamily: "Helvetica-Bold",
                   textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  zoneItem:      { flexDirection: "row", alignItems: "center", gap: 10,
                   backgroundColor: "rgba(30,41,59,0.8)", borderRadius: 6,
                   padding: 8, marginBottom: 8,
                   border: "0.5 solid rgba(51,65,85,0.8)" },
  zoneCircle:    { width: 30, height: 30, borderRadius: 6,
                   backgroundColor: "#0891b2", alignItems: "center",
                   justifyContent: "center" },
  zoneCircleTxt: { fontSize: 10, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  zoneNameTxt:   { fontSize: 9, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  zoneDescTxt:   { fontSize: 7.5, color: "#94a3b8" },
  importantBox:  { marginTop: "auto", borderRadius: 6, padding: 10,
                   border: "0.5 solid rgba(245,158,11,0.5)",
                   backgroundColor: "rgba(245,158,11,0.1)" },
  importantTitle:{ fontSize: 9, color: "#fbbf24", fontFamily: "Helvetica-Bold",
                   textTransform: "uppercase", marginBottom: 4 },
  importantTxt:  { fontSize: 8, color: "#e2e8f0", lineHeight: 1.5 },
});

/* ─────────────────────────────────────────────
   PDF DOCUMENT COMPONENT
───────────────────────────────────────────── */
const AccreditationPDF = ({ accreditation, event, zones = [], imgs }) => {
  const roleColor  = getRoleColor(accreditation?.role, zones);
  const zoneCodes  = accreditation?.zoneCode?.split(",").map((z) => z.trim()).filter(Boolean) || [];
  const countryName = getCountryName(accreditation?.nationality);
  const age        = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;
  const nameFontSize = getNameFontSize(accreditation?.firstName, accreditation?.lastName);
  const fullName   = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;
  const idNumber   = accreditation?.accreditationId?.split("-")?.pop() || "---";

  return (
    <Document>
      {/* ══ FRONT PAGE ══ */}
      <Page size={[CARD_W_PT, CARD_H_PT]} style={S.page}>
        <View style={S.front}>

          {/* Header */}
          <View style={S.header}>
            {imgs.logo ? (
              <PDFImage src={imgs.logo} style={S.headerLogo} />
            ) : (
              <View style={S.photoNone}><Text style={S.photoNoneTxt}>NO LOGO</Text></View>
            )}
          </View>

          <View style={S.gap} />

          {/* Role Banner */}
          <View style={[S.roleBanner, { backgroundColor: roleColor }]}>
            <Text style={S.roleText}>
              {(accreditation?.role || "PARTICIPANT").toUpperCase()}
            </Text>
          </View>

          {/* Body */}
          <View style={S.body}>
            {/* Left column */}
            <View style={S.leftCol}>
              <View style={S.photoBox}>
                {imgs.photo ? (
                  <PDFImage src={imgs.photo} style={S.photo} />
                ) : (
                  <View style={S.photoNone}>
                    <Text style={S.photoNoneTxt}>No Photo</Text>
                  </View>
                )}
              </View>
              <View style={S.metaBox}>
                <Text style={S.metaTxt}>ID: {idNumber}</Text>
                <Text style={S.metaBold}>BADGE: {accreditation?.badgeNumber || "---"}</Text>
              </View>
              {imgs.qrBase64 && (
                <PDFImage src={imgs.qrBase64} style={S.qrImg} />
              )}
            </View>

            {/* Right column */}
            <View style={S.rightCol}>
              <Text style={[S.nameText, { fontSize: nameFontSize }]}>{fullName}</Text>
              <Text style={S.clubText}>{accreditation?.club || "Club Name"}</Text>
              <Text style={S.roleSmall}>{accreditation?.role || "Participant"}</Text>

              <View style={S.ageRow}>
                {age !== null && <Text>{age} Y</Text>}
                {age !== null && <Text style={S.pipe}>|</Text>}
                <Text>{accreditation?.gender || "Gender"}</Text>
              </View>

              <View style={S.flagRow}>
                {imgs.flag && (
                  <PDFImage src={imgs.flag} style={S.flagImg} />
                )}
                <Text style={S.countryTxt}>{countryName}</Text>
              </View>
            </View>
          </View>

          {/* Zone badges row */}
          <View style={S.zoneRow}>
            {zoneCodes.length > 0 ? (
              zoneCodes.slice(0, 4).map((code, i) => (
                <View key={i} style={S.zoneBadge}>
                  <Text style={S.zoneBadgeTxt}>{code}</Text>
                </View>
              ))
            ) : (
              <Text style={S.noAccess}>No Access</Text>
            )}
          </View>

          {/* Sponsor row */}
          <View style={S.sponsorRow}>
            {imgs.sponsors && imgs.sponsors.filter(Boolean).length > 0 ? (
              imgs.sponsors
                .filter(Boolean)
                .slice(0, 6)
                .map((s, i) => (
                  <PDFImage key={i} src={s} style={S.sponsorImg} />
                ))
            ) : (
              <Text style={S.sponsorNone}>Sponsors</Text>
            )}
          </View>
        </View>
      </Page>

      {/* ══ BACK PAGE ══ */}
      <Page size={[CARD_W_PT, CARD_H_PT]} style={S.page}>
        {imgs.backTemplate ? (
          <PDFImage
            src={imgs.backTemplate}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View style={S.back}>
            <View style={S.backHeader}>
              <Text style={S.backTitle}>{event?.name || "Event Name"}</Text>
            </View>

            <Text style={S.accessLabel}>Access Zones</Text>

            {zoneCodes.map((code, i) => {
              const zoneInfo = zones?.find((z) => z.code === code);
              return (
                <View key={i} style={S.zoneItem}>
                  <View style={S.zoneCircle}>
                    <Text style={S.zoneCircleTxt}>{code}</Text>
                  </View>
                  <View>
                    <Text style={S.zoneNameTxt}>{zoneInfo?.name || code}</Text>
                    {zoneInfo?.description && (
                      <Text style={S.zoneDescTxt}>{zoneInfo.description}</Text>
                    )}
                  </View>
                </View>
              );
            })}

            <View style={S.importantBox}>
              <Text style={S.importantTitle}>⚠ Important</Text>
              <Text style={S.importantTxt}>
                This accreditation must be worn visibly at all times.
                Access is restricted to authorized zones only.
              </Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};

/* PDF card dimensions in PDF points (1 mm = 2.8346 pt) */
/* We use the same aspect ratio as the preview: 320×454 px  */
/* Stored here so AccreditationPDF can use them             */
const RATIO    = 454 / 320;
const CARD_W_PT = 240;          // ~84.7 mm — close to ID card width
const CARD_H_PT = Math.round(CARD_W_PT * RATIO); // ~340 pt

/* ─────────────────────────────────────────────
   MAIN MODAL COMPONENT
───────────────────────────────────────────── */
export default function AccreditationPrintModal({
  accreditation,
  event,
  zones = [],
  onClose,
}) {
  const [pdfSizeKey,  setPdfSizeKey]  = useState("a6");
  const [imgSizeKey,  setImgSizeKey]  = useState("1280");
  const [status,      setStatus]      = useState("idle"); // idle | loading | error
  const [errorMsg,    setErrorMsg]    = useState("");
  const [imgs,        setImgs]        = useState(null);

  /* Preload images once on mount */
  useEffect(() => {
    let cancelled = false;
    preloadAll(accreditation, event).then((result) => {
      if (!cancelled) setImgs(result);
    });
    return () => { cancelled = true; };
  }, [accreditation?.id, event?.id]);

  const withLoading = useCallback(async (fn) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      await fn();
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }, []);

  /* Build the PDF blob for a given mm size */
  const buildBlob = useCallback(
    async (sizeKey) => {
      if (!imgs) throw new Error("Images still loading. Please wait a moment.");
      const size = PDF_SIZES[sizeKey] || PDF_SIZES.a6;

      /* Override card dimensions for the chosen paper size */
      const ratio  = CARD_H_PT / CARD_W_PT;
      const wPt    = size.w * 2.8346;
      const hPt    = size.h * 2.8346;

      const doc = React.createElement(AccreditationPDF, {
        accreditation,
        event,
        zones,
        imgs,
        /* pass overridden size via context-free approach: just render at fixed size */
      });

      /* @react-pdf/renderer pdf() accepts a React element */
      const blob = await pdf(
        React.createElement(
          Document,
          null,
          /* Front */
          React.createElement(
            Page,
            { size: [wPt, hPt], style: S.page },
            React.createElement(FrontPageContent, { accreditation, event, zones, imgs, wPt, hPt })
          ),
          /* Back */
          React.createElement(
            Page,
            { size: [wPt, hPt], style: S.page },
            React.createElement(BackPageContent, { accreditation, event, zones, imgs })
          )
        )
      ).toBlob();

      return blob;
    },
    [imgs, accreditation, event, zones]
  );

  /* ── ACTIONS ── */
  const handleDownloadPDF = () =>
    withLoading(async () => {
      const blob = await buildBlob(pdfSizeKey);
      const name = `${accreditation?.firstName || "card"}_${accreditation?.lastName || ""}_${pdfSizeKey}.pdf`;
      saveAs(blob, name);
    });

  const handleOpenInTab = () =>
    withLoading(async () => {
      const blob = await buildBlob(pdfSizeKey);
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });

  const handleDownloadImages = () =>
    withLoading(async () => {
      if (!imgs) throw new Error("Images still loading.");
      const scale  = IMAGE_SIZES[imgSizeKey]?.scale || 4;
      const w      = Math.round(320 * scale);
      const h      = Math.round(454 * scale);
      const baseName = `${accreditation?.firstName || "card"}_${accreditation?.lastName || ""}`;

      for (const side of ["front", "back"]) {
        const canvas = await renderCardToCanvas(accreditation, event, zones, imgs, side, w, h);
        const a = document.createElement("a");
        a.download = `${baseName}_${side}.png`;
        a.href = canvas.toDataURL("image/png", 1.0);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((r) => setTimeout(r, 400));
      }
    });

  const handlePrint = () =>
    withLoading(async () => {
      const blob = await buildBlob(pdfSizeKey);
      const url  = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;";
      document.body.appendChild(iframe);
      iframe.src = url;

      await new Promise((resolve) => {
        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            } catch (_) {
              window.open(url, "_blank");
            }
            resolve();
          }, 300);
        };
        setTimeout(resolve, 5000);
      });

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 30000);
    });

  /* ── RENDER ── */
  const isLoading = status === "loading";
  const imgsReady = !!imgs;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Download / Print Card</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Loading indicator for image preload */}
      {!imgsReady && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Preparing images...</span>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm font-medium">⚠ {errorMsg}</p>
        </div>
      )}

      {/* PDF Size selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">PDF Size</label>
        <select
          value={pdfSizeKey}
          onChange={(e) => setPdfSizeKey(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          {Object.entries(PDF_SIZES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Image Size selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Image Size</label>
        <select
          value={imgSizeKey}
          onChange={(e) => setImgSizeKey(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          {Object.entries(IMAGE_SIZES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDownloadPDF}
          disabled={isLoading || !imgsReady}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download PDF ({PDF_SIZES[pdfSizeKey]?.label.split(" ")[0]})
        </button>

        <button
          onClick={handleOpenInTab}
          disabled={isLoading || !imgsReady}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Open in New Tab
        </button>

        <button
          onClick={handleDownloadImages}
          disabled={isLoading || !imgsReady}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg
