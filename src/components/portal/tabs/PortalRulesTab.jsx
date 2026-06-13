import React, { useState, useEffect } from "react";
import { ShieldAlert, FileText, Eye, CheckCircle2, Clock } from "lucide-react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import EmptyState from "../../ui/EmptyState";
import { useToast } from "../../ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
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

export default function PortalRulesTab({ teamId, eventId }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (eventId && teamId) load();
  }, [eventId, teamId]);

  const load = async () => {
    try {
      setLoading(true);
      const [docs, acks] = await Promise.all([
        TeamPortalAPI.getPortalRulesDocuments(eventId, teamId),
        TeamPortalAPI.getMyRulesAcknowledgements(teamId, user.id),
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

  const getAckForDoc = (docId) => acknowledgements.find((a) => a.document_id === docId);

  const handleAcknowledge = async (doc) => {
    setAcknowledging(doc.id);
    try {
      const ack = await TeamPortalAPI.acknowledgeRulesDocument(eventId, teamId, doc.id, user.id);
      setAcknowledgements((prev) => [...prev.filter((a) => a.document_id !== doc.id), ack]);
      toast.success("Thank you for confirming you have read and accepted this document.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to record acknowledgement");
    } finally {
      setAcknowledging(null);
    }
  };

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
      <div>
        <h2 className="text-lg font-bold text-main">Rules & Regulations</h2>
        <p className="text-sm text-muted">
          Please review each document below. Some require confirmation that you have read and accepted them.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="No Rules Published Yet"
            description="Event organizers have not published any rules or regulations yet. Check back later."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const ack = getAckForDoc(doc.id);
            return (
              <Card key={doc.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-main">{doc.title}</h3>
                        <Badge variant="muted">{CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{doc.description}</p>
                      )}
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-400 mt-2 font-medium"
                        >
                          <Eye className="w-4 h-4" /> View Document
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                    {ack ? (
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <div className="text-xs text-left md:text-right">
                          <div className="font-medium">Acknowledged</div>
                          <div className="text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(ack.acknowledged_at, "MMM dd, yyyy HH:mm")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        loading={acknowledging === doc.id}
                        onClick={() => handleAcknowledge(doc)}
                      >
                        I Have Read & Accept
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
