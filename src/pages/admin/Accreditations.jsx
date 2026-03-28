import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { motion } from "motion/react";
import EditAccreditationModal from "../../components/EditAccreditationModal";
import {
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Loader2,
  Edit,
  Link,
  Copy,
  Check,
  Plus,
  AlertCircle,
  AlertTriangle,
  Mail,
  Image as ImageIcon
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import Card, { CardContent } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import AccreditationCardPreview from "../../components/accreditation/AccreditationCardPreview";
import BadgeGenerator from "../../components/accreditation/BadgeGenerator";
import {
  EventsAPI,
  AccreditationsAPI,
  ZonesAPI,
  EventCategoriesAPI
} from "../../lib/storage";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { supabase } from "../../lib/supabase";
import {
  sendApprovalEmail,
  sendRejectionEmail
} from "../../lib/email";
import ComposeEmailModal from "../../components/accreditation/ComposeEmailModal";
import { generatePdfAttachment } from "../../lib/pdfEmailHelper";
import {
  formatDate,
  calculateAge,
  ROLES,
  ROLE_BADGE_PREFIXES,
  COUNTRIES,
  printPdfBlob,
  isExpired,
  getExpirationLabel
} from "../../lib/utils";
import {
  downloadCapturedPDF,
  openCapturedPDFInTab,
  getCapturedPDFBlob,
  PDF_SIZES,
  IMAGE_SIZES,
  downloadAsImages
} from "../../lib/pdfCapture";
import { exportToExcel, exportTableToPDF } from "../../components/accreditation/ExportUtils";
import { bulkDownloadPDFs } from "../../components/accreditation/cardExport";
import BulkOperations from "../../components/accreditation/BulkOperations";
import { downloadSinglePhoto, downloadFullRecord, bulkDownloadPhotos } from "../../lib/imageDownload";

export default function Accreditations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [events, setEvents] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventCategories, setEventCategories] = useState([]);
  const [filters, setFilters] = useState({ status: "", role: "", nationality: "", club: "" });
  const [selectedRows, setSelectedRows] = useState([]);
  const [viewModal, setViewModal] = useState({ open: false, accreditation: null });
  const [approveModal, setApproveModal] = useState({ open: false, accreditation: null });
  const [rejectModal, setRejectModal] = useState({ open: false, accreditation: null });
  const [bulkApproveModal, setBulkApproveModal] = useState(false);
  const [approveData, setApproveData] = useState({ zoneCodes: [], sendEmail: true });
  const [rejectData, setRejectData] = useState({ remarks: "", sendEmail: true });
  const [downloadingId, setDownloadingId] = useState(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState({ open: false, accreditation: null });
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [badgeGeneratorModal, setBadgeGeneratorModal] = useState({ open: false, accreditation: null });
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [selectedPdfSize, setSelectedPdfSize] = useState("a6");
  const [selectedImageSize, setSelectedImageSize] = useState("medium");
  const [editModal, setEditModal] = useState({ open: false, accreditation: null });
  const [editSaving, setEditSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [shareLinkModal, setShareLinkModal] = useState({ open: false, accreditation: null });
  const [shareLinkData, setShareLinkData] = useState({ expiryDate: "", expiryTime: "23:59" });
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [updatingExpiry, setUpdatingExpiry] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, accreditation: null });
  const [deleting, setDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleteConfirmModal, setBulkDeleteConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const initializedRef = React.useRef(false);
  const [emailModal, setEmailModal] = useState({ open: false, accreditation: null });
  const [imageDownloadingId, setImageDownloadingId] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [frontBackgroundUrl, setFrontBackgroundUrl] = useState("");

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        const allEvents = await EventsAPI.getAll();
        setEvents(allEvents);
        const eventParam = searchParams.get("event");
        const targetEventId = eventParam || (allEvents.length > 0 ? allEvents[0].id : null);
        if (targetEventId) {
          setSelectedEvent(targetEventId);
          const [accData, zoneData] = await Promise.all([
            AccreditationsAPI.getByEventId(targetEventId),
            ZonesAPI.getByEventId(targetEventId)
          ]);
          setAccreditations(accData);
          setZones(zoneData);
          try {
            const { data: ecData } = await supabase
              .from("event_categories")
              .select("*, category:categories(*)")
              .eq("event_id", targetEventId);
            if (ecData) setEventCategories(ecData);
          } catch (ecErr) {
            console.warn("Event categories load failed (non-critical):", ecErr);
          }
          try {
            const clubData = await GlobalSettingsAPI.getClubs(targetEventId);
            setClubs(clubData);
          } catch { setClubs([]); }
          try {
            const frontBg = await GlobalSettingsAPI.get(`event_${targetEventId}_front_bg`);
            setFrontBackgroundUrl(frontBg || "");
          } catch { setFrontBackgroundUrl(""); }
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
        const errorMessage = error.message?.includes("Access denied")
          ? "Access denied. Please log in again."
          : error.message?.includes("Network error") || error.message === "Failed to fetch"
            ? "Network error. Please check your internet connection and refresh the page."
            : "Failed to load data. Please refresh the page.";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
        initializedRef.current = true;
      }
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (!selectedEvent || !initializedRef.current) return;
    const loadEventData = async () => {
      setLoading(true);
      try {
        const [accData, zoneData] = await Promise.all([
          AccreditationsAPI.getByEventId(selectedEvent),
          ZonesAPI.getByEventId(selectedEvent)
        ]);
        setAccreditations(accData);
        setZones(zoneData);
        searchParams.set("event", selectedEvent);
        setSearchParams(searchParams);
        try {
          const { data: ecData } = await supabase
            .from("event_categories")
            .select("*, category:categories(*)")
            .eq("event_id", selectedEvent);
          if (ecData) setEventCategories(ecData);
        } catch (ecErr) {
          console.warn("Event categories (non-critical):", ecErr);
        }
        try {
          const clubData = await GlobalSettingsAPI.getClubs(selectedEvent);
          setClubs(clubData);
        } catch { setClubs([]); }
        try {
          const frontBg = await GlobalSettingsAPI.get(`event_${selectedEvent}_front_bg`);
          setFrontBackgroundUrl(frontBg || "");
        } catch { setFrontBackgroundUrl(""); }
      } catch (error) {
        console.error("Failed to load event data:", error);
        toast.error("Failed to load accreditations. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadEventData();
    setSelectedRows([]);
  }, [selectedEvent]);


  const refreshAccreditations = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const accData = await AccreditationsAPI.getByEventId(selectedEvent);
      setAccreditations(accData);
    } catch (error) {
      console.error("Failed to refresh accreditations:", error);
    }
  }, [selectedEvent]);

  const resetFilters = useCallback(() => {
    setFilters({ status: "", role: "", nationality: "", club: "" });
    toast.success("Filters cleared");
  }, [toast]);

  const filteredAccreditations = useMemo(() => {
    return (Array.isArray(accreditations) ? accreditations : []).filter((acc) => {
      if (filters.status && acc.status !== filters.status) return false;
      if (filters.role && acc.role !== filters.role) return false;
      if (filters.nationality && acc.nationality !== filters.nationality) return false;
      if (filters.club && !acc.club?.toLowerCase().includes(filters.club.toLowerCase())) return false;
      return true;
    });
  }, [accreditations, filters]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    const seen = new Map();
    (accreditations || []).forEach(acc => {
      if (!acc.firstName || !acc.lastName) return;
      const key = `${acc.firstName.trim().toLowerCase()}|${acc.lastName.trim().toLowerCase()}|${acc.club?.trim().toLowerCase()}`;
      if (seen.has(key)) {
        ids.add(acc.id);
        ids.add(seen.get(key));
      } else {
        seen.set(key, acc.id);
      }
    });
    return ids;
  }, [accreditations]);

  const currentEvent = events.find((e) => e.id === selectedEvent);

  const handleOpenEdit = useCallback(async (accreditation) => {
    setEditModal({ open: true, accreditation });
    setLoadingCategories(true);
    try {
      const eventCats = await EventCategoriesAPI.getByEventId(accreditation.eventId);
      setEventCategories(eventCats);
    } catch (err) {
      console.error("Failed to load event categories:", err);
      setEventCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const handleOpenShareLink = useCallback((accreditation) => {
    const defaultDate = accreditation.expiresAt
      ? new Date(accreditation.expiresAt).toISOString().split("T")[0]
      : "";
    const defaultTime = accreditation.expiresAt
      ? new Date(accreditation.expiresAt).toTimeString().slice(0, 5)
      : "23:59";
    setShareLinkData({ expiryDate: defaultDate, expiryTime: defaultTime });
    setGeneratedLink("");
    setLinkCopied(false);
    setShareLinkModal({ open: true, accreditation });
  }, []);

  const generateShareLink = useCallback(async () => {
    if (!shareLinkData.expiryDate) {
      toast.error("Please select an expiry date");
      return;
    }
    setUpdatingExpiry(true);
    try {
      const expiryDateTime = new Date(`${shareLinkData.expiryDate}T${shareLinkData.expiryTime}:00`);
      if (expiryDateTime <= new Date()) {
        toast.error("Expiry date must be in the future");
        setUpdatingExpiry(false);
        return;
      }
      await AccreditationsAPI.update(shareLinkModal.accreditation.id, {
        expiresAt: expiryDateTime.toISOString()
      });
      const accreditationId = shareLinkModal.accreditation.accreditationId || shareLinkModal.accreditation.id;
      const link = `${window.location.origin}/accreditation/${accreditationId}`;
      setGeneratedLink(link);
      await refreshAccreditations();
      toast.success("Expiry updated and link generated!");
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Failed to generate link: " + (error.message || "Unknown error"));
    } finally {
      setUpdatingExpiry(false);
    }
  }, [shareLinkData, shareLinkModal.accreditation, toast, refreshAccreditations]);

  const copyShareLink = useCallback(async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const input = document.getElementById("share-link-input");
      if (input) {
        input.select();
        document.execCommand("copy");
        setLinkCopied(true);
        toast.success("Link copied!");
        setTimeout(() => setLinkCopied(false), 2000);
      }
    }
  }, [generatedLink, toast]);

  const handleOpenDeleteConfirm = useCallback((accreditation) => {
    setDeleteConfirmModal({ open: true, accreditation });
  }, []);

  const confirmDeleteAccreditation = useCallback(async () => {
    if (!deleteConfirmModal.accreditation) return;
    setDeleting(true);
    try {
      await AccreditationsAPI.delete(deleteConfirmModal.accreditation.id);
      toast.success("Accreditation permanently deleted");
      setDeleteConfirmModal({ open: false, accreditation: null });
      await refreshAccreditations();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmModal.accreditation, toast, refreshAccreditations]);

  const handleApprove = (accreditation) => {
    setApproveData({ zoneCodes: [], sendEmail: true });
    setApproveModal({ open: true, accreditation });
  };

  const confirmApprove = async () => {
    if (!approveData.zoneCodes || approveData.zoneCodes.length === 0) {
      toast.error("Please select zone access");
      return;
    }
    setApproving(true);
    try {
      const accreditation = approveModal.accreditation;
      const eventData = events.find((e) => e.id === accreditation.eventId);
      const role = accreditation.role || "Unknown";
      const prefix = ROLE_BADGE_PREFIXES[role] || role.substring(0, 3).toUpperCase() || "GEN";
      const isReApproval = accreditation.status === "approved";
      let badgeNumber = accreditation.badgeNumber;
      if (!isReApproval || !badgeNumber) {
        const { count: existingCount } = await supabase
          .from("accreditations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", accreditation.eventId)
          .eq("role", role)
          .eq("status", "approved");
        badgeNumber = `${prefix}-${String((existingCount || 0) + 1).padStart(3, "0")}`;
      }
      const zoneCodeString = approveData.zoneCodes.join(",");
      await AccreditationsAPI.approve(accreditation.id, zoneCodeString, badgeNumber);
      await refreshAccreditations();

      if (approveData.sendEmail) {
        // Fetch the saved record from DB to get the real accreditation_id (ACC-2025-xxx)
        // The QR code MUST encode the same value the verify page looks up by.
        let freshAccreditation = null;
        try {
          freshAccreditation = await AccreditationsAPI.getById(accreditation.id);
        } catch (fetchErr) {
          console.warn("[Approve] Failed to re-fetch accreditation after approve:", fetchErr);
        }

        // Use the DB-driven accreditationId for the QR; fall back to local if fetch fails
        const realAccreditationId = freshAccreditation?.accreditationId || accreditation.accreditationId;
        const updatedAcc = {
          ...accreditation,
          ...(freshAccreditation || {}),
          badgeNumber,
          zoneCode: zoneCodeString,
          status: "approved",
          accreditationId: realAccreditationId
        };

        let pdfData = null;
        try {
          pdfData = await generatePdfAttachment(updatedAcc, eventData, zones);
        } catch (pdfErr) {
          console.warn("[Approve] PDF generation failed:", pdfErr);
        }

        let emailResult = { success: false };
        try {
          emailResult = await sendApprovalEmail({
            to: accreditation.email,
            name: `${accreditation.firstName} ${accreditation.lastName}`,
            eventName: eventData?.name || "Event",
            eventLocation: eventData?.location || "",
            eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
            role: accreditation.role,
            accreditationId: realAccreditationId || badgeNumber,
            badgeNumber: badgeNumber,
            zoneCode: zoneCodeString,
            reportingTimes: eventData?.reportingTimes || "",
            pdfBase64: pdfData?.pdfBase64 || null,
            pdfFileName: pdfData?.pdfFileName || null
          });
        } catch (emailErr) {
          console.error("[Approve] Email send error:", emailErr);
        }

        if (emailResult.success) {
          toast.success(`Accreditation ${isReApproval ? "re-approved" : "approved"} and email with PDF sent!`);
        } else {
          console.warn("[Approve] Email failed:", emailResult.error);
          toast.success(`Accreditation ${isReApproval ? "re-approved" : "approved"}! Email notification may have failed.`);
        }
      } else {
        toast.success(`Accreditation ${isReApproval ? "re-approved" : "approved"}! (Email skipped)`);
      }
      setApproveModal({ open: false, accreditation: null });

    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Failed to complete approval. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = (accreditation) => {
    setRejectData({ remarks: "", sendEmail: true });
    setRejectModal({ open: true, accreditation });
  };

  const confirmReject = async () => {
    if (!rejectData.remarks.trim()) {
      toast.error("Please provide rejection remarks");
      return;
    }
    setRejecting(true);
    try {
      const accreditation = rejectModal.accreditation;
      const eventData = events.find((e) => e.id === accreditation.eventId);
      await AccreditationsAPI.reject(accreditation.id, rejectData.remarks);
      await refreshAccreditations();

      if (rejectData.sendEmail) {
        let emailResult = { success: false };
        try {
          emailResult = await sendRejectionEmail({
            to: accreditation.email,
            name: `${accreditation.firstName} ${accreditation.lastName}`,
            eventName: eventData?.name || "Event",
            role: accreditation.role,
            remarks: rejectData.remarks,
            resubmitUrl: eventData?.slug ? `${window.location.origin}/register/${eventData.slug}` : null
          });
        } catch (emailErr) {
          console.error("[Reject] Email send error:", emailErr);
        }

        if (emailResult.success) {
          toast.success("Accreditation rejected and email sent!");
        } else {
          console.warn("[Reject] Email failed:", emailResult.error);
          toast.success("Accreditation rejected! Email may have failed.");
        }
      } else {
        toast.success("Accreditation rejected! (Email skipped)");
      }
      setRejectModal({ open: false, accreditation: null });
    } catch (error) {
      console.error("Rejection error:", error);
      toast.error("Failed to complete rejection. Please try again.");
    } finally {
      setRejecting(false);
    }
  };

  const handleBulkApprove = () => {
    if (selectedRows.length === 0) {
      toast.warning("No accreditations selected");
      return;
    }
    setApproveData({ zoneCodes: [], sendEmail: true });
    setBulkApproveModal(true);
  };

  const confirmBulkApprove = async () => {
    if (!approveData.zoneCodes || approveData.zoneCodes.length === 0) {
      toast.error("Please select zone access");
      return;
    }
    setApproving(true);
    try {
      const zoneCodeString = approveData.zoneCodes.join(",");
      await AccreditationsAPI.bulkApprove(selectedRows, zoneCodeString);
      await refreshAccreditations();
      if (approveData.sendEmail) {
        const updatedAccData = await AccreditationsAPI.getByEventId(selectedEvent);
        let emailsSent = 0;
        let emailsFailed = 0;
        
        const CHUNK_SIZE = 5;
        for (let i = 0; i < selectedRows.length; i += CHUNK_SIZE) {
          const chunkIds = selectedRows.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunkIds.map(async (rowId) => {
            const acc = updatedAccData.find((a) => a.id === rowId);
            if (!acc || !acc.email) return;
            const eventData = events.find((e) => e.id === acc.eventId);
            
            let pdfData = null;
            try {
              pdfData = await generatePdfAttachment(acc, eventData, zones);
            } catch (pdfErr) {
              console.warn(`[BulkApprove] PDF failed for ${acc.email}:`, pdfErr);
            }

            try {
              const emailResult = await sendApprovalEmail({
                to: acc.email,
                name: `${acc.firstName} ${acc.lastName}`,
                eventName: eventData?.name || "Event",
                eventLocation: eventData?.location || "",
                eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
                role: acc.role,
                accreditationId: acc.accreditationId || acc.badgeNumber,
                badgeNumber: acc.badgeNumber || "",
                zoneCode: acc.zoneCode || zoneCodeString,
                reportingTimes: eventData?.reportingTimes || "",
                pdfBase64: pdfData?.pdfBase64 || null,
                pdfFileName: pdfData?.pdfFileName || null
              });
              if (emailResult.success) {
                emailsSent++;
              } else {
                emailsFailed++;
              }
            } catch (emailErr) {
              console.error(`[BulkApprove] Email failed for ${acc.email}:`, emailErr);
              emailsFailed++;
            }
          }));
        }

        if (emailsFailed === 0) {
          toast.success(`${selectedRows.length} approved and ${emailsSent} emails sent!`);
        } else {
          toast.success(`${selectedRows.length} approved. Emails: ${emailsSent} sent, ${emailsFailed} failed.`);
        }
      } else {
        toast.success(`${selectedRows.length} approved! (Emails skipped)`);
      }
      setBulkApproveModal(false);
      setSelectedRows([]);
    } catch (error) {
      console.error("Bulk approve error:", error);
      toast.error("Failed to bulk approve. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleBulkEdit = async (ids, updates) => {
    if (!ids || ids.length === 0) return;
    setBulkEditing(true);
    try {
      await AccreditationsAPI.bulkUpdate(ids, updates);
      toast.success(`${ids.length} accreditations updated successfully`);
      setSelectedRows([]);
      await refreshAccreditations();
    } catch (error) {
      console.error("Bulk edit error:", error);
      toast.error("Failed to update accreditations: " + (error.message || "Unknown error"));
    } finally {
      setBulkEditing(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) {
      toast.warning("No accreditations selected");
      return;
    }
    setBulkDeleteConfirmModal(true);
  };

  const confirmBulkDelete = async () => {
    setDeleting(true);
    try {
      await AccreditationsAPI.bulkDelete(selectedRows);
      toast.success(`${selectedRows.length} accreditations permanently deleted`);
      setBulkDeleteConfirmModal(false);
      setSelectedRows([]);
      await refreshAccreditations();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };

  const handlePreviewPDF = useCallback(async (accreditation) => {
    setPdfPreviewLoading(true);
    setPdfPreviewModal({ open: true, accreditation });
    setTimeout(() => { setPdfPreviewLoading(false); }, 500);
  }, []);

  const closePdfPreviewModal = useCallback(() => {
    setPdfPreviewModal({ open: false, accreditation: null });
  }, []);

  const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false) => {
    const id = accreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    try {
      const fileName = `${accreditation.firstName}_${accreditation.lastName}_${selectedPdfSize.toUpperCase()}_${accreditation.accreditationId || "accreditation"}.pdf`;
      if (openInBrowser) {
        await openCapturedPDFInTab("accreditation-front-card", "accreditation-back-card", selectedPdfSize);
        toast.success("PDF opened in new tab!");
      } else {
        await downloadCapturedPDF("accreditation-front-card", "accreditation-back-card", fileName, selectedPdfSize);
        toast.success("PDF downloaded! Check your Downloads folder.");
      }
    } catch (err) {
      console.error("PDF capture error:", err);
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, toast, selectedPdfSize]);

  const handleDownloadImages = useCallback(async (accreditation) => {
    const id = accreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    try {
      const clubStr = accreditation.club ? `${accreditation.club.replace(/\s+/g, '_')}_` : "";
      const baseFileName = `${clubStr}${accreditation.firstName}_${accreditation.lastName}_${selectedImageSize}_${accreditation.accreditationId || "card"}`;
      await downloadAsImages("accreditation-front-card", "accreditation-back-card", baseFileName, selectedImageSize);
      toast.success("Images downloaded! Check your Downloads folder.");
    } catch (err) {
      console.error("Image capture error:", err);
      toast.error("Failed to generate images: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, toast, selectedImageSize]);

  const handlePrintPDF = useCallback(async () => {
    try {
      const blob = await getCapturedPDFBlob("accreditation-front-card", "accreditation-back-card");
      const url = URL.createObjectURL(blob);
      printPdfBlob(url);
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Failed to print: " + (err.message || "Unknown error"));
    }
  }, [toast]);

  const handleDownloadPhoto = useCallback(async (accreditation) => {
    if (imageDownloadingId === accreditation.id) return;
    setImageDownloadingId(accreditation.id);
    try {
      await downloadSinglePhoto(accreditation, "photo");
      toast.success("Photo downloaded!");
    } catch (err) {
      console.error("Photo download error:", err);
      toast.error("Failed to download photo: " + (err.message || "Unknown error"));
    } finally {
      setImageDownloadingId(null);
    }
  }, [imageDownloadingId, toast]);

  const handleDownloadAllDocs = useCallback(async (accreditation) => {
    if (imageDownloadingId === accreditation.id) return;
    setImageDownloadingId(accreditation.id);
    try {
      const count = await downloadFullRecord(accreditation);
      toast.success(`${count} file(s) downloaded!`);
    } catch (err) {
      console.error("Document download error:", err);
      toast.error("Failed to download: " + (err.message || "Unknown error"));
    } finally {
      setImageDownloadingId(null);
    }
  }, [imageDownloadingId, toast]);

  const columns = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      className: "min-w-[250px]",
      render: (row) => {
        const isDuplicate = duplicateIds.has(row.id);
        return (
          <div className="flex items-center gap-3">
            {row.photoUrl ? (
              <img
                src={row.photoUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-primary-500/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {row.firstName?.[0]}{row.lastName?.[0]}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-whiteElite tracking-tight">
                  {row.firstName} {row.lastName}
                </p>
                {isDuplicate && (
                  <span title="Potential Duplicate Registration" className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-critical/10 text-critical uppercase tracking-wider border border-critical/20">
                    <AlertTriangle className="w-3 h-3" /> Duplicate
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{row.email}</p>
            </div>
          </div>
        );
      }
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      className: "w-[120px]",
      render: (row) => (
        <Badge>{row.role}</Badge>
      )
    },
    { key: "club", header: "Club", sortable: true, className: "min-w-[200px]" },
    {
      key: "nationality",
      header: "Country",
      sortable: true,
      className: "w-[100px]",
      render: (row) => <span className="text-lg">{row.nationality}</span>
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      className: "w-[140px]",
      render: (row) => {
        const Icon = row.status === "approved" ? CheckCircle 
                   : row.status === "rejected" ? XCircle 
                   : Clock;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"} className="flex items-center gap-1.5 w-fit">
              <Icon className="w-3.5 h-3.5" />
              {row.status}
            </Badge>
            {row.status === "approved" && (
              <div className="text-[10px] text-slate-400 font-medium px-1 flex flex-col leading-tight">
                <span className="truncate max-w-[120px]" title={row.approverName || "Unknown"}>
                  by {row.approverName || "Unknown"}
                </span>
                {row.approvedAt && (
                  <span className="text-slate-500 opacity-80">
                    {new Date(row.approvedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: "expiresAt",
      header: "Expiration",
      sortable: true,
      className: "w-[140px]",
      render: (row) => {
        if (row.status !== "approved") {
          return <span className="text-sm text-slate-500 font-medium">—</span>;
        }
        const expired = isExpired(row.expiresAt);
        const label = getExpirationLabel(row.expiresAt);
        return (
          <Badge className="whitespace-nowrap">
            {expired ? "Expired" : label}
          </Badge>
        );
      }
    },
    {
      key: "createdAt",
      header: "Submitted",
      sortable: true,
      className: "w-[140px]",
      render: (row) => (
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{formatDate(row.createdAt)}</span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[220px]",
      render: (row) => (
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setViewModal({ open: true, accreditation: row }); }}
            className="p-1.5 rounded-lg hover:bg-primary-800/30 transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
            className="p-1.5 rounded-lg hover:bg-blue-500/20 transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5 text-blue-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleApprove(row); }}
            className="p-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
            title={row.status === "approved" ? "Re-approve" : "Approve"}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleReject(row); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            title={row.status === "rejected" ? "Already rejected" : "Reject"}
          >
            <XCircle className="w-3.5 h-3.5 text-red-300" />
          </button>
          {row.status === "approved" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePreviewPDF(row); }}
                className="p-1.5 rounded-lg hover:bg-primary-500/20 transition-colors"
                title="Preview and Download PDF"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setBadgeGeneratorModal({ open: true, accreditation: row }); }}
                className="p-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
                title="Generate Simple Badge with QR"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenShareLink(row); }}
                className="p-1.5 rounded-lg hover:bg-cyan-500/20 transition-colors"
                title="Share Link"
              >
                <Link className="w-3.5 h-3.5 text-cyan-300" />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(row); }}
            className="p-1.5 rounded-lg hover:bg-orange-500/20 transition-colors"
            title="Download Uploaded Photo"
            disabled={!row.photoUrl || imageDownloadingId === row.id}
          >
            <ImageIcon className={`w-3.5 h-3.5 ${row.photoUrl ? "text-orange-300" : "text-slate-600"}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEmailModal({ open: true, accreditation: row }); }}
            className="p-1.5 rounded-lg hover:bg-violet-500/20 transition-colors"
            title="Send Email"
          >
            <Mail className="w-3.5 h-3.5 text-violet-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(row); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-300" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div id="accreditations_page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-h1 text-white">Accreditations</h1>
          <p className="text-sm text-slate-500 font-medium tracking-wide mt-1 uppercase">Manage participant accreditations</p>
        </div>
        <Button variant="primary" icon={Plus}>
          Add Accreditation
        </Button>
      </div>

      <Card className="apex-glass border-white/5">
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="xl:col-span-3">
              <Select
                label="Event"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                options={events.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Select an event"
                className="apex-input"
              />
            </div>
            <div className="xl:col-span-9 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <Select
                  label="Status"
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" }
                  ]}
                  placeholder="All Status"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Select
                  label="Role"
                  value={filters.role}
                  onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                  options={
                    eventCategories && eventCategories.length > 0
                      ? eventCategories.map((cat) => {
                          const categoryData = cat.category || cat;
                          const name = categoryData?.name || cat?.name;
                          return name ? { value: name, label: name } : null;
                        }).filter(Boolean)
                      : ROLES.map((r) => ({ value: r, label: r }))
                  }
                  placeholder="All Roles"
                />
              </div>
              <div className="flex-[1.5] min-w-[240px]">
                <SearchableSelect
                  label="Club"
                  value={filters.club}
                  onChange={(e) => setFilters((prev) => ({ ...prev, club: e.target.value }))}
                  options={[
                    ...new Set([
                      ...(clubs?.map(c => typeof c === 'string' ? c : (c?.full || c?.short)).filter(Boolean) || []),
                      ...(accreditations?.map(a => a.club).filter(Boolean) || [])
                    ])
                  ].sort((a,b) => a.localeCompare(b)).map(club => ({ value: club, label: club }))}
                  placeholder="Filter by club..."
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <Select
                  label="Country"
                  value={filters.nationality}
                  onChange={(e) => setFilters((prev) => ({ ...prev, nationality: e.target.value }))}
                  options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                  placeholder="All Countries"
                />
              </div>
              <Button
                variant="ghost"
                icon={XCircle}
                onClick={resetFilters}
                className="h-[46px] text-slate-500 hover:text-critical border-white/5 hover:bg-critical/10 transition-all"
                title="Clear All Filters"
              >
                Clear
              </Button>
            </div>
          </div>

          <BulkOperations
            selectedRows={selectedRows}
            filteredData={filteredAccreditations}
            event={currentEvent}
            zones={zones}
            clubs={clubs}
            eventCategories={eventCategories}
            onClearSelection={setSelectedRows}
            onBulkEdit={handleBulkEdit}
            onBulkApprove={handleBulkApprove}
            onBulkDelete={handleBulkDelete}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
              <p className="text-lg text-slate-400">Loading accreditations...</p>
            </div>
          ) : !selectedEvent ? (
            <EmptyState
              icon={Filter}
              title="Select an Event"
              description="Choose an event to view its accreditations"
            />
          ) : filteredAccreditations.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No Accreditations Found"
              description="No accreditations match your current filters"
            />
          ) : (
            <DataTable
              data={filteredAccreditations}
              columns={columns}
              searchable
              searchFields={["firstName", "lastName", "email", "club"]}
              selectable
              selectedRows={selectedRows}
              onSelectRows={setSelectedRows}
              onRowClick={(row) => setViewModal({ open: true, accreditation: row })}
              rowClassName={(row) => duplicateIds.has(row.id) ? "bg-amber-900/10 hover:bg-amber-900/20" : ""}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Accreditation Modal */}
      <EditAccreditationModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, accreditation: null })}
        accreditation={editModal.accreditation}
        zones={zones}
        eventCategories={eventCategories}
        clubs={clubs}
        saving={editSaving}
        currentEvent={currentEvent}
        onSave={(data) => {
          const saveEdit = async () => {
            setEditSaving(true);
            try {
              const updatePayload = {
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.gender,
                dateOfBirth: data.dateOfBirth,
                nationality: data.nationality,
                club: data.club,
                role: data.role,
                email: data.email,
                photoUrl: data.photoUrl,
                badgeColor: data.badgeColor,
                zoneCode: data.zoneCode || (data.zoneCodes ? data.zoneCodes.join(",") : "")
              };
              updatePayload.expiresAt = data.expiresAt !== undefined ? data.expiresAt : null;
              if (data.roleChanged && editModal.accreditation.status === "approved") {
                const newRole = data.role;
                const prefix = ROLE_BADGE_PREFIXES[newRole] || newRole.substring(0, 3).toUpperCase() || "GEN";
                const { count: existingCount } = await supabase
                  .from("accreditations")
                  .select("id", { count: "exact", head: true })
                  .eq("event_id", editModal.accreditation.eventId)
                  .eq("role", newRole)
                  .eq("status", "approved")
                  .neq("id", editModal.accreditation.id);
                const newBadgeNumber = `${prefix}-${String((existingCount || 0) + 1).padStart(3, "0")}`;
                updatePayload.badgeNumber = newBadgeNumber;
                await AccreditationsAPI.update(editModal.accreditation.id, updatePayload);
                toast.success(`Accreditation updated! New badge number: ${newBadgeNumber}`);
              } else {
                await AccreditationsAPI.update(editModal.accreditation.id, updatePayload);
                toast.success("Accreditation updated successfully");
              }
              setEditModal({ open: false, accreditation: null });
              await refreshAccreditations();
            } catch (error) {
              console.error("Edit save error:", error);
              toast.error("Failed to save changes: " + (error.message || "Unknown error"));
            } finally {
              setEditSaving(false);
            }
          };
          saveEdit();
        }}
      />

      {/* View Modal */}
      <Modal
        isOpen={viewModal.open}
        onClose={() => setViewModal({ open: false, accreditation: null })}
        title="Accreditation Details"
        size="lg"
      >
        {viewModal.accreditation && (
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-6">
              {viewModal.accreditation.photoUrl ? (
                <img
                  src={viewModal.accreditation.photoUrl}
                  alt=""
                  className="w-32 h-40 rounded-lg object-cover border-2 border-primary-500/30"
                />
              ) : (
                <div className="w-32 h-40 rounded-lg bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {viewModal.accreditation.firstName?.[0]}
                    {viewModal.accreditation.lastName?.[0]}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-h2 text-whiteElite">
                  {viewModal.accreditation.firstName} {viewModal.accreditation.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge>
                    {viewModal.accreditation.role}
                  </Badge>
                  <Badge variant={viewModal.accreditation.status === "approved" ? "success" : viewModal.accreditation.status === "rejected" ? "danger" : "warning"}>
                    {viewModal.accreditation.status}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-slate-400 font-medium">
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">Club</span> {viewModal.accreditation.club}
                  </p>
                  <p className="text-sm text-slate-400 font-medium">
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">Email</span> {viewModal.accreditation.email}
                  </p>
                  <p className="text-sm text-slate-400 font-medium">
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">Nationality</span> {viewModal.accreditation.nationality}
                  </p>
                  <p className="text-sm text-slate-400 font-medium">
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">Gender</span> {viewModal.accreditation.gender}
                  </p>
                  <p className="text-sm text-slate-400 font-medium">
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">DOB</span>{" "}
                    {formatDate(viewModal.accreditation.dateOfBirth)}
                    {currentEvent && (
                      <span className="text-slate-500 ml-1 opacity-70">
                        (Age: {calculateAge(viewModal.accreditation.dateOfBirth, currentEvent.ageCalculationYear)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {viewModal.accreditation.status === "approved" && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-emerald-400">Approval Details</h4>
                  {viewModal.accreditation.expiresAt && (
                    <Badge className="whitespace-nowrap">
                      {getExpirationLabel(viewModal.accreditation.expiresAt)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">ID</p>
                    <p className="text-sm font-mono text-whiteElite">{viewModal.accreditation.accreditationId}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Badge</p>
                    <p className="text-sm font-mono text-whiteElite">{viewModal.accreditation.badgeNumber}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Zones</p>
                    <p className="text-sm font-mono text-whiteElite">{viewModal.accreditation.zoneCode}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Expiry</p>
                    <p className="text-sm font-mono text-whiteElite">
                      {viewModal.accreditation.expiresAt
                        ? formatDate(viewModal.accreditation.expiresAt)
                        : "LIFETIME"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {viewModal.accreditation.status === "rejected" && viewModal.accreditation.remarks && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-red-400 mb-2">Rejection Remarks</h4>
                <p className="text-lg text-slate-300">{viewModal.accreditation.remarks}</p>
              </div>
            )}

            {/* Uploaded Documents Section */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-cyan-400 mb-3">Uploaded Documents</h4>
              <div className="flex flex-wrap gap-3">
                {viewModal.accreditation.photoUrl ? (
                  <button
                    onClick={() => handleDownloadPhoto(viewModal.accreditation)}
                    disabled={imageDownloadingId === viewModal.accreditation.id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 rounded-lg text-orange-300 transition-colors disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-lg font-medium">Download Photo</span>
                  </button>
                ) : (
                  <span className="text-lg text-slate-500">No photo uploaded</span>
                )}
                <button
                  onClick={() => handleDownloadAllDocs(viewModal.accreditation)}
                  disabled={imageDownloadingId === viewModal.accreditation.id || (!viewModal.accreditation.photoUrl && !viewModal.accreditation.idDocumentUrl)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-300 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-lg font-medium">Download All Documents</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={Edit}
                className="flex-1"
                onClick={() => {
                  const acc = viewModal.accreditation;
                  setViewModal({ open: false, accreditation: null });
                  handleOpenEdit(acc);
                }}
              >
                Edit Details
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="success"
                icon={CheckCircle}
                onClick={() => {
                  setViewModal({ open: false, accreditation: null });
                  handleApprove(viewModal.accreditation);
                }}
                className="flex-1"
              >
                {viewModal.accreditation.status === "approved" ? "Re-approve" : "Approve"}
              </Button>
              <Button
                variant="danger"
                icon={XCircle}
                onClick={() => {
                  setViewModal({ open: false, accreditation: null });
                  handleReject(viewModal.accreditation);
                }}
                className="flex-1"
              >
                Reject
              </Button>
            </div>

            {viewModal.accreditation.status === "approved" && (
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  icon={Eye}
                  className="flex-1"
                  onClick={() => {
                    setViewModal({ open: false, accreditation: null });
                    handlePreviewPDF(viewModal.accreditation);
                  }}
                >
                  Preview and Download PDF
                </Button>
                <Button
                  variant="secondary"
                  icon={Link}
                  className="flex-1"
                  onClick={() => {
                    setViewModal({ open: false, accreditation: null });
                    handleOpenShareLink(viewModal.accreditation);
                  }}
                >
                  Share Link
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, accreditation: null })}
        title="Approve Accreditation"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-300">
            Approve accreditation for{" "}
            <span className="font-semibold text-white">
              {approveModal.accreditation?.firstName} {approveModal.accreditation?.lastName}
            </span>
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-lg font-medium text-slate-300">
                Zone Access <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: zones.map((z) => z.code) }))}
                  className="text-lg text-cyan-400 hover:text-cyan-300"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: [] }))}
                  className="text-lg text-slate-400 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>
            {zones && zones.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {zones.map((zone) => {
                  const isSelected = approveData.zoneCodes.includes(zone.code);
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => {
                        setApproveData((prev) => {
                          const current = prev.zoneCodes || [];
                          if (current.includes(zone.code)) {
                            return { ...prev, zoneCodes: current.filter((z) => z !== zone.code) };
                          } else {
                            return { ...prev, zoneCodes: [...current, zone.code] };
                          }
                        });
                      }}
                      className={`p-3 rounded-xl border transition-all duration-300 text-left ${
                        isSelected
                          ? "border-primary-500/50 bg-primary-500/10 shadow-[0_0_20px_-5px_rgba(34,211,238,0.2)]"
                          : "border-white/5 hover:border-white/20 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                          style={{ backgroundColor: zone.color || "#2563eb" }}
                        >
                          {zone.code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-lg font-medium truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                            {zone.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-lg text-amber-400">No zones defined for this event.</p>
              </div>
            )}
            <p className="text-lg text-slate-500">
              {approveData.zoneCodes?.length || 0} zone(s) selected
            </p>

            {/* Email Notification Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all border-dashed">
                <input
                  type="checkbox"
                  checked={approveData.sendEmail}
                  onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/40"
                />
                <div>
                  <p className="text-sm font-semibold text-whiteElite tracking-wide">Send Email Notification</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Automated PDF delivery enabled</p>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setApproveModal({ open: false, accreditation: null })}
              className="flex-1"
              disabled={approving}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={confirmApprove}
              className="flex-1"
              loading={approving}
              disabled={approving}
            >
              {approving ? "Approving..." : "Confirm Approval"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, accreditation: null })}
        title="Reject Accreditation"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-300">
            Reject accreditation for{" "}
            <span className="font-semibold text-white">
              {rejectModal.accreditation?.firstName} {rejectModal.accreditation?.lastName}
            </span>
          </p>
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Rejection Remarks <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectData.remarks}
              onChange={(e) => setRejectData((prev) => ({ ...prev, remarks: e.target.value }))}
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-primary-800/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              placeholder="Provide a reason for rejection..."
            />
          </div>

          {/* Email Notification Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={rejectData.sendEmail}
                onChange={(e) => setRejectData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
              />
              <div>
                <p className="text-lg font-medium text-white">Send Email Notification</p>
                <p className="text-sm text-slate-400">Inform the athlete/coach about the rejection via email</p>
              </div>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setRejectModal({ open: false, accreditation: null })}
              className="flex-1"
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmReject}
              className="flex-1"
              loading={rejecting}
              disabled={rejecting}
            >
              {rejecting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Approve Modal */}
      <Modal
        isOpen={bulkApproveModal}
        onClose={() => setBulkApproveModal(false)}
        title="Bulk Approve Accreditations"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-300">
            Approve <span className="font-semibold text-white">{selectedRows.length}</span> selected accreditations
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-lg font-medium text-slate-300">
                Zone Access for All <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: zones.map((z) => z.code) }))}
                  className="text-lg text-cyan-400 hover:text-cyan-300"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setApproveData((prev) => ({ ...prev, zoneCodes: [] }))}
                  className="text-lg text-slate-400 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>
            {zones && zones.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {zones.map((zone) => {
                  const isSelected = approveData.zoneCodes.includes(zone.code);
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => {
                        setApproveData((prev) => {
                          const current = prev.zoneCodes || [];
                          if (current.includes(zone.code)) {
                            return { ...prev, zoneCodes: current.filter((z) => z !== zone.code) };
                          } else {
                            return { ...prev, zoneCodes: [...current, zone.code] };
                          }
                        });
                      }}
                      className={`p-3 rounded-xl border transition-all duration-300 text-left ${
                        isSelected
                          ? "border-primary-500/50 bg-primary-500/10 shadow-[0_0_20px_-5px_rgba(34,211,238,0.2)]"
                          : "border-white/5 hover:border-white/20 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                          style={{ backgroundColor: zone.color || "#2563eb" }}
                        >
                          {zone.code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-lg font-medium truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                            {zone.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-lg text-amber-400">No zones defined for this event.</p>
              </div>
            )}
            <p className="text-lg text-slate-500">
              {approveData.zoneCodes?.length || 0} zone(s) selected
            </p>

            {/* Email Notification Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all border-dashed">
                <input
                  type="checkbox"
                  checked={approveData.sendEmail}
                  onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/40"
                />
                <div>
                  <p className="text-sm font-semibold text-whiteElite tracking-wide">Send Email Notifications</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Bulk delivery status: ready</p>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setBulkApproveModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="success" onClick={confirmBulkApprove} className="flex-1">
              Approve All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Individual Email Compose Modal */}
      <ComposeEmailModal
        isOpen={emailModal.open}
        onClose={() => setEmailModal({ open: false, accreditation: null })}
        recipients={emailModal.accreditation ? [emailModal.accreditation] : []}
        event={currentEvent}
        zones={zones}
        isBulk={false}
      />

      {/* PDF Preview Modal */}
      <Modal
        isOpen={pdfPreviewModal.open}
        onClose={closePdfPreviewModal}
        title="Accreditation Card Preview"
        size="xl"
      >
        {pdfPreviewModal.accreditation && (
          <div className="p-6 space-y-6">
            {pdfPreviewLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
                <p className="text-lg text-slate-400">Loading preview...</p>
              </div>
            ) : (
              <>
                <div className="apex-glass p-8 border-white/5">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 text-center">Biometric Identity Overlay</h4>
                  <AccreditationCardPreview
                    accreditation={pdfPreviewModal.accreditation}
                    event={events.find(e => e.id === pdfPreviewModal.accreditation.eventId)}
                    zones={zones}
                    eventCategories={eventCategories}
                    frontBackgroundUrl={frontBackgroundUrl}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/30 rounded-lg p-4 border border-primary-800/30">
                  <div>
                    <label className="block text-lg font-medium text-slate-300 mb-2">
                      PDF Size
                    </label>
                    <select
                      value={selectedPdfSize}
                      onChange={(e) => setSelectedPdfSize(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-primary-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
                    >
                      {Object.entries(PDF_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>{size.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-slate-300 mb-2">
                      Image Size
                    </label>
                    <select
                      value={selectedImageSize}
                      onChange={(e) => setSelectedImageSize(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-primary-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
                    >
                      {Object.entries(IMAGE_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>{size.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation)}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="flex-1"
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Eye}
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation, true)}
                    className="flex-1"
                  >
                    Open in Browser
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadImages(pdfPreviewModal.accreditation)}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="flex-1"
                  >
                    Download Images
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handlePrintPDF}
                    className="flex-1"
                  >
                    Print
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Badge Generator Modal */}
      {badgeGeneratorModal.accreditation && (
        <Modal
          isOpen={badgeGeneratorModal.open}
          onClose={() => setBadgeGeneratorModal({ open: false, accreditation: null })}
          title="Badge Generator"
          size="lg"
        >
          <div className="p-6">
            <BadgeGenerator
              accreditation={badgeGeneratorModal.accreditation}
              event={events.find(e => e.id === badgeGeneratorModal.accreditation.eventId)}
              zones={zones}
            />
          </div>
        </Modal>
      )}

      {/* Share Link Modal */}
      <Modal
        isOpen={shareLinkModal.open}
        onClose={() => setShareLinkModal({ open: false, accreditation: null })}
        title="Share Accreditation Link"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-400 font-extralight">
            Generate a shareable link for{" "}
            <span className="text-white font-medium">
              {shareLinkModal.accreditation?.firstName} {shareLinkModal.accreditation?.lastName}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-1.5">
                Expiry Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={shareLinkData.expiryDate}
                onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-1.5">
                Expiry Time
              </label>
              <input
                type="time"
                value={shareLinkData.expiryTime}
                onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryTime: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
              />
            </div>
          </div>

          <Button
            onClick={generateShareLink}
            loading={updatingExpiry}
            disabled={updatingExpiry}
            className="w-full"
          >
            Generate Link
          </Button>

          {generatedLink && (
            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-300">
                Generated Link
              </label>
              <div className="flex gap-2">
                <input
                  id="share-link-input"
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-lg focus:outline-none"
                />
                <Button
                  onClick={copyShareLink}
                  icon={linkCopied ? Check : Copy}
                  variant={linkCopied ? "success" : "secondary"}
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Delete Confirm Modal */}
      <Modal
        isOpen={bulkDeleteConfirmModal}
        onClose={() => !deleting && setBulkDeleteConfirmModal(false)}
        title="Bulk Delete Accreditations"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Delete {selectedRows.length} accreditations?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                This will permanently remove <span className="text-white font-medium">{selectedRows.length}</span> selected records. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setBulkDeleteConfirmModal(false)}
              className="flex-1"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmBulkDelete}
              className="flex-1"
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteConfirmModal.open}
        onClose={() => !deleting && setDeleteConfirmModal({ open: false, accreditation: null })}
        title="Delete Accreditation"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Permanently delete this accreditation?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                This will permanently remove the accreditation for{" "}
                <span className="text-white font-medium">
                  {deleteConfirmModal.accreditation?.firstName} {deleteConfirmModal.accreditation?.lastName}
                </span>. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmModal({ open: false, accreditation: null })}
              className="flex-1"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteAccreditation}
              className="flex-1"
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Compose Email Modal (single) */}
      <ComposeEmailModal
        isOpen={emailModal.open}
        onClose={() => setEmailModal({ open: false, accreditation: null })}
        recipients={emailModal.accreditation ? [emailModal.accreditation] : []}
        event={currentEvent}
        zones={zones}
        isBulk={false}
      />
    </div>
  );
}
