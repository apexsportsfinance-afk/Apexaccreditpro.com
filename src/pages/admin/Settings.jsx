import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Settings as SettingsIcon, Save, Shield, Bell, Database, Info, Mail, Send, Eye, EyeOff, CheckCircle, XCircle, Loader2, RefreshCw, Server, FileText, RotateCcw } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { uploadToStorage } from "../../lib/uploadToStorage";

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
  const [activeTab, setActiveTab] = useState("smtp");

  const [showPassword, setShowPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [smtpStatus, setSmtpStatus] = useState("unknown");
  const [lastTestResult, setLastTestResult] = useState(null);

  const [templateTab, setTemplateTab] = useState("approved");
  const [templates, setTemplates] = useState({
    approved: { subject: "", body: "" },
    rejected: { subject: "", body: "" },
    custom: { subject: "", body: "" },
    ticket_delivery: { subject: "", body: "" }
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const smtpConfig = {
    host: "mail.apexsports.ae",
    port: "465",
    encryption: "SSL/TLS",
    username: "accreditations@apexsports.ae",
    fromName: "Apex Sports Accreditations",
    fromEmail: "accreditations@apexsports.ae"
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*");
      if (error) throw error;
      const mapped = {};
      (data || []).forEach((t) => {
        mapped[t.template_type] = { subject: t.subject || "", body: t.body || "" };
      });
      setTemplates((prev) => ({ ...prev, ...mapped }));
    } catch (err) {
      console.error("Failed to load email templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");

  const handleMigrateImages = async () => {
    setMigrating(true);
    try {
      setMigrationStatus("Fetching IDs...");
      const { data: accs, error } = await supabase.from('accreditations').select('id');
      if (error) throw error;
      
      let updated = 0;
      for (const { id } of accs) {
        setMigrationStatus(`Checking ${id.substring(0,8)}...`);
        const { data: row } = await supabase.from('accreditations').select('photo_url, id_document_url').eq('id', id).single();
        if (!row) continue;
        
        let updates = {};
        
        const processBase64 = async (base64Str, type) => {
          if (!base64Str || !base64Str.startsWith('data:')) return null;
          const mimeMatches = base64Str.match(/^data:([A-Za-z-+/]+);base64,/);
          if (!mimeMatches) return null;
          const mimeType = mimeMatches[1];
          const ext = mimeType.split('/')[1] || 'jpg';
          const filename = `${type}-${id}.${ext}`;
          
          try {
            const res = await fetch(base64Str);
            const blob = await res.blob();
            const file = new File([blob], filename, { type: mimeType });
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append('id', id);
            
            const result = await uploadToStorage(file, type === "photo" ? "registrations" : "documents");
            return result.url;
          } catch(e) {
            console.error(e);
            return null;
          }
        };

        const newPhotoUrl = await processBase64(row.photo_url, 'photo');
        if (newPhotoUrl) updates.photo_url = newPhotoUrl;
        
        const newIdDocUrl = await processBase64(row.id_document_url, 'iddoc');
        if (newIdDocUrl) updates.id_document_url = newIdDocUrl;
        
        if (Object.keys(updates).length > 0) {
           setMigrationStatus(`Updating ${id.substring(0,8)}...`);
           const { error: updateError } = await supabase.from('accreditations').update(updates).eq('id', id);
           if (!updateError) updated++;
        }
      }
      setMigrationStatus(`Done! Migrated ${updated} records.`);
      toast.success(`Successfully migrated ${updated} records.`);
    } catch (err) {
      console.error(err);
      toast.error("Migration failed");
      setMigrationStatus("Failed");
    } finally {
      setMigrating(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const current = templates[templateTab];
      const { error } = await supabase
        .from("email_templates")
        .upsert({
          template_type: templateTab,
          subject: current.subject,
          body: current.body,
          updated_at: new Date().toISOString()
        }, { onConflict: "template_type" });
      if (error) throw error;
      toast.success(`${templateTab.charAt(0).toUpperCase() + templateTab.slice(1)} email template saved!`);
    } catch (err) {
      console.error("Save template error:", err);
      toast.error("Failed to save template: " + (err.message || "Unknown error"));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = () => {
    const defaults = {
      approved: {
        subject: "Your Accreditation - Dubai International Aquatics Championships (DIAC) 2026",
        body: "Dear {name},\n\nWe are delighted to welcome you to the Dubai International Aquatics Championships (DIAC) 2026.\n\nAttached you will find your accreditation pass. Kindly review your accreditation carefully and ensure that all details are correct, including:\n\n- Name\n- Age\n- Country\n- Club / Team Name\n\nEvent: {eventName}\nRole: {role}\nBadge Number: {badge}\nZone Access: {zones}\n\nIf you notice any errors or require any changes, please reply to this same email only with the corrected information so that we can update it accordingly.\n\nPlease note that the deadline to request any corrections is within 24 hours of receiving this email.\n\nYour accreditation pass must be presented at the main gate of Hamdan Sports Complex to gain access to the competition venue.\n\nWe truly appreciate your support and cooperation, and we look forward to welcoming you to DIAC 2026.\n\nWarm regards,\nDIAC 2026 Organizing Committee"
      },
      rejected: {
        subject: "Accreditation Rejected - {eventName}",
        body: "Dear {name},\n\nWe regret to inform you that your accreditation request for {eventName} as {role} has been rejected.\n\nIf you have any questions or believe this was in error, please contact the event organizers.\n\nBest regards,\nApex Sports Accreditations"
      },
      custom: {
        subject: "Your Accreditation - {eventName}",
        body: "Dear {name},\n\nPlease find your accreditation details attached.\n\nEvent: {eventName}\nRole: {role}\nBadge: {badge}\n\nPlease present this at the venue for badge collection.\n\nBest regards,\nApex Sports Accreditations"
      },
      ticket_delivery: {
        subject: "Booking Confirmation - {eventName}",
        body: "Dear {name},\n\nThank you for booking your ticket(s) with us. We are thrilled to welcome you to {eventName}!\n\nAttached to this email, you will find your official e-ticket(s). Please review your booking details carefully:\n\nEvent: {eventName}\nTotal Tickets: {ticketCount} Person(s)\nAmount Paid: {amountPaid} AED\nPayment Method: {paymentMethod}\nReference ID: {qrCodeId}\n\nPlease keep this email safe and present the attached QR code at the event entrance for scanning. To ensure a smooth entry, please have your ID ready as it may be required for verification.\n\nIf you have any questions or require any assistance, simply reply directly to this email.\n\nWe hope you thoroughly enjoy the event!\n\nWarm regards,\nThe Apex Sports Team"
      }
    };
    setTemplates((prev) => ({ ...prev, [templateTab]: defaults[templateTab] }));
    toast.success("Template reset to default (save to apply)");
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

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings Navigation Sidebar */}
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-2 sticky top-6">
            {[
              { id: "smtp", label: "SMTP Email Config", icon: Mail, color: "violet" },
              { id: "templates", label: "Email Templates", icon: FileText, color: "emerald" },
              { id: "profile", label: "Profile Setting", icon: Shield, color: "primary" },
              { id: "system", label: "System Information", icon: Info, color: "cyan" },
              { id: "notifications", label: "Notifications Settings", icon: Bell, color: "amber" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-lg font-medium transition-all mb-1 last:mb-0 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-500/10 text-${tab.color}-400 border border-${tab.color}-500/20`
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? `text-${tab.color}-400` : "text-slate-500"}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === "smtp" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
            </motion.div>
          )}

          {activeTab === "templates" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Email Templates</h2>
                <p className="text-lg text-slate-400 font-extralight">
                  Customize the email body sent on approval, rejection, or compose
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "approved", label: "Approval Email", color: "emerald" },
                { key: "rejected", label: "Rejection Email", color: "red" },
                { key: "custom", label: "Compose Default", color: "cyan" },
                { key: "ticket_delivery", label: "Ticket Delivery", color: "amber" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTemplateTab(tab.key)}
                  className={`px-4 py-2.5 mb-2 rounded-lg text-lg font-medium transition-all ${
                    templateTab === tab.key
                      ? tab.color === "emerald"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : tab.color === "red"
                        ? "bg-red-500/20 text-red-300 border border-red-500/40"
                        : tab.color === "cyan"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : (
              <>
                <Input
                  label="Email Subject"
                  value={templates[templateTab]?.subject || ""}
                  onChange={(e) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [templateTab]: { ...prev[templateTab], subject: e.target.value }
                    }))
                  }
                  placeholder="Email subject line with {eventName} placeholder"
                />

                <div className="space-y-1.5">
                  <label className="block text-lg font-medium text-slate-300">
                    Email Body
                  </label>
                  <textarea
                    value={templates[templateTab]?.body || ""}
                    onChange={(e) =>
                      setTemplates((prev) => ({
                        ...prev,
                        [templateTab]: { ...prev[templateTab], body: e.target.value }
                      }))
                    }
                    rows={10}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg font-extralight"
                    placeholder="Write your email template here..."
                  />
                </div>

                <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <p className="text-lg text-slate-300 font-medium mb-2">Available Placeholders:</p>
                  <div className="flex flex-wrap gap-2">
                    {["{name}", "{firstName}", "{lastName}", "{eventName}", "{role}", "{badge}", "{zones}", "{email}", "{ticketCount}", "{amountPaid}", "{paymentMethod}", "{qrCodeId}"].map((ph) => (
                      <span
                        key={ph}
                        className="px-3 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-lg text-violet-300 font-mono cursor-pointer hover:bg-violet-500/20 transition-colors"
                        onClick={() => {
                          const el = document.querySelector("textarea");
                          if (el) {
                            const start = el.selectionStart;
                            const end = el.selectionEnd;
                            const currentBody = templates[templateTab]?.body || "";
                            const updated = currentBody.substring(0, start) + ph + currentBody.substring(end);
                            setTemplates((prev) => ({
                              ...prev,
                              [templateTab]: { ...prev[templateTab], body: updated }
                            }));
                          }
                        }}
                      >
                        {ph}
                      </span>
                    ))}
                  </div>
                  <p className="text-lg text-slate-500 font-extralight mt-2">
                    Click a placeholder to insert it. These are replaced with actual values when the email is sent.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    icon={RotateCcw}
                    onClick={handleResetTemplate}
                  >
                    Reset to Default
                  </Button>
                  <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleSaveTemplate}
                    loading={savingTemplate}
                    className="flex-1"
                  >
                    {savingTemplate ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
            </motion.div>
          )}

          {activeTab === "system" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
              
              <div className="pt-4 mt-2 border-t border-slate-700/50 flex flex-col gap-2">
                <Button 
                  onClick={handleMigrateImages} 
                  loading={migrating} 
                  variant="secondary" 
                  icon={Database}
                  className="w-full text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                >
                  {migrating ? "Migrating DB Images..." : "Migrate Database Images to Supabase Storage"}
                </Button>
                {migrationStatus && (
                  <p className="text-center text-sm text-slate-400 mt-1">{migrationStatus}</p>
                )}
              </div>
            </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
