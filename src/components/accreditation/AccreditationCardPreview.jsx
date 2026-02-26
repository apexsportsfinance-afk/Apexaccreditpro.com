import React from "react";
import { getCountryName, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
import QRCode from "qrcode";

/* ── role colours ─────────────────────────────────────────── */
const roleColors = {
  athlete:  "#2563eb",
  coach:    "#0d9488",
  media:    "#d97706",
  official: "#7c3aed",
  medical:  "#e11d48",
  staff:    "#475569",
  vip:      "#b45309",
};
const getRoleHex = (role) => roleColors[role?.toLowerCase()] ?? "#475569";

/* ── canvas-based accurate name font sizing ───────────────── */
const RIGHT_COL_WIDTH = 174; // 320 - 110(left) - 12(pad-l) - 12(pad-r) - 16(gap) ≈ 170, give 4px buffer
const MAX_FONT = 22;
const MIN_FONT = 11;

const measureNameFontSize = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim().toUpperCase();
  if (!full) return MAX_FONT;

  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d");
  let size     = MAX_FONT;

  ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`;
  const w  = ctx.measureText(full).width;

  if (w > RIGHT_COL_WIDTH) {
    size = Math.floor(size * (RIGHT_COL_WIDTH / w));
    size = Math.max(size, MIN_FONT);
  }
  return size;
};

/* ── zone badge PNGs ──────────────────────────────────────── */
const useZoneBadgePngs = (codes) => {
  const [badges, setBadges] = React.useState({});

  React.useEffect(() => {
    if (!codes?.length) return;
    const result = {};
    const SZ = 64;

    codes.forEach((code) => {
      const c   = document.createElement("canvas");
      c.width   = SZ;
      c.height  = SZ;
      const ctx = c.getContext("2d");

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(0, 0, SZ, SZ, 6);
      ctx.fill();

      ctx.fillStyle    = "#ffffff";
      ctx.font         = `bold ${Math.round(SZ * 0.44)}px sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, SZ / 2, SZ / 2 + 1);

      result[code] = c.toDataURL("image/png");
    });

    setBadges(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);

  return badges;
};

/* ══════════════════════════════════════════════════════════COMPONENT
   ══════════════════════════════════════════════════════════ */
const AccreditationCardPreview = ({ accreditation, event, zones = [] }) => {

  /* colour */
  const matchingZone    = zones.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase());
  const roleBannerColor = matchingZone?.color ?? getRoleHex(accreditation?.role);

  /* data */
  const zoneCodes   = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) ?? [];
  const countryData = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const countryName = getCountryName(accreditation?.nationality);
  const age         = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear) : null;
  const expired     = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  const idNumber    = accreditation?.accreditationId?.split("-")?.pop() ?? "---";
  const fullName    = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  /* dynamic font — recalculate only when name changes */
  const nameFontSize = React.useMemo(
    () => measureNameFontSize(accreditation?.firstName, accreditation?.lastName),
    [accreditation?.firstName, accreditation?.lastName]
  );

  const zoneBadgePngs = useZoneBadgePngs(zoneCodes);

  /* QR */
  const [qrDataUrl, setQrDataUrl] = React.useState(null);
  React.useEffect(() => {
    if (!accreditation) return;
    const id  = accreditation.accreditationId ?? accreditation.badgeNumber ?? accreditation.id ?? "unknown";
    const url = `${window.location.origin}/verify/${id}`;
    QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 1, width: 200,
      color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(err => console.error("QR error:", err));
  }, [accreditation?.id, accreditation?.accreditationId, accreditation?.status]);

  /* ── shared inline-style shortcuts ── */
  const S = {
    card: {
      width: "320px", height: "454px",
      backgroundColor: "#ffffff",
      borderRadius: 0,
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
      overflow: "hidden", flexShrink: 0,
      display: "flex", flexDirection: "column",
      position: "relative",
      border: expired ? "2px solid #f87171" : "1px solid #e2e8f0",
    },
  };

  return (
    <div
      id="accreditation-card-preview"
      style={{
        display: "flex", flexWrap: "wrap", gap: "24px",
        alignItems: "flex-start", justifyContent: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >

      {/* ════════════════ FRONT CARD ════════════════ */}
      <div id="accreditation-front-card" style={S.card}>

        {/* expired overlay */}
        {expired && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
            backgroundColor: "rgba(239,68,68,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              backgroundColor: "#dc2626", color: "white",
              padding: "8px 24px", transform: "rotate(-15deg)",
              fontWeight: "bold", fontSize: "24px", letterSpacing: "0.1em",
            }}>EXPIRED</div>
          </div>
        )}

        {/* HEADER */}
        <div style={{
          height: "100px", flexShrink: 0, overflow: "hidden", position: "relative",
          background: "linear-gradient(to right, #22d3ee, #7dd3fc, #22d3ee)",
        }}>
          <div style={{
            position: "relative", zIndex: 10, height: "100%", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
          }}>
            {event?.logoUrl
              ? <img src={event.logoUrl} alt="Logo" style={{ maxHeight: "85px", maxWidth: "100%", objectFit: "contain" }} />
              : <svg style={{ width: "64px", height: "64px", color: "rgba(255,255,255,0.7)" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
            }
          </div>
        </div>

        {/* white spacer */}
        <div style={{ height: "6px", backgroundColor: "white", flexShrink: 0 }} />

        {/* ROLE BANNER */}
        <div style={{
          height: "40px", flexShrink: 0, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          backgroundColor: roleBannerColor,
        }}>
          <span style={{
            color: "white", fontSize: "16px", fontWeight: "bold",
            textTransform: "uppercase", letterSpacing: "0.2em",
            textShadow: "0 1px 2px rgba(0,0,0,0.2)", lineHeight: 1,
          }}>
            {accreditation?.role || "PARTICIPANT"}
          </span>
        </div>

        {/* BODY */}
        <div style={{
          display: "flex", flex: 1, padding: "12px",
          position: "relative", zIndex: 10, minHeight: 0,
          backgroundColor: "white",
        }}>

          {/* LEFT: photo + IDs + QR */}
          <div style={{ width: "110px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>

            {/* photo */}
            <div style={{
              width: "100px", height: "120px", flexShrink: 0,
              border: "2px solid #cbd5e1", padding: "2px",
              backgroundColor: "white", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}>
              {accreditation?.photoUrl
                ? <img src={accreditation.photoUrl} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{
                    width: "100%", height: "100%",
                    background: "linear-gradient(to bottom right, #f1f5f9, #e2e8f0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg style={{ width: "40px", height: "40px", color: "#cbd5e1" }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
              }
            </div>

            {/* IDs */}
            <div style={{ marginTop: "8px", width: "100%", textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: 500 }}>
                ID: {idNumber}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: "bold" }}>
                BADGE: {accreditation?.badgeNumber || "---"}
              </p>
            </div>

            {/* QR */}
            {qrDataUrl && (
              <div style={{ marginTop: "12px" }}>
                <img src={qrDataUrl} alt="QR" style={{ width: "70px", height: "70px", display: "block" }} />
              </div>
            )}
          </div>

          {/* RIGHT: name + details */}
          <div style={{
            flex: 1, paddingLeft: "16px",
            display: "flex", flexDirection: "column", justifyContent: "flex-start",
            minWidth: 0, overflow: "hidden",
          }}>

            {/* ── DYNAMIC NAME ── */}
            <h2 style={{
              margin: 0,
              fontWeight: "bold",
              color: "#1e3a8a",
              textTransform: "uppercase",
              fontSize: `${nameFontSize}px`,
              lineHeight: 1.15,
              whiteSpace: "nowrap",overflow: "hidden",
              textOverflow: "clip",
              width: "100%",
            }}>
              {fullName}
            </h2><p style={{ margin: "10px 0 0", fontSize: "14px", color: "#334155", lineHeight: 1.3, wordBreak: "break-word" }}>
              {accreditation?.club || "Club Name"}
            </p>

            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
              {accreditation?.role || "Participant"}
            </p>

            {/* age + gender */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", fontSize: "13px", color: "#475569" }}>
              {age !== null && <span style={{ fontWeight: 500 }}>{age} Y</span>}
              {age !== null && <span style={{ color: "#cbd5e1" }}>|</span>}
              <span style={{ fontWeight: 500 }}>{accreditation?.gender || "Gender"}</span>
            </div>

            {/* flag + country */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "14px" }}>
              {countryData?.flag && (
                <img
                  src={`https://flagcdn.com/w80/${countryData.flag}.png`}
                  alt="Flag"
                  crossOrigin="anonymous"
                  style={{
                    width: "44px", height: "30px", flexShrink: 0,
                    borderRadius: "4px", objectFit: "cover",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                />
              )}<p style={{ margin: 0, fontSize: "15px", fontWeight: "bold", color: "#1e40af", wordBreak: "break-word" }}>
                {countryName}
              </p>
            </div>
          </div>
        </div>

        {/* ZONE BADGES */}
        <div style={{
          height: "34px", width: "100%", flexShrink: 0,
          backgroundColor: "white",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: "4px", paddingLeft: "12px", paddingRight: "12px",}}>
          {zoneCodes.length > 0
            ? zoneCodes.slice(0, 4).map((code, i) =>
                zoneBadgePngs[code]
                  ? <img key={i} src={zoneBadgePngs[code]} alt={code} style={{ width: "30px", height: "30px", display: "block" }} />
                  : <div key={i} style={{
                      backgroundColor: "#0f172a", color: "white",
                      width: "30px", height: "30px", lineHeight: "30px",
                      textAlign: "center", borderRadius: "3px",
                      fontSize: "13px", fontWeight: 700,
                    }}>{code}</div>
              )
            : <span style={{ fontSize: "10px", color: "#94a3b8" }}>No Access</span>
          }
        </div>

        {/* SPONSORS */}
        <div style={{
          height: "36px", width: "100%", flexShrink: 0,
          borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "12px", padding: "0 12px",
        }}>
          {event?.sponsorLogos?.length > 0
            ? event.sponsorLogos.slice(0, 6).map((logo, i) =>
                logo ? <img key={i} src={logo} alt="Sponsor" style={{ height: "26px", maxWidth: "50px", objectFit: "contain" }} /> : null
              )
            : <span style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic" }}>Sponsors</span>
          }
        </div>
      </div>

      {/* ════════════════ BACK CARD ════════════════ */}
      <div
        id="accreditation-back-card"
        style={{
          width: "320px", height: "454px",
          background: "linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)",
          borderRadius: 0,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          overflow: "hidden", flexShrink: 0,
          border: "1px solid #334155", position: "relative",
        }}
      >
        {/* dot pattern */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
          <svg style={{ width: "100%", height: "100%" }} viewBox="0 0 320 454" preserveAspectRatio="none">
            <defs>
              <pattern id="backPattern" patternUnits="userSpaceOnUse" width="40" height="40">
                <circle cx="20" cy="20" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#backPattern)" />
          </svg>
        </div>

        {event?.backTemplateUrl
          ? <img src={event.backTemplateUrl} alt="Back Template" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "white" }} />
          : (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 10 }}>

              {/* event name pill */}
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ display: "inline-block", padding: "8px 24px", background: "linear-gradient(to right, #0891b2, #2563eb)", borderRadius: "9999px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "white" }}>
                    {event?.name || "Event Name"}
                  </h3>
                </div>
              </div>

              {/* access zones */}
              <div style={{ flex: 1, marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <div style={{ width: "4px", height: "24px", backgroundColor: "#06b6d4", borderRadius: "9999px" }} />
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Access</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {zoneCodes.map((code, i) => {
                    const zoneInfo = zones?.find(z => z.code === code);
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "16px",
                        backgroundColor: "rgba(30,41,59,0.5)", borderRadius: "8px",
                        padding: "12px", border: "1px solid rgba(51,65,85,0.5)",
                      }}>
                        <div style={{
                          width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "linear-gradient(to bottom right, #06b6d4, #2563eb)",
                        }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "white" }}>{code}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "12px", color: "white", fontWeight: 500 }}>{zoneInfo?.name || code}</span>
                          {zoneInfo?.description && (
                            <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#94a3b8" }}>{zoneInfo.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* important notice */}
              <div style={{
                background: "linear-gradient(to right, rgba(245,158,11,0.2), rgba(249,115,22,0.2))",
                borderRadius: "8px", padding: "16px", marginTop: "auto",
                border: "1px solid rgba(245,158,11,0.3)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <svg style={{ width: "20px", height: "20px", color: "#fbbf24", flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "bold", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>Important</p>
                </div><p style={{ margin: 0, fontSize: "11px", color: "#e2e8f0", lineHeight: 1.5 }}>
                  This accreditation must be worn visibly at all times. Access is restricted to authorized zones only.
                </p>
              </div>

              {/* watermark icon */}
              <div style={{ position: "absolute", bottom: "16px", right: "16px", opacity: 0.1 }}>
                <svg style={{ width: "80px", height: "80px", color: "#06b6d4" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 18c.6.5 1.2 1 2.3 1 1.4 0 2.1-.6 2.7-1.2.6-.6 1.3-1.2 2.7-1.2s2.1.6 2.7 1.2c.6.6 1.3 1.2 2.7 1.2s2.1-.6 2.7-1.2c.6-.6 1.3-1.2 2.7-1.2.7 0 1.2.1 1.7.4V15c-.5-.3-1.1-.4-1.7-.4-1.4 0-2.1.6-2.7 1.2-.6.6-1.3 1.2-2.7 1.2s-2.1-.6-2.7-1.2c-.6-.6-1.3-1.2-2.7-1.2s-2.1.6-2.7 1.2C6.4 16.4 5.7 17 4.3 17c-1.1 0-1.7-.5-2.3-1v2z"/>
                </svg>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default AccreditationCardPreview;
