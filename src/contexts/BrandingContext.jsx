import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// =============================================================================
// BrandingContext — the foundation of the white-label / multi-tenant feature.
//
// It resolves the current organisation FROM THE HOSTNAME the visitor used, then
// exposes that org's name / logo / colours / tagline everywhere in the app. A
// federation on its own domain sees only its own brand; everyone else (and the
// whole existing user base) sees the unchanged Apex default.
//
// SAFETY — this is deliberately additive and non-breaking:
//   * It starts on the Apex default and renders immediately (never blocks).
//   * Org resolution is best-effort: it calls the PUBLIC, read-only RPC
//     `get_org_branding`. If that function isn't deployed yet (e.g. on live
//     today), or no org matches the hostname, the call is caught and the Apex
//     default stays. So nothing changes for current customers until the
//     multi-tenant migrations are deployed AND a real org owns the domain.
//   * `isApex` is true for the default. Each wiring site renders its ORIGINAL
//     literal when `isApex` so existing output is byte-for-byte identical, and
//     only switches to org branding for a real tenant.
// =============================================================================

// The Apex default — what every non-tenant visitor sees (i.e. everyone today).
export const APEX_DEFAULT = {
  name: "Apex Sports Academy",
  slug: "apex",
  logoText: "AX",
  logoUrl: "/apex-logo.png",
  brandPrimary: "#2563eb",
  brandDark: "#1e3a8a",
  tagline: "Accreditation & Events",
  customDomain: null,
  hidePoweredBy: false,
  isApex: true,
};

const BrandingContext = createContext(APEX_DEFAULT);

// Module-level mirror of the resolved branding so NON-React code (e.g. the
// email library, which runs outside the component tree) can read the active
// org without a hook. Updated by the provider whenever branding changes.
let activeBranding = APEX_DEFAULT;
export const getActiveBranding = () => activeBranding;

// Map the snake_case RPC row to the camelCase shape the app consumes.
function fromRow(row) {
  return {
    name: row.name || APEX_DEFAULT.name,
    slug: row.slug || null,
    logoText: row.logo_text || APEX_DEFAULT.logoText,
    logoUrl: row.logo_url || null, // null => sites fall back to logoText monogram
    brandPrimary: row.brand_primary || APEX_DEFAULT.brandPrimary,
    brandDark: row.brand_dark || APEX_DEFAULT.brandDark,
    tagline: row.tagline || "",
    customDomain: row.custom_domain || null,
    hidePoweredBy: !!row.hide_powered_by,
    isApex: false,
  };
}

// The keys we try, in order, against get_org_branding (slug OR custom_domain):
//   1. ?org=<slug>     — explicit override, handy for previews/demos
//   2. full hostname   — a client on their own custom domain
//   3. first label     — the <slug>.apexsmart.com subdomain case
function resolutionKeys() {
  const keys = [];
  try {
    const override = new URLSearchParams(window.location.search).get("org");
    if (override) keys.push(override);
    const host = (window.location.hostname || "").toLowerCase();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      keys.push(host);
      const first = host.split(".")[0];
      if (first && first !== host) keys.push(first);
    }
  } catch {
    /* SSR/non-browser guard — fall through to Apex default */
  }
  return [...new Set(keys)];
}

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(APEX_DEFAULT);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const key of resolutionKeys()) {
        try {
          const { data, error } = await supabase.rpc("get_org_branding", { p_key: key });
          if (error) continue; // function missing / not deployed yet → keep default
          if (Array.isArray(data) && data.length > 0) {
            if (!cancelled) setBranding(fromRow(data[0]));
            return;
          }
        } catch {
          /* network / unknown function → keep Apex default */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect a resolved tenant's brand into CSS variables + tab title. We only
  // touch these for a REAL org, so the Apex default is left exactly as-is.
  useEffect(() => {
    activeBranding = branding; // keep the non-React mirror in sync
    if (branding.isApex) return;
    const root = document.documentElement;
    if (branding.brandPrimary) root.style.setProperty("--brand-primary", branding.brandPrimary);
    if (branding.brandDark) root.style.setProperty("--brand-dark", branding.brandDark);
    if (branding.name) document.title = branding.name;
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
};

// Safe to call anywhere — defaults to Apex even outside a provider, so it can
// never throw and break a render.
export const useBranding = () => useContext(BrandingContext);
