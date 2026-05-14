const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

import { supabase } from "./supabase";

// APX-PERF: Email template cache — avoids repeated identical DB queries during bulk operations
const templateCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

export const getEmailTemplate = async (templateType, eventId = null) => {
  const cacheKey = `${templateType}_${eventId || 'global'}`;
  const cached = templateCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    // 1. Try to get event-specific template
    if (eventId) {
      const { data: eventData, error: eventError } = await supabase
        .from("email_templates")
        .select("subject, body")
        .eq("template_type", templateType)
        .eq("event_id", eventId)
        .maybeSingle();
      
      if (!eventError && eventData) {
        const result = { subject: eventData.subject, body: eventData.body };
        templateCache.set(cacheKey, { data: result, ts: Date.now() });
        return result;
      }
    }

    // 2. Fallback to global template (where event_id is null)
    const { data: globalData, error: globalError } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("template_type", templateType)
      .is("event_id", null)
      .maybeSingle();

    if (globalError || !globalData) {
      templateCache.set(cacheKey, { data: null, ts: Date.now() });
      return null;
    }
    const result = { subject: globalData.subject, body: globalData.body };
    templateCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("[Email] getEmailTemplate error:", err);
    return null;
  }
};

const replacePlaceholders = (text, vars) => {
  if (!text) return text;
  return text
    .replace(/\{name\}/g, vars.name || "")
    .replace(/\{firstName\}/g, vars.firstName || "")
    .replace(/\{lastName\}/g, vars.lastName || "")
    .replace(/\{eventName\}/g, vars.eventName || "")
    .replace(/\{role\}/g, vars.role || "")
    .replace(/\{badge\}/g, vars.badge || "")
    .replace(/\{zones\}/g, vars.zones || "")
    .replace(/\{email\}/g, vars.email || "");
};

export const sendApprovalEmail = async ({
  to,
  name,
  eventName,
  eventLocation,
  eventDates,
  role,
  accreditationId,
  badgeNumber,
  zoneCode,
  reportingTimes,
  eventId = null,
  pdfBase64 = null,
  pdfFileName = null
}) => {
  try {
    const template = await getEmailTemplate("approved", eventId);
    let customBody = null;
    let customSubject = null;
    if (template && template.body) {
      const vars = {
        name,
        firstName: name?.split(" ")[0] || "",
        lastName: name?.split(" ").slice(1).join(" ") || "",
        eventName,
        role,
        badge: badgeNumber || accreditationId || "",
        zones: zoneCode || "",
        email: to
      };
      customBody = replacePlaceholders(template.body, vars);
      customSubject = replacePlaceholders(template.subject, vars);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-accreditation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          to,
          name,
          eventName,
          eventLocation,
          eventDates,
          role,
          accreditationId,
          badgeNumber,
          zoneCode,
          reportingTimes,
          type: "approved",
          templateBody: customBody || null,
          templateSubject: customSubject || null,
          pdfBase64: pdfBase64 || undefined,
          pdfFileName: pdfFileName || undefined
        })
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error("[Email] Approval email send failed:", data);
      return { success: false, error: data.error || "Failed to send approval email" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

export const sendRejectionEmail = async ({
  to,
  name,
  eventName,
  role,
  remarks,
  resubmitUrl,
  eventId = null
}) => {
  try {
    const template = await getEmailTemplate("rejected", eventId);
    let customBody = null;
    let customSubject = null;
    if (template && template.body) {
      const vars = {
        name,
        firstName: name?.split(" ")[0] || "",
        lastName: name?.split(" ").slice(1).join(" ") || "",
        eventName,
        role: role || "Participant",
        badge: "",
        zones: "",
        email: to
      };
      customBody = replacePlaceholders(template.body, vars);
      if (remarks) {
        customBody += "\n\nReason: " + remarks;
      }
      customSubject = replacePlaceholders(template.subject, vars);
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-accreditation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          to,
          name,
          eventName,
          role,
          remarks,
          resubmitUrl,
          type: "rejected",
          templateBody: customBody || null,
          templateSubject: customSubject || null
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Email] Rejection email send failed:", data);
      return { success: false, error: data.error || "Failed to send rejection email" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

export const sendCustomEmail = async ({
  to,
  name,
  subject,
  body,
  pdfBase64 = null,
  pdfFileName = null
}) => {
  try {
    const payload = {
      to,
      name,
      customSubject: subject,
      customBody: body,
      type: "custom"
    };
    if (pdfBase64) {
      payload.pdfBase64 = pdfBase64;
      payload.pdfFileName = pdfFileName || "accreditation.pdf";
    }
    console.log("[Email] Attempting to send via Edge Function...", payload.to);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-accreditation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify(payload)
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();
    console.log("[Email] Edge Function Response:", data);

    if (!response.ok) {
      return { success: false, error: data.error || data.message || "SMTP server rejected the request" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

export const sendAccreditationEmail = async ({
  to,
  name,
  eventName,
  role,
  accreditationId,
  badgeNumber,
  zoneCode,
  remarks,
  eventId = null,
  type = "approved"
}) => {
  if (type === "approved") {
    return sendApprovalEmail({
      to,
      name,
      eventName,
      role,
      accreditationId,
      badgeNumber,
      zoneCode,
      eventId
    });
  } else {
    return sendRejectionEmail({
      to,
      name,
      eventName,
      role,
      remarks,
      eventId
    });
  }
};

export const sendTicketEmail = async ({
  to,
  name,
  eventName,
  ticketCount,
  amountPaid,
  paymentMethod,
  eventData,
  qrCodeDataUrl,
  qrCodeId,
  orderId = null,
  eventId = null
}) => {
  try {
    const template = await getEmailTemplate("ticket_delivery", eventId || eventData?.id);
    let subject = `Booking Confirmation - {eventName}`;
    let body = "Dear {name},\n\nThank you for booking your ticket(s) with us. We are thrilled to welcome you to {eventName}!\n\nAttached to this email, you will find your official e-ticket(s). Please review your booking details carefully:\n\nEvent: {eventName}\nTotal Tickets: {ticketCount} Person(s)\nAmount Paid: {amountPaid} AED\nPayment Method: {paymentMethod}\nReference ID: {qrCodeId}\n\nPlease keep this email safe and present the attached QR code at the event entrance for scanning. To ensure a smooth entry, please have your ID ready as it may be required for verification.\n\nIf you have any questions or require any assistance, simply reply directly to this email.\n\nWe hope you thoroughly enjoy the event!\n\nWarm regards,\nThe Apex Sports Team";

    // Prepare variables for placeholder replacement
    const vars = {
      name: name || "Customer",
      firstName: name?.split(" ")[0] || "Customer",
      lastName: name?.split(" ").slice(1).join(" ") || "",
      eventName,
      ticketCount,
      amountPaid,
      paymentMethod,
      qrCodeId
    };
    
    const replacePlaceholders = (text, v) => {
      if (!text) return text;
      return text
        .replace(/\{name\}/g, v.name)
        .replace(/\{firstName\}/g, v.firstName)
        .replace(/\{lastName\}/g, v.lastName)
        .replace(/\{eventName\}/g, v.eventName)
        .replace(/\{ticketCount\}/g, v.ticketCount)
        .replace(/\{amountPaid\}/g, v.amountPaid)
        .replace(/\{paymentMethod\}/g, v.paymentMethod)
        .replace(/\{qrCodeId\}/g, v.qrCodeId);
    };

    if (template && template.body && template.body.trim() !== '') {
      body = replacePlaceholders(template.body, vars);
      subject = replacePlaceholders(template.subject, vars);
    } else {
      body = replacePlaceholders(body, vars);
      subject = replacePlaceholders(subject, vars);
    }

    // Use the reliable sendCustomEmail but with a simple, professional body
    const viewUrl = `https://accreditation.apexsports.ae/view-ticket/${qrCodeId}`;
    
    // Minimalist HTML - No wrappers, no complex CSS
    const finalBody = `
Dear ${name || 'Customer'},<br/><br/>
Your booking for <strong>${eventName}</strong> has been confirmed.<br/><br/>
<strong>ORDER SUMMARY:</strong><br/>
- Tickets: ${ticketCount || 1} Person(s)<br/>
- Amount Paid: ${amountPaid} AED<br/>
- Reference ID: ${qrCodeId}<br/><br/>
<strong>MOBILE TICKETS:</strong><br/>
View and download your tickets here: <a href="${viewUrl}">${viewUrl}</a><br/><br/>
Best regards,<br/>The Apex Sports Team
    `.trim();

    return sendCustomEmail({
      to,
      name,
      subject,
      body: finalBody, 
      pdfBase64: null,
      pdfFileName: null
    });
  } catch (error) {
    console.error("[Email] Ticket email failed to send:", error);
    return { success: false, error: error.message };
  }
};

