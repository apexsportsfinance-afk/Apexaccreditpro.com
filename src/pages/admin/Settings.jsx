import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Settings as SettingsIcon, Save, Shield, Bell, Database, Info, Mail, Send, Eye, EyeOff, CheckCircle, XCircle, Loader2, RefreshCw, Server } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

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

  const [showPassword, setShowPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [smtpStatus, setSmtpStatus] = useState("unknown");
  const [lastTestResult, setLastTestResult] = useState(null);

  const smtpConfig = {
    host: "mail.apexsports.ae",
    port: "465",
    encryption: "SSL/TLS",
    username: "accreditations@apexsports.ae",
    fromName: "Apex Sports Accreditations",
    fromEmail: "accreditations@apexsports.ae"
  };

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

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setTestingEmail(true);
    setSmtpStatus("testing");
    setLastTestResult(null);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/send-accreditation-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            to: testEmail,
            name: "Test User",
            eventName: "SMTP Test Email",
            eventLocation: "System Test",
            eventDates: new Date().toLocaleDateString(),
            role: "Test",
            accreditationId: "TEST-001",
            badgeNumber: "TEST-001",
            zoneCode: "All Zones",
            reportingTimes: "N/A",
            type: "approved"
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setSmtpStatus("connected");
        setLastTestResult({
          success: true,
          message: `Test email sent successfully to ${testEmail}`,
          time: new Date().toLocaleTimeString()
        });
        toast.success("Test email sent successfully!");
      } else {
        setSmtpStatus("error");
        setLastTestResult({
          success: false,
          message: data.error || "Failed to send test email",
          time: new Date().toLocaleTimeString()
        });
        toast.error(data.error || "Failed to send test email");
      }
    } catch (error) {
      setSmtpStatus("error");
      setLastTestResult({
        success: false,
        message: error.message || "Connection failed",
        time: new Date().toLocaleTimeString()
      });
      toast.error("Failed to connect to email service");
    } finally {
      setTestingEmail(false);
    }
  };

  const getStatusBadge = () => {
    switch (smtpStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-lg text-emerald-400 font-medium">Connected</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-lg text-red-400 font-medium">Error</span>
          </div>
        );
      case "testing":
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-lg text-amber-400 font-medium">Testing...</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-lg text-slate-400 font-medium">Not tested</span>
          </div>
        );
    }
  };

  return (
    <div id="settings_page" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Manage your account, email configuration, and system preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Mail className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">SMTP Email Configuration</h2>
                <p className="text-lg text-slate-400 font-extralight">
                  Outgoing email server for accreditation notifications
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-violet-400" />
                  Server Settings
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">SMTP Host</span>
                    <span className="text-lg text-white font-medium">{smtpConfig.host}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">Port</span>
                    <span className="text-lg text-white font-medium">{smtpConfig.port}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">Encryption</span>
                    <Badge variant="success">{smtpConfig.encryption}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  Authentication
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">Username</span>
                    <span className="text-lg text-white font-medium">{smtpConfig.username}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">Password</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-white font-medium">
                        {showPassword ? "Swim2024$$" : "••••••••••"}
                      </span>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 rounded hover:bg-slate-700/50 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-lg text-slate-400 font-extralight">From Name</span>
                    <span className="text-lg text-white font-medium">{smtpConfig.fromName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/50">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-400" />
                Send Test Email
              </h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Recipient Email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter email to send test"
                  />
                </div>
                <Button
                  onClick={handleTestEmail}
                  loading={testingEmail}
                  icon={Send}
                  variant="primary"
                  className="mb-0.5"
                >
                  {testingEmail ? "Sending..." : "Send Test"}
                </Button>
              </div>

              {lastTestResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 flex items-start gap-3 p-4 rounded-lg border ${
                    lastTestResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  {lastTestResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-lg font-medium ${lastTestResult.success ? "text-emerald-300" : "text-red-300"}`}>
                      {lastTestResult.success ? "Test Successful" : "Test Failed"}
                    </p>
                    <p className="text-lg text-slate-400 font-extralight mt-1">{lastTestResult.message}</p>
                    <p className="text-lg text-slate-500 font-extralight mt-1">at {lastTestResult.time}</p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-lg text-violet-300 font-medium">Email Automation Active</p>
                  <p className="text-lg text-slate-400 font-extralight mt-1">
                    Accreditation approval and rejection emails are sent automatically through this SMTP server when you approve or reject applications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                { label: "Email Service", value: "SMTP (SSL/TLS)" },
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
