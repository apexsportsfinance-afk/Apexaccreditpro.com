import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Credentials that require an actual mailbox/password change are kept as
// Supabase function secrets (set via `supabase secrets set`), never in git.
const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT")!);
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
// Fallback visible sender, used only if the admin-editable DB row below is
// missing. The SMTP login/envelope sender always stays on the
// accreditations@ mailbox; only this From/Reply-To header changes.
const FALLBACK_SMTP_FROM = Deno.env.get("SMTP_FROM")!;
const FALLBACK_SMTP_REPLY_TO = Deno.env.get("SMTP_REPLY_TO")!;

// Admin-editable sender name/email/reply-to, stored in the global_settings
// table under key "smtp_sender_config" (set from Settings > SMTP Email
// Config in the app). Read fresh on every send so changes apply instantly,
// no redeploy needed.
async function getSenderConfig(): Promise<{ from: string; replyTo: string }> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/rest/v1/global_settings?key=eq.smtp_sender_config&select=value`;
    const res = await fetch(url, {
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
    });
    const rows = await res.json();
    const raw = rows?.[0]?.value;
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg?.fromEmail) {
        return {
          from: `${cfg.fromName || "Apex Sports Accreditations"} <${cfg.fromEmail}>`,
          replyTo: cfg.replyTo || cfg.fromEmail,
        };
      }
    }
  } catch (e) {
    console.warn("[SMTP] Failed to load sender config from DB, using fallback:", e);
  }
  return { from: FALLBACK_SMTP_FROM, replyTo: FALLBACK_SMTP_REPLY_TO };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
  let fullResponse = "";
  const timeout = 15000;
  const start = Date.now();
  
  while (true) {
    if (Date.now() - start > timeout) {
      throw new Error("SMTP response timeout");
    }
    const { value, done } = await reader.read();
    if (done) break;
    fullResponse += decoder.decode(value, { stream: true });
    if (fullResponse.includes("\r\n")) {
      const lines = fullResponse.split("\r\n");
      const lastCompleteLine = lines.filter(l => l.length > 0).pop() || "";
      if (lastCompleteLine.length >= 4 && lastCompleteLine[3] === " ") {
        break;
      }
    }
  }
  return fullResponse.trim();
}

async function sendSmtpEmail(to: string, subject: string, htmlBody: string, from: string, replyTo: string, pdfBase64?: string, pdfFileName?: string): Promise<void> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  console.log(`[SMTP] Connecting to ${SMTP_HOST}:${SMTP_PORT} via TLS...`);
  
  const conn = await Deno.connectTls({
    hostname: SMTP_HOST,
    port: SMTP_PORT,
  });

  const writer = conn.writable.getWriter();
  const reader = conn.readable.getReader();

  async function send(cmd: string): Promise<string> {
    await writer.write(encoder.encode(cmd + "\r\n"));
    const resp = await readResponse(reader, decoder);
    const logCmd = cmd.startsWith("AUTH") ? "AUTH LOGIN" : (cmd === encodeBase64(SMTP_USER) || cmd === encodeBase64(SMTP_PASS)) ? "[CREDENTIALS]" : cmd;
    console.log(`[SMTP] > ${logCmd}`);
    console.log(`[SMTP] < ${resp}`);
    return resp;
  }

  try {
    const greeting = await readResponse(reader, decoder);
    console.log(`[SMTP] Greeting: ${greeting}`);

    await send(`EHLO accreditations.apexsports.ae`);

    await send(`AUTH LOGIN`);
    await send(encodeBase64(SMTP_USER));
    const authResp = await send(encodeBase64(SMTP_PASS));
    
    if (!authResp.startsWith("235")) {
      throw new Error(`SMTP Authentication failed: ${authResp}`);
    }

    await send(`MAIL FROM:<${SMTP_USER}>`);
    await send(`RCPT TO:<${to}>`);
    await send(`DATA`);

    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    let message = "";

    if (pdfBase64 && pdfFileName) {
      console.log(`[SMTP] Building email WITH PDF attachment: ${pdfFileName} (${pdfBase64.length} chars base64)`);
      message = [
        `From: ${from}`,
        `Reply-To: ${replyTo}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@apexsports.ae>`,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        htmlBody,
        ``,
        `--${boundary}`,
        `Content-Type: application/pdf; name="${pdfFileName}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${pdfFileName}"`,
        ``,
        ...splitBase64Lines(pdfBase64),
        ``,
        `--${boundary}--`,
        `.`,
      ].join("\r\n");
    } else {
      console.log(`[SMTP] Building email WITHOUT attachment`);
      const altBoundary = `alt_${boundary}`;
      message = [
        `From: ${from}`,
        `Reply-To: ${replyTo}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@apexsports.ae>`,
        ``,
        `--${altBoundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        `Your accreditation status has been updated. Please view this email in an HTML-compatible email client.`,
        ``,
        `--${altBoundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        htmlBody,
        ``,
        `--${altBoundary}--`,
        `.`,
      ].join("\r\n");
    }

    await writer.write(encoder.encode(message + "\r\n"));
    const dataResp = await readResponse(reader, decoder);
    console.log(`[SMTP] Data response: ${dataResp}`);

    if (!dataResp.startsWith("250")) {
      throw new Error(`SMTP send failed: ${dataResp}`);
    }

    await send(`QUIT`);
  } finally {
    try {
      writer.releaseLock();
      reader.releaseLock();
      conn.close();
    } catch (e) {
      console.log("[SMTP] Cleanup:", e);
    }
  }
}

function splitBase64Lines(base64: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.substring(i, i + 76));
  }
  return lines;
}

function buildTemplateHtml(bodyText: string, headerTitle: string, headerColor: string): string {
  const htmlParagraphs = bodyText.split("\n").map(line => {
    if (line.trim() === "") return `<br/>`;
    return `<p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin:0 0 8px 0;">${line}</p>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f1f5f9;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="background:#0f172a;border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,${headerColor});padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">${headerTitle}</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Accreditation Notification</p></div><div style="padding:32px;">${htmlParagraphs}</div><div style="padding:24px 32px;border-top:1px solid #1e293b;text-align:center;"><p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Apex Sports Accreditations</p></div></div></div></body></html>`;
}

function buildApprovedHtml(params: { name: string, eventName: string, eventLocation: string, eventDates: string, role: string, accreditationId: string, badgeNumber: string, zoneCode: string, reportingTimes: string }): string {
  const { name, eventName, eventLocation, eventDates, role, accreditationId, badgeNumber, zoneCode, reportingTimes } = params;
  let locationBlock = "";
  if (eventLocation || eventDates) {
    locationBlock = `<div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">`;
    if (eventLocation) {
      locationBlock += `<div style="padding:8px 0;color:#94a3b8;font-size:14px;">&#128205; ${eventLocation}</div>`;
    }
    if (eventDates) {
      locationBlock += `<div style="padding:8px 0;color:#94a3b8;font-size:14px;">&#128197; ${eventDates}</div>`;
    }
    locationBlock += `</div>`;
  }

  let reportingRow = "";
  if (reportingTimes) {
    reportingRow = `<tr><td style="color:#64748b;font-size:13px;padding:10px 0">Reporting Times</td><td style="color:#e2e8f0;font-size:13px;font-weight:600;text-align:right;padding:10px 0">${reportingTimes}</td></tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f1f5f9;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="background:#0f172a;border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">${eventName}</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Accreditation Notification</p></div><div style="padding:32px;"><p style="color:#e2e8f0;font-size:18px;margin-bottom:16px;">Dear ${name},</p><div style="display:inline-block;background:rgba(34,197,94,0.13);color:#22c55e;padding:8px 16px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">APPROVED</div><p style="color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px;">We are pleased to inform you that your accreditation for <strong style="color:#e2e8f0">${eventName}</strong> has been approved.</p>${locationBlock}<div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#64748b;font-size:13px;padding:10px 0;border-bottom:1px solid #334155">Accreditation ID</td><td style="color:#e2e8f0;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #334155">${accreditationId || "N/A"}</td></tr><tr><td style="color:#64748b;font-size:13px;padding:10px 0;border-bottom:1px solid #334155">Badge Number</td><td style="color:#e2e8f0;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #334155">${badgeNumber || "N/A"}</td></tr><tr><td style="color:#64748b;font-size:13px;padding:10px 0;border-bottom:1px solid #334155">Role</td><td style="color:#e2e8f0;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #334155">${role || "N/A"}</td></tr><tr><td style="color:#64748b;font-size:13px;padding:10px 0;border-bottom:1px solid #334155">Zone Access</td><td style="color:#22c55e;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #334155">${zoneCode || "N/A"}</td></tr>${reportingRow}</table></div><p style="color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px;">Please present this accreditation ID at the venue for badge collection. Keep this email for your records.</p></div><div style="padding:24px 32px;border-top:1px solid #1e293b;text-align:center;"><p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Apex Sports Accreditations</p></div></div></div></body></html>`;
}

function buildRejectedHtml(params: { name: string, eventName: string, role: string, remarks: string, resubmitUrl: string }): string {
  const { name, eventName, role, remarks, resubmitUrl } = params;
  let remarksBlock = "";
  if (remarks) {
    remarksBlock = `<div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #ef4444;"><p style="color:#ef4444;font-size:13px;font-weight:600;margin:0 0 8px 0;">Reason for Rejection:</p><p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;">${remarks}</p></div>`;
  }
  let resubmitBlock = "";
  if (resubmitUrl) {
    resubmitBlock = `<p style="color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px;">If you believe this was in error or would like to resubmit your application with updated information, please use the link below:</p><a href="${resubmitUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Resubmit Application</a>`;
  } else {
    resubmitBlock = `<p style="color:#94a3b8;font-size:15px;line-height:1.6;">If you have any questions or believe this was in error, please contact the event organizers.</p>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f1f5f9;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="background:#0f172a;border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">${eventName}</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Accreditation Notification</p></div><div style="padding:32px;"><p style="color:#e2e8f0;font-size:18px;margin-bottom:16px;">Dear ${name},</p><div style="display:inline-block;background:rgba(239,68,68,0.13);color:#ef4444;padding:8px 16px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">REJECTED</div><p style="color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px;">We regret to inform you that your accreditation request for <strong style="color:#e2e8f0">${eventName}</strong> as <strong style="color:#e2e8f0">${role || "Participant"}</strong> has been rejected.</p>${remarksBlock}${resubmitBlock}</div><div style="padding:24px 32px;border-top:1px solid #1e293b;text-align:center;"><p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Apex Sports Accreditations</p></div></div></div></body></html>`;
}

function buildCustomHtml(name: string, bodyText: string): string {
  const htmlParagraphs = bodyText.split("\n").map(line => {
    if (line.trim() === "") return `<br/>`;
    return `<p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin:0 0 8px 0;">${line}</p>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f1f5f9;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="background:#0f172a;border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">Apex Sports Accreditations</h1></div><div style="padding:32px;">${htmlParagraphs}</div><div style="padding:24px 32px;border-top:1px solid #1e293b;text-align:center;"><p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Apex Sports Accreditations</p></div></div></div></body></html>`;
}

function buildGenericHtml(name: string, eventName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f1f5f9;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="background:#0f172a;border-radius:16px;overflow:hidden;"><div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px;text-align:center;"><h1 style="color:white;margin:0;font-size:24px;">${eventName}</h1></div><div style="padding:32px;"><p style="color:#e2e8f0;font-size:18px;margin-bottom:16px;">Dear ${name},</p><p style="color:#94a3b8;font-size:15px;line-height:1.6;">Your accreditation request for ${eventName} has been reviewed. Please contact the event organizers for more details.</p></div><div style="padding:24px 32px;border-top:1px solid #1e293b;text-align:center;"><p style="color:#475569;font-size:12px;margin:0;">This is an automated message from Apex Sports Accreditations</p></div></div></div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, name, eventName, eventLocation, eventDates, role, accreditationId, badgeNumber, zoneCode, reportingTimes, remarks, resubmitUrl, type, customSubject, customBody, pdfBase64, pdfFileName, templateBody, templateSubject } = body;

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing required field: to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject: string;
    let htmlBody: string;
    let attachmentBase64: string | undefined;
    let attachmentFileName: string | undefined;

    if (type === "custom") {
      subject = customSubject || "Accreditation Notification";
      htmlBody = buildCustomHtml(name || "Participant", customBody || "No message content.");
      if (pdfBase64) {
        attachmentBase64 = pdfBase64;
        attachmentFileName = pdfFileName || "accreditation.pdf";
      }
    } else if (type === "approved") {
      if (!name || !eventName) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, eventName" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Use template body if provided, otherwise use default HTML
      if (templateBody) {
        subject = templateSubject || `Accreditation Approved - ${eventName}`;
        htmlBody = buildTemplateHtml(templateBody, eventName, "#3b82f6,#2563eb");
      } else {
        subject = `Accreditation Approved - ${eventName}`;
        htmlBody = buildApprovedHtml({ name, eventName, eventLocation: eventLocation || "", eventDates: eventDates || "", role: role || "", accreditationId: accreditationId || "", badgeNumber: badgeNumber || "", zoneCode: zoneCode || "", reportingTimes: reportingTimes || "" });
      }
      // Pass PDF attachment for approved emails
      if (pdfBase64) {
        attachmentBase64 = pdfBase64;
        attachmentFileName = pdfFileName || "accreditation.pdf";
        console.log(`[SMTP] Approved email: PDF attachment found (${pdfBase64.length} chars)`);
      } else {
        console.log(`[SMTP] Approved email: No PDF attachment provided`);
      }
    } else if (type === "rejected") {
      if (!name || !eventName) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, eventName" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Use template body if provided, otherwise use default HTML
      if (templateBody) {
        subject = templateSubject || `Accreditation Rejected - ${eventName}`;
        htmlBody = buildTemplateHtml(templateBody, eventName, "#ef4444,#dc2626");
      } else {
        subject = `Accreditation Rejected - ${eventName}`;
        htmlBody = buildRejectedHtml({ name, eventName, role: role || "", remarks: remarks || "", resubmitUrl: resubmitUrl || "" });
      }
    } else {
      subject = `Accreditation Update - ${eventName || "Event"}`;
      htmlBody = buildGenericHtml(name || "Participant", eventName || "Event");
    }

    const { from: senderFrom, replyTo: senderReplyTo } = await getSenderConfig();

    console.log(`[SMTP] Sending ${type} email to: ${to} via ${SMTP_HOST}:${SMTP_PORT} from ${senderFrom}${attachmentBase64 ? " (with PDF attachment)" : " (no attachment)"}${templateBody ? " (using custom template)" : ""}`);

    await sendSmtpEmail(to, subject, htmlBody, senderFrom, senderReplyTo, attachmentBase64, attachmentFileName);

    console.log(`[SMTP] Email sent successfully to ${to}`);
    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SMTP] Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
