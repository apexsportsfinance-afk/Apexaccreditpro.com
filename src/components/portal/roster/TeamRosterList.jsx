import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, User, AlertCircle, ShieldAlert } from 'lucide-react';
import { TeamPortalAPI } from '../../../services/teamPortalApi';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import AddParticipantModal from './AddParticipantModal';
import EditParticipantModal from './EditParticipantModal';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { calculateAge, getCountryCode3, getCountryFlag } from '../../../lib/utils';

export default function TeamRosterList({ teamId, userRole }) {
  const toast = useToast();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  
  // Edit & Delete state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [participantToEdit, setParticipantToEdit] = useState(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filtering
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [teamSports, setTeamSports] = useState([]);

  const canManage = userRole === 'admin' || userRole === 'manager';

  const fetchRoster = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TeamPortalAPI.getTeamParticipants(teamId);
      setParticipants(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load team roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchRoster();
      TeamPortalAPI.getPortalTeamSports(teamId)
        .then((sports) => setTeamSports(sports || []))
        .catch((err) => console.error(err));
    }
  }, [teamId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="warning">Pending</Badge>;
    }
  };

  const getActiveBadge = (isActive) => (
    isActive !== false
      ? <Badge variant="success">Active</Badge>
      : <Badge variant="muted">Inactive</Badge>
  );

  const getRoleLabel = (role) => {
    const labels = {
      athlete: 'Athlete',
      head_coach: 'Head Coach',
      assistant_coach: 'Assistant Coach',
      team_manager: 'Team Manager',
      physio: 'Physio',
      support_staff: 'Support Staff'
    };
    return labels[role] || role;
  };

  const getSportDisplay = (p) => {
    const acc = p.accreditations;
    if (p.sport_name) return p.sport_name;
    if (Array.isArray(acc?.selected_sports) && acc.selected_sports.length > 0) {
      return acc.selected_sports.join(', ');
    }
    return '-';
  };

  const filteredParticipants = participants.filter(p => {
    const acc = p.accreditations;
    if (sportFilter !== 'all') {
      const matchesSport = p.sport_name === sportFilter ||
        (Array.isArray(acc?.selected_sports) && acc.selected_sports.includes(sportFilter));
      if (!matchesSport) return false;
    }
    if (search) {
      const term = search.toLowerCase();
      const match =
        acc?.first_name?.toLowerCase().includes(term) ||
        acc?.last_name?.toLowerCase().includes(term) ||
        acc?.accreditation_id?.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  const handleDeleteClick = (participant) => {
    setParticipantToDelete(participant);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!participantToDelete) return;
    try {
      setDeleting(true);
      await TeamPortalAPI.removeTeamParticipant(participantToDelete.id);
      toast.success("Removed from roster.");
      setDeleteConfirmOpen(false);
      setParticipantToDelete(null);
      fetchRoster();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to remove participant.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-base-alt/50 animate-pulse rounded-xl border border-border"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center border border-red-500/20 bg-red-500/5 rounded-xl">
        <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchRoster} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-3 py-2 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value="all">All Sports</option>
            {teamSports.map((s) => (
              <option key={s.sport_name} value={s.sport_name}>{s.sport_name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Filter roster..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-base border border-border rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors w-64 text-main placeholder:text-muted"
            />
          </div>
        </div>

        {canManage && (
          <Button onClick={() => setAddModalOpen(true)} icon={Plus}>
            Add Participant
          </Button>
        )}
      </div>

      {/* Roster List */}
      {participants.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-base-alt/30">
          <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-main mb-2">Your Roster is Empty</h3>
          <p className="text-muted max-w-sm mx-auto mb-6">
            {canManage 
              ? "Start building your team by securely mapping existing accreditations to this roster."
              : "No participants have been assigned to this team yet."}
          </p>
          {canManage && (
            <Button onClick={() => setAddModalOpen(true)} icon={Plus}>
              Add First Participant
            </Button>
          )}
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-base-alt/30">
          <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-main mb-2">No Matches Found</h3>
          <p className="text-muted max-w-sm mx-auto">
            No roster members match your current search or sport filter.
          </p>
        </div>
      ) : (
        <div className="bg-base border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-base-alt/50 border-b border-border text-sm font-medium text-muted">
                  <th className="px-4 py-3 whitespace-nowrap">Participant</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nationality</th>
                  <th className="px-4 py-3 whitespace-nowrap">Age</th>
                  <th className="px-4 py-3 whitespace-nowrap">Sport</th>
                  <th className="px-4 py-3 whitespace-nowrap">Roster Role</th>
                  <th className="px-4 py-3 whitespace-nowrap">Jersey / Pos</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  {canManage && <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredParticipants.map(p => {
                  const acc = p.accreditations;
                  return (
                    <tr key={p.id} className="hover:bg-base-alt/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {acc?.photo_url ? (
                            <img src={acc.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border bg-base-alt" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-border">
                              <User className="w-4 h-4 text-primary-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-main truncate max-w-[200px]">
                              {acc?.first_name} {acc?.last_name}
                            </p>
                            <span className="text-muted text-xs font-mono">{acc?.accreditation_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getCountryFlag(acc?.nationality) && (
                            <img src={getCountryFlag(acc?.nationality)} alt="" className="w-5 h-auto rounded-sm border border-border shrink-0" />
                          )}
                          <span className="text-main">{getCountryCode3(acc?.nationality) || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-main">{calculateAge(acc?.date_of_birth) ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-main">{getSportDisplay(p)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-main">{getRoleLabel(p.roster_role)}</div>
                        {acc?.role && getRoleLabel(p.roster_role) !== acc.role && (
                          <div className="text-muted text-xs whitespace-nowrap">Accreditation: {acc.role}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-main">{p.jersey_number || '-'}</div>
                        <div className="text-muted text-xs">{p.position || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(p.status)}
                          {getActiveBadge(p.is_active)}
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setParticipantToEdit(p);
                                setEditModalOpen(true);
                              }}
                              className="p-2 hover:bg-primary-500/10 text-muted hover:text-primary-500 rounded-lg transition-colors"
                              title="Edit Details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(p)}
                              className="p-2 hover:bg-red-500/10 text-muted hover:text-red-500 rounded-lg transition-colors"
                              title="Remove from Roster"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {addModalOpen && (
        <AddParticipantModal 
          isOpen={addModalOpen} 
          onClose={() => setAddModalOpen(false)} 
          teamId={teamId}
          onSuccess={() => {
            setAddModalOpen(false);
            fetchRoster();
          }}
        />
      )}

      {editModalOpen && participantToEdit && (
        <EditParticipantModal 
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setParticipantToEdit(null);
          }}
          participant={participantToEdit}
          onSuccess={() => {
            setEditModalOpen(false);
            setParticipantToEdit(null);
            fetchRoster();
          }}
        />
      )}

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Remove Participant">
        <div className="p-6">
          <div className="flex gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-6">
            <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
            <div>
              <h3 className="font-bold text-orange-500 mb-1">Are you sure?</h3>
              <p className="text-orange-500/80 text-sm">
                Are you sure you want to remove this person from the team roster? This will only remove their team assignment. Their core accreditation record will not be deleted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {participantToDelete?.accreditations?.photo_url ? (
              <img src={participantToDelete.accreditations.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-base-alt flex items-center justify-center">
                <User className="w-6 h-6 text-muted" />
              </div>
            )}
            <div>
              <p className="font-bold text-main">
                {participantToDelete?.accreditations?.first_name} {participantToDelete?.accreditations?.last_name}
              </p>
              <p className="text-sm text-muted">
                {getRoleLabel(participantToDelete?.roster_role)}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-3 bg-base-alt/50">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting} isLoading={deleting}>
            Remove from Roster
          </Button>
        </div>
      </Modal>

    </div>
  );
}
