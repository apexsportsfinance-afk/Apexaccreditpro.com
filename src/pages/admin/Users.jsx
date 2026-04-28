import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Users as UsersIcon, Shield, Calendar, Eye, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import MultiSearchableSelect from "../../components/ui/MultiSearchableSelect";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { UsersAPI, EventsAPI } from "../../lib/storage";
import { formatDate } from "../../lib/utils";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "event_admin", label: "Event Admin" },
  { value: "viewer", label: "Viewer" }
];

const MODULES = [
  { value: "/admin/dashboard", label: "Dashboard" },
  { value: "/admin/events", label: "Events" },
  { value: "/admin/ticketing", label: "Spectator Portal" },
  { value: "/admin/accreditations", label: "Accreditations" },
  { value: "/admin/zones", label: "Zones" },
  { value: "/admin/qr-system", label: "QR System" },
  { value: "/admin/broadcasts", label: "Broadcast History" },
  { value: "/admin/medals", label: "Medal Rankings" },
  { value: "/admin/feedback", label: "Feedback" },
  { value: "/admin/users", label: "Users" },
  { value: "/admin/audit", label: "Audit Log" },
  { value: "/admin/settings", label: "Settings" }
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "event_admin",
    eventIds: [],
    modulePaths: []
  });
  const [allEvents, setAllEvents] = useState([]);
  const [accessMappings, setAccessMappings] = useState({});
  const [moduleMappings, setModuleMappings] = useState({});
  const { user: currentUser, isSuperAdmin } = useAuth();
  const toast = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [userData, eventData, mappingData, moduleData] = await Promise.all([
        UsersAPI.getAll(),
        EventsAPI.getAll(),
        UsersAPI.getAccessMappings(),
        UsersAPI.getModuleAccessMappings()
      ]);
      setUsers(userData);
      setAllEvents(eventData);
      setAccessMappings(mappingData);
      setModuleMappings(moduleData);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "event_admin",
      eventIds: [],
      modulePaths: []
    });
    setEditingUser(null);
    setIsChangingPassword(false);
    setConfirmPassword("");
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
        eventIds: accessMappings[user.id] || [],
        modulePaths: moduleMappings[user.id] || []
      });
    } else {
      resetForm();
    }
    setIsChangingPassword(false);
    setConfirmPassword("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    if (editingUser && isChangingPassword) {
      if (!formData.password) {
        toast.error("Please enter a new password");
        return;
      }
      if (formData.password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updates = {
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        if (isChangingPassword && formData.password) {
          updates.password = formData.password;
        }
        await UsersAPI.update(editingUser.id, updates);
        
        // Update module access
        await UsersAPI.updateModuleAccessMapping(editingUser.id, formData.modulePaths);
        
        // Update event access mapping
        await UsersAPI.updateAccessMapping(editingUser.id, formData.eventIds);
        
        toast.success("User updated successfully");
      } else {
        const newUser = await UsersAPI.create(formData);
        
        // Save event assignments for new user
        if (formData.eventIds.length > 0) {
          await UsersAPI.updateAccessMapping(newUser.id, formData.eventIds);
        }

        // Save module access for new user
        if (formData.modulePaths.length > 0) {
          await UsersAPI.updateModuleAccessMapping(newUser.id, formData.modulePaths);
        }
        
        toast.success("User created successfully");
      }

      handleCloseModal();
      await loadUsers();
    } catch (error) {
      console.error("User save error:", error);
      if (error.message.includes("failed") || error.message.includes("504")) {
        toast.error("User creation failed. Check if the 'manage-users' Edge Function is deployed and running.");
      } else {
        toast.error(error.message || "Failed to save user");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (user) => {
    if (user.id === currentUser.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    setDeleteModal({ open: true, user });
  };

  const confirmDelete = async () => {
    if (!deleteModal.user) return;
    setDeleting(true);
    try {
      await UsersAPI.delete(deleteModal.user.id);
      toast.success("User deleted successfully");
      setDeleteModal({ open: false, user: null });
      await loadUsers();
    } catch (error) {
      console.error("User delete error:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "super_admin":
        return <Shield className="w-4 h-4 text-red-400" />;
      case "event_admin":
        return <Calendar className="w-4 h-4 text-blue-400" />;
      default:
        return <Eye className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "super_admin":
        return <Badge variant="danger">Super Admin</Badge>;
      case "event_admin":
        return <Badge variant="primary">Event Admin</Badge>;
      default:
        return <Badge variant="default">Viewer</Badge>;
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
            <span className="text-lg font-bold text-white">
              {row.name?.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-semibold text-main tracking-wide">{row.name}</p>
            <p className="text-[11px] font-mono text-muted uppercase tracking-widest">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (_, row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {getRoleIcon(row.role)}
            {getRoleBadge(row.role)}
          </div>
          {accessMappings[row.id] && accessMappings[row.id].length > 0 && (
            <span className="text-[10px] text-muted font-medium">
              {accessMappings[row.id].length} Events Assigned
            </span>
          )}
          {row.role !== "super_admin" && moduleMappings[row.id] && (
            <span className="text-[10px] text-primary-400 font-bold bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20 w-fit">
              {moduleMappings[row.id].length} Modules Allocated
            </span>
          )}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Joined",
      sortable: true,
      render: (_, row) => (
        <span className="text-xs font-mono text-muted uppercase tracking-widest">
          {formatDate(row.createdAt)}
        </span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
            className="p-2 rounded-lg hover:bg-base-alt transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-muted hover:text-main" />
          </button>
          {row.id !== currentUser?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDelete(row);
              }}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      )
    }
  ];

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to manage users"
      />
    );
  }

  return (
    <div id="users_page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-main mb-1 uppercase tracking-tight">Access Control</h1>
          <p className="text-sm text-muted font-medium tracking-wide uppercase opacity-70">
            Biometric and Role-Based Identity Management
          </p>
        </div>
        <Button icon={Plus} onClick={() => handleOpenModal()}>
          Add User
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
          <p className="text-lg text-muted">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No Users"
          description="Add users to give them access to the system"
          action={() => handleOpenModal()}
          actionLabel="Add User"
          actionIcon={Plus}
        />
      ) : (
        <DataTable
          data={users}
          columns={columns}
          searchable
          searchFields={["name", "email"]}
        />
      )}

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingUser ? "Edit User" : "Add User"}
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div className="space-y-4 border-l-2 border-primary-500/30 pl-4 py-2">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Step 1: Identity & Role</h4>
            <div className="space-y-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
                required
                disabled={!!editingUser}
              />
              {editingUser ? (
                <div className="space-y-3">
                  {!isChangingPassword ? (
                    <div className="space-y-3">
                      <Input
                        label="Password"
                        value="••••••••••••"
                        disabled
                        className="bg-base/50 text-muted cursor-not-allowed"
                      />
                      <label className="flex items-center gap-2 text-sm font-bold text-main cursor-pointer hover:text-primary transition-colors w-fit">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-border bg-base text-primary-500 focus:ring-primary-500/20"
                          checked={isChangingPassword}
                          onChange={(e) => setIsChangingPassword(e.target.checked)}
                        />
                        Change Password
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 border border-primary-500/20 bg-primary-500/5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black uppercase tracking-widest text-primary-500">Update Password</h5>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsChangingPassword(false);
                            setFormData(prev => ({ ...prev, password: "" }));
                            setConfirmPassword("");
                          }}
                          className="text-[10px] uppercase font-bold text-muted hover:text-red-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      <Input
                        label="New Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter new password"
                        required
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                />
              )}
              <Select
                label="Role"
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                options={ROLES}
              />
            </div>
          </div>

          <div className="space-y-4 border-l-2 border-blue-500/30 pl-4 py-2">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Step 2: Event Allocation</h4>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-main uppercase tracking-widest opacity-60">Select Assigned Events</label>
              <MultiSearchableSelect
                options={allEvents.map(ev => ({ value: ev.id, label: ev.name }))}
                value={formData.eventIds}
                onChange={(vals) => setFormData(prev => ({ ...prev, eventIds: vals }))}
                placeholder="Choose events..."
              />
              <p className="text-[10px] text-muted italic">
                The user will only manage data for the events selected above.
              </p>
            </div>
          </div>

          <div className="space-y-4 border-l-2 border-emerald-500/30 pl-4 py-2">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Step 3: Page & Module Permission</h4>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-main uppercase tracking-widest opacity-60">Grant Sidebar Access</label>
              <div className="grid grid-cols-2 gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                {MODULES.map((mod) => (
                  <label key={mod.value} className="flex items-center gap-2 group cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border bg-base text-emerald-500 focus:ring-emerald-500/20"
                      checked={formData.role === 'super_admin' || formData.modulePaths.includes(mod.value)}
                      onChange={(e) => {
                        if (formData.role === 'super_admin') return;
                        const paths = e.target.checked
                          ? [...formData.modulePaths, mod.value]
                          : formData.modulePaths.filter(p => p !== mod.value);
                        setFormData(prev => ({ ...prev, modulePaths: paths }));
                      }}
                      disabled={formData.role === 'super_admin'}
                    />
                    <span className="text-[11px] font-bold text-muted group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                      {mod.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted italic">
                Toggle exactly which sections of the platform this user can see.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
              {saving ? "Saving..." : editingUser ? "Update User" : "Add User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => !deleting && setDeleteModal({ open: false, user: null })}
        title="Delete User"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">Permanently delete this user?</p>
              <p className="text-lg text-muted font-extralight mt-1">
                This will remove <span className="text-main font-medium">{deleteModal.user?.name}</span> ({deleteModal.user?.email}) from the system entirely. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteModal({ open: false, user: null })}
              className="flex-1"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              className="flex-1"
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
