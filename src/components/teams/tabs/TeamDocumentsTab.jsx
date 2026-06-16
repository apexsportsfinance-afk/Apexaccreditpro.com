import React, { useState, useEffect } from "react";
import { FileText, ShieldAlert, Upload, Eye, CheckCircle, XCircle, Trash2, AlertCircle } from "lucide-react";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { TeamAPI } from "../../../services/teamApi";
import DocumentUploadModal from "../DocumentUploadModal";
import RejectDocumentModal from "../RejectDocumentModal";
import { formatDate } from "../../../lib/utils";

export default function TeamDocumentsTab({ teamId, eventId }) {
  const [documents, setDocuments] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, docId: null, docType: "" });
  const toast = useToast();

  useEffect(() => {
    if (teamId) loadAll();
  }, [teamId, eventId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [docs, reqs] = await Promise.all([
        TeamAPI.getTeamDocuments(teamId),
        eventId ? TeamAPI.getEventDocumentRequirements(eventId) : Promise.resolve([])
      ]);
      setDocuments(docs);
      setRequirements(reqs);
    } catch (err) {
      console.error(err);
      setError("Failed to load documents.");
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (docId) => {
    try {
      const updated = await TeamAPI.updateDocumentStatus(docId, 'approved', null);
      setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, ...updated } : doc));
      toast.success("Document approved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve document");
    }
  };

  const openRejectModal = (doc) => {
    setRejectModal({ open: true, docId: doc.id, docType: doc.doc_type });
  };

  const handleRejectConfirm = async (reason) => {
    try {
      const updated = await TeamAPI.updateDocumentStatus(rejectModal.docId, 'rejected', reason);
      setDocuments(prev => prev.map(doc => doc.id === rejectModal.docId ? { ...doc, ...updated } : doc));
      toast.success("Document rejected");
      setRejectModal({ open: false, docId: null, docType: "" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject document");
      throw err;
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await TeamAPI.deleteTeamDocument(docId);
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
      toast.success("Document deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'rejected': return <Badge variant="error">Rejected</Badge>;
      default: return <Badge variant="warning">Pending</Badge>;
    }
  };

  // Build requirements checklist
  const getDocStatus = (docType) => {
    const matching = documents.filter(d => d.doc_type === docType);
    if (matching.some(d => d.status === 'approved')) return 'approved';
    if (matching.some(d => d.status === 'pending')) return 'pending';
    if (matching.some(d => d.status === 'rejected')) return 'rejected';
    return 'missing';
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading documents</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-main">Team Documents</h2>
          <p className="text-sm text-muted">Upload and verify official documents for this team.</p>
        </div>
        <Button icon={Upload} onClick={() => setIsUploadModalOpen(true)}>
          Upload Document
        </Button>
      </div>

      {/* Requirements checklist */}
      {requirements.length > 0 && (
        <Card>
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-main flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary-500" />
              Document Checklist
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {requirements.map(req => {
              const status = getDocStatus(req.doc_type);
              return (
                <div key={req.id || req.doc_type} className="px-4 py-3 flex items-center gap-3">
                  {status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-amber-500 shrink-0" />}
                  {status === 'rejected' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  {status === 'missing' && <div className="w-4 h-4 rounded-full border-2 border-slate-600 shrink-0" />}
                  <span className="text-sm text-main flex-1">{req.doc_type}</span>
                  {req.is_required && <span className="text-xs text-red-400 font-medium">Required</span>}
                  <span className={`text-xs font-medium ${
                    status === 'approved' ? 'text-emerald-400' :
                    status === 'pending' ? 'text-amber-400' :
                    status === 'rejected' ? 'text-red-400' : 'text-slate-500'
                  }`}>
                    {status === 'approved' ? 'Approved' :
                     status === 'pending' ? 'Pending Review' :
                     status === 'rejected' ? 'Rejected' : 'Not Uploaded'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents Uploaded"
            description="This team has not uploaded any official documents yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-base-alt/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Document</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Uploaded</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-base-alt/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-main block">{doc.doc_type}</span>
                          {doc.review_notes && doc.status === 'rejected' && (
                            <span className="text-xs text-red-400 block mt-0.5">Reason: {doc.review_notes}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
                    <td className="px-6 py-4 text-muted font-mono text-xs">{formatDate(doc.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-muted hover:text-blue-400 bg-base border border-border rounded-lg transition-colors"
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        {doc.status !== 'approved' && (
                          <button
                            onClick={() => handleApprove(doc.id)}
                            className="p-2 text-muted hover:text-green-400 bg-base border border-border rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {doc.status !== 'rejected' && (
                          <button
                            onClick={() => openRejectModal(doc)}
                            className="p-2 text-muted hover:text-orange-400 bg-base border border-border rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        teamId={teamId}
        eventId={eventId}
        availableDocTypes={requirements.length > 0 ? requirements : null}
        existingDocs={documents}
        onUploadComplete={(newDoc) => setDocuments(prev => [newDoc, ...prev])}
      />

      <RejectDocumentModal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, docId: null, docType: "" })}
        onConfirm={handleRejectConfirm}
        docType={rejectModal.docType}
      />
    </div>
  );
}
