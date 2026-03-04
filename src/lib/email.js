const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

import { supabase } from "./supabase";

/**
 * Load a saved email template from the database
 */
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

/**
 * Replace placeholders in template text
 */
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

/**
 * Send accreditation approval email via Edge Function
 */
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
  reportingTimes
}) => {
  try {
    console.log("[Email] Sending approval email to:", to);

    // Try to load custom template
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
          templateSubject: customSubject || null
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Email] Approval email send failed:", data);
      return { success: false, error: data.error || "Failed to send approval email" };
    }

    console.log("[Email] Approval email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send accreditation rejection email via Edge Function
 */
export const sendRejectionEmail = async ({
  to,
  name,
  eventName,
  role,
  remarks,
  resubmitUrl
}) => {
  try {
    console.log("[Email] Sending rejection email to:", to);

    // Try to load custom template
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

    console.log("[Email] Rejection email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send custom email with optional PDF attachment
 * @param {Object} params
 * @param {string} params.to - recipient email
 * @param {string} params.name - recipient name
 * @param {string} params.subject - email subject
 * @param {string} params.body - email body (plain text, will be wrapped in HTML)
 * @param {string|null} params.pdfBase64 - base64 PDF data (without data: prefix)
 * @param {string|null} params.pdfFileName - PDF attachment filename
 */
export const sendCustomEmail = async ({
  to,
  name,
  subject,
  body,
  pdfBase64 = null,
  pdfFileName = null
}) => {
  try {
    console.log("[Email] Sending custom email to:", to);
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

    console.log("[Email] Custom email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("[Email] Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Generic send accreditation email function (legacy support)
 */
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
