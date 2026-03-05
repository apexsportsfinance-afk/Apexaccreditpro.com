import React, { memo } from "react";
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
  if (len > 30) return 13;
  if (len > 26) return 14;
  if (len > 22) return 16;
  if (len > 18) return 18;
  if (len > 14) return 20;
  if (len > 10) return 22;
  return 24;
};

const getCountryFontSize = (countryName) => {
  if (!countryName) return 14;
  const len = countryName.length;
  if (len > 24) return 10;
  if (len > 18) return 11;
  if (len > 14) return 12;
  if (len > 10) return 13;
  return 14;
};

const useRoleBannerPng = (role, bgColor, width = 320, height = 40) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    const scale = 3;
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
    ctx.font = "bold 16px sans-serif";
    ctx.textBaseline = "middle";
    const text = (role || "PARTICIPANT").toUpperCase();
    const letterSpacing = 3.2;
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

const useCountryNamePng = (name, fontSize = 14) => {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!name) return;
    const height = 26;
    const scale = 3;
    const canvas = document.createElement("canvas");
    const tempCtx = canvas.getContext("2d");
    tempCtx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = Math.ceil(tempCtx.measureText(name).width) + 4;
    canvas.width = textWidth * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#1e40af";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(name, 0, height / 2);
    setUrl(canvas.toDataURL("image/png"));
  }, [name, fontSize]);
  return url;
};

const useZoneBadgePngs = (codes) => {
  const [badges, setBadges] = React.useState({});
  const codesKey = codes.join(",");
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
  }, [codesKey]);
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

// Memoized CardInner — prevents expensive re-renders on every parent state change
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

  const zoneBadgePngs = useZoneBadgePngs(zoneCodes);
  const roleBannerUrl = useRoleBannerPng(accreditation?.role, finalColor);
  const countryNameUrl = useCountryNamePng(countryName, countryFontSize);
  const expired = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  const idNumber = accreditation?.accreditationId?.split("-")?.pop() || "---";
  const nameFontSize = getNameFontSize(accreditation?.firstName, accreditation?.lastName);
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  const [qrDataUrl, setQrDataUrl] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    const generateQR = async () => {
      try {
        const verifyId = accreditation?.accreditationId || accreditation?.badgeNumber || accreditation?.id || "unknown";
        const verifyUrl = `${window.location.origin}/verify/${verifyId}`;
        const url = await QRCode.toDataURL(verifyUrl, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 512,
          color: { dark: "#0f172a", light: "#ffffff" }
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation error:", err);
      }
    };
    if (accreditation) generateQR();
    return () => { cancelled = true; };
  }, [accreditation?.id, accreditation?.status, accreditation?.accreditationId, accreditation?.badgeNumber]);

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
        }}
      >
        {expired && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(239, 68, 68, 0.1)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#dc2626", color: "white", padding: "8px 24px", transform: "rotate(-15deg)", fontWeight: "bold", fontSize: "24px", letterSpacing: "0.1em", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}>
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
            <div style={{ height: "40px", lineHeight: "40px", textAlign: "center", width: "100%", backgroundColor: finalColor, color: "white", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.2em", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
              {accreditation?.role || "PARTICIPANT"}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ display: "flex", flex: 1, padding: "10px 12px 0px 12px", position: "relative", zIndex: 10, minHeight: 0, backgroundColor: "white", overflow: "hidden" }}>
          {/* LEFT: Photo + ID */}
          <div style={{ width: "110px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
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
            <div style={{ marginTop: "6px", textAlign: "left", width: "100%" }}>
              <p style={{ fontSize: "9px", color: "#334155", fontFamily: "monospace", fontWeight: 500 }}>ID: {idNumber}</p>
              <p style={{ fontSize: "9px", color: "#334155", fontFamily: "monospace", fontWeight: "bold" }}>BADGE: {accreditation?.badgeNumber || "---"}</p>
            </div>
          </div>

          {/* RIGHT: Name, details */}
          <div style={{ flex: 1, paddingLeft: "12px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <h2 style={{ fontWeight: "bold", color: "#1e3a8a", textTransform: "uppercase", fontSize: `${nameFontSize}px`, lineHeight: 1.15, margin: 0 }}>
              {fullName}
            </h2>
            <p style={{ fontSize: "13px", color: "#334155", marginTop: "10px", lineHeight: 1.3, wordBreak: "break-word" }}>
              {accreditation?.club || ""}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "12px", color: "#475569" }}>
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
            <div style={{ marginTop: "10px", height: "30px", display: "flex", alignItems: "center", gap: "8px" }}>
              {countryData?.flag && (
                <img
                  src={`https://flagcdn.com/w80/${countryData.flag}.png`}
                  alt="Flag"
                  style={{ width: "44px", height: "30px", minWidth: "44px", minHeight: "30px", maxWidth: "44px", maxHeight: "30px", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", objectFit: "cover", border: "1px solid #e2e8f0", flexShrink: 0 }}
                  crossOrigin="anonymous"
                />
              )}
              {countryNameUrl ? (
                <img src={countryNameUrl} alt={countryName} style={{ height: "30px", maxWidth: "120px", objectFit: "contain", objectPosition: "left" }} />
              ) : (
                <span style={{ fontSize: `${countryFontSize}px`, fontWeight: "bold", color: "#1e40af", lineHeight: "30px" }}>
                  {countryName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* QR CODE + ZONE NUMBERS */}
        <div style={{ height: "80px", width: "100%", backgroundColor: "white", display: "flex", alignItems: "flex-start", padding: "2px 12px 4px 12px", gap: "8px", flexShrink: 0 }}>
          <div style={{ flexShrink: 0 }}>
            {qrDataUrl ? (
              <div data-qr-code="true" style={{ padding: "2px", backgroundColor: "white", border: "2px solid #e2e8f0", borderRadius: "4px" }}>
                <img src={qrDataUrl} alt="QR Verify" style={{ width: "68px", height: "68px", display: "block", imageRendering: "pixelated" }} crossOrigin="anonymous" />
              </div>
            ) : (
              <div style={{ width: "72px", height: "72px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px" }}>
                <p style={{ fontSize: "8px", color: "#94a3b8", textAlign: "center" }}>QR</p>
              </div>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap", height: "100%", paddingBottom: "2px" }}>
            {zoneCodes.length > 0 ? (
              zoneCodes.slice(0, 6).map((code, index) => (
                zoneBadgePngs[code] ? (
                  <img key={index} src={zoneBadgePngs[code]} alt={code} style={{ width: "28px", height: "28px", display: "block" }} />
                ) : (
                  <div key={index} style={{ backgroundColor: "#0f172a", color: "white", width: "28px", height: "28px", lineHeight: "28px", textAlign: "center", borderRadius: "3px", fontSize: "12px", fontWeight: 700 }}>
                    {code}
                  </div>
                )
              ))
            ) : (
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>No Access</span>
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
              <span style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic" }}>Sponsors</span>
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
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "white" }}>
                  {event?.name || "Event Name"}
                </h3>
              </div>
            </div>
            <div style={{ marginBottom: "16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "4px", height: "24px", backgroundColor: "#06b6d4", borderRadius: "9999px" }} />
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Access Zones</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {zoneCodes.length > 0 ? zoneCodes.map((code, index) => {
                  const zoneInfo = zones?.find(z => z.code === code);
                  return (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "10px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(to bottom right, #06b6d4, #2563eb)", flexShrink: 0 }}>
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
                }) : (
                  <p style={{ fontSize: "12px", color: "#64748b" }}>No zone access assigned</p>
                )}
              </div>
            </div>
            <div style={{ background: "linear-gradient(to right, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.2))", borderRadius: "8px", padding: "14px", marginTop: "auto", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <svg style={{ width: "18px", height: "18px", color: "#fbbf24", flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <p style={{ fontSize: "11px", fontWeight: "bold", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>Important</p>
              </div>
              <p style={{ fontSize: "10px", color: "#e2e8f0", lineHeight: 1.5 }}>
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
    <div id="accreditation-card-preview" style={{ display: "inline-block", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start" }}>
        <CardInner accreditation={accreditation} event={event} zones={zones} eventCategories={eventCategories} idSuffix="" />
      </div>
    </div>
  );
});

export default AccreditationCardPreview;
