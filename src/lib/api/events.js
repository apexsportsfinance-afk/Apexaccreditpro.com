import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";

export function mapEventToDB(event) {
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

  if (event.description !== undefined || event.outputType !== undefined) {
    const baseDesc = event.description || "";
    const ot = event.outputType || "Accreditation Pass";
    map.description = `${baseDesc}|||OT:${ot}`;
  }

  return map;
}

export function mapEventFromDB(db) {
  if (!db) return null;

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
  let description = db.description || "";
  let settings = db.settings || {};

  if (description.includes(" | [SETTINGS]:")) {
    const parts = description.split(" | [SETTINGS]:");
    description = parts[0];
    try {
      if (Object.keys(settings).length === 0) settings = JSON.parse(parts[1]);
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
    await handleResponse(() => supabase.from("unified_scan_logs").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_attendance").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_sessions").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("accreditations").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("zones").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("event_categories").delete().eq("event_id", id));
    await handleResponse(() => supabase.from("events").delete().eq("id", id));
    AuditAPI.log("event_deleted", { eventId: id });
  }
};

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
    const updatedZone = await ZonesAPI.update(id, updates);
    const newCode = updates.code;

    if (!oldCode || oldCode === newCode) return updatedZone;

    const { error } = await supabase.rpc("cascade_zone_code_rename", {
      p_event_id: updatedZone.eventId,
      p_old_code: oldCode,
      p_new_code: newCode,
    });
    if (error) throw error;

    AuditAPI.log("zone_code_cascaded", { zoneId: id, oldCode, newCode });
    return updatedZone;
  },
  delete: async (id) => {
    const zone = await ZonesAPI.getById?.(id) || await handleResponse(() => supabase.from("zones").select("*").eq("id", id).maybeSingle());
    if (!zone) return;

    const { code, event_id } = zone;

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

    await handleResponse(() => supabase.from("zones").delete().eq("id", id));
    AuditAPI.log("zone_deleted", { zoneId: id, code });
  }
};
