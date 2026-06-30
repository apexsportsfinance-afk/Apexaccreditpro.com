import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Building2, Plus, Save, Trash2, Link2, Loader2, ShieldAlert } from "lucide-react";

// =============================================================================
// Organizations (Master Console) — PLATFORM-OWNER ONLY.
// Create / brand / package client federations and link their logins, in-app,
// instead of SQL or the standalone console. Backed by the super-admin-gated
// RPCs (admin_list_orgs / admin_save_org / admin_delete_org / admin_link_user)
// — every action is re-checked server-side via is_platform_admin(), so this UI
// is a convenience, not the security boundary.
// =============================================================================

const PLANS = ["basic", "standard", "premium", "full", "enterprise"];
// The pages an org can be granted. Keys are real module paths so the app's
// existing canAccessModule gate enforces them at the org level (even for a
// client 'admin'). Platform-only pages (Settings/Audit/Integrations) are
// deliberately excluded — they're never client features.
const FEATURES = [
  ["/admin/dashboard", "Dashboard"],
  ["/admin/events", "Events"],
  ["/admin/accreditations", "Accreditations"],
  ["/admin/teams", "Team Management"],
  ["/admin/zones", "Zones"],
  ["/admin/qr-system", "QR System"],
  ["/admin/qr-system/booking", "Booking Form (QR)"],
  ["/admin/ticketing", "Spectator Portal"],
  ["/admin/broadcasts", "Broadcast History"],
  ["/admin/medals", "Medal Rankings"],
  ["/admin/call-room", "Call Room Display"],
  ["/admin/feedback", "Feedback"],
  ["/admin/users", "Users (their org)"],
];

const allFeaturesOn = () => Object.fromEntries(FEATURES.map(([k]) => [k, true]));

const blankForm = () => ({
  id: null, name: "", slug: "", custom_domain: "", tagline: "",
  brand_primary: "#0a3d62", brand_dark: "#06243b", plan: "full",
  hide_powered_by: false, features: allFeaturesOn(), logo_url: "",
});

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-base border border-border text-main text-sm outline-none focus:border-primary-500";
const labelCls = "block text-xs text-muted mt-3 mb-1";

export default function Organizations() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok: boolean, text: string }
  const [form, setForm] = useState(blankForm());
  const [linkEmail, setLinkEmail] = useState("");
  const [linkRole, setLinkRole] = useState("admin");

  const isPlatform = user?.role === "super_admin";

  const loadOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_orgs");
    setLoading(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setOrgs(data || []);
  };

  useEffect(() => { if (isPlatform) loadOrgs(); }, [isPlatform]);

  if (!isPlatform) {
    return (
      <div className="p-10 text-center text-muted">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-60" />
        <div className="text-lg text-main">Platform owners only</div>
        <div className="text-sm">This page manages all client organisations and is restricted to the Apex super-admin.</div>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleFeat = (k) => setForm((f) => ({ ...f, features: { ...f.features, [k]: !f.features[k] } }));

  const selectOrg = (o) => {
    setMsg(null); setLinkEmail("");
    setForm({
      id: o.id, name: o.name || "", slug: o.slug || "", custom_domain: o.custom_domain || "",
      tagline: o.tagline || "", brand_primary: o.brand_primary || "#0a3d62",
      brand_dark: o.brand_dark || "#06243b", plan: o.plan || "basic",
      hide_powered_by: !!o.hide_powered_by,
      // Use the org's saved module config if present; otherwise default all-on
      // (legacy/empty features = "everything enabled" = current behaviour).
      features: (o.features && Object.keys(o.features).some((k) => k.startsWith("/admin")))
        ? { ...o.features } : allFeaturesOn(),
      logo_url: o.logo_url || "",
    });
  };

  const newOrg = () => { setMsg(null); setLinkEmail(""); setForm(blankForm()); };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setMsg({ ok: false, text: "Logo too big (keep under 3 MB)" }); e.target.value = ""; return; }
    setBusy(true); setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const base = (form.slug || "org").toLowerCase().replace(/[^a-z0-9-]/g, "") || "org";
      const path = `${base}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("org-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("org-logos").getPublicUrl(path);
      set("logo_url", pub.publicUrl);
      setMsg({ ok: true, text: "Logo uploaded ✓ — click Save to apply" });
    } catch (err) {
      setMsg({ ok: false, text: "Logo upload failed: " + (err?.message || err) });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("admin_save_org", {
      p_id: form.id, p_name: form.name, p_slug: form.slug,
      p_primary: form.brand_primary, p_dark: form.brand_dark, p_domain: form.custom_domain,
      p_tagline: form.tagline, p_plan: form.plan, p_hide: form.hide_powered_by,
      p_features: form.features, p_logo_url: form.logo_url || null,
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setForm((f) => ({ ...f, id: data }));
    setMsg({ ok: true, text: "Saved ✓" });
    loadOrgs();
  };

  const del = async () => {
    if (!form.id) return;
    if (!window.confirm("Delete this organisation? This cannot be undone (fails if it still owns events).")) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("admin_delete_org", { p_id: form.id });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    newOrg(); loadOrgs();
    setMsg({ ok: true, text: "Deleted ✓" });
  };

  const linkUser = async () => {
    if (!form.slug) { setMsg({ ok: false, text: "Save / select an org first (need its slug)" }); return; }
    if (!linkEmail.trim()) { setMsg({ ok: false, text: "Enter the user's email" }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("admin_link_user", {
      p_email: linkEmail.trim(), p_org_slug: form.slug, p_app_role: linkRole, p_org_role: "org_admin",
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `Linked ${linkEmail.trim()} to ${form.slug} as ${linkRole} ✓ (they must log out/in)` });
    setLinkEmail("");
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-main mb-1 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-primary-500" /> Organizations
        </h1>
        <p className="text-muted">Create, brand and package client federations — and link their logins.</p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${msg.ok ? "border-green-600 bg-green-600/10 text-green-300" : "border-red-600 bg-red-600/10 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: list */}
        <div className="bg-base-alt border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-main">Organisations</h2>
            <button onClick={newOrg} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
          {loading ? (
            <div className="text-muted text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : orgs.length === 0 ? (
            <div className="text-muted text-sm">No organisations yet.</div>
          ) : (
            <div className="space-y-2">
              {orgs.map((o) => {
                const on = FEATURES.filter(([k]) => o.features && o.features[k]).length;
                const active = form.id === o.id;
                return (
                  <button key={o.id} onClick={() => selectOrg(o)}
                    className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border bg-base ${active ? "border-primary-500" : "border-border hover:border-primary-500/60"}`}>
                    <div>
                      <div className="text-main font-medium">{o.name}</div>
                      <div className="text-xs text-muted">{o.custom_domain || "no domain"} · {on}/{FEATURES.length} pages</div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted">{o.plan || "basic"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: form */}
        <div className="bg-base-alt border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-main mb-1">{form.id ? `Edit: ${form.name}` : "New organisation"}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div>
              <label className={labelCls}>Display name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
              <label className={labelCls}>Slug * (unique, no spaces)</label>
              <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="uaeaquatics" />
              <label className={labelCls}>Custom domain</label>
              <input className={inputCls} value={form.custom_domain} onChange={(e) => set("custom_domain", e.target.value)} placeholder="registration.uaeaquatics.ae" />
              <label className={labelCls}>Tagline</label>
              <input className={inputCls} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Official Accreditation" />
            </div>
            <div>
              <label className={labelCls}>Package</label>
              <select className={inputCls} value={form.plan} onChange={(e) => set("plan", e.target.value)}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Primary colour</label>
                  <input type="color" className="w-full h-10 rounded-lg bg-base border border-border" value={form.brand_primary} onChange={(e) => set("brand_primary", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Dark colour</label>
                  <input type="color" className="w-full h-10 rounded-lg bg-base border border-border" value={form.brand_dark} onChange={(e) => set("brand_dark", e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm text-main">
                <input type="checkbox" checked={form.hide_powered_by} onChange={(e) => set("hide_powered_by", e.target.checked)} />
                Hide “Powered by Apex”
              </label>
              <label className={labelCls}>Logo</label>
              <div className="flex items-center gap-3">
                {form.logo_url
                  ? <img src={form.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  : <div className="w-12 h-12 rounded-lg border border-border bg-base" />}
                <input type="file" accept="image/*" onChange={onLogo} className="text-xs text-muted" />
              </div>
              <p className="text-[11px] text-muted mt-1">Uploaded to storage (any reasonable size). Empty = name monogram.</p>
            </div>
          </div>

          <label className={labelCls}>Pages this organisation can access</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
            {FEATURES.map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-main">
                <input type="checkbox" checked={!!form.features[k]} onChange={() => toggleFeat(k)} /> {l}
              </label>
            ))}
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            {form.id && (
              <button onClick={del} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-60">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button onClick={newOrg} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-main text-sm">
              Clear / new
            </button>
          </div>

          {/* Link a client login */}
          <div className="mt-6 pt-5 border-t border-border">
            <h3 className="text-base font-semibold text-main mb-1">Link a client login to this org</h3>
            <p className="text-[11px] text-muted mb-3">Create their user first in Supabase → Authentication → Add user, then link by email.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <div>
                <label className={labelCls}>User email</label>
                <input className={inputCls} value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="admin@uaeaquatics.ae" />
              </div>
              <div>
                <label className={labelCls}>App role</label>
                <select className={inputCls} value={linkRole} onChange={(e) => setLinkRole(e.target.value)}>
                  <option value="admin">admin (full self-service)</option>
                  <option value="event_admin">event_admin</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>
            </div>
            <button onClick={linkUser} disabled={busy} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm disabled:opacity-60">
              <Link2 className="w-4 h-4" /> Link user to this org
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
