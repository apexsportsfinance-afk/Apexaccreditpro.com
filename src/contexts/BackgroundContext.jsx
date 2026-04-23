import React, { createContext, useContext, useState, useEffect } from "react";
import { AccreditationsAPI, EventsAPI, ZonesAPI } from "../lib/storage";
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

  const addToQueue = (task) => {
    setQueue(prev => [...prev, task]);
  };

  useEffect(() => {
    if (!processing && queue.length > 0) {
      processNext();
    }
  }, [queue, processing]);

  const processNext = async () => {
    setProcessing(true);
    const task = queue[0];
    setCurrentTask(task);

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
        const resolvedEventId = task.eventId || currentAcc.eventId;
        const [eventData, allZones] = await Promise.all([
          EventsAPI.getById(resolvedEventId),
          ZonesAPI.getByEventId(resolvedEventId)
        ]);

        // 1. Generate PDF
        const pdfResult = await generatePdfAttachment(currentAcc, eventData, allZones, pdfSize || "a6");
        const pdfBlob = pdfResult?.pdfBlob;
        
        // 2. Upload and Cache
        if (pdfBlob) {
          const fixedFileName = `${id}_final.pdf`;
          const pdfFile = new File([pdfBlob], fixedFileName, { type: "application/pdf" });
          const uploadResult = await uploadToStorage(pdfFile, "accreditations", fixedFileName);
          
          const currentDocs = currentAcc.documents || {};
          const finalUpdated = await AccreditationsAPI.update(id, {
            documents: { ...currentDocs, accreditation_pdf: uploadResult.url }
          });
          
          if (onSuccess) onSuccess(finalUpdated);
        }
      } else if (task.type === "single_images_generate") {
        const { id, accreditation, eventId, scale, onSuccess } = task;
        const currentAcc = (await AccreditationsAPI.getById(id)) || accreditation;
        const resolvedEventId = task.eventId || currentAcc.eventId;
        const [eventData, allZones] = await Promise.all([
          EventsAPI.getById(resolvedEventId),
          ZonesAPI.getByEventId(resolvedEventId)
        ]);
        
        const { generateImagesForAccreditation } = await import("../lib/pdfEmailHelper");
        const { frontBlob, backBlob } = await generateImagesForAccreditation(currentAcc, eventData, allZones, scale || 3);
        
        if (onSuccess) {
          onSuccess({ frontBlob, backBlob, accreditation: currentAcc });
        }
      } else {
        // Default task type: approve_edit
        const { id, accreditation, eventId, approveData, onSuccess, pdfSize } = task;
        
        // 1. Ensure minimal data needed for PDF/Images is fetched
        const resolvedEventId = eventId || accreditation.eventId;
        const [currentAcc, eventData, allZones] = await Promise.all([
          AccreditationsAPI.getById(id),
          EventsAPI.getById(resolvedEventId),
          ZonesAPI.getByEventId(resolvedEventId)
        ]);

        if (!currentAcc) throw new Error(`Accreditation ${id} not found`);

        // 2. Determine if we need to regenerate Badge ID (only if completely missing)
        let finalAcc = currentAcc;
        if (!finalAcc.badgeNumber || finalAcc.badgeNumber === "---") {
          const role = finalAcc.role || "Guest";
          const { count } = await supabase
            .from("accreditations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", resolvedEventId)
            .eq("role", role)
            .eq("status", "approved");
          
          const { getBadgePrefix } = await import("../lib/utils");
          const prefix = getBadgePrefix(role);
          const badgeNumber = `${prefix}-${String((count || 0) + 1).padStart(3, "0")}`;
          const zoneCodeStr = approveData?.zoneCodes?.join(",") || finalAcc.zoneCode || "";
          
          finalAcc = await AccreditationsAPI.approve(id, zoneCodeStr, badgeNumber, role);
        }

        // 3. Generate PDF (always overwrite stale cache)
        const pdfResult = await generatePdfAttachment(finalAcc, eventData, allZones, pdfSize || "a6");
        const pdfBlob = pdfResult?.pdfBlob;
        const pdfName = pdfResult?.pdfFileName;
        const pdfBase64 = pdfResult?.pdfBase64;
        
        let finalUpdated = finalAcc;

        if (pdfBlob) {
          try {
            const fixedFileName = `${id}_final.pdf`;
            const pdfFile = new File([pdfBlob], fixedFileName, { type: "application/pdf" });
            // uploadToStorage has upsert: true, so it overwrites correctly
            const uploadResult = await uploadToStorage(pdfFile, "accreditations", fixedFileName);
            
            const currentDocs = finalAcc.documents || {};
            finalUpdated = await AccreditationsAPI.update(id, {
              documents: { ...currentDocs, accreditation_pdf: uploadResult.url }
            });
          } catch (uploadErr) {
            console.error("[BackgroundQueue] PDF regeneration failed:", uploadErr);
          }
        }

        // 4. Send Email if requested
        if (approveData?.sendEmail) {
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
        }

        if (onSuccess) onSuccess(finalUpdated);
      }
    } catch (err) {
      console.error("[BackgroundQueue] Task failed:", err);
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
