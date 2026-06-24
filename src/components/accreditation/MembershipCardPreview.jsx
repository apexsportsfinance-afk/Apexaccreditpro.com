import React, { memo, useState, useEffect, useRef } from "react";
import * as QRCodeLib from "qrcode";
import { getCountryName, getCountryCode3, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
import { BadgeCustomFields } from "./BadgeCustomFieldsV2";
import { usePublicAssetUrls } from "../../lib/storage/publicAssets";

const CARD_FONT = '"Gill Sans MT", "Gill Sans", Calibri, sans-serif';
const CARD_FONT_SIZE = 11;

const roleColors = {
  athlete: { bg: "bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500", hex: "#2563eb" },
  coach: { bg: "bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400", hex: "#0284c7" },
  media: { bg: "bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500", hex: "#4f46e5" },
  official: { bg: "bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-400", hex: "#0891b2" },
  medical: { bg: "bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500", hex: "#475569" },
  staff: { bg: "bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600", hex: "#1d4ed8" },
  vip: { bg: "bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400", hex: "#0d9488" },
  organizer: { bg: "bg-gradient-to-r from-cyan-800 via-cyan-700 to-cyan-600", hex: "#0e7490" }
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
    return cat?.badgeColor || cat?.badge_color || null;
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

const roleBannerCache = new Map();
const useRoleBannerPng = (role, bgColor, textColor = "#000000", fontSize = "14px", fontWeight = "bold", width = 320, height = 40) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    const key = `${role}_${bgColor}_${textColor}_${fontSize}_${fontWeight}_${width}_${height}`;
    if (roleBannerCache.has(key)) {
      setUrl(roleBannerCache.get(key));
      return;
    }
    const scale = 16; // Increased to support 12x global scale
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
    ctx.fillStyle = textColor || "#000000";
    
    // Parse font size and weight
    const parsedFontSize = fontSize ? fontSize.toString().replace("px", "") + "px" : "14px";
    const parsedFontWeight = fontWeight || "bold";
    ctx.font = `${parsedFontWeight} ${parsedFontSize} ${CARD_FONT}`;
    
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
    const dataUrl = canvas.toDataURL("image/png");
    roleBannerCache.set(key, dataUrl);
    setUrl(dataUrl);
    
    // Explicitly free canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }, [role, bgColor, textColor, fontSize, fontWeight, width, height]);
  return url;
};

const countryNameCache = new Map();
const useCountryNamePng = (name, fontSize = 11) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!name) return;
    const key = `${name}_${fontSize}`;
    if (countryNameCache.has(key)) {
      setUrl(countryNameCache.get(key));
      return;
    }
    const height = 22;
    const scale = 16; // Increased to support 12x global scale
    const canvas = document.createElement("canvas");
    const tempCtx = canvas.getContext("2d");
    tempCtx.font = `bold ${fontSize}px ${CARD_FONT}`;
    const textWidth = Math.ceil(tempCtx.measureText(name).width) + 4;
    canvas.width = textWidth * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#000000";
    ctx.font = `bold ${fontSize}px ${CARD_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(name, 0, height / 2);
    const dataUrl = canvas.toDataURL("image/png");
    countryNameCache.set(key, dataUrl);
    setUrl(dataUrl);
    
    // Explicitly free canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }, [name, fontSize]);
  return url;
};

const zoneBadgeCache = new Map();
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
      const zoneInfo = zones.find(z => z.code === code);
      const bgColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : "#0f172a";
      const key = `${code}_${bgColor}_${DISPLAY}_${FONT_SIZE}`;
      if (zoneBadgeCache.has(key)) {
        result[code] = zoneBadgeCache.get(key);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = BADGE_SIZE * 8; // Multiplied by 8 for high-res (scale 16)
      canvas.height = BADGE_SIZE * 8;
      const ctx = canvas.getContext("2d");
      ctx.scale(16, 16); // Increased to support 12x global scale
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(0, 0, DISPLAY, DISPLAY, 3);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = `bold ${FONT_SIZE}px ${CARD_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, DISPLAY / 2, DISPLAY / 2 + 0.5);
      const dataUrl = canvas.toDataURL("image/png");
      zoneBadgeCache.set(key, dataUrl);
      result[code] = dataUrl;
      
      // Explicitly free canvas memory
      canvas.width = 0;
      canvas.height = 0;
    });
    setBadges(result);
  }, [codesKey, zonesKey]);
  return badges;
};

// NOTE: not currently rendered in this file (the membership header is inlined in
// MembershipCardInner). Kept for parity with AccreditationCardPreview; takes an
// already-resolved logoUrl so it never reads a raw storage ref.
const AquaticsHeader = memo(function AquaticsHeader({ logoUrl, bgColor }) {
  return (
    <div style={{ height: "100px", width: "100%", position: "relative", overflow: "hidden", flexShrink: 0 }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Event Header"
          style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block", margin: "auto" }}
          crossOrigin="anonymous"
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          background: bgColor || "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: bgColor || "#06b6d4",
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

export const MembershipCardInner = memo(function MembershipCardInner({ accreditation, event, zones = [], eventCategories = [], idSuffix = "", frontBackgroundUrl = "", customFieldConfigs = [], onlyFrontPage = false }) {
  // Resolve the card's storage-backed images (photo + event branding) through
  // the public-verify-assets edge function so they render — and html2canvas can
  // capture them with crossOrigin — whether the bucket is public or private.
  // Flag OFF: synchronous public URLs (unchanged).
  const cardAssetValues = [
    accreditation?.photoUrl,
    event?.logoUrl,
    event?.backTemplateUrl,
    ...(Array.isArray(event?.sponsorLogos) ? event.sponsorLogos : []),
  ].filter(Boolean);
  const { urls: cardUrls, loading: cardAssetsLoading } = usePublicAssetUrls(cardAssetValues, {
    accreditationId: accreditation?.id,
    eventId: event?.id,
    scope: accreditation?.id ? "profile" : "branding",
  });
  // Original simple role-based color logic
  const roleData = getRoleData(accreditation?.role);
  const finalColor = resolveCategoryColor(accreditation?.role, eventCategories) || roleData.hex;

  // Extract category styling details
  const categoryMatch = eventCategories?.find(ec => {
    const cat = ec.category || ec;
    return cat.name?.toLowerCase() === accreditation?.role?.toLowerCase();
  });
  const categoryStyle = categoryMatch?.category || categoryMatch || {};

  let rawZoneCode = accreditation?.zoneCode;
  if (Array.isArray(rawZoneCode)) rawZoneCode = rawZoneCode.join(",");
  const zoneCodes = (typeof rawZoneCode === "string" ? rawZoneCode : "")
    .split(",")
    .map(z => z.trim())
    .filter(code => {
      if (!code) return false;
      const zoneInfo = zones.find(z => String(z.code).toUpperCase() === String(code).toUpperCase());
      // STRICT FILTER: If the zone is marked as hidden, it MUST NOT appear on the printed card
      return zoneInfo && !zoneInfo?.settings?.isHidden;
    });
  const countryData = COUNTRIES.find(c => 
    c.code?.toUpperCase() === accreditation?.nationality?.toUpperCase() || 
    c.name?.toLowerCase() === accreditation?.nationality?.toLowerCase()
  );
  const countryName = getCountryCode3(accreditation?.nationality);
  const isAthlete = accreditation?.role?.toLowerCase() === "athlete";
  const age = isAthlete && accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;
  const countryFontSize = getCountryFontSize(countryName);

  const zoneBadgePngs = useZoneBadgePngs(zoneCodes, zones);
  const roleBannerUrl = useRoleBannerPng(
    accreditation?.role, 
    finalColor, 
    categoryStyle.textColor || "#000000",
    categoryStyle.fontSize,
    categoryStyle.fontWeight
  );
  const countryNameUrl = useCountryNamePng(countryName, countryFontSize);
  const expired = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  
  const idStr = String(accreditation?.accreditationId || "");
  const idNumber = idStr.includes("-") ? idStr.split("-").pop() : (idStr || "---");
  
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
          width: 1024,
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
    <div className="cut-here-line" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* FRONT CARD CONTAINER */}
      <div className="qr-print-preview" style={{ padding: "8px", background: "white", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px dashed #cbd5e1", width: "max-content" }}>
      <div
        id={`accreditation-front-card${idSuffix}`}
        data-accreditation-id={accreditation?.accreditationId || accreditation?.badgeNumber || accreditation?.id || ""}
        data-assets-ready={cardAssetsLoading ? "false" : "true"}
        style={{
          width: "324px", height: "204px", minWidth: "324px", minHeight: "204px",
          maxWidth: "324px", maxHeight: "204px", backgroundColor: "#ffffff",
          borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          position: "relative",
          border: expired ? "2px solid #f87171" : "1px solid #e2e8f0",
          boxSizing: "border-box", flexShrink: 0, flexGrow: 0,
          ...cardFont
        }}
      >
        {expired && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(239, 68, 68, 0.1)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#dc2626", color: "white", padding: "4px 16px", transform: "rotate(-15deg)", fontWeight: "bold", fontSize: "16px", letterSpacing: "0.1em", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", ...cardFont }}>
              EXPIRED
            </div>
          </div>
        )}

        {frontBackgroundUrl && (
          <img 
            src={frontBackgroundUrl} 
            alt="Front Background" 
            style={{ 
              position: "absolute", inset: 0, width: "100%", height: "100%", 
              opacity: 0.15, zIndex: 0, objectFit: "cover"
            }} 
            crossOrigin="anonymous" 
          />
        )}

        {/* FRONT CARD CONTENT */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 10 }}>
          
          {/* 1. HEADER ROW */}
          <div style={{ height: "45px", width: "100%", borderBottom: "1px solid #cbd5e1", backgroundColor: "#ffffff", display: "flex" }}>
            {event?.logoUrl && cardUrls[event.logoUrl] ? (
              <img src={cardUrls[event.logoUrl]} alt="Header" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} crossOrigin="anonymous" />
            ) : (
              <div style={{ padding: "0 14px", display: "flex", alignItems: "center", width: "100%" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: finalColor }}>{event?.name || "EVENT HEADER"}</div>
              </div>
            )}
          </div>

          {/* MAIN CONTENT ROW */}
          <div style={{ flex: 1, display: "flex", padding: "10px 14px", gap: "16px", position: "relative" }}>
            
            {/* 2. LEFT SIDE (Photo + ID/Badge) */}
            <div style={{ display: "flex", flexDirection: "column", width: "80px", flexShrink: 0 }}>
              <div style={{ width: "80px", height: "100px", borderRadius: "6px", overflow: "hidden", backgroundColor: "#f8fafc", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                {accreditation?.photoUrl && cardUrls[accreditation.photoUrl] ? (
                  <img src={cardUrls[accreditation.photoUrl]} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} crossOrigin="anonymous" />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg style={{ width: "32px", height: "32px", color: "#cbd5e1" }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", marginTop: "12px", gap: "5px" }}>
                <span style={{ fontSize: "8px", color: "black", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                  <strong style={{ fontWeight: 800 }}>ID:</strong> <span style={{ fontWeight: 500 }}>{idNumber}</span>
                </span>
                <span style={{ fontSize: "8px", color: "black", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                  <strong style={{ fontWeight: 800 }}>BADGE NO:</strong> <span style={{ fontWeight: 500 }}>{accreditation?.badgeNumber || "N/A"}</span>
                </span>
              </div>
            </div>

            {/* 3. MIDDLE SECTION (Name, Club, Nationality, DOB) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: "2px", minWidth: 0 }}>
              
              <h2 style={{ 
                fontWeight: 800, color: finalColor, textTransform: "uppercase", 
                fontSize: fullName.length > 24 ? "9px" : fullName.length > 18 ? "11px" : fullName.length > 14 ? "14px" : "18px", 
                margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em", 
                whiteSpace: "normal", wordWrap: "break-word",
                overflow: "visible", flexShrink: 0 
              }}>
                {fullName}
              </h2>
              
              <div style={{ display: "flex", flexDirection: "column", marginTop: "8px", flexShrink: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: 500, color: "black", fontFamily: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif", textTransform: "capitalize", lineHeight: "normal" }}>
                  {String(accreditation?.role || "Participant").toLowerCase()}{accreditation?.gender ? ` - ${String(accreditation.gender).toLowerCase()}` : ""}
                </div>
                {accreditation?.dateOfBirth && (
                  <div style={{ fontSize: "8px", fontWeight: 500, color: "black", fontFamily: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif", marginTop: "5px", lineHeight: "normal", whiteSpace: "nowrap" }}>
                    {new Date(accreditation.dateOfBirth).toLocaleDateString('en-GB')}
                  </div>
                )}
              </div>

              <div style={{ fontSize: accreditation?.club?.length > 25 ? "8px" : accreditation?.club?.length > 18 ? "9px" : "11px", fontWeight: 500, color: "black", fontFamily: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif", textTransform: "capitalize", marginTop: "8px", lineHeight: "normal", whiteSpace: "nowrap", overflow: "visible", flexShrink: 0 }}>
                {String(accreditation?.club || "Independent").toLowerCase()}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", flexShrink: 0 }}>
                 {countryData?.flag && (
                   <img src={`https://flagcdn.com/w160/${countryData.flag}.png`} alt={countryName} style={{ height: "10px", width: "15px", border: "1px solid #e2e8f0", borderRadius: "2px", objectFit: "cover", backgroundColor: "white", display: "block" }} crossOrigin="anonymous" />
                 )}
                 <div style={{ height: "10px", display: "flex", alignItems: "center" }}>
                   <svg height="10" width="100" style={{ display: "block" }}>
                     <text x="0" y="8.5" fill="#475569" fontSize="9" fontWeight="600" fontFamily="sans-serif" style={{ textTransform: "uppercase" }}>{countryName}</text>
                   </svg>
                 </div>
              </div>

              <div style={{ flex: 1 }} />
              
              {/* Bottom Logos */}
              <div style={{ display: "flex", alignItems: "center", height: "30px", marginTop: "auto", marginBottom: "-4px", width: "100%", gap: "6px", overflow: "hidden", flexShrink: 0 }}>
                {event?.sponsorLogos && event.sponsorLogos.slice(0, 4).map((logo, index) => (
                  logo ? <img key={index} src={cardUrls[logo]} alt="Sponsor" style={{ maxHeight: "16px", maxWidth: "60px", objectFit: "contain" }} crossOrigin="anonymous" /> : null
                ))}
              </div>
            </div>

            {/* 4. RIGHT SIDE (QR + Zone) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "65px", flexShrink: 0 }}>
              {qrDataUrl ? (
                <div data-qr-code="true" style={{ padding: "2px", backgroundColor: "white", border: "1px solid #0f172a", borderRadius: "4px" }}>
                  <img src={qrDataUrl} alt="QR" style={{ width: "60px", height: "60px", display: "block", imageRendering: "crisp-edges" }} crossOrigin="anonymous" />
                </div>
              ) : (
                <div style={{ width: "60px", height: "60px", backgroundColor: "#e2e8f0", borderRadius: "4px" }} />
              )}
              
              {zoneCodes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "3px", marginTop: "8px" }}>
                  {zoneCodes.map((code, idx) => {
                    const zoneInfo = zones?.find(z => z.code === code);
                    const zoneAccentColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : finalColor;
                    const w = code.length > 2 ? 24 : code.length > 1 ? 20 : 16;
                    return (
                      <div key={idx}>
                        <svg width={w} height="16" viewBox={`0 0 ${w} 16`} style={{ display: "block" }}>
                          <rect x="0" y="0" width={w} height="16" rx="2" fill={zoneAccentColor} />
                          <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{code}</text>
                        </svg>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
      </div>

      {/* BACK CARD CONTAINER */}
      {!onlyFrontPage && (
      <div className="qr-print-preview" style={{ padding: "8px", background: "white", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px dashed #cbd5e1", width: "max-content" }}>
      <div
        id={`accreditation-back-card${idSuffix}`}
        style={{
          width: "324px", height: "204px", minWidth: "324px", minHeight: "204px",
          maxWidth: "324px", maxHeight: "204px",
          background: "linear-gradient(to bottom right, #ffffff, #f8fafc)",
          borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          overflow: "hidden", flexShrink: 0,
          border: "1px solid #cbd5e1", position: "relative",
          boxSizing: "border-box", flexGrow: 0, display: "flex", flexDirection: "column",
          ...cardFont
        }}
      >
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8px", backgroundColor: finalColor, zIndex: 5 }} />
        
        {event?.backTemplateUrl && cardUrls[event.backTemplateUrl] ? (
          <img src={cardUrls[event.backTemplateUrl]} alt="Back Template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", backgroundColor: "white", position: "relative", zIndex: 10 }} crossOrigin="anonymous" />
        ) : (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 10, justifyContent: "space-between" }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", ...cardFont }}>
                {event?.name || "Event Name"}
              </h3>
            </div>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
               {zoneCodes.slice(0, 6).map((code, index) => {
                  const zoneInfo = zones?.find(z => z.code === code);
                  const zoneAccentColor = (zoneInfo && zoneInfo.color) ? zoneInfo.color : finalColor;
                  return (
                    <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "white", border: `2px solid ${zoneAccentColor}`, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: zoneAccentColor, ...cardFont }}>{code}</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={{ backgroundColor: "#f8fafc", borderRadius: "6px", padding: "8px", border: "1px solid #e2e8f0", marginBottom: "8px" }}>
              <p style={{ fontSize: "8.5px", color: "#475569", lineHeight: 1.4, margin: 0, fontWeight: 500, textAlign: "center", ...cardFont }}>
                <strong>TERMS & CONDITIONS:</strong> This membership card remains the property of the issuing organization. It must be presented upon request and is strictly non-transferable.
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
});

const MembershipCardPreview = memo(function MembershipCardPreview({ accreditation, event, zones = [], eventCategories = [], frontBackgroundUrl = "", customFieldConfigs = [], idSuffix = "", onlyFrontPage = false }) {
  return (
    <div id="accreditation-card-preview" style={{ display: "inline-block", fontFamily: '"Gill Sans MT", "Gill Sans", Calibri, sans-serif' }}>
      <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start" }}>
        <MembershipCardInner
          accreditation={accreditation}
          event={event}
          zones={zones}
          eventCategories={eventCategories}
          idSuffix={idSuffix}
          frontBackgroundUrl={frontBackgroundUrl}
          customFieldConfigs={customFieldConfigs}
          onlyFrontPage={onlyFrontPage}
        />
      </div>
    </div>
  );
});

export default MembershipCardPreview;

