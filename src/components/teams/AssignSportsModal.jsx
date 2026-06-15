import React, { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { TeamAPI } from "../../services/teamApi";

const emptyRow = () => ({ sport_name: "", gender: "" });

export default function AssignSportsModal({ isOpen, onClose, eventId, teams, selectedTeamIds, onAssigned }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [target, setTarget] = useState("all");
  const [pickedTeamIds, setPickedTeamIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setRows([emptyRow()]);
      setPickedTeamIds(selectedTeamIds || []);
      setTarget(selectedTeamIds?.length > 0 ? "selected" : "all");
    }
  }, [isOpen, selectedTeamIds]);

  const updateRow = (index, field, value) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (index) => setRows(prev => prev.filter((_, i) => i !== index));

  const togglePickedTeam = (teamId) => {
    setPickedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleSelectAllTeams = () => {
    setPickedTeamIds(prev => (prev.length === teams.length ? [] : teams.map(t => t.id)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validRows = rows.filter(row => row.sport_name.trim());
    if (validRows.length === 0) return;

    const targetTeamIds = target === "selected" ? pickedTeamIds : teams.map(t => t.id);
    if (targetTeamIds.length === 0) {
      toast.error("Select at least one team.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const row of validRows) {
        await TeamAPI.bulkAssignSport(targetTeamIds, eventId, row.sport_name.trim(), row.gender || null);
      }
      toast.success(`Assigned ${validRows.length} sport(s) to ${targetTeamIds.length} team(s)`);
      onAssigned?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign sports");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Sports to Teams" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-main">Sports & Gender Categories</label>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <Input
                  placeholder="e.g. Football"
                  value={row.sport_name}
                  onChange={(e) => updateRow(i, "sport_name", e.target.value)}
                  className="flex-1"
                />
                <select
                  value={row.gender}
                  onChange={(e) => updateRow(i, "gender", e.target.value)}
                  className="px-3 py-2 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500 transition-colors h-[42px]"
                >
                  <option value="">No Gender</option>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Mixed">Mixed</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="p-2.5 rounded-lg border border-border text-muted hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addRow}>
            Add another sport
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <label className="text-sm font-medium text-main">Apply To</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 px-3 py-2 bg-base border border-border rounded-lg text-sm text-main cursor-pointer flex-1">
              <input
                type="radio"
                name="assign-target"
                value="all"
                checked={target === "all"}
                onChange={() => setTarget("all")}
              />
              All Teams ({teams.length})
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-base border border-border rounded-lg text-sm text-main cursor-pointer flex-1">
              <input
                type="radio"
                name="assign-target"
                value="selected"
                checked={target === "selected"}
                onChange={() => setTarget("selected")}
              />
              Selected Teams Only ({pickedTeamIds.length})
            </label>
          </div>

          {target === "selected" && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-base-alt/50 border-b border-border">
                <span className="text-xs font-medium text-muted">Choose teams</span>
                <button
                  type="button"
                  onClick={toggleSelectAllTeams}
                  className="text-xs font-medium text-primary-500 hover:underline"
                >
                  {pickedTeamIds.length === teams.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-border">
                {teams.map(team => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-main cursor-pointer hover:bg-base-alt/30"
                  >
                    <input
                      type="checkbox"
                      checked={pickedTeamIds.includes(team.id)}
                      onChange={() => togglePickedTeam(team.id)}
                      className="w-4 h-4 accent-primary-500 cursor-pointer"
                    />
                    {team.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!rows.some(r => r.sport_name.trim())}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
