import { supabase } from "./supabase";

function generateToken() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function rowToLink(row) {
  return {
    id:             row.id,
    token:          row.token,
    eventId:        row.event_id,
    label:          row.label,
    mode:           row.mode,
    maxUses:        row.max_uses,
    useCount:       row.use_count,
    expiresAt:      row.expires_at,
    role:           row.role,
    club:           row.club,
    requirePayment: row.require_payment,
    paymentAmount:  row.payment_amount,
    isActive:       row.is_active,
    createdAt:      row.created_at,
  };
}

export async function getInviteLinks(eventId) {
  const { data, error } = await supabase
    .from("invite_links")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToLink);
}

export async function createInviteLink(eventId, updates) {
  const { label, mode, maxUses, expiresAt, role, club } = updates;
  const resolvedMaxUses = mode === "single" ? 1 : (maxUses ? parseInt(maxUses) : null);

  const row = {
    id:              `il_${Date.now()}`,
    token:           generateToken(),
    event_id:        eventId,
    label:           label || "Invite Link",
    mode:            mode || "multi",
    max_uses:        resolvedMaxUses,
    use_count:       0,
    expires_at:      expiresAt || null,
    role:            role || null,
    club:            club || null,
    require_payment: updates?.requirePayment || false,
    payment_amount:  updates?.requirePayment ? parseFloat(updates.paymentAmount) : null,
    is_active:       true,
    created_at:      new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("invite_links")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToLink(data);
}

export async function toggleInviteLink(eventId, linkId, isActive) {
  const { data, error } = await supabase
    .from("invite_links")
    .update({ is_active: isActive })
    .eq("id", linkId)
    .eq("event_id", eventId)
    .select();
  if (error) throw error;
  return (data || []).map(rowToLink);
}

export async function deleteInviteLink(eventId, linkId) {
  const { error } = await supabase
    .from("invite_links")
    .delete()
    .eq("id", linkId)
    .eq("event_id", eventId);
  if (error) throw error;
  return getInviteLinks(eventId);
}

export async function updateInviteLink(eventId, linkId, updates) {
  const patch = {};
  if (updates.label       !== undefined) patch.label           = updates.label;
  if (updates.expiresAt   !== undefined) patch.expires_at      = updates.expiresAt;
  if (updates.maxUses     !== undefined) patch.max_uses        = updates.maxUses;
  if (updates.mode        !== undefined) patch.mode            = updates.mode;
  if (updates.role        !== undefined) patch.role            = updates.role;
  if (updates.club        !== undefined) patch.club            = updates.club;
  if (updates.requirePayment !== undefined) patch.require_payment = updates.requirePayment;
  if (updates.paymentAmount  !== undefined) patch.payment_amount  = updates.paymentAmount;

  const { data, error } = await supabase
    .from("invite_links")
    .update(patch)
    .eq("id", linkId)
    .eq("event_id", eventId)
    .select()
    .single();
  if (error) throw error;
  return rowToLink(data);
}

// Read-only validation — used on page load to show the form or an error screen.
// Does NOT increment use_count; call redeemInviteToken on submit instead.
export async function validateInviteToken(token, eventId) {
  const { data: link, error } = await supabase
    .from("invite_links")
    .select("*")
    .eq("token", token)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !link) return { valid: false, reason: "invalid" };
  if (!link.is_active) return { valid: false, reason: "inactive" };
  if (link.expires_at && new Date() > new Date(link.expires_at))
    return { valid: false, reason: "expired" };
  if (link.max_uses !== null && link.use_count >= link.max_uses)
    return { valid: false, reason: "limit_reached" };
  return { valid: true, link: rowToLink(link) };
}

// Atomic validate + increment via a DB-level FOR UPDATE lock.
// Use this on form submit (free registration) instead of validateInviteToken + incrementLinkUseCount.
export async function redeemInviteToken(token, eventId) {
  const { data, error } = await supabase.rpc("redeem_invite_link", {
    p_token:    token,
    p_event_id: eventId,
  });
  if (error) throw error;
  return data; // { valid, reason?, link? }
}

// Kept for the Stripe webhook path (server-side RPC call).
// In the webhook we call increment_invite_link directly via the service-role client.
export async function incrementLinkUseCount(eventId, linkId) {
  const { error } = await supabase.rpc("increment_invite_link", {
    p_link_id:  linkId,
    p_event_id: eventId,
  });
  if (error) throw error;
}

export function getLinkStatus(link) {
  if (!link.isActive) return "inactive";
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) return "expired";
  if (link.maxUses !== null && link.useCount >= link.maxUses) return "exhausted";
  return "active";
}

export function getInviteUrl(link) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/register/${link.eventId}/${link.token}`;
}
