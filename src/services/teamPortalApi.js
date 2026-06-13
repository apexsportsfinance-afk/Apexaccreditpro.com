import { supabase } from '../lib/supabase';
import { uploadToStorage } from '../lib/uploadToStorage';

export const TeamPortalAPI = {
  /**
   * Get all teams the current logged-in user is assigned to.
   */
  async getMyAssignedTeams(userId) {
    // team_users RLS ensures we only see rows where user_id = auth.uid()
    // However, explicitly querying by userId is safe.
    const { data: assignments, error: assignmentError } = await supabase
      .from('team_users')
      .select('team_id, role, created_at')
      .eq('user_id', userId);

    if (assignmentError) throw assignmentError;
    if (!assignments || assignments.length === 0) return [];

    const teamIds = assignments.map(a => a.team_id);
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    // Merge team data with assignment role
    return teams.map(team => {
      const assignment = assignments.find(a => a.team_id === team.id);
      return {
        ...team,
        my_role: assignment.role,
        assigned_at: assignment.created_at
      };
    });
  },

  /**
   * Verify if a user has access to a specific team.
   * Returns the role if assigned, throws error if not.
   */
  async verifyTeamAccess(teamId, userId) {
    const { data, error } = await supabase
      .from('team_users')
      .select('role')
      .match({ team_id: teamId, user_id: userId })
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new Error("Access Denied"); // Not found
      throw error;
    }
    return data.role;
  },

  /**
   * Fetch a single team by ID for the portal
   */
  async getPortalTeamDetails(teamId) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get registered sports for the team
   */
  async getPortalTeamSports(teamId) {
    const { data, error } = await supabase
      .from('team_sports')
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;
    return data;
  },

  /**
   * Get uploaded documents for the team
   */
  async getPortalTeamDocuments(teamId) {
    // Safe to fetch status and review fields now that the patch is applied
    const { data, error } = await supabase
      .from('team_documents')
      .select('id, doc_type, file_url, status, review_notes, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Safely upload a document directly in the API call
   */
  async uploadPortalDocument(teamId, eventId, docType, file, userId) {
    // 1. Strict Validation
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`Invalid file type (.${extension}). Only PDF, JPG, PNG, and WEBP are allowed.`);
    }

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      throw new Error("Invalid file content type.");
    }

    // 2. Consistent Storage Path
    // Required format: team-documents/{event_id}/{team_id}/{timestamp}_{filename}
    const safeFolder = `team-documents/${eventId}/${teamId}`;
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // 3. Upload to storage
    const { url } = await uploadToStorage(file, safeFolder, safeFileName);

    // 4. Save metadata to DB

    const { data, error } = await supabase
      .from('team_documents')
      .insert([{ 
        team_id: teamId, 
        event_id: eventId,
        doc_type: docType, 
        file_url: url,
        uploaded_by: userId,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ==========================================
   * PHASE 3B: TEAM PARTICIPANTS (ROSTER API)
   * ==========================================
   */

  /**
   * Search available accreditations in the same event for adding to roster.
   */
  async searchAccreditationsForRoster(teamId, searchTerm) {
    if (!searchTerm || searchTerm.length < 3) {
      throw new Error("Search term must be at least 3 characters.");
    }

    // 1. Get the team's event_id and name safely internally
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('event_id, name')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;
    if (!team || !team.event_id) throw new Error("Team not found or has no event.");

    // 2. Perform safe search strictly scoped to the same event_id and this team's club
    const safeTerm = `%${searchTerm.trim()}%`;
    const { data, error } = await supabase
      .from('accreditations')
      .select('id, first_name, last_name, role, club, photo_url, accreditation_id, badge_number')
      .eq('event_id', team.event_id)
      .ilike('club', team.name.trim())
      .or(`first_name.ilike.${safeTerm},last_name.ilike.${safeTerm},email.ilike.${safeTerm},accreditation_id.ilike.${safeTerm},badge_number.ilike.${safeTerm}`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch all participants mapped to this team.
   */
  async getTeamParticipants(teamId) {
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
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Safely map an existing accreditation to the team roster.
   */
  async addTeamParticipant(teamId, accreditationId, rosterRole, jerseyNumber, position) {
    // 1. Get the team's event_id and name safely internally
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('event_id, name')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;
    if (!team || !team.event_id) throw new Error("Team not found.");

    // 2. Verify the accreditation belongs to the same event and club
    const { data: acc, error: accError } = await supabase
      .from('accreditations')
      .select('event_id, club')
      .eq('id', accreditationId)
      .single();

    if (accError) throw new Error("Accreditation not found.");
    if (acc.event_id !== team.event_id) {
      throw new Error("Security Error: Cannot add an athlete from a different event to this team.");
    }
    if (!acc.club || acc.club.trim().toLowerCase() !== team.name.trim().toLowerCase()) {
      throw new Error("Security Error: Cannot add an athlete from a different club to this team.");
    }

    // 3. Insert the mapping
    const { data, error } = await supabase
      .from('team_participants')
      .insert([{
        team_id: teamId,
        event_id: team.event_id,
        accreditation_id: accreditationId,
        roster_role: rosterRole,
        jersey_number: jerseyNumber || null,
        position: position || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error("This person is already assigned to this team roster.");
      }
      throw error;
    }
    return data;
  },

  /**
   * Update team participant details safely.
   */
  async updateTeamParticipant(participantId, updates) {
    // Explicitly filter updates so only safe fields are sent.
    const safeUpdates = {};
    if (updates.jersey_number !== undefined) safeUpdates.jersey_number = updates.jersey_number;
    if (updates.position !== undefined) safeUpdates.position = updates.position;
    if (updates.is_active !== undefined) safeUpdates.is_active = updates.is_active;

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
   * Remove a mapped participant from the roster.
   * Strictly deletes only from 'team_participants'.
   */
  async removeTeamParticipant(participantId) {
    const { error } = await supabase
      .from('team_participants')
      .delete()
      .eq('id', participantId);

    if (error) throw error;
    return true;
  },

  /**
   * ==========================================
   * PHASE 4: FACILITY HOSTING
   * ==========================================
   */

  /**
   * Get the facility hosting answers for this team (if any).
   */
  async getPortalFacilityAnswers(teamId) {
    const { data, error } = await supabase
      .from('team_facility_answers')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Create or update the facility hosting answers for this team.
   */
  async saveFacilityAnswers(teamId, eventId, answers) {
    const existing = await this.getPortalFacilityAnswers(teamId);

    if (existing) {
      const { data, error } = await supabase
        .from('team_facility_answers')
        .update({ answers })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('team_facility_answers')
      .insert([{ team_id: teamId, event_id: eventId, answers }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ==========================================
   * PHASE 4G: RULES & REGULATIONS + ACKNOWLEDGEMENTS
   * ==========================================
   */

  /**
   * Get all active rules/regulations documents published for this team's event
   * and targeted at this team (target_team_ids is null/empty = all teams).
   */
  async getPortalRulesDocuments(eventId, teamId) {
    const { data, error } = await supabase
      .from('event_rules_documents')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).filter((doc) => {
      const targets = doc.target_team_ids;
      return !targets || targets.length === 0 || targets.includes(teamId);
    });
  },

  /**
   * Get the current user's acknowledgements for this team
   */
  async getMyRulesAcknowledgements(teamId, userId) {
    const { data, error } = await supabase
      .from('team_rules_acknowledgements')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  },

  /**
   * Acknowledge ("read and accepted") a rules/regulations document
   */
  async acknowledgeRulesDocument(eventId, teamId, documentId, userId) {
    const { data, error } = await supabase
      .from('team_rules_acknowledgements')
      .upsert(
        [{ event_id: eventId, team_id: teamId, document_id: documentId, user_id: userId, acknowledged_at: new Date().toISOString() }],
        { onConflict: 'team_id,document_id,user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
