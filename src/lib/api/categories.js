import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";

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
      await handleResponse(() => supabase.from("event_categories").insert(rows));
    }
    AuditAPI.log("event_categories_updated", { eventId, count: categoryIds.length });
  }
};
