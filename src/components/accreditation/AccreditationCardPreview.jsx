import React, { memo, useState, useEffect, useRef } from "react";
import * as QRCodeLib from "qrcode";
import { getCountryName, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
const CARD_FONT = '"Gill Sans MT", "Gill Sans", Calibri, sans-serif';
const CARD_FONT_SIZE = 11;

const roleColors = {
  athlete: { bg: "bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500", hex: "#2563eb" },
  coach: { bg: "bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500", hex: "#0d9488" },
  media: { bg: "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500", hex: "#d97706" },
  official: { bg: "bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500", hex: "#7c3aed" },
  medical: { bg: "bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500", hex: "#e11d48" },
  staff: { bg: "bg-gradient-to-r from-slate-600 via-slate-500 to-gray-500", hex: "#475569" },
  vip: { bg: "bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600", hex: "#b45309" },
  organizer: { bg: "bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500", hex: "#059669" }
};

const getRoleData = (role) => {
  const key = role?.toLowerCase() || "default";
  return roleColors[key] || { bg: "bg-gradient-to-r from-slate-600 to-slate-500", hex: "#475569" };
};

const resolveCategoryColor = (role, eventCategories) => {
  if (!role || !eventCategories || eventCategories.length === 0) return null;
  const match = eventCategories.find((ec) => {
    const cat = ec.category || ec;
    return (cat?.name || ec?.name)?.toLowerCase() === role?.toLowerCase();
  });
  if (match) {
    const cat = match.category || match;
    return cat?.badgeColor || null;
  }
  return null;
};

const getNameFontSize = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  const len = full.length;
  if (len > 30) return 10;
  if (len > 26) return 11;
  if (len > 22) return 12;
  if (len > 18) return 13;
  if (len > 14) return 14;
  if (len > 10) return 15;
  return 16;
};

const getCountryFontSize = (countryName) => {
  if (!countryName) return 11;
  const len = countryName.length;
  if (len > 24) return 9;
  if (len > 18) return 10;
  if (len > 14) return 11;
  return 11;
};

const useRoleBannerPng = (role, bgColor, width = 320, height = 40) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = bgColor || "#2563eb";
    ctx.fillRect(0, 0, width, height);
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 2;
    ctx.fillStyle = "white";
    ctx.font = `bold 14px ${CARD_FONT}`;
    ctx.textBaseline = "middle";
    const text = (role || "PARTICIPANT").toUpperCase();
    const letterSpacing = 2.8;
    const chars = text.split("");
    ctx.textAlign = "left";
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const totalWidth = charWidths.reduce((sum, w) => sum + w, 0) + letterSpacing * (chars.length - 1);
    let currentX = (width - totalWidth) / 2;
    chars.forEach((char, i) => {
      ctx.fillText(char, currentX, height / 2);
      currentX += charWidths[i] + letterSpacing;
    });
    setUrl(canvas.toDataURL("image/png"));
  }, [role, bgColor, width, height]);
  return url;
};

const useCountryNamePng = (name, fontSize = 11) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!name) return;
    const height = 22;
    const scale = 4;
    const canvas = document.createElement("canvas");
    const tempCtx = canvas.getContext("2d");
    tempCtx.font = `bold ${fontSize}px ${CARD_FONT}`;
    const textWidth = Math.ceil(tempCtx.measureText(name).width) + 4;
    canvas.width = textWidth * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#1e40af";
    ctx.font = `bold ${fontSize}px ${CARD_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(name, 0, height / 2);
    setUrl(canvas.toDataURL("image/png"));
  }, [name, fontSize]);
  return url;
};

const useZoneBadgePngs = (codes, zones = []) => {
  const [badges, setBadges] = React.useState({});
  const codesKey = codes.join(",");
  const zonesKey = zones.map(z => `${z.code}:${z.color}`).join(",");
  React.useEffect(() => {
    if (!codes || codes.length === 0) return;
    const result = {};
    const count = codes.length;
    const DISPLAY = count <= 4 ? 32 : count <= 6 ? 28 : 24;
    const BADGE_SIZE = DISPLAY * 2;
    const FONT_SIZE = count <= 4 ? 15 : count <= 6 ? 13 : 11;
    codes.forEach((code) => {
      const canvas = document.createElement("canvas");
      canvas.width = BADGE_SIZE;
      canvas.height = BADGE_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      const zoneInfo = zones.find(z => z.code === code);
      const bgColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : "#0f172a";
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(0, 0, DISPLAY, DISPLAY, 3);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = `bold ${FONT_SIZE}px ${CARD_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, DISPLAY / 2, DISPLAY / 2 + 0.5);
      result[code] = canvas.toDataURL("image/png");
    });
    setBadges(result);
  }, [codesKey, zonesKey]);
  return badges;
};

const AquaticsHeader = memo(function AquaticsHeader({ event }) {
  const logoUrl = event?.logoUrl;
  return (
    <div style={{ height: "100px", width: "100%", position: "relative", overflow: "hidden", flexShrink: 0 }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Event Header"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          crossOrigin="anonymous"
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(6, 182, 212, 0.5)"
          }}>
            <svg style={{ width: "30px", height: "30px", color: "white" }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

export const CardInner = memo(function CardInner({ accreditation, event, zones = [], eventCategories = [], idSuffix = "" }) {
  const categoryColor = resolveCategoryColor(accreditation?.role, eventCategories);
  const matchingZone = zones.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase());
  const zoneColor = matchingZone?.color || null;
  const resolvedColor = categoryColor || zoneColor || null;
  const roleData = resolvedColor ? { bg: "", hex: resolvedColor } : getRoleData(accreditation?.role);
  const finalColor = resolvedColor || roleData.hex;

  const zoneCodes = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
  const countryData = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const countryName = getCountryName(accreditation?.nationality);
  const isAthlete = accreditation?.role?.toLowerCase() === "athlete";
  const age = isAthlete && accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;
  const countryFontSize = getCountryFontSize(countryName);

  const zoneBadgePngs = useZoneBadgePngs(zoneCodes, zones);
  const roleBannerUrl = useRoleBannerPng(accreditation?.role, finalColor);
  const countryNameUrl = useCountryNamePng(countryName, countryFontSize);
  const expired = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  const idNumber = accreditation?.accreditationId?.split("-")?.pop() || "---";
  const nameFontSize = getNameFontSize(accreditation?.firstName, accreditation?.lastName);
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  // ── QR CODE BLOCK (injected from new AccreditationCardPreview) ──────────────
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const genRef = useRef(0);

  useEffect(() => {
    genRef.current += 1;
    const currentGen = genRef.current;
    setQrDataUrl(null);

    const verifyUrl = accreditation?.accreditationId
      ? `${window.location.origin}/verify/${accreditation.accreditationId}`
      : accreditation?.badgeNumber
      ? `${window.location.origin}/verify/${accreditation.badgeNumber}`
      : accreditation?.id
      ? `${window.location.origin}/verify/${accreditation.id}`
      : null;

    if (!verifyUrl) return;

    const generate = async () => {
      try {
        const lib = QRCodeLib.default || QRCodeLib;
        const url = await lib.toDataURL(verifyUrl, {
          errorCorrectionLevel: "H",
          type: "image/png",
          margin: 1,
          width: 512,
          color: { dark: "#0f172a", light: "#ffffff" }
        });
        if (genRef.current === currentGen) {
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error("[QR] Generation failed:", err);
      }
    };

    generate();
  }, [
    accreditation?.id,
    accreditation?.status,
    accreditation?.accreditationId,
    accreditation?.badgeNumber,
    idSuffix
  ]);
  // ── END QR CODE BLOCK ────────────────────────────────────────────────────────

  const cardFont = { fontFamily: CARD_FONT };

  return (
    <>
      {/* FRONT CARD */}
      <div
        id={`accreditation-front-card${idSuffix}`}
        data-accreditation-id={accreditation?.accreditationId || accreditation?.badgeNumber || accreditation?.id || ""}
        style={{
          width: "320px", height: "454px", minWidth: "320px", minHeight: "454px",
          maxWidth: "320px", maxHeight: "454px", backgroundColor: "#ffffff",
          borderRadius: "0", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          position: "relative",
          border: expired ? "2px solid #f87171" : "1px solid #e2e8f0",
          boxSizing: "border-box", flexShrink: 0, flexGrow: 0,
          ...cardFont
        }}
      >
        {expired && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(239, 68, 68, 0.1)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#dc2626", color: "white", padding: "8px 24px", transform: "rotate(-15deg)", fontWeight: "bold", fontSize: "24px", letterSpacing: "0.1em", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", ...cardFont }}>
              EXPIRED
            </div>
          </div>
        )}

        <AquaticsHeader event={event} />
        <div style={{ height: "6px", backgroundColor: "white", flexShrink: 0 }} />

        {/* ROLE BANNER */}
        <div style={{ height: "40px", width: "100%", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", flexShrink: 0 }}>
          {roleBannerUrl ? (
            <img src={roleBannerUrl} alt={accreditation?.role} style={{ width: "100%", height: "40px", display: "block" }} />
          ) : (
            <div style={{ height: "40px", lineHeight: "40px", textAlign: "center", width: "100%", backgroundColor: finalColor, color: "white", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.2em", textShadow: "0 1px 2px rgba(0,0,0,0.2)", ...cardFont }}>
              {accreditation?.role || "PARTICIPANT"}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ display: "flex", flex: 1, padding: "10px 12px 0px 12px", position: "relative", zIndex: 10, minHeight: 0, backgroundColor: "white", overflow: "hidden", alignItems: "flex-start" }}>
          {/* LEFT: Photo + ID */}
          <div style={{ width: "110px", display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
            <div style={{ width: "100px", height: "120px", border: "2px solid #cbd5e1", padding: "2px", backgroundColor: "white", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", flexShrink: 0 }}>
              {accreditation?.photoUrl ? (
                <img src={accreditation.photoUrl} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(to bottom right, #f1f5f9, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ width: "40px", height: "40px", color: "#cbd5e1" }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>
            <div style={{ marginTop: "5px", paddingLeft: "4px", textAlign: "left", width: "100%" }}>
              <p style={{ fontSize: `${CARD_FONT_SIZE}px`, color: "#334155", ...cardFont, lineHeight: 1.4, margin: 0 }}>
                <strong style={{ fontWeight: "bold" }}>ID:</strong> {idNumber}
              </p>
              <p style={{ fontSize: `${CARD_FONT_SIZE}px`, color: "#334155", ...cardFont, lineHeight: 1.4, margin: 0 }}>
                <strong style={{ fontWeight: "bold" }}>BADGE:</strong> <span style={{ fontWeight: "normal" }}>{accreditation?.badgeNumber || "---"}</span>
              </p>
            </div>
          </div>

          {/* RIGHT: Name, details */}
          <div style={{ flex: 1, paddingLeft: "10px", display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
            <h2 style={{ fontWeight: "bold", color: "#1e3a8a", textTransform: "uppercase", fontSize: `${nameFontSize}px`, lineHeight: 1.15, margin: 0, ...cardFont }}>
              {fullName}
            </h2>
            <p style={{ fontSize: `${CARD_FONT_SIZE}px`, color: "#334155", marginTop: "7px", lineHeight: 1.3, wordBreak: "break-word", ...cardFont }}>
              {accreditation?.club || ""}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: `${CARD_FONT_SIZE}px`, color: "#475569", ...cardFont, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 500 }}>{accreditation?.role || "Participant"}</span>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <span style={{ fontWeight: 500 }}>{accreditation?.gender || "Gender"}</span>
              {isAthlete && age !== null && (
                <>
                  <span style={{ color: "#cbd5e1" }}>|</span>
                  <span style={{ fontWeight: "bold", color: "#1e40af" }}>Age: {age}</span>
                </>
              )}
            </div>
            {/* Dynamic Flag & Country Name */}
            {(() => {
              const isShortName = countryName?.length < 12;
              const flagWidth = isShortName ? 54 : 44;
              const flagHeight = isShortName ? 36 : 28;
              const nameSize = isShortName ? 14 : countryFontSize;

              return (
                <div style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {countryData?.flag && (
                    <img
                      src={`https://flagcdn.com/w80/${countryData.flag}.png`}
                      alt="Flag"
                      style={{
                        width: `${flagWidth}px`,
                        height: `${flagHeight}px`,
                        minWidth: `${flagWidth}px`,
                        minHeight: `${flagHeight}px`,
                        borderRadius: "3px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        objectFit: "cover",
                        border: "1px solid #e2e8f0",
                        flexShrink: 0
                      }}
                      crossOrigin="anonymous"
                    />
                  )}
                  {countryNameUrl ? (
                    <img src={countryNameUrl} alt={countryName} style={{ height: `${nameSize + 4}px`, maxWidth: "120px", objectFit: "contain", objectPosition: "left" }} />
                  ) : (
                    <span style={{ fontSize: `${nameSize}px`, fontWeight: "bold", color: "#1e40af", lineHeight: "1.2", ...cardFont }}>
                      {countryName}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* QR CODE + ZONE BADGES — 84px white strip */}
        <div style={{ height: "84px", width: "100%", backgroundColor: "white", display: "flex", alignItems: "center", padding: "4px 12px 4px 12px", gap: "10px", flexShrink: 0 }}>
          {/* QR Code — bottom-left */}
          <div style={{ flexShrink: 0 }}>
            {qrDataUrl ? (
              <div data-qr-code="true" style={{ padding: "2px", backgroundColor: "white", border: "2px solid #e2e8f0", borderRadius: "4px" }}>
                <img src={qrDataUrl} alt="QR Verify" style={{ width: "70px", height: "70px", display: "block", imageRendering: "crisp-edges" }} crossOrigin="anonymous" />
              </div>
            ) : (
              <div style={{ width: "74px", height: "74px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px" }}>
                <p style={{ fontSize: "8px", color: "#94a3b8", textAlign: "center" }}>QR</p>
              </div>
            )}
          </div>
          {/* Zone badges */}
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            paddingBottom: "4px",
            gap: zoneCodes.length <= 4 ? "6px" : zoneCodes.length <= 6 ? "4px" : "3px",
            flexWrap: "nowrap",
            height: "100%"
          }}>
            {zoneCodes.length > 0 ? (
              zoneCodes.slice(0, 8).map((code, index) => {
                const zoneInfo = zones.find(z => z.code === code);
                const zBgColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : "#0f172a";
                const count = zoneCodes.length;
                const boxSize = count <= 4 ? 32 : count <= 6 ? 28 : 24;
                const fontSize = count <= 4 ? 15 : count <= 6 ? 13 : 11;
                return zoneBadgePngs[code] ? (
                  <img key={index} src={zoneBadgePngs[code]} alt={code} style={{ width: `${boxSize}px`, height: `${boxSize}px`, display: "block", imageRendering: "crisp-edges" }} />
                ) : (
                  <div key={index} style={{
                    backgroundColor: zBgColor,
                    color: "white",
                    width: `${boxSize}px`,
                    height: `${boxSize}px`,
                    lineHeight: `${boxSize}px`,
                    textAlign: "center",
                    borderRadius: "3px",
                    fontSize: `${fontSize}px`,
                    fontWeight: 700,
                    ...cardFont
                  }}>
                    {code}
                  </div>
                );
              })
            ) : (
              <span style={{ fontSize: `${CARD_FONT_SIZE}px`, color: "#94a3b8", ...cardFont }}>No Access</span>
            )}
          </div>
        </div>

        {/* SPONSORS */}
        <div style={{ height: "36px", width: "100%", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "0 12px", flexShrink: 0, backgroundColor: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", width: "100%", height: "100%" }}>
            {event?.sponsorLogos?.length > 0 ? (
              event.sponsorLogos.slice(0, 6).map((logo, index) => (
                logo ? <img key={index} src={logo} alt="Sponsor" style={{ height: "26px", maxWidth: "50px", objectFit: "contain" }} crossOrigin="anonymous" /> : null
              ))
            ) : (
              <span style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic", ...cardFont }}>Sponsors</span>
            )}
          </div>
        </div>
      </div>

      {/* BACK CARD */}
      <div
        id={`accreditation-back-card${idSuffix}`}
        style={{
          width: "320px", height: "454px", minWidth: "320px", minHeight: "454px",
          maxWidth: "320px", maxHeight: "454px",
          background: "linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)",
          borderRadius: "0", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden", flexShrink: 0,
          border: "1px solid #334155", position: "relative",
          marginLeft: "20px", boxSizing: "border-box", flexGrow: 0,
          ...cardFont
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
          <svg style={{ width: "100%", height: "100%" }} viewBox="0 0 320 454" preserveAspectRatio="none">
            <defs>
              <pattern id={`backPattern${idSuffix}`} patternUnits="userSpaceOnUse" width="40" height="40">
                <circle cx="20" cy="20" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#backPattern${idSuffix})`} />
          </svg>
        </div>

        {event?.backTemplateUrl ? (
          <img src={event.backTemplateUrl} alt="Back Template" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "white" }} crossOrigin="anonymous" />
        ) : (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 10 }}>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{ display: "inline-block", padding: "8px 24px", background: "linear-gradient(to right, #0891b2, #2563eb)", borderRadius: "9999px", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "white", ...cardFont }}>
                  {event?.name || "Event Name"}
                </h3>
              </div>
            </div>
            <div style={{ marginBottom: "16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "4px", height: "24px", backgroundColor: "#06b6d4", borderRadius: "9999px" }} />
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", ...cardFont }}>Access Zones</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {zoneCodes.length > 0 ? zoneCodes.map((code, index) => {
                  const zoneInfo = zones?.find(z => z.code === code);
                  const zoneAccentColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : "#06b6d4";
                  return (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "10px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: zoneAccentColor, flexShrink: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "white", ...cardFont }}>{code}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "12px", color: "white", fontWeight: 500, ...cardFont }}>
                          {zoneInfo?.name || code}
                        </span>
                        {zoneInfo?.description && (
                          <p style={{ fontSize: "10px", color: "#94a3b8", ...cardFont }}>{zoneInfo.description}</p>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <p style={{ fontSize: "12px", color: "#64748b", ...cardFont }}>No zone access assigned</p>
                )}
              </div>
            </div>
            <div style={{ background: "linear-gradient(to right, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.2))", borderRadius: "8px", padding: "14px", marginTop: "auto", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <svg style={{ width: "18px", height: "18px", color: "#fbbf24", flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <p style={{ fontSize: "11px", fontWeight: "bold", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", ...cardFont }}>Important</p>
              </div>
              <p style={{ fontSize: "10px", color: "#e2e8f0", lineHeight: 1.5, ...cardFont }}>
                This accreditation must be worn visibly at all times. Access is restricted to authorized zones only.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

const AccreditationCardPreview = memo(function AccreditationCardPreview({ accreditation, event, zones = [], eventCategories = [] }) {
  return (
    <div id="accreditation-card-preview" style={{ display: "inline-block", fontFamily: '"Gill Sans MT", "Gill Sans", Calibri, sans-serif' }}>
      <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start" }}>
        <CardInner accreditation={accreditation} event={event} zones={zones} eventCategories={eventCategories} idSuffix="" />
      </div>
    </div>
  );
});

export default AccreditationCardPreview;
