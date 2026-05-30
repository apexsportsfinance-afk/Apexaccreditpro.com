/**
 * Compute accreditation live/expired status.
 * NEVER stores status string — always computed on demand.
 *
 * Rules (§7):
 *  - If force_live = true → always "Live"
 *  - If selected_events has at least one event with a date → use latest date
 *  - If no event dates but accreditation has expiry_date → use that
 *  - Otherwise → "Live" (no expiry data)
 */
export function computeExpiryStatus(accreditation) {
  if (!accreditation) return { status: "Valid", label: "Valid Accreditation", isExpired: false };

  if (accreditation.force_live) {
    return { status: "Valid", label: "Valid Accreditation (Override)", isExpired: false };
  }

  const events = Array.isArray(accreditation.selected_events)
    ? accreditation.selected_events
    : [];

  const eventDates = events
    .map(e => e.date || e.event_date)
    .filter(Boolean)
    .map(d => new Date(d));

  if (eventDates.length > 0) {
    const latestDate = new Date(Math.max(...eventDates));
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const isExpired = latestDate < todayUTC;
    return {
      status: isExpired ? "Expired" : "Valid",
      label: isExpired ? "Expired Accreditation" : "Valid Accreditation",
      isExpired,
      expiryDate: latestDate.toISOString().split("T")[0]
    };
  }

  // Fallback to static expiry_date field
  if (accreditation.expiry_date) {
    const expiry = new Date(accreditation.expiry_date);
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const isExpired = expiry < todayUTC;
    return {
      status: isExpired ? "Expired" : "Valid",
      label: isExpired ? "Expired Accreditation" : "Valid Accreditation",
      isExpired,
      expiryDate: accreditation.expiry_date
    };
  }

  return { status: "Valid", label: "Valid Accreditation", isExpired: false };
}

export function formatEventDateTime(ev) {
  const parts = [];
  if (ev.date) {
    const d = new Date(ev.date);
    parts.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
  }
  if (ev.startTime || ev.start_time) {
    parts.push(ev.startTime || ev.start_time);
  }
  if (ev.session) parts.push(`Session ${ev.session}`);
  if (ev.venue) parts.push(ev.venue);
  return parts.join(" · ");
}
