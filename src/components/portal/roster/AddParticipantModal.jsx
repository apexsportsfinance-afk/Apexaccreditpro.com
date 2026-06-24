import React, { useState, useEffect } from 'react';
import StorageImage from '../../ui/StorageImage';
import { Search, X, Loader2, User, Check, AlertCircle } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import { TeamPortalAPI } from '../../../services/teamPortalApi';
import { useToast } from '../../ui/Toast';

const ROSTER_ROLES = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'head_coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'team_manager', label: 'Team Manager' },
  { value: 'physio', label: 'Physio' },
  { value: 'support_staff', label: 'Support Staff' }
];

export default function AddParticipantModal({ isOpen, onClose, teamId, onSuccess }) {
  const toast = useToast();
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // Selection & Form State
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [role, setRole] = useState('athlete');
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Execute Search
  useEffect(() => {
    if (debouncedTerm.length < 3) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await TeamPortalAPI.searchAccreditationsForRoster(teamId, debouncedTerm);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError("No participants found matching your search.");
        }
      } catch (err) {
        console.error(err);
        setSearchError(err.message || "Failed to search participants.");
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedTerm, teamId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAcc) return;

    try {
      setIsSubmitting(true);
      await TeamPortalAPI.addTeamParticipant(
        teamId, 
        selectedAcc.id, 
        role, 
        jerseyNumber.trim() || null, 
        position.trim() || null
      );
      toast.success("Participant added to roster successfully!");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to add participant to roster.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAcc(null);
    setSearchTerm("");
    setSearchResults([]);
    setRole('athlete');
    setJerseyNumber("");
    setPosition("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Participant to Roster" size="lg">
      {!selectedAcc ? (
        <div className="p-6">
          <p className="text-muted text-sm mb-6">
            Search for an existing accreditation to map to your team. You can search by name, accreditation number, badge number, or email.
          </p>

          <div className="relative mb-6">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              placeholder="Type at least 3 characters..."
              className="w-full pl-10 pr-4 py-3 bg-base border border-border rounded-xl focus:outline-none focus:border-primary-500 transition-colors text-main"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-main"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="min-h-[200px] border border-border bg-base-alt/20 rounded-xl overflow-hidden">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary-500" />
                <p className="text-sm">Searching...</p>
              </div>
            ) : searchError ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted">
                <AlertCircle className="w-6 h-6 mb-2 text-orange-500" />
                <p className="text-sm">{searchError}</p>
              </div>
            ) : searchTerm.length > 0 && searchTerm.length < 3 ? (
              <div className="flex items-center justify-center h-[200px] text-muted text-sm">
                Type at least 3 characters to search
              </div>
            ) : searchResults.length > 0 ? (
              <ul className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {searchResults.map((acc) => (
                  <li 
                    key={acc.id} 
                    className="p-4 hover:bg-primary-500/5 cursor-pointer transition-colors flex items-center justify-between group"
                    onClick={() => setSelectedAcc(acc)}
                  >
                    <div className="flex items-center gap-4">
                      {acc.photo_url ? (
                        <StorageImage src={acc.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-base border border-border flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-muted" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-main">
                          {acc.first_name} {acc.last_name}
                        </p>
                        <p className="text-sm text-muted">
                          {acc.role} • {acc.club}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-muted bg-base border border-border px-2 py-1 rounded">
                        {acc.accreditation_id}
                      </p>
                      <span className="text-sm font-medium text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1 inline-block">
                        Select →
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted">
                <Search className="w-8 h-8 mb-3 opacity-20" />
                <p className="text-sm">Search results will appear here</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            
            <div className="flex items-center justify-between p-4 bg-primary-500/5 border border-primary-500/20 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary-500"></div>
              <div className="flex items-center gap-4">
                {selectedAcc.photo_url ? (
                  <StorageImage src={selectedAcc.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-base shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-base border border-border flex items-center justify-center shadow-sm">
                    <User className="w-6 h-6 text-muted" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-primary-500 font-medium mb-0.5">Selected Participant</p>
                  <p className="font-bold text-lg text-main leading-tight">{selectedAcc.first_name} {selectedAcc.last_name}</p>
                  <p className="text-sm text-muted mt-0.5">{selectedAcc.accreditation_id} • {selectedAcc.role}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleReset}
                className="text-sm text-muted hover:text-main underline px-2 py-1"
              >
                Change
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-main mb-1.5">Roster Role <span className="text-red-500">*</span></label>
                <Select 
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  options={ROSTER_ROLES}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-main mb-1.5">Jersey Number <span className="text-muted font-normal">(Optional)</span></label>
                  <Input 
                    value={jerseyNumber}
                    onChange={e => setJerseyNumber(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-main mb-1.5">Position <span className="text-muted font-normal">(Optional)</span></label>
                  <Input 
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    placeholder="e.g. Forward"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-border flex justify-end gap-3 bg-base-alt/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} icon={Check}>
              Confirm & Add to Roster
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
