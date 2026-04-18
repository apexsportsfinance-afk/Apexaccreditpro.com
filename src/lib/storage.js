import { supabase } from "./supabase";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// APX-101: Request De-duplication and Retry Queue
const pendingRequests = new Map();

/**
 * Enterprise-grade response handler for Supabase/REST calls.
 * Implements APX-101 (Offline Resilience) guarantees.
 */
const handleResponse = async (promiseFactory, retries = MAX_RETRIES) => {
  // Simple key for GET-like requests to prevent duplicate inflight calls
  const requestKey = typeof promiseFactory === "string" ? promiseFactory : null;
  
  if (requestKey && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const execution = (async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const promise = typeof promiseFactory === "function" ? promiseFactory() : promiseFactory;
        const { data, error } = await promise;

        if (error) {
          console.error(`Supabase Error (attempt ${attempt}/${retries}):`, error);
          lastError = error;

          // Don't retry these specific error codes (Perms, Unique, JWT etc)
          if (
            error.code === "PGRST116" || // Not found (single)
            error.code === "23505" ||    // Unique constraint
            error.code === "42501" ||    // RLS Permission denied
            error.message?.includes("JWT")
          ) {
            throw error;
          }

          if (attempt < retries) {
            await sleep(RETRY_DELAY * attempt);
            continue;
          }
          throw error;
        }

        return data;
      } catch (err) {
        lastError = err;

        // APX-101: Detect Network Failures
        const isNetworkError = 
          (err.message === "Failed to fetch" || err.name === "TypeError") && 
          !navigator.onLine;

        if (isNetworkError) {
          console.warn(`APX-101: Network error detected (attempt ${attempt}/${retries})`);
          
          if (attempt < retries) {
            await sleep(RETRY_DELAY * attempt);
            continue;
          }

          // If it's a critical network failure and we are out of retries,
          // we could potentially enqueue this, but for now we throw so UI handles it.
          // Dispatch global sync event for UI components (GlobalNetworkBanner)
          window.dispatchEvent(new CustomEvent("apx-network-error", { detail: err }));
        }

        throw err;
      }
    }

    throw lastError || new Error("Max retries exceeded");
  })();

  if (requestKey) {
    pendingRequests.set(requestKey, execution);
    try {
      return await execution;
    } finally {
      pendingRequests.delete(requestKey);
    }
  }

  return await execution;
};

// --- EVENTS API ---
export const EventsAPI = {
  getAll: async () => {
    const data = await handleResponse(
      () => supabase.from("events").select("*").order("created_at", { ascending: false })
    );
    return (data || []).map(mapEventFromDB);
  },
  getById: async (id) => {
    const data = await handleResponse(
      () => supabase.from("events").select("*").eq("id", id).maybeSingle()
    );
    return data ? mapEventFromDB(data) : null;
  },
  getBySlug: async (slug) => {
    let data = await handleResponse(
      () => supabase.from("events").select("*").eq("slug", slug).maybeSingle()
    );
    
    if (!data) {
      data = await handleResponse(
        () => supabase.from("events").select("*").ilike("slug", slug).maybeSingle()
      );
    }

    const decodedSlug = decodeURIComponent(slug);
    if (!data && slug !== decodedSlug) {
      data = await handleResponse(
        () => supabase.from("events").select("*").eq("slug", decodedSlug).maybeSingle()
      );
      if (!data) {
        data = await handleResponse(
          () => supabase.from("events").select("*").ilike("slug", decodedSlug).maybeSingle()
        );
      }
    }

    if (!data) {
      data = await handleResponse(
        () => supabase.from("events").select("*").ilike("name", decodedSlug).maybeSingle()
      );
    }
    
    if (!data && decodedSlug.includes(" ")) {
      const hyphenSlug = decodedSlug.replace(/\s+/g, '-');
      data = await handleResponse(
        () => supabase.from("events").select("*").ilike("slug", hyphenSlug).maybeSingle()
      );
    }

    return data ? mapEventFromDB(data) : null;
  },
  create: async (event) => {
    const dbEvent = mapEventToDB(event);
    const data = await handleResponse(
      () => supabase.from("events").insert([dbEvent]).select().single()
    );
    AuditAPI.log("event_created", { eventId: data.id, name: data.name });
    return mapEventFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapEventToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      () => supabase.from("events").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("event_updated", { eventId: id });
    return mapEventFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(() => supabase.from("accreditations").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("zones").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_categories").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("events").delete().eq("id", id));
    AuditAPI.log("event_deleted", { eventId: id });
  }
};

// --- ZONES API ---
export const ZonesAPI = {
  getAll: async () => {
    const data = await handleResponse(() => supabase.from("zones").select("*"));
    return (data || []).map(mapZoneFromDB);
  },
  getByEventId: async (eventId) => {
    const data = await handleResponse(() => supabase.from("zones").select("*").eq("event_id", eventId));
    return (data || []).map(mapZoneFromDB);
  },
  create: async (zone) => {
    const dbZone = mapZoneToDB(zone);
    const data = await handleResponse(
      () => supabase.from("zones").insert([dbZone]).select().single()
    );
    AuditAPI.log("zone_created", { zoneId: data.id, name: data.name });
    return mapZoneFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapZoneToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      () => supabase.from("zones").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("zone_updated", { zoneId: id });
    return mapZoneFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(() => supabase.from("zones").delete().eq("id", id));
    AuditAPI.log("zone_deleted", { zoneId: id });
  }
};

// --- CATEGORIES API ---
export const CategoriesAPI = {
  getAll: async () => {
    const data = await handleResponse(
      () => supabase.from("categories").select("*").order("name", { ascending: true })
    );
    return (data || []).map(mapCategoryFromDB);
  },
  getActive: async () => {
    const data = await handleResponse(
      () => supabase.from("categories").select("*").eq("status", "active").order("name", { ascending: true })
    );
    return (data || []).map(mapCategoryFromDB);
  },
  getById: async (id) => {
    const data = await handleResponse(
      () => supabase.from("categories").select("*").eq("id", id).maybeSingle()
    );
    return data ? mapCategoryFromDB(data) : null;
  },
  create: async (category) => {
    const dbCat = mapCategoryToDB(category);
    const data = await handleResponse(
      () => supabase.from("categories").insert([dbCat]).select().single()
    );
    AuditAPI.log("category_created", { categoryId: data.id, name: data.name });
    return mapCategoryFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapCategoryToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      () => supabase.from("categories").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("category_updated", { categoryId: id });
    return mapCategoryFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(() => supabase.from("categories").delete().eq("id", id));
    AuditAPI.log("category_deleted", { categoryId: id });
  },
  isInUse: async (id) => {
    const { count } = await handleResponse(
      () => supabase
        .from("accreditations")
        .select("id", { count: "exact", head: true })
        .eq("role", id)
    );
    return (count || 0) > 0;
  }
};

// --- EVENT CATEGORIES API ---
export const EventCategoriesAPI = {
  getByEventId: async (eventId) => {
    const data = await handleResponse(
      () => supabase
        .from("event_categories")
        .select("*, categories(*)")
        .eq("event_id", eventId)
    );
    return (data || []).map(r => ({
      id: r.id,
      eventId: r.event_id,
      categoryId: r.category_id,
      category: r.categories ? mapCategoryFromDB(r.categories) : null,
      createdAt: r.created_at
    }));
  },
  setForEvent: async (eventId, categoryIds) => {
    await handleResponse(
      () => supabase.from("event_categories").delete().eq("event_id", eventId)
    );
    if (categoryIds.length > 0) {
      const rows = categoryIds.map(cid => ({ event_id: eventId, category_id: cid }));
      await handleResponse(
        () => supabase.from("event_categories").insert(rows)
      );
    }
    AuditAPI.log("event_categories_updated", { eventId, count: categoryIds.length });
  }
};

// --- ACCREDITATIONS API ---
const ACCREDITATION_LIST_COLUMNS = [
  "id", "event_id", "first_name", "last_name", "gender", "date_of_birth",
  "nationality", "club", "role", "email", "photo_url", "id_document_url",
  "status", "zone_code", "badge_number", "accreditation_id", "remarks",
  "badge_color", "updated_by", "created_by", "expires_at",
  "created_at", "updated_at", "custom_message", "force_live",
  "payment_status", "payment_amount", "stripe_session_id",
  "documents", "selected_sports"
].join(",");

export const AccreditationsAPI = {
  getStats: async (eventIds = null) => {
    const buildQuery = (status = null) => {
      let q = supabase.from("accreditations").select("*", { count: "exact", head: true });
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
    const data = await handleResponse(
      () => supabase
        .from("accreditations")
        .select("event_id, status")
        .in("event_id", eventIds)
    );

    const counts = {};
    eventIds.forEach(id => {
      counts[id] = { total: 0, pending: 0, approved: 0, rejected: 0 };
    });

    if (data) {
      data.forEach(row => {
        const c = counts[row.event_id];
        if (!c) return;
        c.total++;
        if (row.status === "pending") c.pending++;
        else if (row.status === "approved") c.approved++;
        else if (row.status === "rejected") c.rejected++;
      });
    }
    return counts;
  },

  getRecent: async (limit = 5, eventIds = null) => {
    let q = supabase
        .from("accreditations")
        .select("id, first_name, last_name, role, club, status, created_at, event_id")
        .order("created_at", { ascending: false })
        .limit(limit);
    
    if (eventIds && eventIds.length > 0) {
      q = q.in("event_id", eventIds);
    }

    const data = await handleResponse(() => q);
    return (data || []).map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role,
      club: r.club,
      status: r.status,
      eventId: r.event_id,
      createdAt: r.created_at
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
    const { status = null } = options;
    const PAGE_SIZE = 1000;

    try {
      // APX-PERF: Fast path — single query for ≤1000 records (covers 95% of events)
      let fastQuery = supabase
        .from("accreditations")
        .select(ACCREDITATION_LIST_COLUMNS)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1); // +1 to detect if more exist
      if (status) fastQuery = fastQuery.eq("status", status);

      const { data: fastData, error: fastError } = await fastQuery;

      if (!fastError && fastData && fastData.length <= PAGE_SIZE) {
        return fastData.map(mapAccreditationFromDB);
      }

      // Slow path: paginated fetch for large datasets (>1000 records)
      let countQuery = supabase
        .from("accreditations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);
      if (status) countQuery = countQuery.eq("status", status);
      const { count } = await countQuery;

      if (!count || count === 0) return [];

      const pages = Math.ceil(count / PAGE_SIZE);
      const requests = Array.from({ length: pages }, (_, i) => {
        let q = supabase
          .from("accreditations")
          .select(ACCREDITATION_LIST_COLUMNS)
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
        if (status) q = q.eq("status", status);
        return q;
      });

      const results = await Promise.all(requests);
      const allRows = results.flatMap(r => r.data || []);
      return allRows.map(mapAccreditationFromDB);
    } catch (error) {
      console.error(`Failed to fetch accreditations for event ${eventId}:`, error);
      throw error;
    }
  },

  search: async (eventId, { club = [], name = "", limit = 20, offset = 0 }) => {
    let q = supabase
      .from("accreditations")
      .select(ACCREDITATION_LIST_COLUMNS)
      .eq("event_id", eventId);

    if (club && club.length > 0) q = q.in("club", club);
    if (name) q = q.or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`);
    
    const data = await handleResponse(
      () => q.range(offset, offset + limit - 1).order("first_name", { ascending: true })
    );
    return (data || []).map(mapAccreditationFromDB);
  },

  validateToken: async (token) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    
    if (isUUID) {
      const data = await handleResponse(
        () => supabase.from("accreditations").select("*").eq("id", token).maybeSingle()
      );
      if (data) return mapAccreditationFromDB(data);
      
      const dataByAccId = await handleResponse(
        () => supabase.from("accreditations").select("*").eq("accreditation_id", token).maybeSingle()
      );
      return dataByAccId ? mapAccreditationFromDB(dataByAccId) : null;
    } else {
      const data = await handleResponse(
        () => supabase.from("accreditations").select("*").eq("accreditation_id", token).maybeSingle()
      );
      return data ? mapAccreditationFromDB(data) : null;
    }
  },

  checkDuplicate: async (eventId, firstName, lastName, club, dateOfBirth) => {
    const data = await handleResponse(
      () => supabase
        .from("accreditations")
        .select("id, first_name, last_name, club, date_of_birth, status")
        .eq("event_id", eventId)
        .ilike("first_name", firstName.trim())
        .ilike("last_name", lastName.trim())
        .ilike("club", club.trim())
        .eq("date_of_birth", dateOfBirth)
        .limit(1)
    );
    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        existingRecord: mapAccreditationFromDB(data[0])
      };
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
    const accreditationId = `ACC-2025-${id.substring(0, 8).toUpperCase()}`;
    const updateData = {
      status: "approved",
      zone_code: zoneCode,
      badge_number: badgeNumber,
      accreditation_id: accreditationId,
      approved_at: new Date().toISOString()
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
    const { getBadgePrefix } = await import("./utils");
    const { data: accRows } = await handleResponse(
      () => supabase.from("accreditations").select("id, role, event_id").in("id", ids)
    );
    
    const accMap = {};
    (accRows || []).forEach(r => {
      accMap[r.id] = { role: r.role || "Unknown", eventId: r.event_id };
    });

    const roleCountCache = {};
    const sampleEventId = accRows?.[0]?.event_id;
    
    for (const id of ids) {
      const acc = accMap[id];
      if (!acc) continue;
      const role = acc.role;
      const prefix = getBadgePrefix(role);
      
      if (roleCountCache[role] === undefined) {
        const { count } = await handleResponse(
          () => supabase
            .from("accreditations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", sampleEventId)
            .eq("role", role)
            .eq("status", "approved")
        );
        roleCountCache[role] = count || 0;
      }
      
      roleCountCache[role] += 1;
      const badgeNumber = `${prefix}-${String(roleCountCache[role]).padStart(3, "0")}`;
      await AccreditationsAPI.approve(id, zoneCode, badgeNumber, role);
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
      await handleResponse(
        () => supabase.from("accreditations").update(dbUpdates).in("id", chunk)
      );
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

// --- TICKETING API ---
export const TicketingAPI = {
  getTypes: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("ticket_types").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketTypeFromDB);
  },
  createType: async (type) => {
    const dbType = mapTicketTypeToDB(type);
    const data = await handleResponse(() => supabase.from("ticket_types").insert([dbType]).select().single());
    return mapTicketTypeFromDB(data);
  },
  updateType: async (id, updates) => {
    const dbUpdates = mapTicketTypeToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(() => supabase.from("ticket_types").update(dbUpdates).eq("id", id).select().single());
    return mapTicketTypeFromDB(data);
  },
  deleteType: async (id) => {
    await handleResponse(() => supabase.from("ticket_types").delete().eq("id", id));
  },

  getPackages: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("ticket_packages").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketPackageFromDB);
  },
  createPackage: async (pkg) => {
    const dbPkg = mapTicketPackageToDB(pkg);
    const data = await handleResponse(() => supabase.from("ticket_packages").insert([dbPkg]).select().single());
    return mapTicketPackageFromDB(data);
  },
  updatePackage: async (id, updates) => {
    const dbUpdates = mapTicketPackageToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(() => supabase.from("ticket_packages").update(dbUpdates).eq("id", id).select().single());
    return mapTicketPackageFromDB(data);
  },
  deletePackage: async (id) => {
    await handleResponse(() => supabase.from("ticket_packages").delete().eq("id", id));
  },

  getOrders: async (eventId) => {
    const data = await handleResponse(
      () => supabase.from("spectator_orders").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
    );
    return data || [];
  },

  createOrder: async (order) => {
    const orderQrCodeId = order.qrCodeId || `ord_${Math.random().toString(36).substr(2, 9)}`;
    const dbOrder = {
      event_id: order.eventId,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      total_amount: order.totalAmount,
      ticket_count: order.ticketCount,
      payment_status: order.paymentStatus || 'pending',
      payment_provider: order.paymentProvider || 'stripe',
      qr_code_id: orderQrCodeId,
      scanned_count: 0,
      selected_dates: order.selectedDates || [],
      has_individual_tickets: true
    };

    const orderData = await handleResponse(() => supabase.from("spectator_orders").insert([dbOrder]).select().single());

    const ticketCount = order.ticketItems?.length || order.ticketCount || 0;
    let tickets = [];
    
    if (ticketCount > 0) {
      tickets = (order.ticketItems || []).map(item => ({
        order_id: orderData.id,
        ticket_code: `TKT-${orderData.qr_code_id.split('-')[1] || orderData.id.slice(0,4).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        status: 'valid',
        ticket_name: item.name,
        price: item.price,
        valid_date: item.date
      }));

      const { error: insertErr } = await supabase.from("spectator_tickets").insert(tickets);
      if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
        const safeTickets = tickets.map(t => ({
          order_id: t.order_id,
          ticket_code: t.ticket_code,
          status: `valid|${JSON.stringify({ n: t.ticket_name, p: t.price, d: t.valid_date })}`
        }));
        await handleResponse(() => supabase.from("spectator_tickets").insert(safeTickets));
        tickets = safeTickets;
      } else if (insertErr) throw insertErr;
    }

    return { ...orderData, tickets };
  },

  getRevenueStats: async (eventId) => {
    const rawOrders = await handleResponse(() => supabase.from("spectator_orders").select("*").eq("event_id", eventId));
    if (!rawOrders?.length) return { orders: [], tickets: [] };

    const orders = rawOrders.filter(o => o.payment_status === 'paid');
    if (!orders.length) return { orders: [], tickets: [] };

    const orderIds = orders.map(o => o.id);
    const tickets = [];
    const ID_CHUNK_SIZE = 100;
    
    for (let i = 0; i < orderIds.length; i += ID_CHUNK_SIZE) {
      const chunk = orderIds.slice(i, i + ID_CHUNK_SIZE);
      const data = await handleResponse(() => supabase.from("spectator_tickets").select("*").in("order_id", chunk));
      if (data) tickets.push(...data);
    }

    return {
      orders,
      tickets: tickets.map(t => ({ ...t, order: orders.find(o => o.id === t.order_id) }))
    };
  },

  validateOrder: async (token) => {
    const specificTicket = await handleResponse(
      () => supabase.from("spectator_tickets").select("*, spectator_orders(*)").eq("ticket_code", token).maybeSingle()
    ).catch(() => null);

    if (specificTicket) {
      const orderData = Array.isArray(specificTicket.spectator_orders) ? specificTicket.spectator_orders[0] : specificTicket.spectator_orders;
      return { ...orderData, specific_ticket: specificTicket };
    }

    const ordData = await handleResponse(() => supabase.from("spectator_orders").select("*").eq("qr_code_id", token).maybeSingle());
    return ordData;
  },

  redeemTickets: async (orderId, count, ticketId = null) => {
    const ords = await handleResponse(() => supabase.from('spectator_orders').select('*').eq('id', orderId).limit(1));
    const order = ords?.[0];
    if (!order) throw new Error("Invalid Order or Ticket Code");

    const evs = await handleResponse(() => supabase.from('events').select('timezone').eq('id', order.event_id).limit(1));
    const eventTz = evs?.[0]?.timezone || "UTC";
    const today = new Date().toLocaleDateString('en-CA', { timeZone: eventTz });

    if (ticketId) {
      const ticket = await handleResponse(() => supabase.from('spectator_tickets').select('*').eq('id', ticketId).single());
      if (ticket.status === 'scanned' && ticket.valid_date === today) throw new Error("ALREADY_SCANNED");
      
      await handleResponse(() => supabase.from("spectator_tickets").update({ status: 'scanned', scanned_at: new Date().toISOString() }).eq("id", ticketId));
      const { count: freshCount } = await handleResponse(() => supabase.from("spectator_tickets").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("status", "scanned"));
      
      return handleResponse(() => supabase.from("spectator_orders").update({ scanned_count: freshCount || 0 }).eq("id", orderId).select().single());
    }

    const newScannedTotal = (order.scanned_count || 0) + Number(count);
    if (newScannedTotal > order.ticket_count) throw new Error("Limit exceeded");

    await handleResponse(() => supabase.from("spectator_orders").update({ scanned_count: newScannedTotal, last_scan_at: new Date().toISOString() }).eq("id", orderId));
    return { ...order, scanned_count: newScannedTotal };
  }
};

// --- USERS API ---
export const UsersAPI = {
  getAll: async () => {
    const data = await handleResponse(() => supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    return (data || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.full_name || u.email,
      role: u.role || "viewer",
      avatar: u.avatar_url,
      createdAt: u.created_at
    }));
  },
  getCurrentUser: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || session.user.email,
      role: session.user.user_metadata?.role || "event_admin"
    };
  },
  authenticate: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || email,
      role: data.user.user_metadata?.role || "super_admin"
    };
  },
  logout: async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  },
  create: async (userData) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
    const response = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "create", ...userData })
    });
    if (!response.ok) throw new Error("User creation failed");
    const data = await response.json();
    AuditAPI.log("user_created", { email: userData.email });
    return data.user;
  },
  update: async (id, updates) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
    const response = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "update", id, ...updates })
    });
    if (!response.ok) throw new Error("User update failed");
    const data = await response.json();
    AuditAPI.log("user_updated", { userId: id });
    return data.user;
  },
  delete: async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
    const response = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "delete", id })
    });
    if (!response.ok) throw new Error("User deletion failed");
    AuditAPI.log("user_deleted", { userId: id });
    return true;
  },
  getAccessMappings: async () => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", "user_event_access").maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
  },
  updateAccessMapping: async (userId, eventIds) => {
    const existing = await UsersAPI.getAccessMappings();
    if (eventIds?.length) existing[userId] = eventIds; else delete existing[userId];
    await handleResponse(() => supabase.from("global_settings").upsert({ key: "user_event_access", value: JSON.stringify(existing) }, { onConflict: 'key' }));
    return true;
  }
};

// --- FEEDBACK API ---
export const FeedbackAPI = {
  submit: async (feedback) => {
    const dbFeedback = mapFeedbackToDB(feedback);
    await handleResponse(() => supabase.from("event_feedback").insert([dbFeedback]));
    AuditAPI.log("feedback_submitted", { eventId: feedback.eventId });
    return true;
  },
  getAll: async (eventId) => {
    let q = supabase.from("event_feedback").select("*").order("created_at", { ascending: false });
    if (eventId) q = q.eq("event_id", eventId);
    const data = await handleResponse(() => q);
    return (data || []).map(mapFeedbackFromDB);
  },
  getStats: async (eventId) => {
    const data = await FeedbackAPI.getAll(eventId);
    if (!data.length) return null;
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      total: data.length,
      avgOverall: avg(data.map(f => f.overallRating || 0)),
      roles: { Coach: data.filter(f => f.role === "Coach").length, Athlete: data.filter(f => f.role === "Athlete").length }
    };
  }
};

// --- CONFIG API ---
export const ConfigAPI = {
  getFeedback: async (eventId) => {
    const data = await handleResponse(() => supabase.from("feedback_configs").select("*").eq("event_id", eventId).maybeSingle());
    return data;
  },
  saveFeedback: async (config) => {
    const { data: existing } = await handleResponse(() => supabase.from("feedback_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("feedback_configs").update({ ...config, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("feedback_configs").insert([{ ...config, created_at: new Date().toISOString() }]).select().single());
    }
  }
};

// --- AUDIT API ---
export const AuditAPI = {
  log: (action, details) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      supabase.from("audit_logs").insert([{
        action,
        details,
        user_id: session?.user?.id || "system",
        user_name: session?.user?.email || "System",
        timestamp: new Date().toISOString()
      }]).then(() => {}).catch(() => {});
    });
  },
  getRecent: async (limit = 100) => {
    const data = await handleResponse(
      () => supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit)
    );
    return (data || []).map(r => ({
      id: r.id,
      action: r.action,
      details: r.details,
      timestamp: r.timestamp,
      userId: r.user_id,
      userName: r.user_name
    }));
  },
  getScannerRecent: async (limit = 100) => {
    const data = await handleResponse(
      () => supabase
        .from("scanner_logs")
        .select(`
          *,
          accreditations (id, first_name, last_name, club, role, badge_number),
          spectator_orders (id, customer_name)
        `)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
    return data || [];
  }
};

// --- MAPPERS ---
function mapEventToDB(event) {
  const map = {};
  const fields = {
    name: 'name', slug: 'slug', description: 'description', 
    startDate: 'start_date', endDate: 'end_date', location: 'location',
    ageCalculationYear: 'age_calculation_year', registrationOpen: 'registration_open',
    reportingTimes: 'reporting_times', headerArabic: 'header_arabic',
    headerSubtitle: 'header_subtitle', logoUrl: 'logo_url',
    backTemplateUrl: 'back_template_url', sponsorLogos: 'sponsor_logos',
    requiredDocuments: 'required_documents', timezone: 'timezone',
    termsAndConditions: 'terms_and_conditions',
    sportList: 'sport_list'
  };
  Object.keys(fields).forEach(key => { if (event[key] !== undefined) map[fields[key]] = event[key]; });
  return map;
}

function mapEventFromDB(db) {
  if (!db) return null;
  return {
    id: db.id, name: db.name, slug: db.slug, description: db.description,
    startDate: db.start_date, endDate: db.end_date, location: db.location,
    ageCalculationYear: db.age_calculation_year, registrationOpen: db.registration_open,
    reportingTimes: db.reporting_times, headerArabic: db.header_arabic,
    headerSubtitle: db.header_subtitle, logoUrl: db.logo_url,
    backTemplateUrl: db.back_template_url, sponsorLogos: db.sponsor_logos || [],
    requiredDocuments: db.required_documents || ["picture", "passport"],
    termsAndConditions: db.terms_and_conditions || "",
    timezone: db.timezone || "UTC",
    sportList: db.sport_list || []
  };
}

function mapZoneToDB(z) {
  return { event_id: z.eventId, code: z.code, name: z.name, color: z.color, description: z.description, allowed_roles: z.allowedRoles };
}

function mapZoneFromDB(db) {
  return { id: db.id, eventId: db.event_id, code: db.code, name: db.name, color: db.color, description: db.description, allowedRoles: db.allowed_roles || [] };
}

function mapCategoryToDB(cat) {
  return { name: cat.name, slug: cat.slug, description: cat.description, badge_color: cat.badgeColor, status: cat.status, parent_id: cat.parentId, badge_prefix: cat.badgePrefix, display_order: cat.displayOrder, default_zone_codes: cat.defaultZoneCodes };
}

function mapCategoryFromDB(db) {
  return { id: db.id, name: db.name, slug: db.slug, description: db.description, badgeColor: db.badge_color || "#2563eb", status: db.status || "active", parentId: db.parent_id, badgePrefix: db.badge_prefix, displayOrder: db.display_order || 0, defaultZoneCodes: db.default_zone_codes };
}

function mapAccreditationToDB(acc) {
  const map = {};
  const fields = {
    eventId: 'event_id', firstName: 'first_name', lastName: 'last_name',
    gender: 'gender', dateOfBirth: 'date_of_birth', nationality: 'nationality',
    club: 'club', role: 'role', email: 'email', photoUrl: 'photo_url',
    idDocumentUrl: 'id_document_url', status: 'status', zoneCode: 'zone_code',
    accreditationId: 'accreditation_id',
    remarks: 'remarks', badgeColor: 'badge_color', forceLive: 'force_live',
    paymentStatus: 'payment_status', paymentAmount: 'payment_amount',
    stripeSessionId: 'stripe_session_id', documents: 'documents',
    selectedSports: 'selected_sports'
  };

  Object.keys(fields).forEach(k => { if (acc[k] !== undefined) map[fields[k]] = acc[k]; });
  
  // Custom message/meta docs
  let meta = {};
  if (acc.eidUrl) meta.eidUrl = acc.eidUrl;
  if (acc.medicalUrl) meta.medicalUrl = acc.medicalUrl;
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
    stripeSessionId: db.stripe_session_id
  };
  
  try {
    const meta = (db.custom_message && db.custom_message.startsWith('{')) ? JSON.parse(db.custom_message) : {};
    acc.eidUrl = meta.eidUrl || null;
    acc.medicalUrl = meta.medicalUrl || null;
    
    // Priority 1: Use the dedicated 'documents' JSONB column if it exists and has data
    if (db.documents && typeof db.documents === 'object') {
      acc.documents = { 
        picture: db.photo_url, 
        passport: db.id_document_url, 
        ...db.documents 
      };
    } else {
      // Priority 2: Fallback to manual reconstruction from meta and base fields
      acc.documents = { picture: db.photo_url, passport: db.id_document_url, eid: acc.eidUrl, medical: acc.medicalUrl };
    }

    // APX-Robustness: Ensure photoUrl and idDocumentUrl are populated from documents if missing
    if (!acc.photoUrl) {
      acc.photoUrl = acc.documents.picture || acc.documents.photo || acc.documents.Picture || null;
      
      // APX-Fix: If still no photo, scan all document values (handles custom IDs like "custom_123")
      if (!acc.photoUrl && db.documents && typeof db.documents === 'object') {
        const docEntries = Object.entries(db.documents);
        // First image URL is typically the photo (events list picture first)
        const firstImageEntry = docEntries.find(([, url]) => 
          url && typeof url === 'string' && /\.(jpg|jpeg|png|webp)/i.test(url)
        );
        if (firstImageEntry) acc.photoUrl = firstImageEntry[1];
      }
    }
    if (!acc.idDocumentUrl) {
      acc.idDocumentUrl = acc.documents.passport || acc.documents.Passport || null;
      
      // APX-Fix: If still no ID doc, use the second document URL from JSONB
      if (!acc.idDocumentUrl && db.documents && typeof db.documents === 'object') {
        const docEntries = Object.entries(db.documents);
        // Skip the first entry (photo), use the second one (passport/ID)
        if (docEntries.length >= 2) {
          acc.idDocumentUrl = docEntries[1][1];
        }
      }
    }
  } catch {
    acc.documents = { picture: db.photo_url, passport: db.id_document_url };
  }

  
  // Mapping selected_sports from DB
  acc.selectedSports = Array.isArray(db.selected_sports) ? db.selected_sports : [];
  
  return acc;
}

function mapTicketTypeToDB(t) { return { event_id: t.eventId, name: t.name, description: t.description, price: t.price, currency: t.currency || "AED", capacity: t.capacity, is_active: t.isActive, is_full_event: t.isFullEvent }; }
function mapTicketTypeFromDB(db) { return { id: db.id, eventId: db.event_id, name: db.name, description: db.description, price: db.price, currency: db.currency, capacity: db.capacity, isActive: db.is_active, isFullEvent: db.is_full_event }; }
function mapTicketPackageToDB(p) { return { event_id: p.eventId, name: p.name, description: p.description, price: p.price, quantity_included: p.quantityIncluded, is_active: p.isActive, is_full_event: p.isFullEvent }; }
function mapTicketPackageFromDB(db) { return { id: db.id, eventId: db.event_id, name: db.name, description: db.description, price: db.price, quantityIncluded: db.quantity_included, isActive: db.is_active, isFullEvent: db.is_full_event }; }

function mapFeedbackToDB(f) {
  return { event_id: f.eventId, role: f.role, overall_rating: f.overallRating, competition_rating: f.competitionRating, venue_rating: f.venueRating, communication_rating: f.communicationRating, nps_score: f.npsScore, liked_most: f.likedMost, improve_future: f.improveFuture };
}

function mapFeedbackFromDB(db) {
  return { id: db.id, eventId: db.event_id, role: db.role, overallRating: db.overall_rating, competitionRating: db.competition_rating, venueRating: db.venue_rating, communicationRating: db.communication_rating };
}

export const initializeDefaultData = async () => {};
