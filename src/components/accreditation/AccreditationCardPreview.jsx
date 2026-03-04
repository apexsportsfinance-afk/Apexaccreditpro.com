import React from "react";
import { getCountryName, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
import QRCode from "qrcode";

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

const getNameFontSize = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  const len = full.length;
  if (len > 28) return 14;
  if (len > 22) return 17;
  if (len > 16) return 19;
  return 22;
};

// Pre-render role banner as a canvas image so html2canvas copies pixels instead of rendering text
const useRoleBannerPng = (role, bgColor, width = 320, height = 40) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = bgColor || "#2563eb";
    ctx.fillRect(0, 0, width, height);

    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 2;

    // Text
    ctx.fillStyle = "white";
    ctx.font = "bold 16px sans-serif";
    ctx.textBaseline = "middle";

    const text = (role || "PARTICIPANT").toUpperCase();
    const letterSpacing = 3.2; // 0.2em * 16px

    // Draw characters individually with letter-spacing, centered
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

// Pre-render country name as a canvas image at flag height for perfect vertical alignment
const useCountryNamePng = (name) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!name) return;
    const height = 30;
    const scale = 3;
    const canvas = document.createElement("canvas");
    const tempCtx = canvas.getContext("2d");
    tempCtx.font = "bold 16px sans-serif";
    const textWidth = Math.ceil(tempCtx.measureText(name).width) + 4;

    canvas.width = textWidth * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 16px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(name, 0, height / 2);

    setUrl(canvas.toDataURL("image/png"));
  }, [name]);
  return url;
};

const useZoneBadgePngs = (codes) => {
  const [badges, setBadges] = React.useState({});
  React.useEffect(() => {
    if (!codes || codes.length === 0) return;
    const result = {};
    const size = 64;
    codes.forEach((code) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(0, 0, 32, 32, 3);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, 16, 16.5);
      result[code] = canvas.toDataURL("image/png");
    });
    setBadges(result);
  }, [codes.join(",")]);
  return badges;
};

// NEW: Exported for PDF generation - renders cards with dynamic IDs
export const CardInner = ({ accreditation, event, zones = [], idSuffix = "" }) => {
  const matchingZone = zones.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase());
  const zoneColor = matchingZone?.color || null;
  const roleData = zoneColor ? { bg: "", hex: zoneColor } : getRoleData(accreditation?.role);
  const zoneCodes = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
  const countryData = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const countryName = getCountryName(accreditation?.nationality);
  const age = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;

  const zoneBadgePngs = useZoneBadgePngs(zoneCodes);
  const roleBannerUrl = useRoleBannerPng(accreditation?.role, zoneColor || roleData.hex);
  const countryNameUrl = useCountryNamePng(countryName);
  const expired = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  const idNumber = accreditation?.accreditationId?.split("-")?.pop() || "---";
  const nameFontSize = getNameFontSize(accreditation?.firstName, accreditation?.lastName);
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  const [qrDataUrl, setQrDataUrl] = React.useState(null);

  React.useEffect(() => {
    const generateQR = async () => {
      try {
        const verifyId = accreditation?.accreditationId || accreditation?.badgeNumber || accreditation?.id || "unknown";
        const verifyUrl = `${window.location.origin}/verify/${verifyId}`;
        const url = await QRCode.toDataURL(verifyUrl, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 200,
          color: { dark: "#0f172a", light: "#ffffff" }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation error:", err);
      }
    };
    if (accreditation) generateQR();
  }, [accreditation?.id, accreditation?.status, accreditation?.accreditationId]);

  return (
    <>
      {/* FRONT CARD - CRITICAL: Use exact pixel dimensions with box-sizing */}
      <div 
        id={`accreditation-front-card${idSuffix}`} 
        style={{ 
          width: "320px", 
          height: "454px", 
          minWidth: "320px",
          minHeight: "454px",
          maxWidth: "320px",
          maxHeight: "454px",
          backgroundColor: "#ffffff", 
          borderRadius: "0", 
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", 
          overflow: "hidden", 
          display: "flex", 
          flexDirection: "column", 
          position: "relative", 
          border: expired ? "2px solid #f87171" : "1px solid #e2e8f0",
          boxSizing: "border-box", // CRITICAL: Include border in dimensions
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        {expired && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(239, 68, 68, 0.1)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#dc2626", color: "white", padding: "8px 24px", transform: "rotate(-15deg)", fontWeight: "bold", fontSize: "24px", letterSpacing: "0.1em", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}>
              EXPIRED
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={{ position: "relative", height: "100px", background: "linear-gradient(to right, #22d3ee, #7dd3fc, #22d3ee)", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "relative", zIndex: 10, display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
            {event?.logoUrl ? (
              <img src={event.logoUrl} alt="Logo" style={{ maxHeight: "85px", maxWidth: "100%", objectFit: "contain" }} crossOrigin="anonymous" />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg style={{ width: "64px", height: "64px", color: "rgba(255,255,255,0.7)" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        <div style={{ height: "6px", backgroundColor: "white", flexShrink: 0 }} />

        {/* ROLE BANNER — rendered as canvas image for html2canvas compatibility */}
        <div style={{ height: "40px", width: "100%", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", flexShrink: 0 }}>
          {roleBannerUrl ? (
            <img src={roleBannerUrl} alt={accreditation?.role} style={{ width: "100%", height: "40px", display: "block" }} />
          ) : (
            <div style={{ height: "40px", lineHeight: "40px", textAlign: "center", width: "100%", backgroundColor: zoneColor || roleData.hex || "#2563eb", color: "white", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.2em", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
              {accreditation?.role || "PARTICIPANT"}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ display: "flex", flex: 1, padding: "12px", position: "relative", zIndex: 10, minHeight: 0, backgroundColor: "white", overflow: "hidden" }}>
          {/* LEFT: Photo + ID + QR */}
          <div style={{ width: "110px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: "100px", height: "120px", border: "2px solid #cbd5e1", padding: "2px", backgroundColor: "white", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", flexShrink: 0 }}>
              {accreditation?.photoUrl ? (
                <img src={accreditation.photoUrl} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(to bottom right, #f1f5f9, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ width: "40px", height: "40px", color: "#cbd5e1" }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>
            <div style={{ marginTop: "8px", textAlign: "left", width: "100%" }}>
              <p style={{ fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: 500 }}>ID: {idNumber}</p>
              <p style={{ fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: "bold" }}>BADGE: {accreditation?.badgeNumber || "---"}</p>
            </div>
            {qrDataUrl && (
              <div style={{ marginTop: "16px" }}>
                <img src={qrDataUrl} alt="QR Verify" style={{ width: "70px", height: "70px" }} />
              </div>
            )}
          </div>

          {/* RIGHT: Name, details */}
          <div style={{ flex: 1, paddingLeft: "16px", display: "flex", flexDirection: "column", justifyContent: "flex-start", minWidth: 0 }}>
            <h2 style={{ fontWeight: "bold", color: "#1e3a8a", textTransform: "uppercase", fontSize: `${nameFontSize}px`, lineHeight: 1.15, margin: 0 }}>
              {fullName}
            </h2>

            <p style={{ fontSize: "14px", color: "#334155", marginTop: "12px", lineHeight: 1.3, wordBreak: "break-word" }}>
              {accreditation?.club || "Club Name"}
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              {accreditation?.role || "Participant"}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "13px", color: "#475569" }}>
              {age !== null && (
                <span style={{ fontWeight: 500 }}>{age} Y</span>
              )}
              {age !== null && <span style={{ color: "#cbd5e1" }}>|</span>}
              <span style={{ fontWeight: 500 }}>{accreditation?.gender || "Gender"}</span>
            </div>

            {/* Country — both flag and name are <img> at 30px height for pixel-perfect alignment */}
            <div style={{ marginTop: "16px", height: "30px" }}>
              {countryData?.flag && (
                <img
                  src={`https://flagcdn.com/w80/${countryData.flag}.png`}
                  alt="Flag"
                  style={{ width: "44px", height: "30px", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", objectFit: "cover", border: "1px solid #e2e8f0", display: "inline-block", verticalAlign: "top", marginRight: "12px" }}
                  crossOrigin="anonymous"
                />
              )}
              {countryNameUrl ? (
                <img src={countryNameUrl} alt={countryName} style={{ height: "30px", display: "inline-block", verticalAlign: "top" }} />
              ) : (
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#1e40af", display: "inline-block", verticalAlign: "top", lineHeight: "30px" }}>
                  {countryName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ZONE NUMBERS */}
        <div style={{ height: "26px", width: "100%", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", paddingLeft: "12px", paddingRight: "12px", flexShrink: 0 }}>
        {zoneCodes.length > 0 ? (
            zoneCodes.slice(0, 4).map((code, index) => (
              zoneBadgePngs[code] ? (
                <img key={index} src={zoneBadgePngs[code]} alt={code} style={{ width: "30px", height: "30px", display: "block" }} />
              ) : (
                <div key={index} style={{ backgroundColor: "#0f172a", color: "white", width: "30px", height: "30px", lineHeight: "30px", textAlign: "center", borderRadius: "3px", fontSize: "13px", fontWeight: 700 }}>
                  {code}
                </div>
              )
            ))
          ) : (
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>No Access</span>
          )}
        </div>

        {/* SPONSORS */}
        <div style={{ height: "36px", width: "100%", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "0 12px", flexShrink: 0, backgroundColor: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", width: "100%", height: "100%" }}>
            {event?.sponsorLogos?.length > 0 ? (
              event.sponsorLogos.slice(0, 6).map((logo, index) => (
                logo ? <img key={index} src={logo} alt="Sponsor" style={{ height: "26px", maxWidth: "50px", objectFit: "contain" }} crossOrigin="anonymous" /> : null
              ))
            ) : (
              <span style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic" }}>Sponsors</span>
            )}
          </div>
        </div>
      </div>

      {/* BACK CARD */}
      <div 
        id={`accreditation-back-card${idSuffix}`} 
        style={{ 
          width: "320px", 
          height: "454px",
          minWidth: "320px",
          minHeight: "454px", 
          maxWidth: "320px",
          maxHeight: "454px",
          background: "linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)", 
          borderRadius: "0", 
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", 
          overflow: "hidden", 
          flexShrink: 0, 
          border: "1px solid #334155", 
          position: "relative", 
          marginLeft: "20px",
          boxSizing: "border-box",
          flexGrow: 0,
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
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ display: "inline-block", padding: "8px 24px", background: "linear-gradient(to right, #0891b2, #2563eb)", borderRadius: "9999px", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>
                  {event?.name || "Event Name"}
                </h3>
              </div>
            </div>

            <div style={{ marginBottom: "16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <div style={{ width: "4px", height: "24px", backgroundColor: "#06b6d4", borderRadius: "9999px" }} />
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Access</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {zoneCodes.map((code, index) => {
                  const zoneInfo = zones?.find(z => z.code === code);
                  return (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "16px", backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(to bottom right, #06b6d4, #2563eb)", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "white" }}>{code}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "12px", color: "white", fontWeight: 500 }}>
                          {zoneInfo?.name || code}
                        </span>
                        {zoneInfo?.description && (
                          <p style={{ fontSize: "10px", color: "#94a3b8" }}>{zoneInfo.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "linear-gradient(to right, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.2))", borderRadius: "8px", padding: "16px", marginTop: "auto", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <svg style={{ width: "20px", height: "20px", color: "#fbbf24" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <p style={{ fontSize: "12px", fontWeight: "bold", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>Important</p>
              </div>
              <p style={{ fontSize: "11px", color: "#e2e8f0", lineHeight: 1.5 }}>
                This accreditation must be worn visibly at all times.
                Access is restricted to authorized zones only.
              </p>
            </div>

            <div style={{ position: "absolute", bottom: "16px", right: "16px", opacity: 0.1 }}>
              <svg style={{ width: "80px", height: "80px", color: "#06b6d4" }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 18c.6.5 1.2 1 2.3 1 1.4 0 2.1-.6 2.7-1.2.6-.6 1.3-1.2 2.7-1.2s2.1.6 2.7 1.2c.6.6 1.3 1.2 2.7 1.2s2.1-.6 2.7-1.2c.6-.6 1.3-1.2 2.7-1.2.7 0 1.2.1 1.7.4V15c-.5-.3-1.1-.4-1.7-.4-1.4 0-2.1.6-2.7 1.2-.6.6-1.3-1.2-2.7-1.2s-2.1.6-2.7 1.2C6.4 16.4 5.7 17 4.3 17c-1.1 0-1.7-.5-2.3-1v2z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// CRITICAL FIX: Use inline-block wrapper to prevent flex stretching
const AccreditationCardPreview = ({ accreditation, event, zones = [] }) => {
  return (
    <div id="accreditation-card-preview" style={{ display: "inline-block", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start" }}>
        <CardInner accreditation={accreditation} event={event} zones={zones} idSuffix="" />
      </div>
    </div>
  );
};

export default AccreditationCardPreview;
