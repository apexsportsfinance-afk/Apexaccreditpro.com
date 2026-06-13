import React, { useState } from "react";
import { UserPlus, Mail, ShieldAlert } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { TeamAPI } from "../../services/teamApi";

export default function AssignUserModal({ isOpen, onClose, onAssigned, teamId }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsSearching(true);
    setSearchError("");
    setFoundUser(null);

    try {
      const profile = await TeamAPI.searchProfilesByEmail(email);
      if (profile) {
        setFoundUser(profile);
      } else {
        setSearchError("No user found with this email address.");
      }
    } catch (err) {
      console.error(err);
      setSearchError("Error searching for user.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!foundUser || !teamId) return;

    setIsAssigning(true);
    try {
      await TeamAPI.assignTeamUser(teamId, foundUser.id, role);
      onAssigned();
      onClose();
      // Reset
      setEmail("");
      setRole("manager");
      setFoundUser(null);
    } catch (err) {
      console.error(err);
      if (err.code === "23505") {
        setSearchError("This user is already assigned to this team.");
      } else {
        setSearchError(err.message || "Failed to assign user.");
      }
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Team User" size="md">
      <div className="space-y-6">
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Search User by Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFoundUser(null);
                setSearchError("");
              }}
              placeholder="e.g. coach@example.com"
              icon={Mail}
              required
            />
          </div>
          <Button type="submit" variant="secondary" loading={isSearching} className="mb-0.5">
            Search
          </Button>
        </form>

        {searchError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <p>{searchError}</p>
          </div>
        )}

        {foundUser && (
          <div className="border border-border rounded-xl p-4 bg-base-alt/50 space-y-4">
            <div>
              <p className="text-sm font-medium text-muted">Found User</p>
              <p className="text-main font-semibold text-lg mt-1">
                {foundUser.full_name || "Unknown Name"}
              </p>
              <p className="text-sm text-muted">{foundUser.email}</p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-sm font-medium text-main">Select Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
              >
                <option value="admin">Team Admin (Full Access)</option>
                <option value="manager">Team Manager (Roster/Entry Access)</option>
                <option value="coach">Coach (Read-only + Messages)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <Button 
              className="w-full" 
              icon={UserPlus} 
              onClick={handleAssign}
              loading={isAssigning}
            >
              Assign User to Team
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
