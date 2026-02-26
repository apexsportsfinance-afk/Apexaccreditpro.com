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
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { UsersAPI } from "../../lib/storage";
import { formatDate } from "../../lib/utils";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "event_admin", label: "Event Admin" },
  { value: "viewer", label: "Viewer" }
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "event_admin"
  });
  const { user: currentUser, isSuperAdmin } = useAuth();
  const toast = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await UsersAPI.getAll();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "event_admin"
    });
    setEditingUser(null);
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role
      });
    } else {
      resetForm();
    }
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

    setSaving(true);
    try {
      if (editingUser) {
        const updates = {
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        await UsersAPI.update(editingUser.id, updates);
        toast.success("User updated successfully");
      } else {
        await UsersAPI.create(formData);
        toast.success("User created successfully");
      }

      handleCloseModal();
      await loadUsers();
    } catch (error) {
      console.error("User save error:", error);
      toast.error(error.message || "Failed to save user");
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
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
            <span className="text-lg font-bold text-white">
              {row.name?.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <p className="text-lg text-slate-500">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          {getRoleIcon(row.role)}
          {getRoleBadge(row.role)}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (row) => (
        <span className="text-lg text-slate-400">
          {formatDate(row.createdAt)}
        </span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-slate-400" />
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
          <h1 className="text-3xl font-bold text-white mb-2">Users</h1>
          <p className="text-lg text-slate-400 font-extralight">
            Manage system users and permissions
          </p>
        </div>
        <Button icon={Plus} onClick={() => handleOpenModal()}>
          Add User
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
          <p className="text-lg text-slate-400">Loading users...</p>
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
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="John Doe"
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="john@example.com"
            required
            disabled={!!editingUser}
          />

          <Input
            label={editingUser ? "New Password (leave blank to keep)" : "Password"}
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            placeholder="Enter password"
            required={!editingUser}
          />

          <Select
            label="Role"
            value={formData.role}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, role: e.target.value }))
            }
            options={ROLES}
          />

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
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Permanently delete this user?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                This will remove <span className="text-white font-medium">{deleteModal.user?.name}</span> ({deleteModal.user?.email}) from the system entirely. This action cannot be undone.
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
