import React, { createContext, useContext, useState, useEffect } from "react";
import { AccreditationsAPI, EventsAPI } from "../lib/storage";
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
      const { id, accreditation, eventId, approveData, onSuccess, pdfSize } = task;
      
      // Determine the Badge Number (generate if missing)
      let badgeNumber = accreditation.badgeNumber || accreditation.badge_number;
      const role = accreditation.role || "Guest";
      
      if (!badgeNumber) {
        const { count } = await supabase
          .from("accreditations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("role", role)
          .eq("status", "approved");
        
        const prefix = getBadgePrefix(role);
        badgeNumber = `${prefix}-${String((count || 0) + 1).padStart(3, "0")}`;
      }

      const zoneCodeStr = approveData.zoneCodes?.join(",") || "";

      // Formal approval (generates permanent Accreditation ID and saves Badge Number)
      const updated = await AccreditationsAPI.approve(id, zoneCodeStr, badgeNumber, role);

      const eventData = await EventsAPI.getById(eventId);

      // 1. Generate PDF with requested size (defaults to A6 if not specified)
      const pdfResult = await generatePdfAttachment(updated, eventData, approveData.zoneCodes, pdfSize || "a6");
      const pdfBlob = pdfResult?.pdfBlob;
      const pdfName = pdfResult?.pdfFileName;
      const pdfBase64 = pdfResult?.pdfBase64;
      
      // 2. Upload PDF to storage for caching
      let storedPdfUrl = null;
      let finalUpdated = updated;

      if (pdfBlob) {
        try {
          // Create a file object from blob for the upload utility
          const fixedFileName = `${accreditation.id}_final.pdf`;
          const pdfFile = new File([pdfBlob], fixedFileName, { type: "application/pdf" });
          const uploadResult = await uploadToStorage(pdfFile, "accreditations", fixedFileName);
          storedPdfUrl = uploadResult.url;
          
          // 3. Update accreditation record with PDF URL
          const currentDocs = updated.documents || {};
          finalUpdated = await AccreditationsAPI.update(id, {
            documents: { ...currentDocs, accreditation_pdf: storedPdfUrl }
          });
        } catch (uploadErr) {
          console.error("[BackgroundQueue] PDF upload failed:", uploadErr);
        }
      }

      // 4. Send Email
      // ... (rest of code)
      await sendApprovalEmail({
        to: finalUpdated.email,
        name: `${finalUpdated.firstName} ${finalUpdated.lastName}`,
        eventName: eventData?.name || "Event",
        eventLocation: eventData?.location || "",
        eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
        role: finalUpdated.role,
        accreditationId: finalUpdated.accreditationId || finalUpdated.badgeNumber,
        badgeNumber: finalUpdated.badgeNumber || "",
        zoneCode: finalUpdated.zoneCode || approveData.zoneCodes?.join(",") || "",
        reportingTimes: eventData?.reportingTimes || "",
        eventId: finalUpdated.eventId,
        pdfBase64: pdfBase64 || null,
        pdfFileName: pdfName || null
      });

      if (onSuccess) onSuccess(finalUpdated);
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
