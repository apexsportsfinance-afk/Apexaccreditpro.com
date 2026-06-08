import React, { useState, useCallback } from "react";
import html2canvas from "html2canvas";
import AccreditationCardPreview, { CardInner } from "./AccreditationCardPreview";
import MembershipCardPreview, { MembershipCardInner } from "./MembershipCardPreview";
import { OUTPUT_TYPES } from "../../lib/constants";
import { useToast } from "../ui/Toast";

const AccreditationCard = ({ accreditation, event, zones = [] }) => {
  const [downloadingId, setDownloadingId] = useState(null);
  const toast = useToast();

  const captureElement = async (elementId, scale = 3) => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element #${elementId} not found`);

    const isMembership = event?.outputType === OUTPUT_TYPES.MEMBERSHIP;
    const wPx = isMembership ? 324 : 320;
    const hPx = isMembership ? 204 : 454;

    return await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: wPx,
      height: hPx
    });
  };

  const handleDownloadPNG = useCallback(async () => {
    const id = accreditation?.id;
    if (!id || downloadingId === id) return;
    setDownloadingId(id);

    try {
      const frontCanvas = await captureElement("accreditation-front-card", 3);
      const link = document.createElement("a");
      link.download = `${accreditation.firstName}_${accreditation.lastName}_Card.png`;
      link.href = frontCanvas.toDataURL("image/png", 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (document.getElementById("accreditation-back-card")) {
        await new Promise(r => setTimeout(r, 300));
        const backCanvas = await captureElement("accreditation-back-card", 3);
        const link2 = document.createElement("a");
        link2.download = `${accreditation.firstName}_${accreditation.lastName}_Card_Back.png`;
        link2.href = backCanvas.toDataURL("image/png", 1.0);
        document.body.appendChild(link2);
        link2.click();
        document.body.removeChild(link2);
      }
      toast.success("Cards downloaded as PNG images!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  }, [accreditation, downloadingId, toast]);

  if (!accreditation) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        No accreditation data provided
      </div>
    );
  }

  const isMembership = event?.outputType === OUTPUT_TYPES.MEMBERSHIP;
  const PreviewComponent = isMembership ? MembershipCardPreview : AccreditationCardPreview;

  return (
    <div id="accreditation-card-wrapper" className="inline-block">
      <PreviewComponent
        accreditation={accreditation}
        event={event}
        zones={zones}
      />
    </div>
  );
};

export default AccreditationCard;
export { CardInner };
