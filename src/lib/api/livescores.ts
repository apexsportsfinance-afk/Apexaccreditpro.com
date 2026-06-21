import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import type { DbRow } from "./_types";

// [APX-SEC] SHA-256 hex digest via the Web Crypto API (browser + modern Node).
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface MatchFilters {
  status?: string | null;
  leagueName?: string | null;
  matchDate?: string | null;
}

export const LiveScoresAPI = {
  getSettings: async (eventId: string): Promise<DbRow> => {
    const data = await handleResponse(() => supabase.from("live_score_settings").select("*").eq("event_id", eventId).maybeSingle());
    return data || { event_id: eventId, live_scores_enabled: false };
  },
  saveSettings: async (settings: DbRow): Promise<DbRow> => {
    const existing = await handleResponse(() => supabase.from("live_score_settings").select("event_id").eq("event_id", settings.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("live_score_settings").update({ ...settings, updated_at: new Date().toISOString() }).eq("event_id", settings.event_id).select().single());
    } else {
      return handleResponse(() => supabase.from("live_score_settings").insert([{ ...settings, created_at: new Date().toISOString() }]).select().single());
    }
  },
  getSports: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("live_score_sports").select("*").eq("event_id", eventId).order("display_order", { ascending: true }));
    return data || [];
  },
  saveSport: async (sport: DbRow): Promise<DbRow> => {
    if (sport.id) {
      return handleResponse(() => supabase.from("live_score_sports").update(sport).eq("id", sport.id).select().single());
    } else {
      return handleResponse(() => supabase.from("live_score_sports").insert([sport]).select().single());
    }
  },
  deleteSport: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("live_score_sports").delete().eq("id", id).select());
  },
  getMatches: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("live_score_matches").select("*").eq("event_id", eventId).order("match_date", { ascending: true }).order("match_time", { ascending: true }));
    return data || [];
  },
  getMatchesWithTeams: async (eventId: string, sportId?: string | null, filters: MatchFilters = {}): Promise<DbRow[]> => {
    const { status, leagueName, matchDate } = filters;
    const data = await handleResponse(() => supabase.rpc("get_live_scores_matches", {
      p_event_id: eventId,
      p_sport_id: sportId || null,
      p_status: status || null,
      p_league_name: leagueName || null,
      p_match_date: matchDate || null,
    }));
    return data || [];
  },
  getFilterOptions: async (eventId: string, sportId?: string | null): Promise<{ leagueNames: string[]; matchDates: string[] }> => {
    const data = await handleResponse(() => supabase.rpc("get_live_scores_filter_options", { p_event_id: eventId, p_sport_id: sportId || null }));
    const row: DbRow = (data && data[0]) || {};
    return { leagueNames: row.league_names || [], matchDates: row.match_dates || [] };
  },
  saveMatch: async (match: DbRow): Promise<DbRow> => {
    const dbMatch: DbRow = { ...match };
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
  deleteMatch: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("live_score_matches").delete().eq("id", id).select());
  },
  renameLeague: async (eventId: string, sportId: string, oldName: string, newName: string): Promise<DbRow[]> => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .update({ league_name: newName.trim() || null, updated_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .eq("league_name", oldName)
        .select()
    );
  },
  deleteLeague: async (eventId: string, sportId: string, leagueName: string): Promise<DbRow[]> => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .delete()
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .eq("league_name", leagueName)
        .select()
    );
  },
  deleteMatchesBySportNoLeague: async (eventId: string, sportId: string): Promise<DbRow[]> => {
    // Deletes matches with no league_name (null or empty string)
    const { data: nullRows } = await supabase.from("live_score_matches")
      .delete().eq("event_id", eventId).eq("sport_id", sportId).is("league_name", null).select();
    const { data: emptyRows } = await supabase.from("live_score_matches")
      .delete().eq("event_id", eventId).eq("sport_id", sportId).eq("league_name", "").select();
    return [...(nullRows || []), ...(emptyRows || [])];
  },
  deleteAllMatchesBySport: async (eventId: string, sportId: string): Promise<DbRow[]> => {
    return handleResponse(() =>
      supabase.from("live_score_matches")
        .delete()
        .eq("event_id", eventId)
        .eq("sport_id", sportId)
        .select()
    );
  },
  getStandings: async (eventId: string, sportId?: string | null, divisionId?: string | null, areaId?: string | null): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.rpc("get_team_standings", { p_event_id: eventId, p_sport_id: sportId || null, p_division_id: divisionId || null, p_area_id: areaId || null }));
    return data || [];
  },
  getPointsConfig: async (eventId: string, sportId: string): Promise<DbRow | null> => {
    const data = await handleResponse(() => supabase.from("sport_points_config").select("*").eq("event_id", eventId).eq("sport_id", sportId).maybeSingle());
    return data || null;
  },
  savePointsConfig: async (config: DbRow): Promise<DbRow> => {
    return handleResponse(() => supabase.from("sport_points_config").upsert(config, { onConflict: "event_id,sport_id" }).select().single());
  },
  getTeamSportDivisions: async (teamIds: string[], sportName: string): Promise<DbRow[]> => {
    if (!teamIds || teamIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("team_sports").select("team_id, sport_name, division_id").eq("sport_name", sportName).in("team_id", teamIds));
    return data || [];
  },
  setTeamSportDivision: async (teamId: string, sportName: string, divisionId?: string | null): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("team_sports").update({ division_id: divisionId || null }).eq("team_id", teamId).eq("sport_name", sportName).select());
  },
  // assignments: [{ teamId, sportName, divisionId }]. Low-volume admin action
  // (auto-assign by location) - loops the single-team RPC rather than adding
  // a new bulk endpoint.
  bulkSetTeamDivisions: async (assignments: Array<{ teamId: string; sportName: string; divisionId?: string | null }>): Promise<DbRow[][]> => {
    const results: DbRow[][] = [];
    for (const a of assignments) {
      results.push(await LiveScoresAPI.setTeamSportDivision(a.teamId, a.sportName, a.divisionId));
    }
    return results;
  },
  getTeamIdsForSport: async (teamIds: string[], sportName: string, gender?: string): Promise<string[]> => {
    if (!teamIds || teamIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("team_sports").select("team_id, gender").eq("sport_name", sportName).in("team_id", teamIds));
    let rows: DbRow[] = data || [];
    if (gender) rows = rows.filter((row: DbRow) => !row.gender || row.gender === gender);
    return rows.map((row: DbRow) => row.team_id);
  },
  bulkCreateMatches: async (rows: DbRow[]): Promise<DbRow[]> => {
    if (!rows || rows.length === 0) return [];
    const now = new Date().toISOString();
    const payload = rows.map((r: DbRow) => ({ ...r, created_at: now, updated_at: now }));
    const data = await handleResponse(() => supabase.from("live_score_matches").insert(payload).select());
    return data || [];
  }
};

export const DivisionsAPI = {
  getBySport: async (sportId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("competition_divisions").select("*").eq("sport_id", sportId).order("display_order", { ascending: true }).order("name", { ascending: true }));
    return data || [];
  },
  save: async (division: DbRow): Promise<DbRow> => {
    if (division.id) {
      return handleResponse(() => supabase.from("competition_divisions").update(division).eq("id", division.id).select().single());
    } else {
      return handleResponse(() => supabase.from("competition_divisions").insert([division]).select().single());
    }
  },
  delete: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("competition_divisions").delete().eq("id", id).select());
  }
};

export const AreasAPI = {
  getBySport: async (sportId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("competition_areas").select("*").eq("sport_id", sportId).order("display_order", { ascending: true }).order("name", { ascending: true }));
    return data || [];
  },
  save: async (area: DbRow): Promise<DbRow> => {
    if (area.id) {
      return handleResponse(() => supabase.from("competition_areas").update(area).eq("id", area.id).select().single());
    } else {
      return handleResponse(() => supabase.from("competition_areas").insert([area]).select().single());
    }
  },
  delete: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("competition_areas").delete().eq("id", id).select());
  }
};

export const MatchEventsAPI = {
  getByMatch: async (matchId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("match_events").select("*").eq("match_id", matchId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByEvent: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("match_events").select("*").eq("event_id", eventId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByMatchIds: async (matchIds: string[]): Promise<DbRow[]> => {
    if (!matchIds || matchIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("match_events").select("*").in("match_id", matchIds).order("created_at", { ascending: true }));
    return data || [];
  },
  save: async (evt: DbRow): Promise<DbRow> => {
    const dbEvt: DbRow = { ...evt };
    if (!dbEvt.id) { delete dbEvt.id; dbEvt.created_at = new Date().toISOString(); }
    else { dbEvt.updated_at = new Date().toISOString(); }
    if (evt.id) {
      return handleResponse(() => supabase.from("match_events").update(dbEvt).eq("id", evt.id).select().single());
    } else {
      return handleResponse(() => supabase.from("match_events").insert([dbEvt]).select().single());
    }
  },
  delete: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("match_events").delete().eq("id", id).select());
  }
};

export const DisciplinaryAPI = {
  getByMatch: async (matchId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("match_id", matchId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByEvent: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("event_id", eventId).order("match_date", { ascending: false }));
    return data || [];
  },
  getByPlayer: async (accreditationId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("player_disciplinary_records").select("*").eq("player_accreditation_id", accreditationId).order("match_date", { ascending: false }));
    return data || [];
  },
  save: async (record: DbRow): Promise<DbRow> => {
    const dbRecord: DbRow = { ...record };
    if (!dbRecord.id) { delete dbRecord.id; dbRecord.created_at = new Date().toISOString(); }
    else { dbRecord.updated_at = new Date().toISOString(); }
    if (record.id) {
      return handleResponse(() => supabase.from("player_disciplinary_records").update(dbRecord).eq("id", record.id).select().single());
    } else {
      return handleResponse(() => supabase.from("player_disciplinary_records").insert([dbRecord]).select().single());
    }
  },
  delete: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("player_disciplinary_records").delete().eq("id", id).select());
  }
};

export const PlayerStatsAPI = {
  getByMatch: async (matchId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("player_match_stats").select("*").eq("match_id", matchId).order("created_at", { ascending: true }));
    return data || [];
  },
  getByMatchIds: async (matchIds: string[]): Promise<DbRow[]> => {
    if (!matchIds || matchIds.length === 0) return [];
    const data = await handleResponse(() => supabase.from("player_match_stats").select("*").in("match_id", matchIds).order("created_at", { ascending: true }));
    return data || [];
  },
  getByEvent: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.from("player_match_stats").select("*").eq("event_id", eventId).order("created_at", { ascending: true }));
    return data || [];
  },
  getPlayerTotals: async (accreditationId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.rpc("get_player_stat_totals", { p_accreditation_id: accreditationId }));
    return data || [];
  },
  getTeamTotals: async (teamId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.rpc("get_team_stat_totals", { p_team_id: teamId }));
    return data || [];
  },
  save: async (row: DbRow): Promise<DbRow> => {
    const dbRow: DbRow = { ...row };
    if (!dbRow.id) { delete dbRow.id; dbRow.created_at = new Date().toISOString(); }
    else { dbRow.updated_at = new Date().toISOString(); }
    if (row.id) {
      return handleResponse(() => supabase.from("player_match_stats").update(dbRow).eq("id", row.id).select().single());
    } else {
      return handleResponse(() => supabase.from("player_match_stats").upsert(dbRow, { onConflict: "match_id,player_accreditation_id" }).select().single());
    }
  },
  delete: async (id: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("player_match_stats").delete().eq("id", id).select());
  }
};

export const PartnersAPI = {
  getPartners: async (): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("partners").select("*").order("created_at", { ascending: false }));
  },
  createPartner: async (partnerData: DbRow): Promise<DbRow> => {
    const { data, error } = await supabase.from("partners").insert(partnerData).select().single();
    if (error) throw error;
    return data;
  },
  updatePartner: async (id: string, partnerData: DbRow): Promise<DbRow> => {
    const { data, error } = await supabase.from("partners").update(partnerData).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  deletePartner: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  getKeys: async (partnerId: string): Promise<DbRow[]> => {
    return handleResponse(() => supabase.from("partner_api_keys").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }));
  },
  generateKey: async (partnerId: string, label: string, permissions: string[] = [], allowedFields: string[] = []): Promise<DbRow> => {
    const apiKey = `apex_live_${crypto.randomUUID().replace(/-/g, "")}`;
    // [APX-SEC] Store a SHA-256 hash alongside the key so verification never
    // string-matches the plaintext credential. The raw key is returned once for
    // the admin to copy; it cannot be recovered from the hash afterwards.
    const apiKeyHash = await sha256Hex(apiKey);
    const { data, error } = await supabase.from("partner_api_keys").insert({
      partner_id: partnerId, label, api_key: apiKey, api_key_hash: apiKeyHash,
      permissions: permissions.length > 0 ? permissions : ["read_basic"],
      allowed_fields: allowedFields.length > 0 ? allowedFields : ["firstName", "lastName", "role", "badgeNumber"]
    }).select().single();
    if (error) throw error;
    return data;
  },
  revokeKey: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("partner_api_keys").update({ status: 'revoked' }).eq("id", id);
    if (error) throw error;
    return true;
  }
};

export const initializeDefaultData = async (): Promise<void> => {};
