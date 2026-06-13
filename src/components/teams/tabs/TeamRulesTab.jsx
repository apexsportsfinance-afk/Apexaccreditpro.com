import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, FileText, Eye, CheckCircle2, XCircle, BookOpen } from "lucide-react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import EmptyState from "../../ui/EmptyState";
import { TeamAPI } from "../../../services/teamApi";
import { formatDate } from "../../../lib/utils";

const CATEGORY_LABELS = {
  general: "General Rules",
  sport_specific: "Sport-Specific Rules",
  code_of_conduct: "Code of Conduct",
  eligibility: "Eligibility Rules",
  venue: "Venue Rules",
  deadlines: "Important Deadlines",
  notice: "General Notice",
};

export default function TeamRulesTab({ teamId, eventId }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const targeted = docs.filter((doc) => {
        const targets = doc.target_team_ids;
        return !targets || targets.length === 0 || targets.includes(teamId);
      });
      setDocuments(targeted);
      setAcknowledgements(acks);
    } catch (err) {
      console.error(err);
      setError("Failed to load rules & regulations.");
    } finally {
      setLoading(false);
    }
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
          <p className="text-sm text-muted">Documents published for this team and their acknowledgement status.</p>
        </div>
        <Button icon={BookOpen} variant="outline" onClick={() => navigate(`/admin/rules`)}>
          Manage Rules & Regulations
        </Button>
      </div>

      <Card>
        {documents.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No Rules Published Yet"
            description="Use the Rules & Regulations page to publish documents for this team's event."
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
                  <th className="px-6 py-4 font-semibold text-muted uppercase tracking-wider text-xs text-right">File</th>
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
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex p-2 text-muted hover:text-blue-400 bg-base border border-border rounded-lg transition-colors"
                            title="View Document"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
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
