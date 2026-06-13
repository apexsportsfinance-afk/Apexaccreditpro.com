import React, { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import EmptyState from "../../ui/EmptyState";
import { useToast } from "../../ui/Toast";
import { TeamAPI } from "../../../services/teamApi";
import AssignUserModal from "../AssignUserModal";
import { formatDate } from "../../../lib/utils";

export default function TeamUsersTab({ teamId, isAdmin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (teamId) {
      loadUsers();
    }
  }, [teamId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await TeamAPI.getTeamUsers(teamId);
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load team users.");
      toast.error("Failed to load team users");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this user from the team?")) return;
    try {
      await TeamAPI.removeTeamUser(teamId, userId);
      toast.success("User removed successfully");
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove user");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await TeamAPI.updateTeamUserRole(teamId, userId, newRole);
      toast.success("Role updated successfully");
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update role");
    }
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': return <Badge variant="danger">Admin</Badge>;
      case 'manager': return <Badge variant="warning">Manager</Badge>;
      case 'coach': return <Badge variant="success">Coach</Badge>;
      case 'viewer': return <Badge variant="muted">Viewer</Badge>;
      default: return <Badge>{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading team users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading users</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-main">Team Users & Roles</h2>
          <p className="text-sm text-muted">Manage administrators, managers, and coaches assigned to this team.</p>
        </div>
        
        {isAdmin && (
          <Button icon={UserPlus} onClick={() => setIsAssignModalOpen(true)}>
            Assign User
          </Button>
        )}
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Users Assigned"
            description="There are no users assigned to this team yet."
            action={isAdmin && (
              <Button onClick={() => setIsAssignModalOpen(true)} icon={UserPlus}>
                Assign First User
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-base-alt/30 border-b border-border">
                  <th className="px-6 py-4 font-medium text-muted">User Name</th>
                  <th className="px-6 py-4 font-medium text-muted">Email</th>
                  <th className="px-6 py-4 font-medium text-muted">Role</th>
                  <th className="px-6 py-4 font-medium text-muted">Added Date</th>
                  {isAdmin && <th className="px-6 py-4 font-medium text-muted text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((item) => (
                  <tr key={item.id} className="hover:bg-base-alt/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 font-bold shrink-0">
                          {item.profiles?.full_name?.[0] || item.profiles?.email?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-main">
                          {item.profiles?.full_name || "Unknown User"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted">
                      {item.profiles?.email}
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <select
                          value={item.role}
                          onChange={(e) => handleRoleChange(item.profiles.id, e.target.value)}
                          className="bg-base-alt border border-border rounded-lg px-2 py-1 text-xs font-medium text-main outline-none focus:border-primary-500 transition-all"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="coach">Coach</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        getRoleBadge(item.role)
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {formatDate(item.created_at)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemoveUser(item.profiles.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Remove User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AssignUserModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        teamId={teamId}
        onAssigned={loadUsers}
      />
    </div>
  );
}
