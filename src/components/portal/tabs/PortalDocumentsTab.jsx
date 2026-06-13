import React, { useState, useEffect } from "react";
import { FileText, ShieldAlert, Upload, Eye } from "lucide-react";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
import DocumentUploadModal from "../../teams/DocumentUploadModal";
import { formatDate } from "../../../lib/utils";

export default function PortalDocumentsTab({ teamId, eventId, userRole }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    if (teamId) {
      loadDocuments();
    }
  }, [teamId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await TeamPortalAPI.getPortalTeamDocuments(teamId);
      setDocuments(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'rejected': return <Badge variant="error">Rejected</Badge>;
      default: return <Badge variant="warning">Pending</Badge>;
    }
  };

  const canUpload = ['admin', 'manager'].includes(userRole);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Team Documents</h2>
          <p className="text-sm text-muted">View uploaded documents and their verification status.</p>
        </div>
        
        {canUpload && (
          <Button icon={Upload} onClick={() => setIsUploadModalOpen(true)}>
            Upload Document
          </Button>
        )}
      </div>

      <Card>
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
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Document Type</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs">Uploaded Date</th>
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
                          {doc.review_notes && (
                            <span className="text-xs text-muted block mt-1">Note: {doc.review_notes}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 text-muted font-mono text-xs whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-muted hover:text-blue-400 bg-base border border-border rounded-lg transition-colors inline-flex"
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canUpload && (
        <DocumentUploadModal 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          teamId={teamId}
          eventId={eventId}
          isPortal={true}
          onUploadComplete={(newDoc) => {
            setDocuments(prev => [newDoc, ...prev]);
          }}
        />
      )}
    </div>
  );
}
