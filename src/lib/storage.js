import { supabase } from "./supabase";
import { OfflineDB } from "./offlineDb";
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
  getAllMinimal: async () => {
    const data = await handleResponse(
      () => supabase.from("events").select("id, name, slug, description, start_date, end_date, location, registration_open, required_documents").order("created_at", { ascending: false })
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
    // 1. Delete dependent operational data first to prevent orphans
    await handleResponse(() => supabase.from("unified_scan_logs").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_attendance").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_sessions").delete().eq("event_id", id));
    
    // 2. Delete core configuration data
    await handleResponse(() => supabase.from("accreditations").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("zones").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_categories").delete().eq("event_id", id));
    
    // 3. Finally delete the event itself
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
  updateWithCascade: async (id, updates, oldCode) => {
    // 1. Update the zone itself
    const updatedZone = await ZonesAPI.update(id, updates);
    const newCode = updates.code;

    // 2. If code hasn't changed, we're done
    if (!oldCode || oldCode === newCode) return updatedZone;

    const eventId = updatedZone.eventId;

    // 3. Cascade to Accreditations
    const { data: accs } = await supabase
      .from("accreditations")
      .select("id, zone_code")
      .eq("event_id", eventId)
      .or(`zone_code.ilike.%${oldCode}%`);

    if (accs && accs.length > 0) {
      const accUpdates = accs.map(acc => {
        const codes = acc.zone_code?.split(',').map(c => c.trim()).filter(Boolean) || [];
        if (codes.includes(oldCode)) {
          const newCodes = codes.map(c => c === oldCode ? newCode : c);
          return { id: acc.id, zone_code: newCodes.join(', ') };
        }
        return null;
      }).filter(Boolean);

      // Perform updates sequentially or in small batches to avoid timeouts
      for (const update of accUpdates) {
        await supabase.from("accreditations").update({ zone_code: update.zone_code }).eq("id", update.id);
      }
    }

    // 4. Cascade to Categories (Default Zone Codes)
    const { data: cats } = await supabase
      .from("categories")
      .select("id, default_zone_codes")
      .or(`default_zone_codes.ilike.%${oldCode}%`);

    if (cats && cats.length > 0) {
      const catUpdates = cats.map(cat => {
        const codes = cat.default_zone_codes?.split(',').map(c => c.trim()).filter(Boolean) || [];
        if (codes.includes(oldCode)) {
          const newCodes = codes.map(c => c === oldCode ? newCode : c);
          return { id: cat.id, default_zone_codes: newCodes.join(', ') };
        }
        return null;
      }).filter(Boolean);

      for (const update of catUpdates) {
        await supabase.from("categories").update({ default_zone_codes: update.default_zone_codes }).eq("id", update.id);
      }
    }

    AuditAPI.log("zone_code_cascaded", { zoneId: id, oldCode, newCode });
    return updatedZone;
  },
  delete: async (id) => {
    // 1. Get the zone first to know its code
    const zone = await ZonesAPI.getById?.(id) || await handleResponse(() => supabase.from("zones").select("*").eq("id", id).maybeSingle());
    if (!zone) return;

    const { code, event_id } = zone;

    // 2. Cascade to Accreditations: Remove this code from the comma-separated list
    const { data: accs } = await supabase
      .from("accreditations")
      .select("id, zone_code")
      .eq("event_id", event_id)
      .or(`zone_code.ilike.%${code}%`);

    if (accs && accs.length > 0) {
      const updates = accs.map(acc => {
        const codes = acc.zone_code?.split(',').map(c => c.trim()).filter(Boolean) || [];
        if (codes.includes(code)) {
          const newCodes = codes.filter(c => c !== code);
          return { id: acc.id, zone_code: newCodes.join(', ') };
        }
        return null;
      }).filter(Boolean);

      for (const update of updates) {
        await supabase.from("accreditations").update({ zone_code: update.zone_code }).eq("id", update.id);
      }
    }

    // 3. Delete the zone
    await handleResponse(() => supabase.from("zones").delete().eq("id", id));
    AuditAPI.log("zone_deleted", { zoneId: id, code });
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
    try {
      const category = await CategoriesAPI.getById(id);
      if (!category) return false;

      const { count, error } = await supabase
        .from("accreditations")
        .select("id", { count: "exact", head: true })
        .in("role", [id, category.name]);
        
      if (error) throw error;
      return (count || 0) > 0;
    } catch (err) {
      console.error("isInUse check failed:", err);
      return true;
    }
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
  "badge_color", "payment_status", "payment_amount", "stripe_session_id",
  "expires_at", "custom_message", "selected_sports", "created_at"
].join(",");

export const AccreditationsAPI = {
  getStats: async (eventIds = null) => {
    if (eventIds !== null && Array.isArray(eventIds) && eventIds.length === 0) {
      return { total: 0, pending: 0, approved: 0, rejected: 0 };
    }

    // APX-PERF: Using head:true queries is the fastest way to get exact counts in Supabase
    // as it bypasses data transfer entirely.
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
    eventIds.forEach(id => {
      counts[id] = { total: 0, pending: 0, approved: 0, rejected: 0 };
    });

    try {
      // APX-PERF: Fix for browser HTTP connection exhaustion.
      // Instead of 4 queries per event (120+ queries), we bulk-fetch lightweight columns 
      // (status, event_id) and aggregate in Javascript. Bypasses 1000-row PostgREST limits via pagination.
      let start = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('accreditations')
          .select('status, event_id')
          .in('event_id', eventIds)
          .range(start, start + 999);
          
        if (error) {
          console.error("Aggregation chunk error:", error);
          break;
        }
        
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
        
        if (!data || data.length < 1000) {
          hasMore = false;
        } else {
          start += 1000;
        }
      }
    } catch (err) {
      console.error("Failed to aggregate counts:", err);
    }
    
    return counts;
  },

  getRecent: async (limit = 5, eventIds = null) => {
    if (eventIds !== null && Array.isArray(eventIds) && eventIds.length === 0) {
      return [];
    }

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
          
        if (eventId && eventId !== "null") {
          q = q.eq("event_id", eventId);
        }
        
        if (status) q = q.eq("status", status);
        if (club) q = q.ilike("club", club.trim());

        const { data, error } = await q;

        if (error) {
          console.error(`Error fetching accreditations for event ${eventId}:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          start += PAGE_SIZE;
        }

        if (!data || data.length < PAGE_SIZE) {
          hasMore = false;
        }
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
          
        if (eventId && eventId !== "null") {
          q = q.eq("event_id", eventId);
        }
        
        const { data, error } = await q;

        if (error) {
          console.error(`Error fetching dashboard distribution for event ${eventId}:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          start += PAGE_SIZE;
        }

        if (!data || data.length < PAGE_SIZE) {
          hasMore = false;
        }
      }
      return allData;
    } catch (err) {
      console.error("[AccreditationsAPI] getDashboardDistribution Error:", err);
      return [];
    }
  },

  getPaginatedByEventId: async (eventId, options = {}) => {
    const { 
      status = null, 
      role = null, 
      nationality = null, 
      club = null,
      searchTerm = "",
      limit = 50, 
      offset = 0 
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
    
    if (error) {
      console.error(`Failed to fetch paginated accreditations for event ${eventId}:`, error);
      throw error;
    }
    
    return {
      data: (data || []).map(mapAccreditationFromDB),
      count: count || 0
    };
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
    // 1. Offline Mode Check
    if (!navigator.onLine) {
      try {
        console.log("[Offline Mode] Searching local cache for:", token);
        const cachedData = await OfflineDB.getAccreditation(token);
        if (cachedData) {
          return mapAccreditationFromDB(cachedData);
        }
        console.warn("[Offline Mode] Token not found in local cache.");
        return null;
      } catch (err) {
        console.error("[Offline Mode] Error searching local cache:", err);
        return null;
      }
    }

    // 2. Online Mode (Supabase)
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
    const data = await handleResponse(
      () => {
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
      }
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
    const { getBadgePrefix } = await import("./utils");
    const { data: accRows } = await handleResponse(
      () => supabase.from("accreditations").select("id, role, event_id").in("id", ids)
    );
    
    if (!accRows || accRows.length === 0) return;

    const accMap = {};
    (accRows || []).forEach(r => {
      accMap[r.id] = { role: r.role || "Unknown", eventId: r.event_id };
    });

    const sampleEventId = accRows[0].event_id;
    const uniqueRoles = [...new Set((accRows || []).map(r => r.role || "Unknown"))];
    const roleCountCache = {};

    // 1. Fetch existing badge counts for all unique roles in parallel
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
            const numPart = parts[parts.length - 1];
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
      }
      roleCountCache[role] = maxNum;
    }));
    
    // 2. Pre-calculate badge numbers in memory
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

    // 3. Execute updates in parallel chunks of 10 to prevent rate-limiting/timeouts
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
      try {
        const data = await handleResponse(() => 
          supabase.rpc('redeem_ticket_transaction', {
            p_ticket_id: ticketId,
            p_order_id: orderId,
            p_today_date: today
          })
        );
        return data;
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes("ALREADY_SCANNED")) {
          throw new Error("ALREADY_SCANNED");
        }
        throw new Error(msg);
      }
    }

    const newScannedTotal = (order.scanned_count || 0) + Number(count);
    if (newScannedTotal > order.ticket_count) throw new Error("Limit exceeded");

    await handleResponse(() => supabase.from("spectator_orders").update({ scanned_count: newScannedTotal, last_scan_at: new Date().toISOString() }).eq("id", orderId));
    return { ...order, scanned_count: newScannedTotal };
  },
  
  recordGenericEntry: async (eventId, guestName, deviceLabel) => {
    // Record generic pass scans in the audit log since they don't have a specific order ID
    AuditAPI.log("generic_pass_scan", { 
      eventId, 
      guestName, 
      deviceLabel: deviceLabel || "Generic Gate",
      timestamp: new Date().toISOString()
    });
    return true;
  }
};

// --- USERS API ---
export const UsersAPI = {
  getAll: async () => {
    // APX-Recovery: Try Edge Function first to reach accounts missing from 'profiles', but with a strict timeout
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const EDGE_URL = "https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users";
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        try {
          const response = await fetch(EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: "list" }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data.users) return data.users.map(u => ({
              id: u.id,
              email: u.email,
              name: u.full_name || u.email,
              role: u.role || "viewer",
              createdAt: u.created_at,
              type: "Admin Staff",
              isAuthUser: true
            }));
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      }
    } catch (err) {
      console.warn("Edge list failed or timed out, falling back to profiles:", err);
    }

    const data = await handleResponse(() => supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    return (data || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.full_name || u.email,
      role: u.role || "viewer",
      avatar: u.avatar_url,
      createdAt: u.created_at,
      type: "Admin Staff"
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
      role: data.user.user_metadata?.role || "viewer" // APX-SEC: Safe fallback — real role loaded from profiles table by upgradeProfileRole()
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
  },
  getModuleAccessMappings: async () => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", "user_module_access").maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
  },
  updateModuleAccessMapping: async (userId, modules) => {
    const existing = await UsersAPI.getModuleAccessMappings();
    if (modules?.length) existing[userId] = modules; else delete existing[userId];
    await handleResponse(() => supabase.from("global_settings").upsert({ key: "user_module_access", value: JSON.stringify(existing) }, { onConflict: 'key' }));
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

// --- MAIN SCANNER API ---
export const MainScannerAPI = {
  getConfig: async (eventId) => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", `main_scanner_config_${eventId}`).maybeSingle());
    try { 
      return data?.value ? JSON.parse(data.value) : null; 
    } catch { 
      return null; 
    }
  },
  saveConfig: async (eventId, config) => {
    await handleResponse(() => supabase.from("global_settings").upsert({ 
      key: `main_scanner_config_${eventId}`, 
      value: JSON.stringify(config) 
    }, { onConflict: 'key' }));
    return config;
  }
};

// --- CONFIG API ---
export const ConfigAPI = {
  getFeedback: async (eventId) => {
    const data = await handleResponse(() => supabase.from("feedback_configs").select("*").eq("event_id", eventId).maybeSingle());
    return data;
  },
  saveFeedback: async (config) => {
    const existing = await handleResponse(() => supabase.from("feedback_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("feedback_configs").update({ ...config, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("feedback_configs").insert([{ ...config, created_at: new Date().toISOString() }]).select().single());
    }
  }
};

// --- BOOKINGS API ---
export const BookingsAPI = {
  getConfig: async (eventId) => {
    const data = await handleResponse(() => supabase.from("booking_configs").select("*").eq("event_id", eventId).maybeSingle());
    return data;
  },
  saveConfig: async (config) => {
    const existing = await handleResponse(() => supabase.from("booking_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    const payload = { ...config, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;
    delete payload.hidden_dates; // <--- FIX: Column does not exist in DB schema, causes Save to fail

    if (existing) {
      return handleResponse(() => supabase.from("booking_configs").update(payload).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("booking_configs").insert([{ ...payload, created_at: new Date().toISOString() }]).select().single());
    }
  },
  getBookings: async (eventId) => {
    const data = await handleResponse(() => supabase
      .from("bookings")
      .select(`
        *,
        accreditations (id, accreditation_id, first_name, last_name, club, role, badge_number)
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
    );
    return data || [];
  },
  // [APX-SEC] Anonymous participants no longer have direct table access to
  // `bookings` (see supabase/migrations/20260612_rls_hardening.sql). These
  // SECURITY DEFINER RPCs verify the accreditation belongs to the event
  // before reading/writing on the participant's behalf.
  getParticipantBooking: async (eventId, accreditationId) => {
    const data = await handleResponse(() => supabase.rpc("get_my_booking", {
      p_event_id: eventId,
      p_accreditation_id: accreditationId
    }));
    return data || [];
  },
  bookSlot: async (eventId, accreditationId, slotId, groupName = "General Meeting") => {
    return handleResponse(() => supabase.rpc("upsert_my_booking", {
      p_event_id: eventId,
      p_accreditation_id: accreditationId,
      p_slot_id: slotId,
      p_group_name: groupName
    }));
  },
  cancelBooking: async (eventId, accreditationId, slotId) => {
    return handleResponse(() => supabase.rpc("delete_my_booking", {
      p_event_id: eventId,
      p_accreditation_id: accreditationId,
      p_slot_id: slotId
    }));
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
  getRecent: async (limit = 100, offset = 0) => {
    const data = await handleResponse(
      () => supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1)
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
    name: 'name', slug: 'slug',
    startDate: 'start_date', endDate: 'end_date', location: 'location',
    ageCalculationYear: 'age_calculation_year', registrationOpen: 'registration_open',
    reportingTimes: 'reporting_times', headerArabic: 'header_arabic',
    headerSubtitle: 'header_subtitle', logoUrl: 'logo_url',
    backTemplateUrl: 'back_template_url', sponsorLogos: 'sponsor_logos',
    requiredDocuments: 'required_documents', timezone: 'timezone',
    termsAndConditions: 'terms_and_conditions',
    sportList: 'sport_list',
    registrationClosedMessage: 'athlete_qr_broadcast_message'
  };
  Object.keys(fields).forEach(key => { if (event[key] !== undefined) map[fields[key]] = event[key]; });

  // Embed outputType inside description since we cannot run a database migration
  if (event.description !== undefined || event.outputType !== undefined) {
    const baseDesc = event.description || "";
    const ot = event.outputType || "Accreditation Pass";
    map.description = `${baseDesc}|||OT:${ot}`;
  }

  return map;
}

function mapEventFromDB(db) {
  if (!db) return null;

  // Extract outputType from description payload
  let desc = db.description || "";
  let ot = "Accreditation Pass";
  if (desc.includes("|||OT:")) {
    const parts = desc.split("|||OT:");
    desc = parts[0];
    ot = parts[1];
  }

  return {
    id: db.id, name: db.name, slug: db.slug, description: desc,
    startDate: db.start_date, endDate: db.end_date, location: db.location,
    ageCalculationYear: db.age_calculation_year, registrationOpen: db.registration_open,
    reportingTimes: db.reporting_times, headerArabic: db.header_arabic,
    headerSubtitle: db.header_subtitle, logoUrl: db.logo_url,
    backTemplateUrl: db.back_template_url, sponsorLogos: db.sponsor_logos || [],
    requiredDocuments: db.required_documents || ["picture", "passport"],
    termsAndConditions: db.terms_and_conditions || "",
    timezone: db.timezone || "UTC",
    sportList: db.sport_list || [],
    registrationClosedMessage: db.athlete_qr_broadcast_message || "",
    outputType: ot
  };
}

function mapZoneToDB(z) {
  // Backward compatibility: Embed settings into the description to avoid SQL schema cache errors 
  // if the 'settings' column hasn't been added to the Supabase database yet.
  const settingsString = z.settings && Object.keys(z.settings).length > 0 
    ? ` | [SETTINGS]:${JSON.stringify(z.settings)}` 
    : "";
    
  return { 
    event_id: z.eventId, 
    code: z.code, 
    name: z.name, 
    color: z.color, 
    description: (z.description || "") + settingsString, 
    allowed_roles: z.allowedRoles 
  };
}

function mapZoneFromDB(db) {
  // Backward compatibility: If the DB migration hasn't run yet, extract settings from description
  let description = db.description || "";
  let settings = db.settings || {};
  
  if (description.includes(" | [SETTINGS]:")) {
    const parts = description.split(" | [SETTINGS]:");
    description = parts[0];
    try {
      // Only merge if db.settings is empty
      if (Object.keys(settings).length === 0) {
        settings = JSON.parse(parts[1]);
      }
    } catch (e) {
      console.warn("Failed to parse legacy zone settings metadata", e);
    }
  }

  return { 
    id: db.id, 
    eventId: db.event_id, 
    code: db.code, 
    name: db.name, 
    color: db.color, 
    description, 
    settings,
    allowedRoles: db.allowed_roles || [] 
  };
}

function mapCategoryToDB(cat) {
  return { 
    name: cat.name, 
    slug: cat.slug, 
    description: cat.description, 
    badge_color: cat.badgeColor, 
    status: cat.status, 
    parent_id: cat.parentId, 
    badge_prefix: cat.badgePrefix, 
    display_order: cat.displayOrder, 
    default_zone_codes: cat.defaultZoneCodes,
    text_color: cat.textColor,
    font_size: cat.fontSize,
    font_weight: cat.fontWeight
  };
}

function mapCategoryFromDB(db) {
  return { 
    id: db.id, 
    name: db.name, 
    slug: db.slug, 
    description: db.description, 
    badgeColor: db.badge_color || "#2563eb", 
    status: db.status || "active", 
    parentId: db.parent_id, 
    badgePrefix: db.badge_prefix, 
    displayOrder: db.display_order || 0, 
    defaultZoneCodes: db.default_zone_codes,
    textColor: db.text_color || "#000000",
    fontSize: db.font_size || "14px",
    fontWeight: db.font_weight || "bold"
  };
}

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
  
  // Custom message/meta docs
  let meta = acc.customMessage ? (typeof acc.customMessage === 'string' ? JSON.parse(acc.customMessage) : { ...acc.customMessage }) : {};
  if (acc.eidUrl) meta.eidUrl = acc.eidUrl;
  if (acc.medicalUrl) meta.medicalUrl = acc.medicalUrl;
  if (acc.phone) meta.phone = acc.phone; // Fix: Ensure phone is saved to JSONB
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
    createdAt: db.created_at // Fix: Map created_at for Export
  };
  
  try {
    const meta = (db.custom_message && db.custom_message.startsWith('{')) ? JSON.parse(db.custom_message) : {};
    acc.eidUrl = meta.eidUrl || null;
    acc.medicalUrl = meta.medicalUrl || null;
    acc.phone = meta.phone || null; // Fix: Extract phone from JSONB
    acc.customFields = meta;
    
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

// --- LIVE SCORES API ---
export const LiveScoresAPI = {
  getSettings: async (eventId) => {
    const data = await handleResponse(() => supabase.from("live_score_settings").select("*").eq("event_id", eventId).maybeSingle());
    return data || { event_id: eventId, live_scores_enabled: false };
  },
  saveSettings: async (settings) => {
    const existing = await handleResponse(() => supabase.from("live_score_settings").select("event_id").eq("event_id", settings.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("live_score_settings").update({ ...settings, updated_at: new Date().toISOString() }).eq("event_id", settings.event_id).select().single());
    } else {
      return handleResponse(() => supabase.from("live_score_settings").insert([{ ...settings, created_at: new Date().toISOString() }]).select().single());
    }
  },
  getSports: async (eventId) => {
    const data = await handleResponse(() => supabase.from("live_score_sports").select("*").eq("event_id", eventId).order("display_order", { ascending: true }));
    return data || [];
  },
  saveSport: async (sport) => {
    if (sport.id) {
      return handleResponse(() => supabase.from("live_score_sports").update(sport).eq("id", sport.id).select().single());
    } else {
      return handleResponse(() => supabase.from("live_score_sports").insert([sport]).select().single());
    }
  },
  deleteSport: async (id) => {
    return handleResponse(() => supabase.from("live_score_sports").delete().eq("id", id).select());
  },
  getMatches: async (eventId) => {
    const data = await handleResponse(() => supabase.from("live_score_matches").select("*").eq("event_id", eventId).order("match_date", { ascending: true }).order("match_time", { ascending: true }));
    return data || [];
  },
  saveMatch: async (match) => {
    const dbMatch = { ...match };
    if (!dbMatch.id) {
      delete dbMatch.id;
      dbMatch.created_at = new Date().toISOString();
    } else {
      dbMatch.updated_at = new Date().toISOString();
    }
    if (match.id) {
      return handleResponse(() => supabase.from("live_score_matches").update(dbMatch).eq("id", match.id).select().single());
    } else {
      return handleResponse(() => supabase.from("live_score_matches").insert([dbMatch]).select().single());
    }
  },
  deleteMatch: async (id) => {
    return handleResponse(() => supabase.from("live_score_matches").delete().eq("id", id).select());
  },
  getStandings: async (eventId, sportId) => {
    const data = await handleResponse(() => supabase.rpc("get_team_standings", { p_event_id: eventId, p_sport_id: sportId || null }));
    return data || [];
  }
};

export const initializeDefaultData = async () => {};
// --- PARTNERS & API KEYS API ---
export const PartnersAPI = {
  getPartners: async () => {
    return await handleResponse(
      () => supabase.from("partners").select("*").order("created_at", { ascending: false })
    );
  },

  createPartner: async (partnerData) => {
    const { data, error } = await supabase
      .from("partners")
      .insert(partnerData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updatePartner: async (id, partnerData) => {
    const { data, error } = await supabase
      .from("partners")
      .update(partnerData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deletePartner: async (id) => {
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  getKeys: async (partnerId) => {
    return await handleResponse(
      () => supabase
        .from("partner_api_keys")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
    );
  },

  generateKey: async (partnerId, label, permissions = [], allowedFields = []) => {
    const apiKey = `apex_live_${crypto.randomUUID().replace(/-/g, "")}`;
    const { data, error } = await supabase
      .from("partner_api_keys")
      .insert({
        partner_id: partnerId,
        label,
        api_key: apiKey,
        permissions: permissions.length > 0 ? permissions : ["read_basic"],
        allowed_fields: allowedFields.length > 0 ? allowedFields : ["firstName", "lastName", "role", "badgeNumber"]
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  revokeKey: async (id) => {
    const { error } = await supabase
      .from("partner_api_keys")
      .update({ status: 'revoked' })
      .eq("id", id);
    if (error) throw error;
    return true;
  }
};
