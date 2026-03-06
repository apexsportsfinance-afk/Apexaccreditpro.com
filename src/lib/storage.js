import { supabase } from "./supabase";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const handleResponse = async (promiseFactory, retries = MAX_RETRIES) => {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const promise = typeof promiseFactory === "function" ? promiseFactory() : promiseFactory;
      const { data, error } = await promise;

      if (error) {
        console.error(`Supabase Error (attempt ${attempt}/${retries}):`, error);
        lastError = error;

        if (error.code === "PGRST116" ||
            error.code === "23505" ||
            error.code === "42501" ||
            error.message?.includes("JWT")) {
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

      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        console.warn(`Network error (attempt ${attempt}/${retries}):`, err.message);
        if (attempt < retries) {
          await sleep(RETRY_DELAY * attempt);
          continue;
        }
      }

      throw err;
    }
  }

  throw lastError || new Error("Max retries exceeded");
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
    const data = await handleResponse(
      supabase.from("events").select("*").eq("slug", slug).single()
    ).catch(() => null);
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
const ACCREDITATION_LIST_COLUMNS = "id,event_id,first_name,last_name,gender,date_of_birth,nationality,club,role,email,photo_url,status,zone_code,badge_number,accreditation_id,remarks,badge_color,updated_by,expires_at,created_at,updated_at";

export const AccreditationsAPI = {
  getStats: async () => {
    // Use count queries instead of fetching all rows — much faster
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
    const { data, error } = await supabase
      .from("accreditations")
      .select("event_id, status")
      .in("event_id", eventIds);
    if (error) {
      console.error("getCountsByEventIds error:", error);
      return {};
    }
    const counts = {};
    (data || []).forEach(row => {
      if (!counts[row.event_id]) {
        counts[row.event_id] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      counts[row.event_id].total++;
      if (row.status === "pending") counts[row.event_id].pending++;
      else if (row.status === "approved") counts[row.event_id].approved++;
      else if (row.status === "rejected") counts[row.event_id].rejected++;
    });
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

  getByEventId: async (eventId, options = {}) => {
    const { limit = 5000, offset = 0, status = null } = options;

    const queryFactory = () => {
      let query = supabase
        .from("accreditations")
        .select(ACCREDITATION_LIST_COLUMNS)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      return query.range(offset, offset + limit - 1);
    };

    try {
      const data = await handleResponse(queryFactory);
      return (data || []).map(mapAccreditationFromDB);
    } catch (error) {
      console.error(`Failed to fetch accreditations for event ${eventId}:`, error);

      if (error.code === "42501" || error.message?.includes("row-level security")) {
        throw new Error("Access denied. Please ensure you are logged in with proper permissions.");
      }

      throw new Error(`Failed to load accreditations: ${error.message || "Network error. Please check your connection and try again."}`);
    }
  },

  getById: async (id) => {
    const data = await handleResponse(
      supabase.from("accreditations").select("*").eq("id", id).single()
    ).catch(() => null);
    return data ? mapAccreditationFromDB(data) : null;
  },

  checkDuplicateName: async (eventId, firstName, lastName) => {
    const { data, error } = await supabase
      .from("accreditations")
      .select("id, first_name, last_name, status")
      .eq("event_id", eventId)
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
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

  create: async (accreditation) => {
    const dbAccreditation = mapAccreditationToDB(accreditation);
    dbAccreditation.status = "pending";
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
    if (adminUserId) dbUpdates.updated_by = adminUserId;
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
    const data = await handleResponse(
      supabase.from("accreditations").update(updateData).eq("id", id).select().single()
    );
    AuditAPI.log("accreditation_approved", { accreditationId: id, badgeNumber });
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

  // OPTIMIZED: single batch UPDATE via .in() for small sets, parallel chunks for large sets
  bulkUpdate: async (ids, updates) => {
    if (!ids || ids.length === 0) return;
    const dbUpdates = mapAccreditationToDB(updates);
    delete dbUpdates.id;

    // For large batches: split into chunks of 100 and run in parallel
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
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
  if (acc.expiresAt !== undefined) map.expires_at = acc.expiresAt;
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
    expiresAt: db.expires_at,
    createdAt: db.created_at,
    updatedAt: db.updated_at
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
      const data = await response.json();
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
