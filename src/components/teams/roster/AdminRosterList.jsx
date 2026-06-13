import React, { useState, useEffect } from 'react';
import { Search, User, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { TeamAPI } from '../../../services/teamApi';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import ReviewParticipantModal from './ReviewParticipantModal';
import { calculateAge, getCountryCode3, getCountryFlag } from '../../../lib/utils';

export default function AdminRosterList({ teamId }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [teamSports, setTeamSports] = useState([]);

  // Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [participantToReview, setParticipantToReview] = useState(null);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TeamAPI.getAdminTeamRoster(teamId);
      setParticipants(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load team roster for admin review.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchRoster();
      TeamAPI.getTeamSports(teamId)
        .then((sports) => setTeamSports(sports || []))
        .catch((err) => console.error(err));
    }
  }, [teamId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <Badge variant="success" icon={CheckCircle2}>Approved</Badge>;
      case 'rejected': return <Badge variant="danger" icon={XCircle}>Rejected</Badge>;
      default: return <Badge variant="warning" icon={Clock}>Pending</Badge>;
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

  const handleReviewClick = (participant) => {
    setParticipantToReview(participant);
    setReviewModalOpen(true);
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
    if (filter !== 'all' && p.status !== filter) return false;
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
        acc?.accreditation_id?.toLowerCase().includes(term) ||
        acc?.badge_number?.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-alt/30 p-4 border border-border rounded-xl">
        <div className="flex items-center gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f 
                  ? 'bg-primary-500 text-white shadow-sm' 
                  : 'bg-base border border-border text-muted hover:text-main hover:border-primary-500/30'
              }`}
            >
              {f}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-black/10">
                {f === 'all' 
                  ? participants.length 
                  : participants.filter(p => p.status === f).length}
              </span>
            </button>
          ))}
        </div>
        
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
              placeholder="Search roster..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-base border border-border rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors w-full sm:w-64 text-main placeholder:text-muted"
            />
          </div>
        </div>
      </div>

      {/* Roster List */}
      {filteredParticipants.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-base-alt/30">
          <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-main mb-2">No Roster Mappings Found</h3>
          <p className="text-muted max-w-sm mx-auto">
            {filter !== 'all' 
              ? `There are no participants with the status '${filter}'.`
              : "No participants have been submitted to this team roster yet."}
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
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
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
                        {p.status !== 'pending' && (p.reviewed_at || p.review_notes) && (
                          <div className="text-xs text-muted max-w-[150px] mt-1">
                            {p.reviewed_at && <div>On: {new Date(p.reviewed_at).toLocaleDateString()}</div>}
                            {p.review_notes && <div className="truncate text-main" title={p.review_notes}>"{p.review_notes}"</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant={p.status === 'pending' ? 'primary' : 'outline'} 
                          size="sm"
                          onClick={() => handleReviewClick(p)}
                        >
                          {p.status === 'pending' ? 'Review' : 'Update Review'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reviewModalOpen && participantToReview && (
        <ReviewParticipantModal 
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setParticipantToReview(null);
          }}
          participant={participantToReview}
          onSuccess={() => {
            setReviewModalOpen(false);
            setParticipantToReview(null);
            fetchRoster();
          }}
        />
      )}
    </div>
  );
}
