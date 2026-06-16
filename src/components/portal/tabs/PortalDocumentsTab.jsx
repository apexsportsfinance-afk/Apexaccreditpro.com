import React, { useState, useEffect } from "react";
import { FileText, ShieldAlert, Upload, Eye, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
import DocumentUploadModal from "../../teams/DocumentUploadModal";
import { formatDate } from "../../../lib/utils";

export default function PortalDocumentsTab({ teamId, eventId, userRole }) {
  const [documents, setDocuments] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadModal, setUploadModal] = useState({ open: false, preSelectedDocType: "" });

  const canUpload = ['admin', 'manager'].includes(userRole);

  useEffect(() => {
    if (teamId) loadAll();
  }, [teamId, eventId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [docs, reqs] = await Promise.all([
        TeamPortalAPI.getPortalTeamDocuments(teamId),
        eventId ? TeamPortalAPI.getEventDocumentRequirements(eventId) : Promise.resolve([])
      ]);
      setDocuments(docs || []);
      setRequirements(reqs || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const openUpload = (preSelectedDocType = "") => {
    setUploadModal({ open: true, preSelectedDocType });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'rejected': return <Badge variant="error">Rejected</Badge>;
      default: return <Badge variant="warning">Pending Review</Badge>;
    }
  };

  // Per-type status: best status wins (approved > pending > rejected > missing)
  const getDocTypeStatus = (docType) => {
    const matching = documents.filter(d => d.doc_type === docType);
    if (matching.some(d => d.status === 'approved')) return 'approved';
    if (matching.some(d => d.status === 'pending')) return 'pending';
    if (matching.some(d => d.status === 'rejected')) return 'rejected';
    return 'missing';
  };

  const getRejectedDoc = (docType) =>
    documents.find(d => d.doc_type === docType && d.status === 'rejected');

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

  const requiredCount = requirements.filter(r => r.is_required).length;
  const approvedRequiredCount = requirements.filter(r => r.is_required && getDocTypeStatus(r.doc_type) === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Team Documents</h2>
          <p className="text-sm text-muted">Upload official team documents and track verification status.</p>
        </div>
        {canUpload && (
          <Button icon={Upload} onClick={() => openUpload()}>
            Upload Document
          </Button>
        )}
      </div>

      {/* Requirements checklist */}
      {requirements.length > 0 && (
        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-main flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary-500" />
              Required Documents
            </h3>
            {requiredCount > 0 && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                approvedRequiredCount === requiredCount
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {approvedRequiredCount}/{requiredCount} approved
              </span>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {requirements.map(req => {
              const status = getDocTypeStatus(req.doc_type);
              const rejectedDoc = status === 'rejected' ? getRejectedDoc(req.doc_type) : null;
              return (
                <div key={req.id || req.doc_type} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-amber-500 shrink-0" />}
                    {status === 'rejected' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    {status === 'missing' && <div className="w-4 h-4 rounded-full border-2 border-slate-600 shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-main font-medium">{req.doc_type}</span>
                      {req.description && (
                        <p className="text-xs text-muted mt-0.5">{req.description}</p>
                      )}
                      {rejectedDoc?.review_notes && (
                        <p className="text-xs text-red-400 mt-0.5">Rejection reason: {rejectedDoc.review_notes}</p>
                      )}
                    </div>

                    {req.is_required && status === 'missing' && (
                      <span className="text-xs text-red-400 font-medium shrink-0">Required</span>
                    )}

                    <span className={`text-xs font-medium shrink-0 ${
                      status === 'approved' ? 'text-emerald-400' :
                      status === 'pending' ? 'text-amber-400' :
                      status === 'rejected' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {status === 'approved' ? 'Approved' :
                       status === 'pending' ? 'Pending Review' :
                       status === 'rejected' ? 'Rejected' : 'Not Uploaded'}
                    </span>

                    {canUpload && (status === 'missing' || status === 'rejected') && (
                      <button
                        onClick={() => openUpload(req.doc_type)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 text-xs font-medium transition-colors shrink-0"
                      >
                        {status === 'rejected'
                          ? <><RefreshCw className="w-3 h-3" /> Re-upload</>
                          : <><Upload className="w-3 h-3" /> Upload</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Uploaded documents history */}
      <Card>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-main">Upload History</h3>
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents Uploaded"
            description="There are currently no official documents uploaded for this team."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-base-alt/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Document</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Date</th>
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
                    <td className="px-6 py-4 text-muted font-mono text-xs whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-muted hover:text-blue-400 bg-base border border-border rounded-lg transition-colors inline-flex"
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        {canUpload && doc.status === 'rejected' && (
                          <button
                            onClick={() => openUpload(doc.doc_type)}
                            className="p-2 text-muted hover:text-primary-400 bg-base border border-border rounded-lg transition-colors inline-flex"
                            title="Re-upload"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
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
        isOpen={uploadModal.open}
        onClose={() => setUploadModal({ open: false, preSelectedDocType: "" })}
        teamId={teamId}
        eventId={eventId}
        isPortal={true}
        availableDocTypes={requirements.length > 0 ? requirements : null}
        existingDocs={documents}
        preSelectedDocType={uploadModal.preSelectedDocType}
        onUploadComplete={(newDoc) => {
          setDocuments(prev => [newDoc, ...prev]);
          setUploadModal({ open: false, preSelectedDocType: "" });
        }}
      />
    </div>
  );
}
