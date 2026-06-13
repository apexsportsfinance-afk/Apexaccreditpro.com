import React, { useState } from 'react';
import { User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { TeamAPI } from '../../../services/teamApi';
import { useToast } from '../../ui/Toast';

export default function ReviewParticipantModal({ isOpen, onClose, participant, onSuccess }) {
  const toast = useToast();
  const acc = participant.accreditations;
  
  const [notes, setNotes] = useState(participant.review_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
          </div>
          <div className="p-4 border border-primary-500/30 rounded-xl bg-primary-500/5">
            <p className="text-sm text-primary-500 mb-1">Requested Roster Role</p>
            <p className="font-bold text-main text-lg">{getRoleLabel(participant.roster_role)}</p>
            <p className="text-xs text-muted mt-1">
              Jersey: {participant.jersey_number || '-'} • Pos: {participant.position || '-'}
            </p>
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
