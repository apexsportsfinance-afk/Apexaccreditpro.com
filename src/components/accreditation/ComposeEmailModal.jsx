import React, { useState, useEffect } from "react";
import { Mail, Send, Paperclip, Loader2, X, Users, User, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import { useToast } from "../ui/Toast";
import { sendCustomEmail } from "../../lib/email";
import { getEmailTemplate } from "../../lib/email";
import { generatePdfAttachment } from "../../lib/pdfEmailHelper";

export default function ComposeEmailModal({
  isOpen,
  onClose,
  recipients = [],
  event = null,
  zones = [],
  isBulk = false
}) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const eventName = event?.name || "the event";

      // Try to load saved custom template
      const loadTemplate = async () => {
        const template = await getEmailTemplate("custom");
        if (template && template.body) {
          const r = recipients.length === 1 ? recipients[0] : null;
          const placeholderVars = {
            name: r ? `${r.firstName} ${r.lastName}` : "Participant",
            firstName: r?.firstName || "Participant",
            lastName: r?.lastName || "",
            eventName,
            role: r?.role || "Participant",
            badge: r?.badgeNumber || "N/A",
            zones: r?.zoneCode || "",
            email: r?.email || ""
          };
          let bodyText = template.body;
          let subjectText = template.subject || `Your Accreditation - ${eventName}`;
          // Replace placeholders
          Object.entries(placeholderVars).forEach(([key, val]) => {
            bodyText = bodyText.replace(new RegExp(`\\{${key}\\}`, "g"), val);
            subjectText = subjectText.replace(new RegExp(`\\{${key}\\}`, "g"), val);
          });
          setSubject(subjectText);
          setBody(bodyText);
        } else {
          // Fallback defaults
          if (r) {
            setSubject(`Your Accreditation - ${eventName}`);
            setBody(`Dear ${r.firstName} ${r.lastName},\n\nPlease find your accreditation details attached.\n\nEvent: ${eventName}\nRole: ${r.role || "Participant"}\nBadge: ${r.badgeNumber || "N/A"}\n\nPlease present this at the venue for badge collection.\n\nBest regards,\nApex Sports Accreditations`);
          } else {
            setSubject(`Your Accreditation - ${eventName}`);
            setBody(`Dear Participant,\n\nPlease find your accreditation details attached.\n\nEvent: ${eventName}\n\nPlease present this at the venue for badge collection.\n\nBest regards,\nApex Sports Accreditations`);
          }
        }
      };
      loadTemplate();

      setAttachPdf(true);
      setResults([]);
      setProgress({ sent: 0, failed: 0, total: 0 });
    }
  }, [isOpen, recipients, event]);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter a message body");
      return;
    }
    if (recipients.length === 0) {
      toast.error("No recipients selected");
      return;
    }

    setSending(true);
    const total = recipients.length;
    setProgress({ sent: 0, failed: 0, total });
    const sendResults = [];

    for (let i = 0; i < recipients.length; i++) {
      const acc = recipients[i];
      const recipientName = `${acc.firstName} ${acc.lastName}`;

      try {
        let pdfBase64 = null;
        let pdfFileName = null;

        if (attachPdf && acc.status === "approved") {
          try {
            const attachment = await generatePdfAttachment(acc, event, zones);
            if (attachment) {
              pdfBase64 = attachment.pdfBase64;
              pdfFileName = attachment.pdfFileName;
            }
          } catch (pdfErr) {
            console.warn(`PDF generation failed for ${recipientName}:`, pdfErr);
          }
        }

        // Personalize body for bulk
        let personalBody = body;
        if (isBulk) {
          personalBody = body
            .replace(/Dear Participant/g, `Dear ${recipientName}`)
            .replace(/\{name\}/g, recipientName)
            .replace(/\{firstName\}/g, acc.firstName || "")
            .replace(/\{lastName\}/g, acc.lastName || "")
            .replace(/\{role\}/g, acc.role || "Participant")
            .replace(/\{badge\}/g, acc.badgeNumber || "N/A")
            .replace(/\{email\}/g, acc.email || "");
        }

        const result = await sendCustomEmail({
          to: acc.email,
          name: recipientName,
          subject,
          body: personalBody,
          pdfBase64,
          pdfFileName
        });

        if (result.success) {
          sendResults.push({ email: acc.email, name: recipientName, success: true });
          setProgress((p) => ({ ...p, sent: p.sent + 1 }));
        } else {
          sendResults.push({ email: acc.email, name: recipientName, success: false, error: result.error });
          setProgress((p) => ({ ...p, failed: p.failed + 1 }));
        }
      } catch (err) {
        sendResults.push({ email: acc.email, name: recipientName, success: false, error: err.message });
        setProgress((p) => ({ ...p, failed: p.failed + 1 }));
      }
    }

    setResults(sendResults);
    setSending(false);

    const successCount = sendResults.filter((r) => r.success).length;
    const failCount = sendResults.filter((r) => !r.success).length;

    if (failCount === 0) {
      toast.success(`All ${successCount} email(s) sent successfully!`);
    } else if (successCount === 0) {
      toast.error(`All ${failCount} email(s) failed to send`);
    } else {
      toast.warning(`${successCount} sent, ${failCount} failed`);
    }
  };

  const approvedCount = recipients.filter((r) => r.status === "approved").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isBulk ? "Bulk Email Compose" : "Compose Email"} size="lg">
      <div id="compose-email-modal" className="p-6 space-y-5">
        {/* Recipients Info */}
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
          {isBulk ? (
            <Users className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          ) : (
            <User className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            {isBulk ? (
              <p className="text-lg text-white font-extralight">
                Sending to <span className="font-medium text-cyan-400">{recipients.length}</span> recipient(s)
                {approvedCount < recipients.length && (
                  <span className="text-amber-400 ml-2">
                    ({approvedCount} approved with PDF)
                  </span>
                )}
              </p>
            ) : (
              <div>
                <p className="text-lg text-white font-medium">
                  {recipients[0]?.firstName} {recipients[0]?.lastName}
                </p>
                <p className="text-lg text-slate-400 font-extralight">{recipients[0]?.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line"
          required
        />

        {/* Body */}
        <div className="space-y-1.5">
          <label className="block text-lg font-medium text-slate-300">
            Message Body <span className="text-red-400">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg font-extralight"
            placeholder="Write your email message here..."
          />
          {isBulk && (
            <p className="text-lg text-slate-500 font-extralight">
              Use placeholders: {"{name}"}, {"{firstName}"}, {"{lastName}"}, {"{role}"}, {"{badge}"}, {"{email}"}
            </p>
          )}
        </div>

        {/* Attach PDF Toggle */}
        <div className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
          <button
            type="button"
            onClick={() => setAttachPdf(!attachPdf)}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              attachPdf ? "border-primary-500 bg-primary-500" : "border-slate-500"
            }`}
          >
            {attachPdf && <CheckCircle className="w-4 h-4 text-white" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-violet-400" />
              <p className="text-lg text-white font-medium">Attach Accreditation PDF with QR Code</p>
            </div>
            <p className="text-lg text-slate-400 font-extralight mt-1">
              PDF will be generated and attached for approved accreditations only
            </p>
          </div>
        </div>

        {/* Progress (during sending) */}
        {sending && (
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <p className="text-lg text-cyan-300 font-medium">
                Sending emails... {progress.sent + progress.failed} / {progress.total}
              </p>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((progress.sent + progress.failed) / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2">
              <p className="text-lg text-emerald-400 font-extralight">{progress.sent} sent</p>
              {progress.failed > 0 && (
                <p className="text-lg text-red-400 font-extralight">{progress.failed} failed</p>
              )}
            </div>
          </div>
        )}

        {/* Results (after sending) */}
        {results.length > 0 && !sending && (
          <div className="max-h-48 overflow-y-auto space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-lg ${
                  r.success
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                {r.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={`font-extralight ${r.success ? "text-emerald-300" : "text-red-300"}`}>
                  {r.name} ({r.email})
                </span>
                {!r.success && r.error && (
                  <span className="text-lg text-red-400 ml-auto font-extralight">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={sending}>
            {results.length > 0 ? "Close" : "Cancel"}
          </Button>
          {results.length === 0 && (
            <Button
              variant="primary"
              icon={Send}
              onClick={handleSend}
              className="flex-1"
              loading={sending}
              disabled={sending}
            >
              {sending ? "Sending..." : isBulk ? `Send to ${recipients.length} Recipients` : "Send Email"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
