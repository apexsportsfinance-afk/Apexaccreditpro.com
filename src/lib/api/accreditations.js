import { supabase } from "../supabase";
import { handleResponse, sleep } from "../apiHelpers";
import { OfflineDB } from "../offlineDb";
import { AuditAPI } from "./audit";

const ACCREDITATION_LIST_COLUMNS = [
  "id", "event_id", "first_name", "last_name", "gender", "date_of_birth",
  "nationality", "club", "role", "email", "photo_url", "id_document_url",
  "status", "zone_code", "badge_number", "accreditation_id", "remarks",
  "badge_color", "payment_status", "payment_amount", "stripe_session_id",
  "expires_at", "custom_message", "selected_sports", "created_at"
].join(",");

function mapAccreditationToDB(acc) {
  const map = {};
  const fields = {
    eventId: 'event_id', firstName: 'first_name', lastName: 'last_name',
    gender: 'gender', dateOfBirth: 'date_of_birth', nationality: 'nationality',
    club: 'club', role: 'role', email: 'email', photoUrl: 'photo_url',
    idDocumentUrl: 'id_document_url', status: 'status', zoneCode: 'zone_code',
    accreditationId: 'accreditation_id', badgeNumber: 'badge_number',
    remarks: 'remarks', badgeColor: 'badge_color', forceLive: 'force_live',
    paymentStatus: 'payment_status', paymentAmount: 'payment_amount',
    stripeSessionId: 'stripe_session_id', documents: 'documents',
    selectedSports: 'selected_sports', customMessage: 'custom_message',
    expiresAt: 'expires_at'
  };

  Object.keys(fields).forEach(k => {
    if (acc[k] !== undefined) {
      if ((k === 'dateOfBirth' || k === 'gender' || k === 'nationality') && acc[k] === "") {
        map[fields[k]] = null;
      } else {
        map[fields[k]] = acc[k];
      }
    }
  });

  let meta = acc.customMessage ? (typeof acc.customMessage === 'string' ? JSON.parse(acc.customMessage) : { ...acc.customMessage }) : {};
  if (acc.eidUrl) meta.eidUrl = acc.eidUrl;
  if (acc.medicalUrl) meta.medicalUrl = acc.medicalUrl;
  if (acc.phone) meta.phone = acc.phone;
  if (acc.customFields) meta = { ...meta, ...(typeof acc.customFields === 'string' ? JSON.parse(acc.customFields) : acc.customFields) };

  if (Object.keys(meta).length > 0) map.custom_message = JSON.stringify(meta);

  return map;
}

function mapAccreditationFromDB(db) {
  if (!db) return null;
  const acc = {
    id: db.id, eventId: db.event_id, firstName: db.first_name, lastName: db.last_name,
    gender: db.gender, dateOfBirth: db.date_of_birth, nationality: db.nationality,
    club: db.club, role: db.role, email: db.email, photoUrl: db.photo_url,
    idDocumentUrl: db.id_document_url, status: db.status, zoneCode: db.zone_code,
    badgeNumber: db.badge_number, accreditationId: db.accreditation_id,
    remarks: db.remarks, badgeColor: db.badge_color || "#2563eb",
    paymentStatus: db.payment_status || 'unpaid', paymentAmount: db.payment_amount,
    stripeSessionId: db.stripe_session_id,
    expiresAt: db.expires_at,
    createdAt: db.created_at
  };

  try {
    const meta = (db.custom_message && db.custom_message.startsWith('{')) ? JSON.parse(db.custom_message) : {};
    acc.eidUrl = meta.eidUrl || null;
    acc.medicalUrl = meta.medicalUrl || null;
    acc.phone = meta.phone || null;
    acc.customFields = meta;

    if (db.documents && typeof db.documents === 'object') {
      acc.documents = { picture: db.photo_url, passport: db.id_document_url, ...db.documents };
    } else {
      acc.documents = { picture: db.photo_url, passport: db.id_document_url, eid: acc.eidUrl, medical: acc.medicalUrl };
    }

    if (!acc.photoUrl) {
      acc.photoUrl = acc.documents.picture || acc.documents.photo || acc.documents.Picture || null;
      if (!acc.photoUrl && db.documents && typeof db.documents === 'object') {
        const docEntries = Object.entries(db.documents);
        const firstImageEntry = docEntries.find(([, url]) =>
          url && typeof url === 'string' && /\.(jpg|jpeg|png|webp)/i.test(url)
        );
        if (firstImageEntry) acc.photoUrl = firstImageEntry[1];
      }
    }
    if (!acc.idDocumentUrl) {
      acc.idDocumentUrl = acc.documents.passport || acc.documents.Passport || null;
      if (!acc.idDocumentUrl && db.documents && typeof db.documents === 'object') {
        const docEntries = Object.entries(db.documents);
        if (docEntries.length >= 2) acc.idDocumentUrl = docEntries[1][1];
      }
    }
  } catch {
    acc.documents = { picture: db.photo_url, passport: db.id_document_url };
  }

  acc.selectedSports = Array.isArray(db.selected_sports) ? db.selected_sports : [];

  return acc;
}

export const AccreditationsAPI = {
  getStats: async (eventIds = null) => {
    if (eventIds !== null && Array.isArray(eventIds) && eventIds.length === 0) {
      return { total: 0, pending: 0, approved: 0, rejected: 0 };
    }

    const buildQuery = (status = null) => {
      let q = supabase.from("accreditations").select("id", { count: "exact", head: true });
      if (eventIds && eventIds.length > 0) q = q.in("event_id", eventIds);
      if (status) q = q.eq("status", status);
      return q;
    };

    const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      buildQuery(),
      buildQuery("pending"),
      buildQuery("approved"),
      buildQuery("rejected")
    ]);
    return {
      total: totalRes.count || 0,
      pending: pendingRes.count || 0,
      approved: approvedRes.count || 0,
      rejected: rejectedRes.count || 0
    };
  },

  getCountsByEventIds: async (eventIds) => {
    if (!eventIds || eventIds.length === 0) return {};

    const counts = {};
    eventIds.forEach(id => { counts[id] = { total: 0, pending: 0, approved: 0, rejected: 0 }; });

    try {
      let start = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('accreditations')
          .select('status, event_id')
          .in('event_id', eventIds)
          .range(start, start + 999);

        if (error) { console.error("Aggregation chunk error:", error); break; }

        if (data && data.length > 0) {
          data.forEach(row => {
            const eid = row.event_id;
            if (counts[eid]) {
              counts[eid].total++;
              if (row.status === 'pending') counts[eid].pending++;
              if (row.status === 'approved') counts[eid].approved++;
              if (row.status === 'rejected') counts[eid].rejected++;
            }
          });
        }

        hasMore = data && data.length >= 1000;
        if (hasMore) start += 1000;
      }
    } catch (err) {
      console.error("Failed to aggregate counts:", err);
    }

    return counts;
  },

  getRecent: async (limit = 5, eventIds = null) => {
    if (eventIds !== null && Array.isArray(eventIds) && eventIds.length === 0) return [];

    let q = supabase
      .from("accreditations")
      .select("id, first_name, last_name, role, club, status, created_at, event_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventIds && eventIds.length > 0) q = q.in("event_id", eventIds);

    const data = await handleResponse(() => q);
    return (data || []).map(r => ({
      id: r.id, firstName: r.first_name, lastName: r.last_name,
      role: r.role, club: r.club, status: r.status,
      eventId: r.event_id, createdAt: r.created_at
    }));
  },

  getAll: async (options = {}) => {
    const { limit = 500, offset = 0 } = options;
    const data = await handleResponse(
      () => supabase
        .from("accreditations")
        .select(ACCREDITATION_LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
    );
    return (data || []).map(mapAccreditationFromDB);
  },

  getById: async (id) => {
    const data = await handleResponse(
      () => supabase.from("accreditations").select("*").eq("id", id).maybeSingle()
    );
    return data ? mapAccreditationFromDB(data) : null;
  },

  getByEventId: async (eventId, options = {}) => {
    const { status = null, club = null } = options;
    const PAGE_SIZE = 1000;
    let allData = [];
    let hasMore = true;
    let start = 0;

    try {
      while (hasMore) {
        let q = supabase
          .from("accreditations")
          .select(ACCREDITATION_LIST_COLUMNS)
          .order("created_at", { ascending: false })
          .range(start, start + PAGE_SIZE - 1);

        if (eventId && eventId !== "null") q = q.eq("event_id", eventId);
        if (status) q = q.eq("status", status);
        if (club) q = q.ilike("club", club.trim());

        const { data, error } = await q;
        if (error) { console.error(`Error fetching accreditations for event ${eventId}:`, error); throw error; }
        if (data && data.length > 0) { allData = allData.concat(data); start += PAGE_SIZE; }
        hasMore = data && data.length >= PAGE_SIZE;
      }
      return allData.map(mapAccreditationFromDB);
    } catch (error) {
      console.error(`Failed to fetch accreditations for event ${eventId}:`, error);
      throw error;
    }
  },

  getDashboardDistribution: async (eventId) => {
    const PAGE_SIZE = 1000;
    let allData = [];
    let hasMore = true;
    let start = 0;

    try {
      while (hasMore) {
        let q = supabase
          .from("accreditations")
          .select("zone_code, role")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(start, start + PAGE_SIZE - 1);

        if (eventId && eventId !== "null") q = q.eq("event_id", eventId);

        const { data, error } = await q;
        if (error) { console.error(`Error fetching dashboard distribution:`, error); throw error; }
        if (data && data.length > 0) { allData = allData.concat(data); start += PAGE_SIZE; }
        hasMore = data && data.length >= PAGE_SIZE;
      }
      return allData;
    } catch (err) {
      console.error("[AccreditationsAPI] getDashboardDistribution Error:", err);
      return [];
    }
  },

  getPaginatedByEventId: async (eventId, options = {}) => {
    const {
      status = null, role = null, nationality = null, club = null,
      searchTerm = "", limit = 50, offset = 0
    } = options;

    let q = supabase
      .from("accreditations")
      .select(ACCREDITATION_LIST_COLUMNS, { count: "estimated" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventId && eventId !== "null") q = q.eq("event_id", eventId);
    if (status) q = q.eq("status", status);
    if (role) q = q.eq("role", role);
    if (nationality) q = q.eq("nationality", nationality);
    if (club) q = q.ilike("club", `%${club}%`);

    if (searchTerm) {
      const term = `%${searchTerm.trim()}%`;
      q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},club.ilike.${term},accreditation_id.ilike.${term},badge_number.ilike.${term}`);
    }

    const { data, count, error } = await q;
    if (error) { console.error(`Failed paginated fetch:`, error); throw error; }

    return { data: (data || []).map(mapAccreditationFromDB), count: count || 0 };
  },

  search: async (eventId, { club = [], role = [], name = "", limit = 20, offset = 0 }) => {
    let q = supabase
      .from("accreditations")
      .select(ACCREDITATION_LIST_COLUMNS)
      .eq("event_id", eventId);

    if (club && club.length > 0) q = q.in("club", club);
    if (role && role.length > 0) q = q.in("role", role);
    if (name) q = q.or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`);

    const data = await handleResponse(
      () => q.range(offset, offset + limit - 1).order("first_name", { ascending: true })
    );
    return (data || []).map(mapAccreditationFromDB);
  },

  validateToken: async (token) => {
    if (!navigator.onLine) {
      try {
        const cachedData = await OfflineDB.getAccreditation(token);
        if (cachedData) return mapAccreditationFromDB(cachedData);
        return null;
      } catch (err) {
        console.error("[Offline Mode] Error searching local cache:", err);
        return null;
      }
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      let result = null;

      if (isUUID) {
        const data = await handleResponse(
          () => supabase.from("accreditations").select("*").eq("id", token).maybeSingle()
        );
        if (data) {
          result = mapAccreditationFromDB(data);
        } else {
          const dataByAccId = await handleResponse(
            () => supabase.from("accreditations").select("*").eq("accreditation_id", token).maybeSingle()
          );
          if (dataByAccId) result = mapAccreditationFromDB(dataByAccId);
        }
      } else {
        const data = await handleResponse(
          () => supabase.from("accreditations").select("*").eq("accreditation_id", token).maybeSingle()
        );
        if (data) result = mapAccreditationFromDB(data);
      }

      if (result) return result;
      if (attempts < maxAttempts) await sleep(1000);
    }

    return null;
  },

  checkDuplicate: async (eventId, firstName, lastName, club, dateOfBirth) => {
    const data = await handleResponse(() => {
      let q = supabase
        .from("accreditations")
        .select("id, first_name, last_name, club, date_of_birth, status")
        .eq("event_id", eventId)
        .ilike("first_name", firstName.trim())
        .ilike("last_name", lastName.trim())
        .ilike("club", (club || "").trim());

      if (dateOfBirth && dateOfBirth !== "") {
        q = q.eq("date_of_birth", dateOfBirth);
      } else {
        q = q.is("date_of_birth", null);
      }

      return q.limit(1);
    });

    if (data && data.length > 0) {
      return { isDuplicate: true, existingRecord: mapAccreditationFromDB(data[0]) };
    }
    return { isDuplicate: false };
  },

  create: async (accreditation, submissionSecret) => {
    const VALID_SECRET = `apex_v1_${accreditation.eventId?.substring(0, 8)}`;
    if (submissionSecret !== VALID_SECRET) {
      throw new Error("SECURITY_ERROR: Submission must be performed via the official registration form.");
    }

    const dbAccreditation = mapAccreditationToDB(accreditation);
    dbAccreditation.status = accreditation.status || "pending";

    const data = await handleResponse(
      () => supabase.from("accreditations").insert([dbAccreditation]).select().single()
    );
    AuditAPI.log("accreditation_submitted", { accreditationId: data.id });
    return mapAccreditationFromDB(data);
  },

  adminAdd: async (accreditation, adminUserId) => {
    const dbAccreditation = mapAccreditationToDB(accreditation);
    dbAccreditation.status = accreditation.status || "pending";
    if (adminUserId) {
      dbAccreditation.created_by = adminUserId;
      dbAccreditation.updated_by = adminUserId;
    }
    const data = await handleResponse(
      () => supabase.from("accreditations").insert([dbAccreditation]).select().single()
    );
    AuditAPI.log("accreditation_admin_added", { accreditationId: data.id, adminId: adminUserId });
    return mapAccreditationFromDB(data);
  },

  update: async (id, updates) => {
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      () => supabase.from("accreditations").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_updated", { accreditationId: id });
    return mapAccreditationFromDB(data);
  },

  adminEdit: async (id, updates, adminUserId) => {
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;
    if (adminUserId) {
      dbUpdates.updated_by = adminUserId;
      if (updates.status === "approved") {
        dbUpdates.approved_by = adminUserId;
        dbUpdates.approved_at = new Date().toISOString();
      }
    }
    const data = await handleResponse(
      () => supabase.from("accreditations").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_admin_edited", { accreditationId: id, adminId: adminUserId });
    return mapAccreditationFromDB(data);
  },

  approve: async (id, zoneCode, badgeNumber, role = null) => {
    const accreditationId = `ACC-${new Date().getFullYear()}-${id.substring(0, 8).toUpperCase()}`;
    const updateData = {
      status: "approved",
      zone_code: zoneCode,
      badge_number: badgeNumber,
      accreditation_id: accreditationId
    };
    if (role) updateData.role = role;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) updateData.updated_by = session.user.id;

    const data = await handleResponse(
      () => supabase.from("accreditations").update(updateData).eq("id", id).select(ACCREDITATION_LIST_COLUMNS).single()
    );
    AuditAPI.log("accreditation_approved", { accreditationId: id, badgeNumber, adminId: session?.user?.id });
    return mapAccreditationFromDB(data);
  },

  reject: async (id, remarks) => {
    const data = await handleResponse(
      () => supabase.from("accreditations").update({ status: "rejected", remarks }).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_rejected", { accreditationId: id, remarks });
    return mapAccreditationFromDB(data);
  },

  bulkApprove: async (ids, zoneCode) => {
    if (!ids || ids.length === 0) return;
    const { getBadgePrefix } = await import("../utils");
    const { data: accRows } = await handleResponse(
      () => supabase.from("accreditations").select("id, role, event_id").in("id", ids)
    );

    if (!accRows || accRows.length === 0) return;

    const accMap = {};
    (accRows || []).forEach(r => { accMap[r.id] = { role: r.role || "Unknown", eventId: r.event_id }; });

    const sampleEventId = accRows[0].event_id;
    const uniqueRoles = [...new Set((accRows || []).map(r => r.role || "Unknown"))];
    const roleCountCache = {};

    await Promise.all(uniqueRoles.map(async (role) => {
      const { data: existingBadges } = await handleResponse(
        () => supabase
          .from("accreditations")
          .select("badge_number")
          .eq("event_id", sampleEventId)
          .eq("role", role)
          .not("badge_number", "is", null)
      );

      let maxNum = 0;
      if (existingBadges && existingBadges.length > 0) {
        existingBadges.forEach(b => {
          if (b.badge_number) {
            const parts = b.badge_number.split("-");
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
      }
      roleCountCache[role] = maxNum;
    }));

    const approvalParams = [];
    for (const id of ids) {
      const acc = accMap[id];
      if (!acc) continue;
      const role = acc.role;
      const prefix = getBadgePrefix(role);
      roleCountCache[role] += 1;
      const badgeNumber = `${prefix}-${String(roleCountCache[role]).padStart(3, "0")}`;
      approvalParams.push({ id, zoneCode, badgeNumber, role });
    }

    const CHUNK_SIZE = 10;
    for (let i = 0; i < approvalParams.length; i += CHUNK_SIZE) {
      const chunk = approvalParams.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(param =>
        AccreditationsAPI.approve(param.id, param.zoneCode, param.badgeNumber, param.role)
      ));
    }
  },

  bulkUpdate: async (ids, updates) => {
    if (!ids || ids.length === 0) return;
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) dbUpdates.updated_by = session.user.id;

    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      await handleResponse(() => supabase.from("accreditations").update(dbUpdates).in("id", chunk));
    }
    AuditAPI.log("accreditations_bulk_updated", { count: ids.length });
  },

  delete: async (id) => {
    await handleResponse(() => supabase.from("accreditations").delete().eq("id", id));
    AuditAPI.log("accreditation_deleted", { accreditationId: id });
  },

  bulkDelete: async (ids) => {
    if (!ids || ids.length === 0) return;
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      await handleResponse(() => supabase.from("accreditations").delete().in("id", chunk));
    }
    AuditAPI.log("accreditations_bulk_deleted", { count: ids.length });
  }
};
