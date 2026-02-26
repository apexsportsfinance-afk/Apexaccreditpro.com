import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Bell,
  Palette,
  Database,
  Download,
  Upload,
  Trash2
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Tabs from "../../components/ui/Tabs";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { UsersAPI } from "../../lib/storage";

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileData.name || !profileData.email) {
      toast.error("Please fill in all fields");
      return;
    }
    await UsersAPI.update(user.id, profileData);
    toast.success("Profile updated successfully");
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    await UsersAPI.update(user.id, { password: passwordData.newPassword });
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    toast.success("Password updated successfully");
  };

  const handleExportData = () => {
    const data = {
      events: localStorage.getItem("accredit_events"),
      accreditations: localStorage.getItem("accredit_accreditations"),
      zones: localStorage.getItem("accredit_zones"),
      users: localStorage.getItem("accredit_users"),
      auditLog: localStorage.getItem("accredit_audit_log"),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accreditpro-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      localStorage.clear();
      toast.success("All data cleared. Refreshing...");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const tabs = [
    {
      value: "profile",
      label: "Profile",
      icon: User,
      content: (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold text-white">Profile Settings</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} noValidate className="space-y-4 max-w-md">
              <Input
                label="Full Name"
                value={profileData.name}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                label="Email Address"
                type="email"
                value={profileData.email}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>
      )
    },
    {
      value: "security",
      label: "Security",
      icon: Lock,
      content: (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold text-white">Change Password</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} noValidate className="space-y-4 max-w-md">
              <Input
                label="Current Password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    currentPassword: e.target.value
                  }))
                }
              />
              <Input
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    newPassword: e.target.value
                  }))
                }
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value
                  }))
                }
              />
              <Button type="submit">Update Password</Button>
            </form>
          </CardContent>
        </Card>
      )
    },
    {
      value: "data",
      label: "Data",
      icon: Database,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold text-white">Export Data</h3>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-slate-400 mb-4 font-extralight">
                Download a backup of all your data including events, accreditations, and settings.
              </p>
              <Button icon={Download} onClick={handleExportData}>
                Export All Data
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardHeader>
              <h3 className="text-xl font-semibold text-red-400">Danger Zone</h3>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-slate-400 mb-4 font-extralight">
                Clear all data from the system. This action cannot be undone.
              </p>
              <Button variant="danger" icon={Trash2} onClick={handleClearData}>
                Clear All Data
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
  ];

  return (
    <div id="settings_page" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Manage your account and system preferences
        </p>
      </div>

      <Tabs tabs={tabs} defaultTab="profile" />
    </div>
  );
}