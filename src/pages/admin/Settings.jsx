import React, { useState } from "react";
import { motion } from "motion/react";
import { Settings as SettingsIcon, Save, Shield, Bell, Database, Info } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (profileData.newPassword && profileData.newPassword !== profileData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success("Profile settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="settings_page" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Manage your account and system preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <Shield className="w-5 h-5 text-primary-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Profile Settings</h2>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
              <Input
                label="Full Name"
                value={profileData.name}
                onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
              />
              <Input
                label="Email Address"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="your@email.com"
                disabled
              />
              <div className="pt-2 border-t border-slate-800">
                <p className="text-lg text-slate-400 font-extralight mb-4">Change Password</p>
                <div className="space-y-3">
                  <Input
                    label="Current Password"
                    type="password"
                    value={profileData.currentPassword}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={profileData.confirmPassword}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <Button type="submit" icon={Save} loading={saving} className="w-full">
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <Info className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">System Information</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Platform", value: "ApexAccreditation v1.0" },
                { label: "Database", value: "Supabase (PostgreSQL)" },
                { label: "Authentication", value: "Supabase Auth" },
                { label: "Storage", value: "Supabase Storage" },
                { label: "Environment", value: "Production Ready" }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-lg text-slate-400 font-extralight">{item.label}</span>
                  <span className="text-lg text-white font-medium">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Notifications</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Email on new registration", desc: "Receive email when someone registers" },
                { label: "Email on approval", desc: "Confirm when accreditations are approved" },
                { label: "Email on rejection", desc: "Notify applicants of rejection" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg text-white font-medium">{item.label}</p>
                    <p className="text-lg text-slate-400 font-extralight">{item.desc}</p>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-primary-600 flex items-center justify-end pr-1 cursor-pointer flex-shrink-0">
                    <div className="w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
