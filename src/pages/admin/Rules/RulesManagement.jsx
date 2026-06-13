import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Plus, Trash2, Eye, EyeOff, Pencil, FileText, Upload, Users, X } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { TeamAPI } from "../../../services/teamApi";
import { EventsAPI } from "../../../lib/storage";
import { uploadToStorage } from "../../../lib/uploadToStorage";

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

const EMPTY_FORM = { title: "", category: "general", description: "", sort_order: 0, target_team_ids: [] };

export default function RulesManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isAdmin = user?.role === 'super_admin' || user?.role === 'event_admin';

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [teams, setTeams] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isAdmin) loadEvents();
    else setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (selectedEventId) loadEventData(selectedEventId);
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const data = await EventsAPI.getAllMinimal();
      setEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load events");
      setLoading(false);
    }
  };

  const loadEventData = async (eventId) => {
    try {
      setLoading(true);
      setError(null);
      const [teamsData, docsData, acksData] = await Promise.all([
        TeamAPI.getTeamsByEvent(eventId),
        TeamAPI.getEventRulesDocuments(eventId),
        TeamAPI.getEventAcknowledgements(eventId),
      ]);
      setTeams(teamsData || []);
      setDocuments(docsData || []);
      setAcknowledgements(acksData || []);
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
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setForm({
      title: doc.title,
      category: doc.category || "general",
      description: doc.description || "",
      sort_order: doc.sort_order ?? 0,
      target_team_ids: doc.target_team_ids || [],
    });
    setFile(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title for this document.");
      return;
    }

    setSaving(true);
    try {
      let fileUrl = editingId ? (documents.find((d) => d.id === editingId)?.file_url || null) : null;
      if (file) {
        const safeFolder = `event-rules/${selectedEventId}`;
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { url } = await uploadToStorage(file, safeFolder, safeFileName);
        fileUrl = url;
      }

      const payload = {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        file_url: fileUrl,
        target_team_ids: form.target_team_ids.length > 0 ? form.target_team_ids : null,
      };

      if (editingId) {
        const updated = await TeamAPI.updateRulesDocument(editingId, payload);
        setDocuments((prev) => prev.map((d) => (d.id === editingId ? updated : d)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        toast.success("Document updated");
      } else {
        const created = await TeamAPI.createRulesDocument(selectedEventId, { ...payload, is_active: true });
        setDocuments((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        toast.success("Rules document published");
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (doc) => {
    try {
      const updated = await TeamAPI.updateRulesDocument(doc.id, { is_active: !doc.is_active });
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
      toast.success(updated.is_active ? "Document published to teams" : "Document hidden from teams");
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

  const getTargetLabel = (doc) => {
    if (!doc.target_team_ids || doc.target_team_ids.length === 0) return "All Teams";
    return `${doc.target_team_ids.length} team${doc.target_team_ids.length === 1 ? "" : "s"}`;
  };

  const getAckProgress = (doc) => {
    const targetIds = (doc.target_team_ids && doc.target_team_ids.length > 0)
      ? doc.target_team_ids
      : teams.map((t) => t.id);
    const ackTeamIds = new Set(acknowledgements.filter((a) => a.document_id === doc.id).map((a) => a.team_id));
    const acked = targetIds.filter((id) => ackTeamIds.has(id)).length;
    return { acked, total: targetIds.length };
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-main mb-2">Access Denied</h1>
        <p className="text-muted">You do not have permission to view this page.</p>
        <Button onClick={() => navigate('/')} className="mt-6">Return Home</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-main">Rules & Regulations</h1>
          <p className="text-sm text-muted">
            Publish documents once and choose which teams in the event should receive them. Teams see published
            documents in their portal and must acknowledge them.
          </p>
        </div>
        <div className="w-full md:w-72">
          <Select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
            placeholder={events.length === 0 ? "No events found" : "Select an event"}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
          <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted">Loading rules & regulations...</p>
        </div>
      ) : error ? (
        <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-main font-medium">Error loading rules & regulations</p>
          <p className="text-muted text-sm">{error}</p>
        </div>
      ) : !selectedEventId ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="No Event Selected"
            description="Create an event first, then come back here to publish rules & regulations."
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Button icon={showForm ? X : Plus} variant={showForm ? "outline" : "primary"} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
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
                    ) : editingId && documents.find((d) => d.id === editingId)?.file_url ? (
                      <span className="text-sm text-muted">Keep existing file (click to replace)</span>
                    ) : (
                      <span className="text-sm text-muted flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4" /> Click to attach PDF / image
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <label className="block text-lg font-medium text-main mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Target Teams
                </label>
                <label className="flex items-center gap-2 text-sm text-main cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.target_team_ids.length === 0}
                    onChange={(e) => update("target_team_ids", e.target.checked ? [] : teams.map((t) => t.id))}
                  />
                  All teams in this event ({teams.length})
                </label>
                {form.target_team_ids.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 bg-base-alt/50 rounded-lg border border-border mt-2">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2 text-sm text-main cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.target_team_ids.includes(team.id)}
                          onChange={(e) => {
                            if (e.target.checked) update("target_team_ids", [...form.target_team_ids, team.id]);
                            else update("target_team_ids", form.target_team_ids.filter((id) => id !== team.id));
                          }}
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button onClick={handleSave} loading={saving} icon={editingId ? Pencil : Plus}>
                  {editingId ? "Save Changes" : "Publish Document"}
                </Button>
              </div>
            </Card>
          )}

          <Card>
            {documents.length === 0 ? (
              <EmptyState
                icon={ShieldAlert}
                title="No Rules Published Yet"
                description="Publish general rules, sport-specific rules, code of conduct, and other notices for teams in this event."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-base-alt/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Document</th>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Category</th>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Status</th>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Target</th>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Acknowledged</th>
                      <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {documents.map((doc) => {
                      const progress = getAckProgress(doc);
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
                            <Badge variant="info">{getTargetLabel(doc)}</Badge>
                          </td>
                          <td className="px-6 py-4 text-main">
                            {progress.acked} / {progress.total} teams
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
                                onClick={() => handleEdit(doc)}
                                className="p-2 text-muted hover:text-primary-500 bg-base border border-border rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
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
        </>
      )}
    </div>
  );
}
