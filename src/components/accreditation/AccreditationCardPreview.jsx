import React from "react";
import { getCountryName, calculateAge, COUNTRIES, isExpired } from "../../lib/utils";
import QRCode from "qrcode";

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

const RIGHT_COL_WIDTH = 174;
const MAX_FONT = 22;
const MIN_FONT = 11;

const measureNameFontSize = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim().toUpperCase();
  if (!full) return MAX_FONT;
  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d");
  let size     = MAX_FONT;
  ctx.font     = `bold ${size}px Helvetica, Arial, sans-serif`;
  const w      = ctx.measureText(full).width;
  if (w > RIGHT_COL_WIDTH) {
    size = Math.floor(size * (RIGHT_COL_WIDTH / w));
    size = Math.max(size, MIN_FONT);
  }
  return size;
};

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

const useFlagBase64 = (flagCode) => {
  const [flagB64, setFlagB64] = React.useState(null);
  React.useEffect(() => {
    if (!flagCode) return;
    const isDev = import.meta.env.DEV;
    const url   = isDev
      ? `/flags/w80/${flagCode}.png`
      : `https://flagcdn.com/w80/${flagCode}.png`;
    fetch(url, { cache: "force-cache" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.onerror  = () => res(null);
            reader.readAsDataURL(blob);
          })
      )
      .then((b64) => {
        if (b64) { setFlagB64(b64); return; }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width  = img.naturalWidth  || 80;
            c.height = img.naturalHeight || 60;
            c.getContext("2d").drawImage(img, 0, 0);
            setFlagB64(c.toDataURL("image/png"));
          } catch {
            setFlagB64(`https://flagcdn.com/w80/${flagCode}.png`);
          }
        };
        img.onerror = () => setFlagB64(null);
        img.src = `https://flagcdn.com/w80/${flagCode}.png?_t=${Date.now()}`;
      })
      .catch(() => setFlagB64(null));
  }, [flagCode]);
  return flagB64;
};

/* ══════════════════════════════════════════════════════════
   CardInner — exported so pdfUtils can render it offscreen
   ══════════════════════════════════════════════════════════ */
export const CardInner = ({ accreditation, event, zones = [], idSuffix = "" }) => {
  const matchingZone    = zones.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase());
  const roleBannerColor = matchingZone?.color ?? getRoleHex(accreditation?.role);
  const zoneCodes       = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) ?? [];
  const countryData     = COUNTRIES.find(c => c.code === accreditation?.nationality);
  const countryName     = getCountryName(accreditation?.nationality);
  const age             = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear) : null;
  const expired         = typeof isExpired === "function" ? isExpired(accreditation?.expiresAt) : false;
  const idNumber        = accreditation?.accreditationId?.split("-")?.pop() ?? "---";
  const fullName        = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  const nameFontSize  = React.useMemo(
    () => measureNameFontSize(accreditation?.firstName, accreditation?.lastName),
    [accreditation?.firstName, accreditation?.lastName]
  );
  const zoneBadgePngs = useZoneBadgePngs(zoneCodes);
  const flagB64       = useFlagBase64(countryData?.flag ?? null);

  const [qrDataUrl, setQrDataUrl] = React.useState(null);
  React.useEffect(() => {
    if (!accreditation) return;
