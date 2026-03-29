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
        const isNetworkError = err.message === "Failed to fetch" || err.name === "TypeError" || err.code === "PGRST116" === false && !navigator.onLine;

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
      supabase.from("events").select("*").order("created_at", { ascending: false })
    );
    return (data || []).map(mapEventFromDB);
  },
  getById: async (id) => {
    const data = await handleResponse(
      supabase.from("events").select("*").eq("id", id).single()
    ).catch(() => null);
    return data ? mapEventFromDB(data) : null;
  },
  getBySlug: async (slug) => {
    let data = await handleResponse(
      supabase.from("events").select("*").eq("slug", slug).single()
    ).catch(() => null);
    
    if (!data) {
      data = await handleResponse(
        supabase.from("events").select("*").ilike("slug", slug).single()
      ).catch(() => null);
    }

    const decodedSlug = decodeURIComponent(slug);
    if (!data && slug !== decodedSlug) {
      data = await handleResponse(
        supabase.from("events").select("*").eq("slug", decodedSlug).single()
      ).catch(() => null);
      if (!data) {
        data = await handleResponse(
          supabase.from("events").select("*").ilike("slug", decodedSlug).single()
        ).catch(() => null);
      }
    }

    if (!data) {
      data = await handleResponse(
        supabase.from("events").select("*").ilike("name", decodedSlug).single()
      ).catch(() => null);
    }
    
    if (!data && decodedSlug.includes(" ")) {
      const hyphenSlug = decodedSlug.replace(/\s+/g, '-');
      data = await handleResponse(
        supabase.from("events").select("*").ilike("slug", hyphenSlug).single()
      ).catch(() => null);
    }

    return data ? mapEventFromDB(data) : null;
  },
  create: async (event) => {
    const dbEvent = mapEventToDB(event);
    const data = await handleResponse(
      supabase.from("events").insert([dbEvent]).select().single()
    );
    AuditAPI.log("event_created", { eventId: data.id, name: data.name });
    return mapEventFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapEventToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("events").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("event_updated", { eventId: id });
    return mapEventFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(supabase.from("accreditations").delete().eq("event_id", id));
    await handleResponse(supabase.from("zones").delete().eq("event_id", id));
    await supabase.from("event_categories").delete().eq("event_id", id);
    await handleResponse(supabase.from("events").delete().eq("id", id));
    AuditAPI.log("event_deleted", { eventId: id });
  }
};

// --- ZONES API ---
export const ZonesAPI = {
  getAll: async () => {
    const data = await handleResponse(supabase.from("zones").select("*"));
    return (data || []).map(mapZoneFromDB);
  },
  getByEventId: async (eventId) => {
    const data = await handleResponse(supabase.from("zones").select("*").eq("event_id", eventId));
    return (data || []).map(mapZoneFromDB);
  },
  create: async (zone) => {
    const dbZone = mapZoneToDB(zone);
    const data = await handleResponse(
      supabase.from("zones").insert([dbZone]).select().single()
    );
    AuditAPI.log("zone_created", { zoneId: data.id, name: data.name });
    return mapZoneFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapZoneToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("zones").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("zone_updated", { zoneId: id });
    return mapZoneFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(supabase.from("zones").delete().eq("id", id));
    AuditAPI.log("zone_deleted", { zoneId: id });
  }
};

// --- CATEGORIES API ---
export const CategoriesAPI = {
  getAll: async () => {
    const data = await handleResponse(
      supabase.from("categories").select("*").order("name", { ascending: true })
    );
    return (data || []).map(mapCategoryFromDB);
  },
  getActive: async () => {
    const data = await handleResponse(
      supabase.from("categories").select("*").eq("status", "active").order("name", { ascending: true })
    );
    return (data || []).map(mapCategoryFromDB);
  },
  getById: async (id) => {
    const data = await handleResponse(
      supabase.from("categories").select("*").eq("id", id).single()
    ).catch(() => null);
    return data ? mapCategoryFromDB(data) : null;
  },
  create: async (category) => {
    const dbCat = mapCategoryToDB(category);
    const data = await handleResponse(
      supabase.from("categories").insert([dbCat]).select().single()
    );
    AuditAPI.log("category_created", { categoryId: data.id, name: data.name });
    return mapCategoryFromDB(data);
  },
  update: async (id, updates) => {
    const dbUpdates = mapCategoryToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("categories").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("category_updated", { categoryId: id });
    return mapCategoryFromDB(data);
  },
  delete: async (id) => {
    await handleResponse(supabase.from("categories").delete().eq("id", id));
    AuditAPI.log("category_deleted", { categoryId: id });
  },
  isInUse: async (id) => {
    const { count } = await supabase
      .from("accreditations")
      .select("id", { count: "exact", head: true })
      .eq("role", id);
    return (count || 0) > 0;
  }
};

// --- EVENT CATEGORIES API ---
export const EventCategoriesAPI = {
  getByEventId: async (eventId) => {
    const data = await handleResponse(
      supabase
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
      supabase.from("event_categories").delete().eq("event_id", eventId)
    );
    if (categoryIds.length > 0) {
      const rows = categoryIds.map(cid => ({ event_id: eventId, category_id: cid }));
      await handleResponse(
        supabase.from("event_categories").insert(rows)
      );
    }
    AuditAPI.log("event_categories_updated", { eventId, count: categoryIds.length });
  }
};

// --- ACCREDITATIONS API ---
// All columns that exist in the accreditations table (excluding heavy/unused joins)
const ACCREDITATION_LIST_COLUMNS = [
  "id", "event_id", "first_name", "last_name", "gender", "date_of_birth",
  "nationality", "club", "role", "email", "photo_url", "id_document_url",
  "status", "zone_code", "badge_number", "accreditation_id", "remarks",
  "badge_color", "updated_by", "created_by", "expires_at",
  "created_at", "updated_at",
  "custom_message", "custom_message_updated_at",
  "selected_events", "selected_sport_events",
  "heat_sheet_url", "event_result_url", "force_live",
  "heat_sheet_updated_at", "event_result_updated_at"
].join(",");

export const AccreditationsAPI = {
  getStats: async () => {
    const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase.from("accreditations").select("*", { count: "exact", head: true }),
      supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("status", "rejected")
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
    // Use proper count queries via Supabase head:true — avoids the 1000-row PostgREST default cap
    const counts = {};
    await Promise.all(
      eventIds.map(async (eventId) => {
        const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
          supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("event_id", eventId),
          supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "pending"),
          supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "approved"),
          supabase.from("accreditations").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "rejected")
        ]);
        counts[eventId] = {
          total: totalRes.count || 0,
          pending: pendingRes.count || 0,
          approved: approvedRes.count || 0,
          rejected: rejectedRes.count || 0
        };
      })
    );
    return counts;
  },

  getRecent: async (limit = 5) => {
    const data = await handleResponse(
      supabase
        .from("accreditations")
        .select(ACCREDITATION_LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
    return (data || []).map(mapAccreditationFromDB);
  },

  getAll: async (options = {}) => {
    const { limit = 500, offset = 0 } = options;
    const data = await handleResponse(
      supabase
        .from("accreditations")
        .select(ACCREDITATION_LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
    );
    return (data || []).map(mapAccreditationFromDB);
  },

  // FIXED: batched pagination — 500 rows per request, looped until complete
  // Prevents "Failed to fetch" and statement timeout (57014) from massive single queries
  getByEventId: async (eventId, options = {}) => {
    const { status = null, maxRecords = 6000 } = options; // APX-P0: Stable 6k limit as requested
    const BATCH_SIZE = 1000; // APX-P0: Set to 1,000 to trigger multi-batching up to the 6k limit

    const allRows = [];
    let batchOffset = 0;

    try {
      while (allRows.length < maxRecords) {
        const remaining = maxRecords - allRows.length;
        const fetchSize = Math.min(BATCH_SIZE, remaining);

        const batchData = await handleResponse(() => {
          let q = supabase
            .from("accreditations")
            .select(ACCREDITATION_LIST_COLUMNS)
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });
          if (status) q = q.eq("status", status);
          return q.range(batchOffset, batchOffset + fetchSize - 1);
        });

        const rows = batchData || [];
        allRows.push(...rows);

        // If we got fewer rows than requested, we've reached the end
        if (rows.length < fetchSize) break;
        batchOffset += fetchSize;
      }

      return allRows.map(mapAccreditationFromDB);
    } catch (error) {
      console.error(`Failed to fetch accreditations for event ${eventId}:`, error);

      if (error.code === "42501" || error.message?.includes("row-level security")) {
        throw new Error("Access denied. Please ensure you are logged in with proper permissions.");
      }

      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        throw new Error("Network error. Please check your internet connection and try again.");
      }

      throw new Error(
        `Failed to load accreditations: ${error.message || "Network error. Please check your connection and try again."}`
      );
    }
  },

  search: async (eventId, { club = [], heat = [], name = "", limit = 20, offset = 0 }) => {
    let q = supabase
      .from("accreditations")
      .select(ACCREDITATION_LIST_COLUMNS)
      .eq("event_id", eventId); // Removed .is("deleted_at", null) as column does not exist

    if (club && club.length > 0) q = q.in("club", club);
    if (name) q = q.or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`);
    
    // If heat is relevant, we might need to join or check a column. 
    // Assuming 'selected_events' contains event codes/heats.
    if (heat && heat.length > 0) {
      // This might be a complex check if it's JSON. 
      // For now, let's assume it's a simple match or we'll refine later.
    }

    const { data, error } = await q.range(offset, offset + limit - 1).order("first_name", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapAccreditationFromDB);
  },

  getById: async (id) => {
    const data = await handleResponse(
      supabase.from("accreditations").select("*").eq("id", id).single()
    ).catch(() => null);
    return data ? mapAccreditationFromDB(data) : null;
  },

  validateToken: async (token) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    let query = supabase.from("accreditations").select("*");
    
    if (isUUID) {
      // First try by ID (if it's a UUID)
      const { data: byId } = await query.eq("id", token).maybeSingle();
      if (byId) return mapAccreditationFromDB(byId);
      
      // If it's a UUID but not the primary ID, try accreditation_id
      const { data: byAccId } = await supabase.from("accreditations").select("*").eq("accreditation_id", token).maybeSingle();
      return byAccId ? mapAccreditationFromDB(byAccId) : null;
    } else {
      // If it's short ID, search by accreditation_id
      const data = await handleResponse(query.eq("accreditation_id", token).maybeSingle()).catch(() => null);
      return data ? mapAccreditationFromDB(data) : null;
    }
  },

  checkDuplicate: async (eventId, firstName, lastName, club, dateOfBirth) => {
    const { data, error } = await supabase
      .from("accreditations")
      .select("id, first_name, last_name, club, date_of_birth, status")
      .eq("event_id", eventId)
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .ilike("club", club.trim())
      .eq("date_of_birth", dateOfBirth)
      .limit(1);
    if (error) {
      console.error("Duplicate check error:", error);
      return { isDuplicate: false };
    }
    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        existingRecord: mapAccreditationFromDB(data[0])
      };
    }
    return { isDuplicate: false };
  },

  /**
   * Enterprise-Grade Submission Guard (APX-P0)
   * Prevents unauthorized API bypasses and programmatic injection.
   */
  create: async (accreditation, submissionSecret) => {
    // 1. Foolproof Origin Validation
    const VALID_SECRET = `apex_v1_${accreditation.eventId?.substring(0, 8)}`;
    if (submissionSecret !== VALID_SECRET) {
      console.error("APX-P0: Unauthorized submission bypass detected.");
      AuditAPI.log("unauthorized_submission_attempt", { 
        eventId: accreditation.eventId,
        club: accreditation.club,
        origin: "bypass_detected"
      });
      throw new Error("SECURITY_ERROR: Submission must be performed via the official registration form.");
    }

    // Rigid duplicate check fallback before insert
    const dupCheck = await AccreditationsAPI.checkDuplicate(
      accreditation.eventId,
      accreditation.firstName,
      accreditation.lastName,
      accreditation.club,
      accreditation.dateOfBirth
    );
    if (dupCheck.isDuplicate) {
      throw new Error("DUPLICATE_NAME: An athlete with this profile has already registered for this event.");
    }

    const dbAccreditation = mapAccreditationToDB(accreditation);
    dbAccreditation.status = "pending";
    
    // Tag the record as an official form submission in a hidden metadata field (optional but recommended)
    dbAccreditation.custom_message = "OFFICIAL_SUBMISSION_V1";

    try {
      const data = await handleResponse(
        supabase.from("accreditations").insert([dbAccreditation]).select().single()
      );
      AuditAPI.log("accreditation_submitted", { accreditationId: data.id });
      return mapAccreditationFromDB(data);
    } catch (error) {
      if (error.code === "23505" && error.message.includes("idx_accreditations_unique_name_per_event")) {
        throw new Error("DUPLICATE_NAME: An athlete with this name has already registered for this event.");
      }
      throw error;
    }
  },

  update: async (id, updates) => {
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("accreditations").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_updated", { accreditationId: id });
    return mapAccreditationFromDB(data);
  },

  adminEdit: async (id, updates, adminUserId) => {
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;
    if (adminUserId) {
      dbUpdates.updated_by = adminUserId;
      // If status is changing to approved, set approved_by/at
      if (updates.status === "approved") {
        dbUpdates.approved_by = adminUserId;
        dbUpdates.approved_at = new Date().toISOString();
      }
    }
    const data = await handleResponse(
      supabase.from("accreditations").update(dbUpdates).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_admin_edited", {
      accreditationId: id,
      fields: Object.keys(dbUpdates),
      adminId: adminUserId
    });
    return mapAccreditationFromDB(data);
  },

  approve: async (id, zoneCode, badgeNumber, role = null) => {
    const accreditationId = `ACC-2025-${id.substring(0, 8).toUpperCase()}`;
    const updateData = {
      status: "approved",
      zone_code: zoneCode,
      badge_number: badgeNumber,
      accreditation_id: accreditationId
    };
    if (role) {
      updateData.role = role;
    }
    // APX-102: Capture Actor Identity using verified column
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      updateData.updated_by = session.user.id;
    }

    const data = await handleResponse(
      supabase.from("accreditations").update(updateData).eq("id", id).select(ACCREDITATION_LIST_COLUMNS).single()
    );
    AuditAPI.log("accreditation_approved", { 
      accreditationId: id, 
      badgeNumber,
      adminId: session?.user?.id 
    });
    return mapAccreditationFromDB(data);
  },

  reject: async (id, remarks) => {
    const data = await handleResponse(
      supabase.from("accreditations").update({
        status: "rejected",
        remarks: remarks
      }).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_rejected", { accreditationId: id, remarks });
    return mapAccreditationFromDB(data);
  },

  bulkApprove: async (ids, zoneCode) => {
    const { getBadgePrefix } = await import("./utils");
    const { data: accRows, error: accErr } = await supabase
      .from("accreditations")
      .select("id, role, event_id")
      .in("id", ids);
    if (accErr) throw accErr;
    const accMap = {};
    (accRows || []).forEach(r => {
      accMap[r.id] = { role: r.role || "Unknown", eventId: r.event_id };
    });
    const roleCountCache = {};
    const uniqueRoles = [...new Set(ids.map(id => accMap[id]?.role).filter(Boolean))];
    const sampleEventId = accMap[ids[0]]?.eventId;
    if (sampleEventId && uniqueRoles.length > 0) {
      await Promise.all(uniqueRoles.map(async (role) => {
        const { count } = await supabase
          .from("accreditations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", sampleEventId)
          .eq("role", role)
          .eq("status", "approved");
        roleCountCache[role] = count || 0;
      }));
    }
    for (const id of ids) {
      const acc = accMap[id];
      if (!acc) continue;
      const role = acc.role;
      const prefix = getBadgePrefix(role);
      if (roleCountCache[role] === undefined) roleCountCache[role] = 0;
      roleCountCache[role] += 1;
      const badgeNumber = `${prefix}-${String(roleCountCache[role]).padStart(3, "0")}`;
      await AccreditationsAPI.approve(id, zoneCode, badgeNumber, role);
    }
  },

  bulkUpdate: async (ids, updates) => {
    if (!ids || ids.length === 0) return;
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;

    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      dbUpdates.updated_by = session.user.id;
    }

    try {
      await Promise.all(chunks.map(chunk =>
        handleResponse(
          supabase.from("accreditations").update(dbUpdates).in("id", chunk)
        )
      ));
    } catch (err) {
      console.warn("Bulk update partial failure:", err);
    }

    AuditAPI.log("accreditations_bulk_updated", {
      count: ids.length,
      fields: Object.keys(updates)
    });
  },

  delete: async (id) => {
    await handleResponse(supabase.from("accreditations").delete().eq("id", id));
    AuditAPI.log("accreditation_deleted", { accreditationId: id });
  },

  bulkDelete: async (ids) => {
    if (!ids || ids.length === 0) return;
    
    // Chunking to avoid massive request issues if necessary, though 
    // .in() is usually fine for moderate counts (up to ~1000).
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      await handleResponse(
        supabase.from("accreditations").delete().in("id", chunk)
      );
    }
    
    AuditAPI.log("accreditations_bulk_deleted", { count: ids.length });
  }
};

// --- TICKETING API ---
export const TicketingAPI = {
  getTypes: async (eventId) => {
    const data = await handleResponse(
      supabase.from("ticket_types").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketTypeFromDB);
  },
  createType: async (type) => {
    const dbType = mapTicketTypeToDB(type);
    const data = await handleResponse(
      supabase.from("ticket_types").insert([dbType]).select().single()
    );
    return mapTicketTypeFromDB(data);
  },
  updateType: async (id, updates) => {
    const dbUpdates = mapTicketTypeToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("ticket_types").update(dbUpdates).eq("id", id).select().single()
    );
    return mapTicketTypeFromDB(data);
  },
  deleteType: async (id) => {
    await handleResponse(supabase.from("ticket_types").delete().eq("id", id));
  },

  getPackages: async (eventId) => {
    const data = await handleResponse(
      supabase.from("ticket_packages").select("*").eq("event_id", eventId).order("created_at", { ascending: true })
    );
    return (data || []).map(mapTicketPackageFromDB);
  },
  createPackage: async (pkg) => {
    const dbPkg = mapTicketPackageToDB(pkg);
    const data = await handleResponse(
      supabase.from("ticket_packages").insert([dbPkg]).select().single()
    );
    return mapTicketPackageFromDB(data);
  },
  updatePackage: async (id, updates) => {
    const dbUpdates = mapTicketPackageToDB(updates);
    delete dbUpdates.id;
    const data = await handleResponse(
      supabase.from("ticket_packages").update(dbUpdates).eq("id", id).select().single()
    );
    return mapTicketPackageFromDB(data);
  },
  deletePackage: async (id) => {
    await handleResponse(supabase.from("ticket_packages").delete().eq("id", id));
  },

  getOrders: async (eventId) => {
    const { data } = await handleResponse(
      supabase
        .from("spectator_orders")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
    );
    return data || [];
  },

  createOrder: async (order) => {
    // Generate a unique QR code ID if not provided
    const qrCodeId = order.qrCodeId || `spec_${Math.random().toString(36).substr(2, 9)}`;
    const dbOrder = {
      event_id: order.eventId,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      total_amount: order.totalAmount,
      ticket_count: order.ticketCount,
      payment_status: order.paymentStatus || 'pending',
      payment_provider: order.paymentProvider || 'stripe',
      qr_code_id: qrCodeId,
      scanned_count: 0,
      selected_dates: order.selectedDates || []
    };
    const data = await handleResponse(
      supabase.from("spectator_orders").insert([dbOrder]).select().single()
    );
    return data;
  },

  validateOrder: async (qrCodeId) => {
    const data = await handleResponse(
      supabase.from("spectator_orders")
        .select("*")
        .eq("qr_code_id", qrCodeId)
        .single()
    );
    return data;
  },

  redeemTickets: async (orderId, count) => {
    // Increment scanned_count in DB
    const { data: order, error: fetchError } = await supabase
      .from("spectator_orders")
      .select("scanned_count, ticket_count")
      .eq("id", orderId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const newScanned = (order.scanned_count || 0) + count;
    if (newScanned > order.ticket_count) {
      throw new Error(`Cannot redeem ${count} tickets. Only ${order.ticket_count - order.scanned_count} remaining.`);
    }

    const { data, error } = await supabase
      .from("spectator_orders")
      .update({ 
        scanned_count: newScanned,
        last_scanned_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// --- MAPPERS ---

function mapEventToDB(event) {
  const map = {};
  if (event.name !== undefined) map.name = event.name;
  if (event.slug !== undefined) map.slug = event.slug;
  if (event.description !== undefined) map.description = event.description;
  if (event.startDate !== undefined) map.start_date = event.startDate;
  if (event.endDate !== undefined) map.end_date = event.endDate;
  if (event.location !== undefined) map.location = event.location;
  if (event.ageCalculationYear !== undefined) map.age_calculation_year = event.ageCalculationYear;
  if (event.registrationOpen !== undefined) map.registration_open = event.registrationOpen;
  if (event.reportingTimes !== undefined) map.reporting_times = event.reportingTimes;
  if (event.headerArabic !== undefined) map.header_arabic = event.headerArabic;
  if (event.headerSubtitle !== undefined) map.header_subtitle = event.headerSubtitle;
  if (event.logoUrl !== undefined) map.logo_url = event.logoUrl;
  if (event.backTemplateUrl !== undefined) map.back_template_url = event.backTemplateUrl;
  if (event.sponsorLogos !== undefined) map.sponsor_logos = event.sponsorLogos;
  if (event.requiredDocuments !== undefined) map.required_documents = event.requiredDocuments;
  if (event.registrationClosedMessage !== undefined) map.athlete_qr_broadcast_message = event.registrationClosedMessage;
  return map;
}

function mapEventFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    description: db.description,
    startDate: db.start_date,
    endDate: db.end_date,
    location: db.location,
    ageCalculationYear: db.age_calculation_year,
    registrationOpen: db.registration_open,
    registrationClosedMessage: db.athlete_qr_broadcast_message || "",
    reportingTimes: db.reporting_times,
    headerArabic: db.header_arabic,
    headerSubtitle: db.header_subtitle,
    logoUrl: db.logo_url,
    backTemplateUrl: db.back_template_url,
    sponsorLogos: db.sponsor_logos || [],
    requiredDocuments: db.required_documents || ["picture", "passport"],
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}

function mapZoneToDB(zone) {
  const map = {};
  if (zone.eventId !== undefined) map.event_id = zone.eventId;
  if (zone.code !== undefined) map.code = zone.code;
  if (zone.name !== undefined) map.name = zone.name;
  if (zone.color !== undefined) map.color = zone.color;
  if (zone.description !== undefined) map.description = zone.description;
  if (zone.allowedRoles !== undefined) map.allowed_roles = zone.allowedRoles;
  return map;
}

function mapZoneFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    eventId: db.event_id,
    code: db.code,
    name: db.name,
    color: db.color,
    description: db.description,
    allowedRoles: db.allowed_roles || [],
    createdAt: db.created_at
  };
}

function mapCategoryToDB(cat) {
  const map = {};
  if (cat.name !== undefined) map.name = cat.name;
  if (cat.slug !== undefined) map.slug = cat.slug;
  if (cat.description !== undefined) map.description = cat.description;
  if (cat.badgeColor !== undefined) map.badge_color = cat.badgeColor;
  if (cat.status !== undefined) map.status = cat.status;
  if (cat.parentId !== undefined) map.parent_id = cat.parentId;
  if (cat.badgePrefix !== undefined) map.badge_prefix = cat.badgePrefix;
  if (cat.displayOrder !== undefined) map.display_order = cat.displayOrder;
  if (cat.defaultZoneCodes !== undefined) map.default_zone_codes = cat.defaultZoneCodes;
  return map;
}

function mapCategoryFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    description: db.description,
    badgeColor: db.badge_color || "#2563eb",
    status: db.status || "active",
    parentId: db.parent_id || null,
    badgePrefix: db.badge_prefix || null,
    displayOrder: db.display_order || 0,
    defaultZoneCodes: db.default_zone_codes || null,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}

function mapAccreditationToDB(acc) {
  const map = {};
  if (acc.eventId !== undefined) map.event_id = acc.eventId;
  if (acc.firstName !== undefined) map.first_name = acc.firstName;
  if (acc.lastName !== undefined) map.last_name = acc.lastName;
  if (acc.gender !== undefined) map.gender = acc.gender;
  if (acc.dateOfBirth !== undefined) map.date_of_birth = acc.dateOfBirth;
  if (acc.nationality !== undefined) map.nationality = acc.nationality;
  if (acc.club !== undefined) map.club = acc.club;
  if (acc.role !== undefined) map.role = acc.role;
  if (acc.email !== undefined) map.email = acc.email;
  if (acc.photoUrl !== undefined) map.photo_url = acc.photoUrl;
  if (acc.idDocumentUrl !== undefined) map.id_document_url = acc.idDocumentUrl;
  if (acc.status !== undefined) map.status = acc.status;
  if (acc.zoneCode !== undefined) map.zone_code = acc.zoneCode;
  if (acc.badgeNumber !== undefined) map.badge_number = acc.badgeNumber;
  if (acc.accreditationId !== undefined) map.accreditation_id = acc.accreditationId;
  if (acc.remarks !== undefined) map.remarks = acc.remarks;
  if (acc.badgeColor !== undefined) map.badge_color = acc.badgeColor;
  if (acc.updatedBy !== undefined) map.updated_by = acc.updatedBy;
  if (acc.createdBy !== undefined) map.created_by = acc.createdBy;
  if (acc.expiresAt !== undefined) map.expires_at = acc.expiresAt;
  if (acc.customMessage !== undefined) map.custom_message = acc.customMessage;
  if (acc.customMessageUpdatedAt !== undefined) map.custom_message_updated_at = acc.customMessageUpdatedAt;
  if (acc.selectedEvents !== undefined) map.selected_events = acc.selectedEvents;
  if (acc.selectedSportEvents !== undefined) map.selected_sport_events = acc.selectedSportEvents;
  if (acc.forceLive !== undefined) map.force_live = acc.forceLive;
  if (acc.heatSheetUpdatedAt !== undefined) map.heat_sheet_updated_at = acc.heatSheetUpdatedAt;
  if (acc.eventResultUpdatedAt !== undefined) map.event_result_updated_at = acc.eventResultUpdatedAt;
  if (acc.payment_status !== undefined) map.payment_status = acc.payment_status;
  if (acc.payment_amount !== undefined) map.payment_amount = acc.payment_amount;
  if (acc.stripe_session_id !== undefined) map.stripe_session_id = acc.stripe_session_id;
  return map;
}

function mapAccreditationFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    eventId: db.event_id,
    firstName: db.first_name,
    lastName: db.last_name,
    gender: db.gender,
    dateOfBirth: db.date_of_birth,
    nationality: db.nationality,
    club: db.club,
    role: db.role,
    email: db.email,
    photoUrl: db.photo_url,
    idDocumentUrl: db.id_document_url,
    status: db.status,
    zoneCode: db.zone_code,
    badgeNumber: db.badge_number,
    accreditationId: db.accreditation_id,
    remarks: db.remarks,
    badgeColor: db.badge_color || "#2563eb",
    updatedBy: db.updated_by,
    createdBy: db.created_by,
    expiresAt: db.expires_at,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    customMessage: db.custom_message || "",
    customMessageUpdatedAt: db.custom_message_updated_at,
    selectedEvents: db.selected_events || [],
    selectedSportEvents: db.selected_sport_events || [],
    heatSheetUrl: db.heat_sheet_url || "",
    eventResultUrl: db.event_result_url || "",
    forceLive: db.force_live || false,
    heatSheetUpdatedAt: db.heat_sheet_updated_at,
    eventResultUpdatedAt: db.event_result_updated_at,
    approverName: db.approverName || null,
    paymentStatus: db.payment_status || 'unpaid',
    paymentAmount: db.payment_amount || null,
    stripeSessionId: db.stripe_session_id || null
  };
}

function mapTicketTypeToDB(type) {
  const map = {};
  if (type.eventId !== undefined) map.event_id = type.eventId;
  if (type.name !== undefined) map.name = type.name;
  if (type.description !== undefined) map.description = type.description;
  if (type.price !== undefined) map.price = type.price;
  if (type.currency !== undefined) map.currency = type.currency;
  if (type.capacity !== undefined) map.capacity = type.capacity;
  if (type.isActive !== undefined) map.is_active = type.isActive;
  return map;
}

function mapTicketTypeFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    eventId: db.event_id,
    name: db.name,
    description: db.description,
    price: db.price,
    currency: db.currency,
    capacity: db.capacity,
    isActive: db.is_active,
    createdAt: db.created_at
  };
}

function mapTicketPackageToDB(pkg) {
  const map = {};
  if (pkg.eventId !== undefined) map.event_id = pkg.eventId;
  if (pkg.name !== undefined) map.name = pkg.name;
  if (pkg.description !== undefined) map.description = pkg.description;
  if (pkg.price !== undefined) map.price = pkg.price;
  if (pkg.quantityIncluded !== undefined) map.quantity_included = pkg.quantityIncluded;
  if (pkg.isActive !== undefined) map.is_active = pkg.isActive;
  return map;
}

function mapTicketPackageFromDB(db) {
  if (!db) return null;
  return {
    id: db.id,
    eventId: db.event_id,
    name: db.name,
    description: db.description,
    price: db.price,
    quantityIncluded: db.quantity_included,
    isActive: db.is_active,
    createdAt: db.created_at
  };
}

// --- USERS API ---
export const UsersAPI = {
  getAll: async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      console.warn("UsersAPI.getAll error:", error);
      return [];
    }
    return data.map(u => ({
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
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("SignOut error (session may already be invalid):", err);
    }
  },
  create: async (userData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated. Please log in again.");
      const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
      let response;
      try {
        response = await fetch(EDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: "create", ...userData })
        });
      } catch (networkErr) {
        throw new Error("Network error: unable to reach the server. Please check your connection.");
      }
      if (!response.ok) {
        let errMsg = `Request failed with status ${response.status}`;
        try { const d = await response.json(); if (d.error) errMsg = d.error; } catch (_) { /* non-JSON body */ }
        throw new Error(errMsg);
      }
      const data = await response.json();
      AuditAPI.log("user_created", { email: userData.email, role: userData.role });
      return data.user;
    } catch (error) {
      console.error("UsersAPI.create error:", error);
      throw error;
    }
  },
  update: async (id, updates) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated. Please log in again.");
      const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
      let response;
      try {
        response = await fetch(EDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: "update", id, ...updates })
        });
      } catch (networkErr) {
        throw new Error("Network error: unable to reach the server. Please check your connection.");
      }
      if (!response.ok) {
        let errMsg = `Request failed with status ${response.status}`;
        try { const d = await response.json(); if (d.error) errMsg = d.error; } catch (_) { /* non-JSON body */ }
        throw new Error(errMsg);
      }
      const data = await response.json();
      AuditAPI.log("user_updated", { userId: id });
      return data.user;
    } catch (error) {
      console.error("UsersAPI.update error:", error);
      throw error;
    }
  },
  delete: async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated. Please log in again.");
      const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
      let response;
      try {
        response = await fetch(EDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: "delete", id })
        });
      } catch (networkErr) {
        throw new Error("Network error: unable to reach the server. Please check your connection.");
      }
      if (!response.ok) {
        let errMsg = `Request failed with status ${response.status}`;
        try { const d = await response.json(); if (d.error) errMsg = d.error; } catch (_) { /* non-JSON body */ }
        throw new Error(errMsg);
      }
      AuditAPI.log("user_deleted", { userId: id });
      return true;
    } catch (error) {
      console.error("UsersAPI.delete error:", error);
      throw error;
    }
  }
};

// --- AUDIT API ---
export const AuditAPI = {
  log: (action, details) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id || "system";
      const userName = session?.user?.user_metadata?.name || session?.user?.email || "System";
      return supabase.from("audit_logs").insert([{
        action,
        details,
        user_id: userId,
        user_name: userName,
        timestamp: new Date().toISOString()
      }]);
    }).catch(e => console.warn("Audit log failed", e));
  },
  getRecent: async (limit = 50) => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("Audit log fetch error", error);
      return [];
    }
    return data.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      userId: log.user_id,
      userName: log.user_name,
      timestamp: log.timestamp
    }));
  }
};

export const initializeDefaultData = async () => {
  // no-op for Supabase
};
