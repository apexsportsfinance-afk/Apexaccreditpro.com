import React, { useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { getCountryName, calculateAge } from "../../lib/utils";

const roleColorSchemes = {
  athlete: { bg: "#2563eb", text: "#ffffff" },
  coach: { bg: "#0d9488", text: "#ffffff" },
  media: { bg: "#d97706", text: "#ffffff" },
  official: { bg: "#7c3aed", text: "#ffffff" },
  medical: { bg: "#e11d48", text: "#ffffff" },
  staff: { bg: "#475569", text: "#ffffff" },
  vip: { bg: "#b45309", text: "#ffffff" }
};
const getRoleColors = (r) => roleColorSchemes[r?.toLowerCase()] || { bg: "#475569", text: "#fff" };

export default function BadgeGenerator({ accreditation, event, zones = [], onClose }) {
  const [generating, setGenerating] = useState(false);

  const generateBadgePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [148, 210] // A5 portrait size
      });

      /* ---------- DATA ---------- */
      const roleColors = getRoleColors(accreditation.role);
      const fullName = `${accreditation.firstName || ""} ${accreditation.lastName || ""}`.trim().toUpperCase();
      const countryName = getCountryName(accreditation.nationality);
      const zoneCodes = accreditation.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
      const age = accreditation.dateOfBirth && event?.ageCalculationYear
        ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
        : null;

      /* ---------- HEADER ---------- */
      pdf.setFillColor(245, 249, 255);
      pdf.rect(0, 0, 148, 27, "F");
      pdf.setTextColor(30, 58, 138);
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(event?.name?.toUpperCase() || "EVENT NAME", 140, 13, { align: "right" });
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(event?.headerSubtitle || "", 140, 20, { align: "right" });

      /* ---------- ROLE BANNER ---------- */
      pdf.setFillColor(roleColors.bg);
      pdf.rect(0, 27, 148, 15, "F"); // increased height
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text((accreditation.role || "PARTICIPANT").toUpperCase(), 74, 37, { align: "center" });

      /* ---------- BODY SECTION ---------- */
      const leftX = 10;     // photo position
      const rightX = 66;    // text starting point (shifted right)
      const topY = 47;      // start position for top of photo/text

      // Photo box
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(leftX, topY, 46, 56);
      if (accreditation.photoUrl) {
        const img = new Image();
        img.src = accreditation.photoUrl;
        pdf.addImage(img, "JPEG", leftX, topY, 46, 56);
      }

      /* ---------- TEXT CONTENT ---------- */
      const nameLength = fullName.length;
      let nameFont = 18;
      if (nameLength > 26) nameFont = 12;
      else if (nameLength > 20) nameFont = 14;
      else if (nameLength > 16) nameFont = 16;

      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(nameFont);
      pdf.setTextColor(30, 58, 138);
      pdf.text(fullName, rightX, topY + 8);

      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text(accreditation.club || "Club Name", rightX, topY + 18);
      pdf.setFontSize(11);
      pdf.text(`${age !== null ? age + " Y  |  " : ""}${accreditation.gender || ""}`, rightX, topY + 28);

      pdf.setTextColor(30, 64, 175);
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(countryName, rightX, topY + 45);

      /* ---------- IDs BELOW PHOTO ---------- */
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      const idNumber = accreditation.accreditationId?.split("-")?.pop() || "---";
      pdf.text(`ID: ${idNumber}`, rightX, 121);
      pdf.text(`Badge: ${accreditation.badgeNumber || "---"}`, rightX, 126);

      /* ---------- QR CODE ---------- */
      const verifyId = accreditation.accreditationId || accreditation.badgeNumber || accreditation.id || "unknown";
      const verifyUrl = `${window.location.origin}/verify/${verifyId}`;
      const qrCanvas = await QRCode.toCanvas(verifyUrl, {
        errorCorrectionLevel: "H",
        margin: 0,
        width: 300,
        color: { dark: "#000000", light: "#FFFFFF" }
      });
      const qrImg = qrCanvas.toDataURL("image/png");
      pdf.addImage(qrImg, "PNG", 98, 132, 35, 35);
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("SCAN TO VERIFY", 115, 172, { align: "center" });

      /* ---------- ZONE SECTION ---------- */
      pdf.setFillColor(0, 61, 82);
      pdf.rect(0, 182, 148, 20, "F");  // thicker bar
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(18);
      const zonesText = zoneCodes.length ? zoneCodes.slice(0, 4).join("   ") : "NO ACCESS";
      pdf.text(zonesText, 74, 194, { align: "center" });

      /* ---------- BORDER ---------- */
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.rect(2, 2, 144, 206);

      /* ---------- SAVE ---------- */
      const fileName = `${accreditation.firstName}_${accreditation.lastName}_Badge_${accreditation.badgeNumber || "card"}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("Badge PDF error:", err);
      alert("Something went wrong while generating the PDF.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Generate Accreditation PDF</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={generateBadgePDF}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-lg"
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Download Accreditation PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}