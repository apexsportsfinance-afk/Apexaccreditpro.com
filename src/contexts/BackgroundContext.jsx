import React, { createContext, useContext, useState, useEffect } from "react";
import { AccreditationsAPI, EventsAPI, ZonesAPI } from "../lib/storage";
import { useToast } from "../components/ui/Toast";
import { generatePdfAttachment } from "../lib/pdfEmailHelper";
import { sendApprovalEmail } from "../lib/email";
import { uploadToStorage } from "../lib/uploadToStorage";
import { supabase } from "../lib/supabase";
import { getBadgePrefix } from "../lib/utils";

const BackgroundContext = createContext();

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) throw new Error("useBackground must be used within a BackgroundProvider");
  return context;
};

export const BackgroundProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const toast = useToast();

  const addToQueue = (task) => {
    setQueue(prev => [...prev, task]);
  };

  useEffect(() => {
    if (!processing && queue.length > 0) {
      processNext();
    }
  }, [queue, processing]);

  const processNext = async () => {
    if (queue.length === 0 || processing) return;
    
    setProcessing(true);
    const task = queue[0];
    setCurrentTask({
      ...task,
      status: "processing",
      message: "Processing..."
    });

    try {
      if (task.type === "bulk_download") {
        const { accreditations, event, zones, sizeKey, onProgress, onSuccess } = task;
        const { bulkDownloadPDFs } = await import("../components/accreditation/cardExport");
        const result = await bulkDownloadPDFs(
          accreditations, 
          event, 
          zones, 
          sizeKey || "a6",
          (completed, total, failed) => {
            if (onProgress) onProgress(completed, total, failed);
          }
        );
        if (onSuccess) onSuccess(result);
      } else if (task.type === "single_pdf_generate") {
        const { id, accreditation, eventId, pdfSize, onSuccess } = task;
        const currentAcc = (await AccreditationsAPI.getById(id)) || accreditation;
        const resolvedEventId = eventId || currentAcc.eventId;
        const [eventData, allZones] = await Promise.all([
          EventsAPI.getById(resolvedEventId),
          ZonesAPI.getByEventId(resolvedEventId)
        ]);

        const pdfResult = await generatePdfAttachment(currentAcc, eventData, allZones, pdfSize || "a6");
        if (onSuccess) onSuccess(pdfResult);
      } else if (task.type === "accreditation_approval") {
        // Support both wrapped task.data and flat task properties
        const taskData = task.data || task;
        const { id, eventId, approveData, onSuccess, pdfSize } = taskData;

        // 1. Get Event & Zones
        const resolvedEventId = eventId || taskData.accreditation?.eventId;
        const [eventData, allZones] = await Promise.all([
          EventsAPI.getById(resolvedEventId),
          ZonesAPI.getByEventId(resolvedEventId)
        ]);

        // 2. Fetch fresh accreditation data
        const currentAcc = await AccreditationsAPI.getById(id);
        if (!currentAcc) throw new Error("Accreditation not found");

        // 3. Generate PDF
        console.log(`[BackgroundQueue] Generating PDF for ${currentAcc.firstName}...`);
        const pdfResult = await generatePdfAttachment(currentAcc, eventData, allZones, pdfSize || "a6");
        const pdfBase64 = pdfResult?.pdfBase64;
        const pdfName = pdfResult?.pdfFileName;

        if (pdfResult) {
          console.log(`[BackgroundQueue] PDF generated successfully. Length: ${pdfBase64?.length || 0}`);
        } else {
          console.warn("[BackgroundQueue] PDF generation failed or returned null.");
        }

        // 4. Final update in database (if needed)
        const finalUpdated = await AccreditationsAPI.getById(id);
        if (onSuccess) onSuccess(finalUpdated);

        // 5. Send Email if requested
        if (approveData?.sendEmail) {
          console.log(`[BackgroundQueue] Email notification requested for ${finalUpdated.email}`);
          if (!finalUpdated.email) {
            console.warn("[BackgroundQueue] Skipping email dispatch: No email address found.");
          } else {
            try {
              await sendApprovalEmail({
                to: finalUpdated.email,
                name: `${finalUpdated.firstName} ${finalUpdated.lastName}`,
                eventName: eventData?.name || "Event",
                eventLocation: eventData?.location || "",
                eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
                role: finalUpdated.role,
                accreditationId: finalUpdated.accreditationId || finalUpdated.badgeNumber,
                badgeNumber: finalUpdated.badgeNumber || "",
                zoneCode: finalUpdated.zoneCode || approveData?.zoneCodes?.join(",") || "",
                reportingTimes: eventData?.reportingTimes || "",
                eventId: finalUpdated.eventId,
                pdfBase64: pdfBase64 || null,
                pdfFileName: pdfName || null
              });
              console.log("[BackgroundQueue] Email notification dispatched successfully.");
            } catch (emailErr) {
              console.error("[BackgroundQueue] Email delivery failed:", emailErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("[BackgroundQueue] Task failed:", err);
      toast.error(`Task failed: ${err.message || "Unknown error"}`);
    } finally {
      setQueue(prev => prev.slice(1));
      setCurrentTask(null);
      setProcessing(false);
    }
  };

  return (
    <BackgroundContext.Provider value={{ queue, addToQueue, currentTask, processing }}>
      {children}
    </BackgroundContext.Provider>
  );
};
