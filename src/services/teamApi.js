import { supabase } from '../lib/supabase';

export const TeamAPI = {
  /**
   * Fetch all participants mapped to this team (Admin View).
   */
  async getAdminTeamRoster(teamId) {
    const { data, error } = await supabase
      .from('team_participants')
      .select(`
        id, 
        team_id,
        event_id,
        accreditation_id,
        roster_role,
        status,
        is_active,
        sport_name,
        review_notes,
        reviewed_by,
        reviewed_at,
        jersey_number,
        position,
        created_at,
        accreditations (
          first_name,
          last_name,
          role,
          club,
          photo_url,
          accreditation_id,
          badge_number,
          nationality,
          date_of_birth,
          selected_sports
        ),
        reviewer:reviewed_by (
          email
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Approve or reject a participant mapping (Admin Only).
   */
  async reviewTeamParticipant(participantId, status, notes) {
    // 1. Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    // 2. Whitelist status
    if (status !== 'approved' && status !== 'rejected') {
      throw new Error("Invalid status. Must be 'approved' or 'rejected'.");
    }

    // 3. Update the mapping securely
    const { data, error } = await supabase
      .from('team_participants')
      .update({
        status: status,
        review_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update the roster role and/or assigned sport for a participant (Admin Only).
   */
  async updateRosterAssignment(participantId, updates) {
    const safeUpdates = {};
    if (updates.roster_role !== undefined) safeUpdates.roster_role = updates.roster_role;
    if (updates.sport_name !== undefined) safeUpdates.sport_name = updates.sport_name;

    if (Object.keys(safeUpdates).length === 0) return null;

    const { data, error } = await supabase
      .from('team_participants')
      .update(safeUpdates)
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Fetch all teams for a specific event
   */
  async getTeamsByEvent(eventId) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Fetch a single team by ID
   */
  async getTeamById(teamId) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new team
   */
  async createTeam(teamData) {
    const { data, error } = await supabase
      .from('teams')
      .insert([teamData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing team
   */
  async updateTeam(teamId, teamData) {
    const { data, error } = await supabase
      .from('teams')
      .update(teamData)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a team
   */
  async deleteTeam(teamId) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    return true;
  },

  /**
   * Get basic stats for teams in an event
   */
  async getTeamStats(eventId) {
    const { data, error } = await supabase
      .from('teams')
      .select('status')
      .eq('event_id', eventId);

    if (error) throw error;

    const stats = {
      total: data.length,
      active: 0,
      pending: 0,
      suspended: 0,
    };

    data.forEach(team => {
      if (team.status === 'active') stats.active++;
      else if (team.status === 'pending') stats.pending++;
      else if (team.status === 'suspended') stats.suspended++;
    });

    return stats;
  },

  // ==========================================
  // PHASE 2B: Users & Roles
  // ==========================================

  /**
   * Search profiles by email (exact match)
   * Note: RLS on profiles must allow Global Admin / Event Admin to search.
   */
  async searchProfilesByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
    return data || null;
  },

  /**
   * Get all users assigned to a team
   */
  async getTeamUsers(teamId) {
    // Step 1: Get the team_users mapping
    const { data: teamUsers, error: tuError } = await supabase
      .from('team_users')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (tuError) throw tuError;
    if (!teamUsers || teamUsers.length === 0) return [];

    // Step 2: Get the corresponding profiles
    const userIds = teamUsers.map(tu => tu.user_id);
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (pError) throw pError;

    // Step 3: Merge them together
    return teamUsers.map(tu => ({
      ...tu,
      profiles: profiles.find(p => p.id === tu.user_id) || {}
    }));
  },

  /**
   * Assign a user to a team
   */
  async assignTeamUser(teamId, userId, role) {
    // The database requires event_id for RLS safety
    const { data: teamData } = await supabase
      .from('teams')
      .select('event_id')
      .eq('id', teamId)
      .single();

    const payload = { team_id: teamId, user_id: userId, role };
    if (teamData?.event_id) {
      payload.event_id = teamData.event_id;
    }

    const { data, error } = await supabase
      .from('team_users')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove a user from a team
   */
  async removeTeamUser(teamId, userId) {
    const { error } = await supabase
      .from('team_users')
      .delete()
      .match({ team_id: teamId, user_id: userId });

    if (error) throw error;
    return true;
  },

  /**
   * Update a user's role on a team
   */
  async updateTeamUserRole(teamId, userId, newRole) {
    const { data, error } = await supabase
      .from('team_users')
      .update({ role: newRole })
      .match({ team_id: teamId, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // PHASE 2B: Basic Sports & Notes
  // ==========================================

  /**
   * Get team registered sports
   */
  async getTeamSports(teamId) {
    const { data, error } = await supabase
      .from('team_sports')
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;
    return data;
  },

  /**
   * Update team notes
   */
  async updateTeamNotes(teamId, notes) {
    const { data, error } = await supabase
      .from('teams')
      .update({ notes })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // PHASE 2C: TEAM DOCUMENTS & SPORTS
  // ==========================================

  /**
   * Add a registered sport to a team
   */
  async addTeamSport(teamId, eventId, sportName) {
    const { data, error } = await supabase
      .from('team_sports')
      .insert([{
        team_id: teamId,
        event_id: eventId,
        sport_name: sportName
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove a specific sport from a team
   */
  async removeTeamSport(teamId, sportName) {
    const { error } = await supabase
      .from('team_sports')
      .delete()
      .match({ team_id: teamId, sport_name: sportName });

    if (error) throw error;
    return true;
  },

  /**
   * Get uploaded documents for a team
   */
  async getTeamDocuments(teamId) {
    const { data, error } = await supabase
      .from('team_documents')
      .select('id, doc_type, file_url, status, review_notes, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Record an uploaded document into the database
   */
  async addTeamDocument(teamId, eventId, docType, fileUrl) {
    const { data, error } = await supabase
      .from('team_documents')
      .insert([{ 
        team_id: teamId, 
        event_id: eventId,
        doc_type: docType, 
        file_url: fileUrl
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a document mapping
   */
  async deleteTeamDocument(documentId) {
    const { error } = await supabase
      .from('team_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
    return true;
  },

  /**
   * Update the status of a document
   */
  async updateDocumentStatus(documentId, status) {
    const { data, error } = await supabase
      .from('team_documents')
      .update({ status })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // PHASE 4: FACILITY HOSTING (Admin Read-Only)
  // ==========================================

  /**
   * Get the facility hosting answers submitted by a team
   */
  async getTeamFacilityAnswers(teamId) {
    const { data, error } = await supabase
      .from('team_facility_answers')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // PHASE 4G: RULES & REGULATIONS + ACKNOWLEDGEMENTS
  // ==========================================

  /**
   * Get all rules/regulations documents published for an event
   */
  async getEventRulesDocuments(eventId) {
    const { data, error } = await supabase
      .from('event_rules_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Publish a new rules/regulations document for an event
   */
  async createRulesDocument(eventId, payload) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('event_rules_documents')
      .insert([{ ...payload, event_id: eventId, created_by: user?.id || null }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing rules/regulations document
   */
  async updateRulesDocument(documentId, payload) {
    const { data, error } = await supabase
      .from('event_rules_documents')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a rules/regulations document
   */
  async deleteRulesDocument(documentId) {
    const { error } = await supabase
      .from('event_rules_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
    return true;
  },

  /**
   * Get this team's acknowledgement status for every published rules document,
   * including which user acknowledged and when.
   */
  async getTeamRulesAcknowledgements(teamId) {
    const { data: acks, error } = await supabase
      .from('team_rules_acknowledgements')
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;
    if (!acks || acks.length === 0) return [];

    const userIds = [...new Set(acks.map(a => a.user_id).filter(Boolean))];
    if (userIds.length === 0) return acks;

    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (pError) throw pError;

    return acks.map(a => ({
      ...a,
      profile: profiles?.find(p => p.id === a.user_id) || null
    }));
  },

  /**
   * Get every acknowledgement recorded across all teams for an event
   * (used by the admin Rules & Regulations management page to show
   * per-document acknowledgement progress across teams).
   */
  async getEventAcknowledgements(eventId) {
    const { data, error } = await supabase
      .from('team_rules_acknowledgements')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data || [];
  }
};
