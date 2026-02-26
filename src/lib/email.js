const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

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
          type: "approved"
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
          type: "rejected"
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
