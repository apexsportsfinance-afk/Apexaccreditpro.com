import React, { useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { TeamPortalAPI } from '../../../services/teamPortalApi';
import { useToast } from '../../ui/Toast';
import { User } from 'lucide-react';

export default function EditParticipantModal({ isOpen, onClose, participant, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [jerseyNumber, setJerseyNumber] = useState(participant.jersey_number || "");
  const [position, setPosition] = useState(participant.position || "");

  const acc = participant.accreditations;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await TeamPortalAPI.updateTeamParticipant(participant.id, {
        jersey_number: jerseyNumber.trim() || null,
        position: position.trim() || null
      });
      toast.success("Participant updated successfully.");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update participant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Roster Details">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
          {/* Read-only Participant Preview */}
          <div className="flex items-center gap-4 p-4 bg-base-alt/50 border border-border rounded-xl">
            {acc?.photo_url ? (
              <img src={acc.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-base-alt border border-border flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-muted" />
              </div>
            )}
            <div>
              <p className="font-bold text-main">{acc?.first_name} {acc?.last_name}</p>
              <p className="text-sm text-muted">{acc?.accreditation_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-main mb-1.5">Jersey Number (Optional)</label>
              <Input 
                value={jerseyNumber}
                onChange={e => setJerseyNumber(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-main mb-1.5">Position (Optional)</label>
              <Input 
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder="e.g. Forward"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-base-alt/50">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} isLoading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
