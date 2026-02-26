import React from "react";
import { getCountryName, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
import QRCode from "qrcode";

/* ============================================================
   ROLE COLOR MAP
   ============================================================ */
const roleColors = {
  athlete:  { hex: "#2563eb" },
  coach:    { hex: "#0d9488" },
  media:    { hex: "#d97706" },
  official: { hex: "#7c3aed" },
  medical:  { hex: "#e11d48" },
  staff:    { hex: "#475569" },
  vip:      { hex: "#b45309" },
};

const getRoleHex = (role) =>
  roleColors[role?.toLowerCase()]?.hex ?? "#475569";

/* ============================================================
   DYNAMIC NAME FONT SIZE
   Uses a canvas to measure real text width, then scales down
   so the name always fits in the available container width.
   ============================================================ */
const CONTAINER_WIDTH = 174; // px — right panel width (320 - 110 - 12pad - 12pad - 16gap)
const MAX_FONT        = 22;
const MIN_FONT        = 11;

const getNameFontSize = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim().toUpperCase();
  if (!full) return MAX_FONT;

  // Use offscreen canvas for accurate text measurement
  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d");

  let fontSize = MAX_FONT;
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  let textWidth = ctx.measureText(full).width;

  if (textWidth > CONTAINER_WIDTH) {
    // Scale proportionally
    fontSize = Math.floor(fontSize * (CONTAINER_WIDTH / textWidth));
    fontSize = Math.max(fontSize, MIN_FONT);
  }
  return fontSize;
};

/* ============================================================
   ZONE BADGE PNGs  (small dark rounded squares)
   ============================================================ */
const useZoneBadgePngs = (codes) => {
  const [badges, setBadges] = React.useState({});

  React.useEffect(() => {
    if (!codes?.length) return;
    const result = {};
    const SIZE   = 64; // canvas px (will render at 32 CSS px, 2x crisp)

    codes.forEach((code) => {
      const canvas = document.createElement("canvas");
      canvas.width  = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 6);
      ctx.fill();

      // Label
      ctx.fillStyle    = "#ffffff";
      ctx.font         = `bold ${SIZE * 0.45}px sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, SIZE / 2, SIZE / 2 + 1);

      result[code] = canvas.toDataURL("image/png");
    });

    setBadges(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);

  return badges;
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
const AccreditationCardPreview = ({ accreditation, event, zones = [] }) => {

  /* --- colour resolution ---------------------------------- */
  const matchingZone = zones.find(
    (z) => z.name?.toLowerCase() === accreditation?.role?.toLowerCase()
  );
  const roleBannerColor =
    matchingZone?.color ?? getRoleHex(accreditation?.role);

  /* --- data helpers --------------------------------------- */
  const zoneCodes  = accreditation?.zoneCode
    ?.split(",").map((z) => z.trim()).filter(Boolean) ?? [];
  const countryData  = COUNTRIES.find((c) => c.code === accreditation?.nationality);
  const countryName  = getCountryName(accreditation?.nationality);
  const age          = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;
  const expired      = typeof isExpired === "function"
    ? isExpired(accreditation?.expiresAt) : false;
  const idNumber     = accreditation?.accreditationId?.split("-")?.pop() ?? "---";

  /* --- dynamic font size (measured once per render) ------- */
  const nameFontSize = React.useMemo(
    () => getNameFontSize(accreditation?.firstName, accreditation?.lastName),
    [accreditation?.firstName, accreditation?.lastName]
  );
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  /* --- zone badges ---------------------------------------- */
  const zoneBadgePngs = useZoneBadgePngs(zoneCodes);

  /* --- QR code -------------------------------------------- */
  const [qrDataUrl, setQrDataUrl] = React.useState(null);
  React.useEffect(() => {
    if (!accreditation) return;
    const verifyId  = accreditation.accreditationId
      ?? accreditation.badgeNumber ?? accreditation.id ?? "unknown";
    const verifyUrl = `${window.location.origin}/verify/${verifyId}`;

    QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 200,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("QR error:", err));
  }, [accreditation?.id, accreditation?.accreditationId, accreditation?.status]);

  /* ======================================================
     CARD DIMENSIONS  (never change these — PDF reads them)
     320 × 454 px
     ====================================================== */
  const CARD_W = 320;
  const CARD_H = 454;

  return (
    <div
      id="accreditation-card-preview"
      style={{
        display:        "flex",
        flexDirection:  "row",
        flexWrap:       "wrap",
        gap:            "24px",
        alignItems:     "flex-start",
        justifyContent: "center",
        fontFamily:     "Helvetica, Arial, sans-serif",
      }}
    >

      {/* ====================================================
          FRONT CARD
          ==================================================== */}
      <div
        id="accreditation-front-card"
        style={{
          width:           CARD_W,
          height:          CARD_H,
          backgroundColor: "#ffffff",
          borderRadius:    0,
          boxShadow:       "0 25px 50px -12px rgba(0,0,0,0.25)",
          overflow:        "hidden",
          flexShrink:      0,
          display:         "flex",
          flexDirection:   "column",
          position:        "relative",
          border:          expired ? "2px solid #f87171" : "1px solid #e2e8f0",
        }}
      >
        {/* EXPIRED OVERLAY */}
        {expired && (
          <div style={{
            position:        "absolute", inset: 0,
            backgroundColor: "rgba(239,68,68,0.1)",
            zIndex:          20,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            pointerEvents:   "none",
          }}>
            <div style={{
              backgroundColor: "#dc2626",
              color:           "white",
              padding:         "8px 24px",
              transform:       "rotate(-15deg)",
              fontWeight:      "bold",
              fontSize:        "24px",
              letterSpacing:   "0.1em",
            }}>
              EXPIRED
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div style={{
          position:   "relative",
          height:     "100px",
          background: "linear-gradient(to right, #22d3ee, #7dd3fc, #22d3ee)",
          overflow:   "hidden",
          flexShrink: 0,
        }}>
          <div style={{
            position:        "relative",
            zIndex:          10,
            display:         "flex",
            height:          "100%",
            width:           "100%",
            alignItems:      "center",
            justifyContent:  "center",
            padding:         "0 16px",
          }}>
            {event?.logoUrl ? (
              <img
                src={event.logoUrl}
                alt="Logo"
                style={{ maxHeight: "85px", maxWidth: "100%", objectFit: "contain" }}
              />
            ) : (
              <svg
                style={{ width: "64px", height: "64px", color: "rgba(255,255,255,0.7)" }}
                viewBox="0 0 24 24" fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
                         10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5
                         1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            )}
          </div>
        </div>

        {/* 6 px white spacer */}
        <div style={{ height: "6px", backgroundColor: "white", flexShrink: 0 }} />

        {/* ── ROLE BANNER ── */}
        <div style={{
          height:          "40px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          width:           "100%",
          overflow:        "hidden",
          boxShadow:       "0 4px 6px -1px rgba(0,0,0,0.1)",
          flexShrink:      0,
          backgroundColor: roleBannerColor,
        }}>
          <span style={{
            color:          "white",
            fontSize:       "16px",
            fontWeight:     "bold",
            textTransform:  "uppercase",
            letterSpacing:  "0.2em",
            textShadow:     "0 1px 2px rgba(0,0,0,0.2)",
            lineHeight:     1,
          }}>
            {accreditation?.role || "PARTICIPANT"}
          </span>
        </div>

        {/* ── BODY ── */}
        <div style={{
          display:         "flex",
          flex:            1,
          padding:         "12px",
          position:        "relative",
          zIndex:          10,
          minHeight:       0,
          backgroundColor: "white",
        }}>

          {/* LEFT COL: Photo + ID + QR */}
          <div style={{
            width:          "110px",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            flexShrink:     0,
          }}>
            {/* Photo */}
            <div style={{
              width:        "100px",
              height:       "120px",
              border:       "2px solid #cbd5e1",
              padding:      "2px",
              backgroundColor: "white",
              boxShadow:    "0 4px 6px -1px rgba(0,0,0,0.1)",
              flexShrink:   0,
            }}>
              {accreditation?.photoUrl ? (
                <img
                  src={accreditation.photoUrl}
                  alt="User"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  width:      "100%",
                  height:     "100%",
                  background: "linear-gradient(to bottom right, #f1f5f9, #e2e8f0)",
                  display:    "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <svg
                    style={{ width: "40px", height: "40px", color: "#cbd5e1" }}
                    viewBox="0 0 24 24" fill="currentColor"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4
                             -4 1.79-4 4 1.79 4 4 4zm0 2c-2.67
                             0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>

            {/* ID + Badge */}
            <div style={{ marginTop: "8px", textAlign: "left", width: "100%" }}>
              <p style={{
                fontSize:   "10px",
                color:      "#334155",
                fontFamily: "monospace",
                fontWeight: 500,
                margin:     0,
              }}>
                ID: {idNumber}
              </p>
              <p style={{
                fontSize:   "10px",
                color:      "#334155",
                fontFamily: "monospace",
                fontWeight: "bold",
                margin:     "2px 0 0 0",
              }}>
                BADGE: {accreditation?.badgeNumber || "---"}
              </p>
            </div>

            {/* QR */}
            {qrDataUrl && (
              <div style={{ marginTop: "12px" }}>
                <img
                  src={qrDataUrl}
                  alt="QR Verify"
                  style={{ width: "70px", height: "70px", display: "block" }}
                />
              </div>
            )}
          </div>

          {/* RIGHT COL: Name + details */}
          <div style={{
            flex:           1,
            paddingLeft:    "16px",
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "flex-start",
            minWidth:       0,   // ← critical: allows text to shrink
            overflow:       "hidden",
          }}>
            {/* ── DYNAMIC NAME ── */}
            <h2
              id="accreditation-person-name"
              style={{
                fontWeight:     "bold",
                color:          "#1e3a8a",
                textTransform:  "uppercase",
                fontSize:       `${nameFontSize}px`,
                lineHeight:     1.15,
                margin:         0,
                whiteSpace:     "nowrap",
                overflow:       "hidden",
                textOverflow:   "clip",
                width:          "100%",
              }}
            >
              {fullName}
            </h2>

            <p style={{
              fontSize:    "14px",
              color:       "#334155",
              marginTop:   "10px",
              lineHeight:  1.3,
              wordBreak:   "break-word",
              margin:      "10px 0 0 0",
            }}>
              {accreditation?.club || "Club Name"}
            </p>

            <p style={{
              fontSize:  "12px",
              color:     "#64748b",
              marginTop: "4px",
              margin:    "4px 0 0 0",
            }}>
              {accreditation?.role || "Participant"}
            </p>

            {/* Age + Gender */}
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        "8px",
              marginTop:  "10px",
              fontSize:   "13px",
              color:      "#475569",
            }}>
              {age !== null && (
                <span style={{ fontWeight: 500 }}>{age} Y</span>
              )}
              {age !== null && (
                <span style={{ color: "#cbd5e1" }}>|</span>
              )}
              <span style={{ fontWeight: 500 }}>
                {accreditation?.gender || "Gender"}
              </span>
            </div>

            {/* Flag + Country */}
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        "10px",
              marginTop:  "14px",
            }}>
              {countryData?.flag && (
                <img
                  src={`https://flagcdn.com/w80/${countryData.flag}.png`}
                  alt="Flag"
                  crossOrigin="anonymous"
                  style={{
                    width:        "44px",
                    height:       "30px",
                    borderRadius: "4px",
                    boxShadow:    "0 1px 3px rgba(0,0,0,0.1)",
                    objectFit:    "cover",
                    border:       "1px solid #e2e8f0",
                    flexShrink:   0,
                  }}
                />
              )}
              <p style={{
                fontSize:   "15px",
                fontWeight: "bold",
                color:      "#1e40af",
                wordBreak:  "break-word",
                margin:     0,
              }}>
                {countryName}
              </p>
            </div>
          </div>
        </div>

        {/* ── ZONE BADGES ROW ── */}
        <div style={{
          height:          "34px",
          width:           "100%",
          backgroundColor: "white",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "flex-end",
          gap:             "4px",
          paddingLeft:     "12px",
          paddingRight:    "12px",
          flexShrink:      0,
        }}>
          {zoneCodes.length > 0 ? (
            zoneCodes.slice(0, 4).map((code, i) =>
              zoneBadgePngs[code] ? (
                <img
                  key={i}
                  src={zoneBadgePngs[code]}
                  alt={code}
                  style={{ width: "30px", height: "30px", display: "block" }}
                />
              ) : (
                <div
                  key={i}
                  style={{
                    backgroundColor: "#0f172a",
                    color:           "white",
                    width:           "30px",
                    height:          "30px",
                    lineHeight:      "30px",
                    textAlign:       "center",
                    borderRadius:    "3px",
                    fontSize:        "13px",
                    fontWeight:      700,
                  }}
                >
                  {code}
                </div>
              )
            )
          ) : (
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>No Access</span>
          )}
        </div>

        {/* ── SPONSORS STRIP ── */}
        <div style={{
          height:          "36px",
          width:           "100%",
          borderTop:       "1px solid #e2e8f0",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          gap:             "12px",
          padding:         "0 12px",
          flexShrink:      0,
          backgroundColor: "#f8fafc",
        }}>
          {event
