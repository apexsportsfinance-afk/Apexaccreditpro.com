/**
 * Invite Links API
 * Stores invite link configuration in global_settings as JSON (no schema changes needed).
 * Key format: "event_{eventId}_invite_links"
 */
import { GlobalSettingsAPI } from "./broadcastApi";

const STORAGE_KEY = (eventId) => `event_${eventId}_invite_links`;

/**
 * Generate a random token string
 */
function generateToken() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Get all invite links for an event
 */
export async function getInviteLinks(eventId) {
  try {
    const raw = await GlobalSettingsAPI.get(STORAGE_KEY(eventId));
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save all invite links for an event
 */
async function saveInviteLinks(eventId, links) {
  await GlobalSettingsAPI.set(STORAGE_KEY(eventId), JSON.stringify(links));
}

/**
 * Create a new invite link
 */
export async function createInviteLink(eventId, updates) {
  const { label, mode, maxUses, expiresAt, role, club } = updates;
  const links = await getInviteLinks(eventId);
  const newLink = {
    id: `il_${Date.now()}`,
    token: generateToken(),
    label: label || "Invite Link",
    mode: mode || "multi", // "single" | "multi"
    maxUses: mode === "single" ? 1 : (maxUses ? parseInt(maxUses) : null),
    useCount: 0,
    expiresAt: expiresAt || null,
    role: role || null,
    club: club || null,
    requirePayment: updates?.requirePayment || false,
    paymentAmount: updates?.requirePayment ? parseFloat(updates.paymentAmount) : null,
    isActive: true,
    createdAt: new Date().toISOString(),
    eventId
  };
  links.push(newLink);
  await saveInviteLinks(eventId, links);
  return newLink;
}

/**
 * Deactivate/toggle an invite link
 */
export async function toggleInviteLink(eventId, linkId, isActive) {
  const links = await getInviteLinks(eventId);
  const updated = links.map(l => l.id === linkId ? { ...l, isActive } : l);
  await saveInviteLinks(eventId, updated);
  return updated;
}

/**
 * Delete an invite link
 */
export async function deleteInviteLink(eventId, linkId) {
  const links = await getInviteLinks(eventId);
  const updated = links.filter(l => l.id !== linkId);
  await saveInviteLinks(eventId, updated);
  return updated;
}

/**
 * Update an existing invite link
 */
export async function updateInviteLink(eventId, linkId, updates) {
  const links = await getInviteLinks(eventId);
  const updated = links.map(l => {
    if (l.id !== linkId) return l;
    return {
      ...l,
      label: updates.label !== undefined ? updates.label : l.label,
      expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : l.expiresAt,
      maxUses: updates.maxUses !== undefined ? updates.maxUses : l.maxUses,
      mode: updates.mode !== undefined ? updates.mode : l.mode,
      role: updates.role !== undefined ? updates.role : l.role,
      club: updates.club !== undefined ? updates.club : l.club,
      requirePayment: updates.requirePayment !== undefined ? updates.requirePayment : l.requirePayment,
      paymentAmount: updates.paymentAmount !== undefined ? updates.paymentAmount : l.paymentAmount
    };
  });
  await saveInviteLinks(eventId, updated);
  return updated.find(l => l.id === linkId);
}

/**
 * Validate a token and return link data + associated eventId
 * Scans all events' invite_links keys in global_settings
 */
export async function validateInviteToken(token, eventId) {
  const links = await getInviteLinks(eventId);
  const link = links.find(l => l.token === token);
  if (!link) return { valid: false, reason: "invalid" };
  if (!link.isActive) return { valid: false, reason: "inactive" };
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
    return { valid: false, reason: "expired" };
  }
  if (link.maxUses !== null && link.useCount >= link.maxUses) {
    return { valid: false, reason: "limit_reached" };
  }
  return { valid: true, link };
}

/**
 * Increment the use count of a link after successful submission
 */
export async function incrementLinkUseCount(eventId, linkId) {
  const links = await getInviteLinks(eventId);
  const updated = links.map(l => {
    if (l.id !== linkId) return l;
    const newCount = (l.useCount || 0) + 1;
    // Auto-deactivate if single-use
    const shouldDeactivate = l.maxUses !== null && newCount >= l.maxUses;
    return { ...l, useCount: newCount, isActive: shouldDeactivate ? false : l.isActive };
  });
  await saveInviteLinks(eventId, updated);
}

/**
 * Helper: check if a link is currently valid (for display)
 */
export function getLinkStatus(link) {
  if (!link.isActive) return "inactive";
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) return "expired";
  if (link.maxUses !== null && link.useCount >= link.maxUses) return "exhausted";
  return "active";
}

/**
 * Helper: get the full registration URL for a link
 */
export function getInviteUrl(link) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/register/${link.eventId}/${link.token}`;
}
