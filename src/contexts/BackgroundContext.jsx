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
        
        if (pdfResult?.pdfBlob) {
          // Upload to storage
          const { url } = await uploadToStorage(
            new File([pdfResult.pdfBlob], pdfResult.pdfFileName, { type: "application/pdf" }),
            "accreditations/pdfs"
          );
          
          // Update database with URL
          const updated = await AccreditationsAPI.update(id, {
            documents: {
              ...(currentAcc.documents || {}),
              accreditation_pdf: url
            }
          });
          if (onSuccess) onSuccess(updated);
        } else if (onSuccess) {
          onSuccess(pdfResult);
        }
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

        let badgeNumber = currentAcc.badgeNumber;
        if (!badgeNumber) {
          const prefix = getBadgePrefix(currentAcc.role);
          const { count } = await supabase
            .from("accreditations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", resolvedEventId)
            .eq("role", currentAcc.role)
            .eq("status", "approved");
          
          const nextCount = (count || 0) + 1;
          badgeNumber = `${prefix}-${String(nextCount).padStart(3, "0")}`;
          console.log(`[BackgroundQueue] Generated badge number ${badgeNumber} for ${currentAcc.firstName}`);
        }

        // 3. Status Update (Approve)
        console.log(`[BackgroundQueue] Approving ${currentAcc.firstName}...`);
        await AccreditationsAPI.approve(
          id, 
          approveData?.zoneCodes?.join(",") || "", 
          badgeNumber, 
          currentAcc.role
        );

        // 3.5 Fetch strictly perfectly updated accreditation directly from database
        const fullyUpdatedAcc = await AccreditationsAPI.getById(id);

        // 4. Generate PDF using exactly what's inside the database!
        console.log(`[BackgroundQueue] Generating PDF for ${fullyUpdatedAcc.firstName}...`);
        const pdfResult = await generatePdfAttachment(fullyUpdatedAcc, eventData, allZones, pdfSize || "a6");
        const pdfBase64 = pdfResult?.pdfBase64;
        const pdfName = pdfResult?.pdfFileName;
        const pdfBlob = pdfResult?.pdfBlob;

        let finalPdfUrl = null;
        if (pdfBlob) {
          console.log(`[BackgroundQueue] PDF generated successfully. Uploading to storage...`);
          const { url } = await uploadToStorage(
            new File([pdfBlob], pdfName, { type: "application/pdf" }),
            "accreditations/pdfs"
          );
          finalPdfUrl = url;
          
          // Update database with URL
          await AccreditationsAPI.update(id, {
            documents: {
              ...(fullyUpdatedAcc.documents || {}),
              accreditation_pdf: url
            }
          });
        } else {
          console.warn("[BackgroundQueue] PDF generation failed or returned null.");
        }

        // 5. Finalize State
        const finalDelivered = await AccreditationsAPI.getById(id);
        if (onSuccess) onSuccess(finalDelivered);

        // 6. Send Email if requested
        if (approveData?.sendEmail) {
          console.log(`[BackgroundQueue] Email notification requested for ${finalDelivered.email}`);
          if (!finalDelivered.email) {
            console.warn("[BackgroundQueue] Skipping email dispatch: No email address found.");
          } else {
            try {
              await sendApprovalEmail({
                to: finalDelivered.email,
                name: `${finalDelivered.firstName} ${finalDelivered.lastName}`,
                eventName: eventData?.name || "Event",
                eventLocation: eventData?.location || "",
                eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
                role: finalDelivered.role,
                accreditationId: finalDelivered.accreditationId || finalDelivered.badgeNumber,
                badgeNumber: finalDelivered.badgeNumber || "",
                zoneCode: finalDelivered.zoneCode || "",
                reportingTimes: eventData?.reportingTimes || "",
                eventId: finalDelivered.eventId,
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
