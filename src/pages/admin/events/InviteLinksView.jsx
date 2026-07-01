import React from "react";
import {
  Plus,
  Edit,
  Copy,
  Check,
  ExternalLink,
  Trash,
  CreditCard,
  Lock
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Card, { CardContent } from "../../../components/ui/Card";
import MultiSearchableSelect from "../../../components/ui/MultiSearchableSelect";
import { useToast } from "../../../components/ui/Toast";
import { CategoriesAPI } from "../../../lib/storage";
import {
  getInviteLinks,
  createInviteLink,
  updateInviteLink,
  toggleInviteLink,
  deleteInviteLink,
  getLinkStatus
} from "../../../lib/inviteLinksApi";

export default function InviteLinksView({ event }) {
  const toast = useToast();
  const [links, setLinks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(null);
  const [editingLinkId, setEditingLinkId] = React.useState(null);
  const [availableClubs, setAvailableClubs] = React.useState([]);

  const defaultForm = {
    label: "",
    mode: "multi",
    maxUses: "",
    expiresIn: "48h",
    customExpiry: "",
    role: "",
    club: [],
    requirePayment: false,
    paymentAmount: ""
  };
  const [form, setForm] = React.useState(defaultForm);

  const roleOptions = [
    { value: "participant", label: "Participant" },
    { value: "coach", label: "Coach" },
    { value: "official", label: "Official" },
    { value: "vip", label: "VIP" },
    { value: "media", label: "Media" },
    { value: "crew", label: "Crew / Staff" },
    { value: "sponsor", label: "Sponsor" },
    { value: "spectator", label: "Spectator" }
  ];

  React.useEffect(() => {
    const fetchClubs = async () => {
      try {
        const clubsData = await CategoriesAPI.getActive();
        const uniqueClubs = Array.from(new Set(clubsData.map(c => c.clubName).filter(Boolean))).sort();
        setAvailableClubs(uniqueClubs);
      } catch (err) {
        console.error("Failed to fetch clubs:", err);
      }
    };
    fetchClubs();
  }, []);

  const clubs = React.useMemo(() => {
    return availableClubs.map(c => ({ value: c, label: c }));
  }, [availableClubs]);

  const loadLinks = React.useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const data = await getInviteLinks(event.id);
      setLinks(data.reverse()); // newest first
    } catch (error) {
      console.error("Failed to load links:", error);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  React.useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const getExpiryDate = () => {
    if (form.expiresIn === "never") return null;
    if (form.expiresIn === "custom") return form.customExpiry ? new Date(form.customExpiry).toISOString() : null;
    const hours = { "12h": 12, "24h": 24, "48h": 48, "72h": 72, "168h": 168 }[form.expiresIn] || 48;
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  };

  const handleCreateOrUpdate = async () => {
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        label: form.label,
        mode: form.mode,
        maxUses: form.mode === "single" ? 1 : (form.maxUses ? parseInt(form.maxUses) : null),
        expiresAt: getExpiryDate(),
        role: form.role || null,
        club: form.club && form.club.length > 0 ? form.club : null,
        requirePayment: form.requirePayment,
        paymentAmount: form.requirePayment ? parseFloat(form.paymentAmount) : null
      };

      if (editingLinkId) {
        await updateInviteLink(event.id, editingLinkId, payload);
        toast.success("Invite link updated!");
      } else {
        await createInviteLink(event.id, payload);
        toast.success("Invite link created!");
      }

      setShowCreate(false);
      setEditingLinkId(null);
      setForm(defaultForm);
      loadLinks();
    } catch (err) {
      toast.error(`Failed to ${editingLinkId ? "update" : "create"} link: ` + (err.message || ""));
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (link) => {
    setEditingLinkId(link.id);
    setForm({
      label: link.label || "",
      mode: link.mode || "multi",
      maxUses: link.maxUses ? link.maxUses.toString() : "",
      expiresIn: link.expiresAt ? "custom" : "never",
      customExpiry: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
      role: link.role || "",
      club: link.club ? (Array.isArray(link.club) ? link.club : [link.club]) : [],
      requirePayment: link.requirePayment || false,
      paymentAmount: link.paymentAmount ? link.paymentAmount.toString() : ""
    });
    setShowCreate(true);
  };

  const handleToggle = async (link) => {
    try {
      await toggleInviteLink(event.id, link.id, !link.isActive);
      toast.success(link.isActive ? "Link deactivated" : "Link activated");
      loadLinks();
    } catch (error) {
      toast.error("Failed to toggle link");
    }
  };

  const handleDelete = async (link) => {
    if (!window.confirm(`Delete invite link "${link.label}"?`)) return;
    try {
      await deleteInviteLink(event.id, link.id);
      toast.success("Invite link deleted");
      loadLinks();
    } catch (error) {
      toast.error("Failed to delete link");
    }
  };

  const getInviteUrl = (link) =>
    `${window.location.origin}/register/${event.slug}/invite/${link.token}`;

  const handleCopy = async (link) => {
    const url = getInviteUrl(link);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(link.id);
      toast.success("Invite link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error("Copy failed");
    }
  };

  const statusColors = {
    active: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    inactive: "bg-base-alt border-border text-muted",
    expired: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    exhausted: "bg-red-500/10 border-red-500/30 text-red-400"
  };

  const statusDots = {
    active: "bg-emerald-400 animate-pulse",
    inactive: "bg-slate-500",
    expired: "bg-amber-400",
    exhausted: "bg-red-400"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-main">Private Invite Links</h3>
          <p className="text-sm text-muted mt-1">Generate secret registration links for specific people while main registration stays closed.</p>
        </div>
        <Button icon={Plus} onClick={() => {
          setEditingLinkId(null);
          setForm(defaultForm);
          setShowCreate(true);
        }}>Create Link</Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="p-6 space-y-4">
            <h4 className="text-lg font-bold text-main">{editingLinkId ? "Edit Invite Link" : "New Invite Link"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-main mb-1">Label <span className="text-red-400">*</span></label>
                <input
                  value={form.label}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Late Registrations - Coaches"
                  className="w-full bg-base-alt border border-border rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-main mb-1">Link Expires In</label>
                <select
                  value={form.expiresIn}
                  onChange={e => setForm(p => ({ ...p, expiresIn: e.target.value }))}
                  className="w-full bg-base-alt border border-border rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="12h">12 Hours</option>
                  <option value="24h">24 Hours</option>
                  <option value="48h">48 Hours (default)</option>
                  <option value="72h">72 Hours</option>
                  <option value="168h">1 Week</option>
                  <option value="custom">Custom Date/Time</option>
                  <option value="never">Never Expires</option>
                </select>
              </div>
            </div>
            {form.expiresIn === "custom" && (
              <div>
                <label className="block text-sm font-medium text-main mb-1">Custom Expiry</label>
                <input type="datetime-local" value={form.customExpiry}
                  onChange={e => setForm(p => ({ ...p, customExpiry: e.target.value }))}
                  className="w-full bg-base-alt border border-border rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-violet-500" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Restrict to Role <span className="text-muted text-xs">(optional)</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-base-alt border border-border rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Any Role</option>
                  {roleOptions.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Restrict to Clubs <span className="text-muted text-xs">(optional)</span>
                </label>
                <MultiSearchableSelect
                  options={clubs}
                  value={form.club}
                  onChange={val => setForm(p => ({ ...p, club: val }))}
                  placeholder="Select organizations..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-main mb-2">Usage Mode</label>
              <div className="flex gap-3">
                {[
                  { value: "multi", label: "Multi-Use", desc: "Same link for multiple people" },
                  { value: "single", label: "Single-Use", desc: "Expires after 1 submission" }
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, mode: opt.value, maxUses: opt.value === "single" ? "1" : "" }))}
                    className={`flex-1 p-3 rounded-xl border text-left transition-all ${form.mode === opt.value ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-border bg-base-alt text-muted hover:border-border"}`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.mode === "multi" && (
              <div>
                <label className="block text-sm font-medium text-main mb-1">Max Uses <span className="text-muted">(optional — leave blank for unlimited)</span></label>
                <input
                  type="number" min="1" value={form.maxUses}
                  onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-40 bg-base-alt border border-border rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${form.requirePayment ? 'bg-emerald-500/10 text-emerald-400' : 'bg-base-alt text-muted'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-main">Require Payment</p>
                    <p className="text-xs text-muted">Enable Stripe fee for this registration link</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, requirePayment: !p.requirePayment }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.requirePayment ? 'bg-emerald-500' : 'bg-base-alt'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.requirePayment ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {form.requirePayment && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 translate-x-11">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">AED</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.paymentAmount}
                        onChange={e => setForm(p => ({ ...p, paymentAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-2 bg-base-alt border border-border rounded-xl text-main text-sm focus:outline-none focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                    <p className="text-xs text-muted italic">Fee per athlete registration</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreateOrUpdate} loading={creating} disabled={creating}>
                {editingLinkId ? "Save Changes" : "Generate Link"}
              </Button>
              <Button variant="ghost" onClick={() => {
                setShowCreate(false);
                setEditingLinkId(null);
                setForm(defaultForm);
              }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      {loading ? (
        <div className="text-center py-10 text-muted">Loading invite links...</div>
      ) : links.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <Lock className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted font-medium">No invite links yet</p>
            <p className="text-muted text-sm mt-1">Create your first private invite link above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const status = getLinkStatus(link);
            const url = getInviteUrl(link);
            return (
              <Card key={link.id} className="border-border hover:border-border transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-main font-semibold">{link.label}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${statusColors[status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]}`} />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${link.mode === "single" ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"}`}>
                          {link.mode === "single" ? "Single-Use" : "Multi-Use"}
                        </span>
                        {(link.role || (link.club && link.club.length > 0)) && (
                           <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                             Restricted Link
                           </span>
                        )}
                        {link.requirePayment && (
                          <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CreditCard className="w-2.5 h-2.5" />
                            AED {link.paymentAmount?.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-muted truncate block max-w-md">{url}</code>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <span>{link.useCount || 0}{link.maxUses ? `/${link.maxUses}` : ""} uses</span>
                        {link.expiresAt && (
                          <span>Expires: {new Date(link.expiresAt).toLocaleString()}</span>
                        )}
                        {!link.expiresAt && <span>Never expires</span>}
                        {link.role && <span>• Role: <span className="text-main">{link.role}</span></span>}
                        {link.club && link.club.length > 0 && (() => {
                          const clubsArray = Array.isArray(link.club) ? link.club : [link.club];
                          return (
                            <span title={clubsArray.join(", ")}>
                              • Clubs: <span className="text-main truncate max-w-[150px] inline-block align-bottom">
                                {clubsArray.length === 1 ? clubsArray[0] : `${clubsArray.length} clubs selected`}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(link)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-base hover:bg-border border border-border rounded-lg text-muted text-xs font-medium transition-colors"
                        title="Copy link"
                      >
                        {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === link.id ? "Copied!" : "Copy"}
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="p-2 bg-base-alt hover:bg-base-alt border border-border rounded-lg text-muted hover:text-main transition-colors"
                        title="Open link">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => openEdit(link)}
                        className="p-2 bg-base-alt hover:bg-base-alt border border-border rounded-lg text-muted hover:text-main transition-colors"
                        title="Edit link">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(link)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${link.isActive ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"}`}
                        title={link.isActive ? "Deactivate" : "Activate"}
                      >
                        {link.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(link)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-colors"
                        title="Delete link"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
