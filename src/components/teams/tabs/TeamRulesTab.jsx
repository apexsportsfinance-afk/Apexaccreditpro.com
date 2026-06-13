import React, { useState, useEffect, useRef } from "react";
import { ShieldAlert, Plus, Trash2, Eye, EyeOff, FileText, Upload, CheckCircle2, XCircle, X } from "lucide-react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import EmptyState from "../../ui/EmptyState";
import { useToast } from "../../ui/Toast";
import { TeamAPI } from "../../../services/teamApi";
import { uploadToStorage } from "../../../lib/uploadToStorage";
import { formatDate } from "../../../lib/utils";

const CATEGORIES = [
  { value: "general", label: "General Rules" },
  { value: "sport_specific", label: "Sport-Specific Rules" },
  { value: "code_of_conduct", label: "Code of Conduct" },
  { value: "eligibility", label: "Eligibility Rules" },
  { value: "venue", label: "Venue Rules" },
  { value: "deadlines", label: "Important Deadlines" },
  { value: "notice", label: "General Notice" },
];

const CATEGORY_LABELS = CATEGORIES.reduce((acc, c) => ({ ...acc, [c.value]: c.label }), {});

const EMPTY_FORM = { title: "", category: "general", description: "", sort_order: 0 };

export default function TeamRulesTab({ teamId, eventId }) {
  const [documents, setDocuments] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (eventId && teamId) load();
  }, [eventId, teamId]);

  const load = async () => {
    try {
      setLoading(true);
      const [docs, acks] = await Promise.all([
        TeamAPI.getEventRulesDocuments(eventId),
        TeamAPI.getTeamRulesAcknowledgements(teamId),
      ]);
      setDocuments(docs);
      setAcknowledgements(acks);
    } catch (err) {
      console.error(err);
      setError("Failed to load rules & regulations.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFile(null);
    setShowForm(false);
  };

  const handlePublish = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title for this document.");
      return;
    }

    setSaving(true);
    try {
      let fileUrl = null;
      if (file) {
        const safeFolder = `event-rules/${eventId}`;
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { url } = await uploadToStorage(file, safeFolder, safeFileName);
        fileUrl = url;
      }

      const created = await TeamAPI.createRulesDocument(eventId, {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        file_url: fileUrl,
        is_active: true,
      });

      setDocuments((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast.success("Rules document published");
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish document");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (doc) => {
    try {
      const updated = await TeamAPI.updateRulesDocument(doc.id, { is_active: !doc.is_active });
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
      toast.success(updated.is_active ? "Document published" : "Document hidden from teams");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update document");
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this rules document? This cannot be undone.")) return;
    try {
      await TeamAPI.deleteRulesDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) {
      setFile(null);
      return;
    }
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const extension = selected.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      toast.error(`Invalid file type (.${extension}). Only PDF, JPG, PNG, and WEBP are allowed.`);
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const getAckForDoc = (docId) => acknowledgements.find((a) => a.document_id === docId);

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading rules & regulations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading rules & regulations</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-main">Rules & Regulations</h2>
          <p className="text-sm text-muted">Publish event rules and track this team's acknowledgements.</p>
        </div>
        <Button icon={showForm ? X : Plus} variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Publish Document"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title"
              placeholder="e.g. General Event Rules"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              options={CATEGORIES}
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-main mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="Summary that will be shown to teams (optional)"
              className="w-full px-4 py-2.5 rounded-lg border text-lg bg-base border-border text-main focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => update("sort_order", e.target.value)}
            />
            <div>
              <label className="block text-lg font-medium text-main mb-2">Attach File (optional)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                  file ? "border-primary-500 bg-primary-500/5" : "border-border hover:border-primary-500/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                />
                {file ? (
                  <span className="text-sm text-main break-all">{file.name}</span>
                ) : (
                  <span className="text-sm text-muted flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" /> Click to attach PDF / image
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-border">
            <Button onClick={handlePublish} loading={saving} icon={Plus}>
              Publish to All Teams
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {documents.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No Rules Published Yet"
            description="Publish general rules, sport-specific rules, code of conduct, and other notices for all teams in this event."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-base-alt/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Document</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Category</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">This Team Acknowledged</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {documents.map((doc) => {
                  const ack = getAckForDoc(doc.id);
                  return (
                    <tr key={doc.id} className="hover:bg-base-alt/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-main block">{doc.title}</span>
                            {doc.description && (
                              <span className="text-xs text-muted block mt-1 max-w-md">{doc.description}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="muted">{CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={doc.is_active ? "success" : "muted"}>
                          {doc.is_active ? "Published" : "Hidden"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {ack ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <div className="text-xs">
                              <div className="text-main font-medium">
                                {ack.profile?.full_name || ack.profile?.email || "Team member"}
                              </div>
                              <div className="text-muted">{formatDate(ack.acknowledged_at, "MMM dd, yyyy HH:mm")}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">Not yet acknowledged</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-muted hover:text-blue-400 bg-base border border-border rounded-lg transition-colors"
                              title="View Document"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleToggleActive(doc)}
                            className="p-2 text-muted hover:text-amber-400 bg-base border border-border rounded-lg transition-colors"
                            title={doc.is_active ? "Hide from teams" : "Publish to teams"}
                          >
                            {doc.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-muted hover:text-red-400 hover:bg-red-400/10 bg-base border border-border rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
