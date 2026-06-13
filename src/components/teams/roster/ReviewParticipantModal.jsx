import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Select from '../../ui/Select';
import { TeamAPI } from '../../../services/teamApi';
import { useToast } from '../../ui/Toast';

const ROSTER_ROLES = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'head_coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'team_manager', label: 'Team Manager' },
  { value: 'physio', label: 'Physio' },
  { value: 'support_staff', label: 'Support Staff' }
];

export default function ReviewParticipantModal({ isOpen, onClose, participant, onSuccess }) {
  const toast = useToast();
  const acc = participant.accreditations;

  const [notes, setNotes] = useState(participant.review_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [rosterRole, setRosterRole] = useState(participant.roster_role || 'athlete');
  const [sportName, setSportName] = useState(participant.sport_name || "");
  const [teamSports, setTeamSports] = useState([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  useEffect(() => {
    TeamAPI.getTeamSports(participant.team_id)
      .then((sports) => setTeamSports(sports || []))
      .catch((err) => console.error(err));
  }, [participant.team_id]);

  const handleReview = async (status) => {
    setError(null);
    if (status === 'rejected' && !notes.trim()) {
      setError("Review notes are required when rejecting a participant.");
      return;
    }

    try {
      setIsSubmitting(true);
      await TeamAPI.reviewTeamParticipant(participant.id, status, notes.trim());
      toast.success(`Participant ${status} successfully.`);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || `Failed to ${status} participant.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAssignment = async () => {
    try {
      setSavingAssignment(true);
      await TeamAPI.updateRosterAssignment(participant.id, {
        roster_role: rosterRole,
        sport_name: sportName || null
      });
      toast.success("Roster assignment updated.");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update roster assignment.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const sportOptions = [
    { value: '', label: 'Not Assigned' },
    ...teamSports.map((s) => ({ value: s.sport_name, label: s.sport_name }))
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Roster Participant" size="lg">
      <div className="p-6 space-y-6">
        
        {/* Current Status Banner */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          participant.status === 'approved' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
          participant.status === 'rejected' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
          'bg-orange-500/10 border-orange-500/20 text-orange-500'
        }`}>
          {participant.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> :
           participant.status === 'rejected' ? <XCircle className="w-5 h-5" /> :
           <AlertCircle className="w-5 h-5" />}
          <div>
            <h3 className="font-bold capitalize">{participant.status}</h3>
            {participant.reviewed_at && (
              <p className="text-sm opacity-80">Last updated: {new Date(participant.reviewed_at).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Participant Profile */}
        <div className="flex items-start gap-4 p-5 bg-base-alt/50 border border-border rounded-xl">
          {acc?.photo_url ? (
            <img src={acc.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-border shadow-sm bg-base" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-base border border-border flex items-center justify-center shrink-0 shadow-sm">
              <User className="w-8 h-8 text-muted" />
            </div>
          )}
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted mb-1">Name</p>
              <p className="font-bold text-main">{acc?.first_name} {acc?.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Accreditation ID</p>
              <p className="font-mono text-sm text-main">{acc?.accreditation_id}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Club / Organization</p>
              <p className="font-medium text-main">{acc?.club || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Badge Number</p>
              <p className="font-mono text-sm text-main">{acc?.badge_number || '-'}</p>
            </div>
          </div>
        </div>

        {/* Role Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-border rounded-xl bg-base">
            <p className="text-sm text-muted mb-1">System Accreditation Role</p>
            <p className="font-bold text-main">{acc?.role || 'None'}</p>
            <p className="text-xs text-muted mt-1">What they are registered as globally.</p>
            {Array.isArray(acc?.selected_sports) && acc.selected_sports.length > 0 && (
              <p className="text-xs text-muted mt-1">Registered sports: {acc.selected_sports.join(', ')}</p>
            )}
          </div>
          <div className="p-4 border border-primary-500/30 rounded-xl bg-primary-500/5">
            <p className="text-sm text-primary-500 mb-1">Roster Details</p>
            <p className="text-xs text-muted mt-1">
              Jersey: {participant.jersey_number || '-'} • Pos: {participant.position || '-'}
            </p>
          </div>
        </div>

        {/* Roster Assignment */}
        <div className="p-4 border border-border rounded-xl bg-base space-y-4">
          <p className="text-sm font-semibold text-main">Roster Assignment</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-main mb-1.5">Roster Role</label>
              <Select
                value={rosterRole}
                onChange={(e) => setRosterRole(e.target.value)}
                options={ROSTER_ROLES}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-main mb-1.5">Sport</label>
              <Select
                value={sportName}
                onChange={(e) => setSportName(e.target.value)}
                options={sportOptions}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveAssignment}
              disabled={savingAssignment}
              isLoading={savingAssignment}
            >
              Save Assignment
            </Button>
          </div>
        </div>

        {/* Review Notes */}
        <div>
          <label className="block text-sm font-medium text-main mb-2">
            Review Notes 
            <span className="text-muted font-normal ml-1">(Required for rejection)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes for the team manager regarding this approval or rejection..."
            className="w-full bg-base border border-border rounded-xl p-3 min-h-[100px] text-sm focus:outline-none focus:border-primary-500 transition-colors text-main"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      </div>
      
      <div className="p-4 border-t border-border flex justify-between items-center bg-base-alt/50">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button 
            variant="danger" 
            onClick={() => handleReview('rejected')} 
            disabled={isSubmitting} 
            isLoading={isSubmitting}
            icon={XCircle}
          >
            Reject Participant
          </Button>
          <Button 
            variant="success" 
            onClick={() => handleReview('approved')} 
            disabled={isSubmitting} 
            isLoading={isSubmitting}
            icon={CheckCircle2}
          >
            Approve Participant
          </Button>
        </div>
      </div>
    </Modal>
  );
}
