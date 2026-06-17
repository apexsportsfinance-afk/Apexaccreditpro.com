import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";

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
  getMatchesWithTeams: async (eventId, sportId) => {
    const data = await handleResponse(() => supabase.rpc("get_live_scores_matches", { p_event_id: eventId, p_sport_id: sportId || null }));
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
  renameLeague: async (eventId, sportId, oldName, newName) => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .update({ league_name: newName.trim() || null, updated_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .eq("league_name", oldName)
        .select()
    );
  },
  deleteLeague: async (eventId, sportId, leagueName) => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .delete()
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .eq("league_name", leagueName)
        .select()
    );
  },
  deleteMatchesBySportNoLeague: async (eventId, sportId) => {
    // Deletes matches with no league_name (null or empty string)
    const { data: nullRows } = await supabase.from("live_score_matches")
      .delete().eq("event_id", eventId).eq("sport_id", sportId).is("league_name", null).select();
    const { data: emptyRows } = await supabase.from("live_score_matches")
      .delete().eq("event_id", eventId).eq("sport_id", sportId).eq("league_name", "").select();
    return [...(nullRows || []), ...(emptyRows || [])];
  },
  deleteAllMatchesBySport: async (eventId, sportId) => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .delete()
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .select()
    );
  },
  getStandings: async (eventId, sportId, divisionId) => {
    const data = await handleResponse(() => supabase.rpc("get_team_standings", { p_event_id: eventId, p_sport_id: sportId || null, p_division_id: divisionId || null }));
    return data || [];
  },
  getPointsConfig: async (eventId, sportId) => {
    const data = await handleResponse(() => supabase.from("sport_points_config").select("*").eq("event_id", eventId).eq("sport_id", sportId).maybeSingle());
    return data || null;
  },
  savePointsConfig: async (config) => {
    return handleResponse(() => supabase.from("sport_points_config").upsert(config, { onConflict: "event_id,sport_id" }).select().single());
  },
  getTeamSportDivisions: async (teamIds, sportName) => {
    if (!teamIds || teamIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("team_sports").select("team_id, sport_name, division_id").eq("sport_name", sportName).in("team_id", teamIds));
    return data || [];
  },
  setTeamSportDivision: async (teamId, sportName, divisionId) => {
    return handleResponse(() => supabase.from("team_sports").update({ division_id: divisionId || null }).eq("team_id", teamId).eq("sport_name", sportName).select());
  },
  getTeamIdsForSport: async (teamIds, sportName, gender) => {
    if (!teamIds || teamIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("team_sports").select("team_id, gender").eq("sport_name", sportName).in("team_id", teamIds));
    let rows = data || [];
    if (gender) rows = rows.filter(row => !row.gender || row.gender === gender);
    return rows.map(row => row.team_id);
  },
  bulkCreateMatches: async (rows) => {
    if (!rows || rows.length === 0) return [];
    const now = new Date().toISOString();
    const payload = rows.map(r => ({ ...r, created_at: now, updated_at: now }));
    const data = await handleResponse(() => supabase.from("live_score_matches").insert(payload).select());
    return data || [];
  }
};

export const DivisionsAPI = {
  getBySport: async (sportId) => {
    const data = await handleResponse(() => supabase.from("competition_divisions").select("*").eq("sport_id", sportId).order("display_order", { ascending: true }).order("name", { ascending: true }));
    return data || [];
  },
  save: async (division) => {
    if (division.id) {
      return handleResponse(() => supabase.from("competition_divisions").update(division).eq("id", division.id).select().single());
    } else {
      return handleResponse(() => supabase.from("competition_divisions").insert([division]).select().single());
    }
  },
  delete: async (id) => {
    return handleResponse(() => supabase.from("competition_divisions").delete().eq("id", id).select());
  }
};

export const MatchEventsAPI = {
  getByMatch: async (matchId) => {
    const data = await handleResponse(() => supabase.from("match_events").select("*").eq("match_id", matchId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByEvent: async (eventId) => {
    const data = await handleResponse(() => supabase.from("match_events").select("*").eq("event_id", eventId).order("created_at", { ascending: true }));
    return data || [];
  },
  save: async (evt) => {
    const dbEvt = { ...evt };
    if (!dbEvt.id) { delete dbEvt.id; dbEvt.created_at = new Date().toISOString(); }
    else { dbEvt.updated_at = new Date().toISOString(); }
    if (evt.id) {
      return handleResponse(() => supabase.from("match_events").update(dbEvt).eq("id", evt.id).select().single());
    } else {
      return handleResponse(() => supabase.from("match_events").insert([dbEvt]).select().single());
    }
  },
  delete: async (id) => {
    return handleResponse(() => supabase.from("match_events").delete().eq("id", id).select());
  }
};

export const DisciplinaryAPI = {
  getByMatch: async (matchId) => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("match_id", matchId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByEvent: async (eventId) => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("event_id", eventId).order("match_date", { ascending: false }));
    return data || [];
  },
  getByPlayer: async (accreditationId) => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("player_accreditation_id", accreditationId).order("match_date", { ascending: false }));
    return data || [];
  },
  save: async (record) => {
    const dbRecord = { ...record };
    if (!dbRecord.id) { delete dbRecord.id; dbRecord.created_at = new Date().toISOString(); }
    else { dbRecord.updated_at = new Date().toISOString(); }
    if (record.id) {
      return handleResponse(() => supabase.from("player_disciplinary_records").update(dbRecord).eq("id", record.id).select().single());
    } else {
      return handleResponse(() => supabase.from("player_disciplinary_records").insert([dbRecord]).select().single());
    }
  },
  delete: async (id) => {
    return handleResponse(() => supabase.from("player_disciplinary_records").delete().eq("id", id).select());
  }
};

export const PartnersAPI = {
  getPartners: async () => {
    return handleResponse(() => supabase.from("partners").select("*").order("created_at", { ascending: false }));
  },
  createPartner: async (partnerData) => {
    const { data, error } = await supabase.from("partners").insert(partnerData).select().single();
    if (error) throw error;
    return data;
  },
  updatePartner: async (id, partnerData) => {
    const { data, error } = await supabase.from("partners").update(partnerData).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  deletePartner: async (id) => {
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  getKeys: async (partnerId) => {
    return handleResponse(() => supabase.from("partner_api_keys").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }));
  },
  generateKey: async (partnerId, label, permissions = [], allowedFields = []) => {
    const apiKey = `apex_live_${crypto.randomUUID().replace(/-/g, "")}`;
    const { data, error } = await supabase.from("partner_api_keys").insert({
      partner_id: partnerId, label, api_key: apiKey,
      permissions: permissions.length > 0 ? permissions : ["read_basic"],
      allowed_fields: allowedFields.length > 0 ? allowedFields : ["firstName", "lastName", "role", "badgeNumber"]
    }).select().single();
    if (error) throw error;
    return data;
  },
  revokeKey: async (id) => {
    const { error } = await supabase.from("partner_api_keys").update({ status: 'revoked' }).eq("id", id);
    if (error) throw error;
    return true;
  }
};

export const initializeDefaultData = async () => {};
