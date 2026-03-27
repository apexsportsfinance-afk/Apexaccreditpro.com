const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

import { supabase } from "./supabase";
import { generateTicketAttachment } from "./pdfTicketHelper";

export const getEmailTemplate = async (templateType) => {
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("template_type", templateType)
      .single();
    if (error || !data) return null;
    return { subject: data.subject, body: data.body };
  } catch {
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
  pdfBase64 = null,
  pdfFileName = null
}) => {
  try {

    const template = await getEmailTemplate("approved");
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
  resubmitUrl
}) => {
  try {

    const template = await getEmailTemplate("rejected");
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
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-accreditation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Email] Custom email send failed:", data);
      return { success: false, error: data.error || "Failed to send email" };
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
      zoneCode
    });
  } else {
    return sendRejectionEmail({
      to,
      name,
      eventName,
      role,
      remarks
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
  qrCodeId
}) => {
  try {
    const template = await getEmailTemplate("ticket_delivery");
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

    // Generate Visual PDF Ticket via helper using exactly the same component layout!
    // order format needs customer_name, ticket_count, qr_code_id
    const orderFormat = { 
      customer_name: name, 
      ticket_count: ticketCount, 
      qr_code_id: qrCodeId, 
      selected_dates: [] 
    };

    let pdfBase64 = null;
    let pdfFileName = `${eventName.replace(/[^a-z0-9]/gi, '_')}_Ticket.pdf`;

    if (eventData) {
      const result = await generateTicketAttachment(orderFormat, eventData, qrCodeDataUrl);
      if (result) {
        pdfBase64 = result.pdfBase64;
        pdfFileName = result.pdfFileName;
      }
    }

    return sendCustomEmail({
      to,
      name,
      subject,
      body,
      pdfBase64,
      pdfFileName
    });
  } catch (error) {
    console.error("[Email] Ticket email failed to generate/send:", error);
    return { success: false, error: error.message };
  }
};

