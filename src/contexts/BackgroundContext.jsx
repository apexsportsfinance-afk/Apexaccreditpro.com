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
        const id = task.id;
        const { accreditation: currentAccInput, eventId, approveData, pdfSize, onSuccess } = task;

        // 1. Fetch latest data to ensure we have current status and documents
        // Use the API wrapper instead of raw supabase for consistent error handling/retries
        let currentAcc;
        try {
          currentAcc = await AccreditationsAPI.getById(id);
        } catch (e) {
          console.warn("[BackgroundQueue] Failed to fetch latest accreditation, using input data", e);
          currentAcc = currentAccInput;
        }

        if (!currentAcc) throw new Error(`Accreditation ${id} not found`);

        const resolvedEventId = eventId || currentAcc?.eventId;
        if (!resolvedEventId) throw new Error(`Event ID not found for accreditation ${id}`);

        // Fetch auxiliary data in parallel, but handle failures gracefully
        const [eventData, allZones] = await Promise.all([
          EventsAPI.getById(resolvedEventId).catch(err => {
            console.error("[BackgroundQueue] Failed to fetch event data:", err);
            return null;
          }),
          ZonesAPI.getByEventId(resolvedEventId).catch(err => {
            console.error("[BackgroundQueue] Failed to fetch zones:", err);
            return [];
          })
        ]);

        // 2. Determine if we need to regenerate Badge ID or update status to approved
        let finalAcc = currentAcc;
        const needsApproval = finalAcc.status !== "approved";
        const needsBadge = !finalAcc.badgeNumber || finalAcc.badgeNumber === "---";

        if (needsApproval || needsBadge) {
          const role = finalAcc.role || "Guest";
          const { count } = await supabase
            .from("accreditations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", resolvedEventId)
            .eq("role", role)
            .eq("status", "approved");
          
          const { getBadgePrefix } = await import("../lib/utils");
          const prefix = getBadgePrefix(role);
          
          // Only generate a NEW badge number if we don't already have one
          const badgeNumber = (finalAcc.badgeNumber && finalAcc.badgeNumber !== "---") 
            ? finalAcc.badgeNumber 
            : `${prefix}-${String((count || 0) + 1).padStart(3, "0")}`;
            
          const zoneCodeStr = approveData?.zoneCodes?.join(",") || finalAcc.zoneCode || "";
          
          // AccreditationsAPI.approve explicitly sets status: "approved"
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
            const uploadResult = await uploadToStorage(pdfFile, "accreditations", fixedFileName);
            
            const currentDocs = finalAcc.documents || {};
            const updatePayload = {
              documents: { ...currentDocs, accreditation_pdf: uploadResult.url }
            };
            
            // Re-assert approval status to be safe, especially for new events 
            // where we want to ensure any internal cache is bypassed
            if (finalAcc.status === "approved") {
              updatePayload.status = "approved";
              if (finalAcc.badgeNumber) updatePayload.badge_number = finalAcc.badgeNumber;
              if (finalAcc.accreditationId) updatePayload.accreditation_id = finalAcc.accreditationId;
            }

            finalUpdated = await AccreditationsAPI.update(id, updatePayload);
          } catch (uploadErr) {
            console.error("[BackgroundQueue] PDF regeneration failed:", uploadErr);
          }
        }

        // 4. Sync UI state as soon as the main DB transitions are complete
        if (onSuccess) onSuccess(finalUpdated);

        // 5. Send Email if requested (Secondary step, failures won't block UI sync)
        if (approveData?.sendEmail) {
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
          } catch (emailErr) {
            console.error("[BackgroundQueue] Email delivery failed:", emailErr);
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
