import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
  FileDown,
  Loader2,
  ExternalLink,
  Printer,
  Edit,
  Save,
  Link,
  Clock,
  Copy,
  Check,
  FileSpreadsheet,
  FileText,
  Plus
} from "lucide-react";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import SearchableSelect from "../../components/ui/SearchableSelect";
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
  ZonesAPI
} from "../../lib/api";
import { supabase } from "../../lib/supabase";
import {
  sendApprovalEmail,
  sendRejectionEmail
} from "../../lib/email";
import {
  formatDate,
  getStatusColor,
  getRoleColor,
  calculateAge,
  ROLES,
  ROLE_BADGE_PREFIXES,
  COUNTRIES,
  validateFile,
  fileToBase64,
  isExpired,
  getExpirationLabel,
  getExpirationStatusColor
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

export default function Accreditations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [events, setEvents] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(searchParams.get("event") || "");
  const [filters, setFilters] = useState({
    status: "",
    role: "",
    nationality: ""
  });
  const [selectedRows, setSelectedRows] = useState([]);
  const [viewModal, setViewModal] = useState({ open: false, accreditation: null });
  const [approveModal, setApproveModal] = useState({ open: false, accreditation: null });
  const [rejectModal, setRejectModal] = useState({ open: false, accreditation: null });
  const [bulkApproveModal, setBulkApproveModal] = useState(false);
  const [approveData, setApproveData] = useState({ zoneCode: "" });
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState({ open: false, accreditation: null });
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [badgeGeneratorModal, setBadgeGeneratorModal] = useState({ open: false, accreditation: null });
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [selectedPdfSize, setSelectedPdfSize] = useState("a6");
  const [selectedImageSize, setSelectedImageSize] = useState("medium");
  const [editModal, setEditModal] = useState({ open: false, accreditation: null });
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    club: "",
    role: "",
    email: "",
    photoUrl: null,
    idDocumentUrl: null,
    zoneCode: ""
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  // Share link state
  const [shareLinkModal, setShareLinkModal] = useState({ open: false, accreditation: null });
  const [shareLinkData, setShareLinkData] = useState({
    expiryDate: "",
    expiryTime: "23:59"
  });
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [updatingExpiry, setUpdatingExpiry] = useState(false);

  // Delete confirmation state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, accreditation: null });
  const [deleting, setDeleting] = useState(false);

  // NEW: Bulk operations loading state
  const [bulkDownloading, setBulkDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      const loadEventData = async () => {
        setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
        setZones(await ZonesAPI.getByEventId(selectedEvent));
      };
      loadEventData();
      searchParams.set("event", selectedEvent);
      setSearchParams(searchParams);
    } else {
      AccreditationsAPI.getAll().then(setAccreditations);
    }
    setSelectedRows([]);
  }, [selectedEvent]);

  const loadData = async () => {
    const allEvents = await EventsAPI.getAll();
    setEvents(allEvents);
    const eventParam = searchParams.get("event");
    if (eventParam) {
      setSelectedEvent(eventParam);
      setAccreditations(await AccreditationsAPI.getByEventId(eventParam));
      setZones(await ZonesAPI.getByEventId(eventParam));
    } else if (allEvents.length > 0) {
      setSelectedEvent(allEvents[0].id);
      setAccreditations(await AccreditationsAPI.getByEventId(allEvents[0].id));
      setZones(await ZonesAPI.getByEventId(allEvents[0].id));
    }
  };

  // IMPORTANT: Define filteredAccreditations BEFORE functions that use it
  const filteredAccreditations = useMemo(() => {
    return (Array.isArray(accreditations) ? accreditations : []).filter((acc) => {
      if (filters.status && acc.status !== filters.status) return false;
      if (filters.role && acc.role !== filters.role) return false;
      if (filters.nationality && acc.nationality !== filters.nationality) return false;
      return true;
    });
  }, [accreditations, filters]);

  const currentEvent = events.find((e) => e.id === selectedEvent);

  // NOW define the export functions that use filteredAccreditations
  const handleExportExcel = useCallback(() => {
    const dataToExport = selectedRows.length > 0 
      ? filteredAccreditations.filter(r => selectedRows.includes(r.id))
      : filteredAccreditations;
    
    const eventName = currentEvent?.name || "export";
    exportToExcel(dataToExport, `accreditations-${eventName}`);
    toast.success("Excel file downloaded!");
  }, [selectedRows, filteredAccreditations, currentEvent, toast]);

  const handleExportPDF = useCallback(async () => {
    const dataToExport = selectedRows.length > 0 
      ? filteredAccreditations.filter(r => selectedRows.includes(r.id))
      : filteredAccreditations;
    
    const columns = [
      { key: "accreditationId", header: "ID" },
      { key: "badgeNumber", header: "Badge" },
      { key: "firstName", header: "First Name" },
      { key: "lastName", header: "Last Name" },
      { key: "role", header: "Role" },
      { key: "club", header: "Club" },
      { key: "nationality", header: "Country" },
      { key: "status", header: "Status" },
    ];
    
    await exportTableToPDF(dataToExport, columns, "Accreditations List");
    toast.success("PDF file downloaded!");
  }, [selectedRows, filteredAccreditations, toast]);

  const handleBulkDownloadCards = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setBulkDownloading(true);
    try {
      const selectedData = filteredAccreditations.filter(r => selectedRows.includes(r.id));
      await bulkDownloadPDFs(selectedData, currentEvent, zones, "a6");
      toast.success(`Downloaded ${selectedRows.length} cards!`);
    } catch (err) {
      toast.error("Failed to download cards");
    } finally {
      setBulkDownloading(false);
    }
  }, [selectedRows, filteredAccreditations, currentEvent, zones, toast]);

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
      const baseFileName = `${accreditation.firstName}_${accreditation.lastName}_${selectedImageSize}_${accreditation.accreditationId || "card"}`;
      await downloadAsImages("accreditation-front-card", "accreditation-back-card", baseFileName, selectedImageSize);
      toast.success("Images downloaded! Check your Downloads folder.");
    } catch (err) {
      console.error("Image capture error:", err);
      toast.error("Failed to generate images: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, toast, selectedImageSize]);

  // FIXED: Safer print handler
  const handlePrintPDF = useCallback(async () => {
    try {
      const blob = await getCapturedPDFBlob("accreditation-front-card", "accreditation-back-card");
      const url = URL.createObjectURL(blob);
      
      // Method 1: Try iframe printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.left = '-9999px';
      printFrame.style.top = '-9999px';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.src = url;
      
      document.body.appendChild(printFrame);
      
      printFrame.onload = () => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (e) {
          // Fallback: open in new tab
          window.open(url, '_blank');
        }
        
        // Cleanup
        setTimeout(() => {
          if (printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
          URL.revokeObjectURL(url);
        }, 60000);
      };
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Failed to print: " + (err.message || "Unknown error"));
    }
  }, [toast]);

  const handlePreviewPDF = useCallback(async (accreditation) => {
    setPdfPreviewLoading(true);
    setPdfPreviewModal({ open: true, accreditation });
    setTimeout(() => {
      setPdfPreviewLoading(false);
    }, 500);
  }, []);

  const closePdfPreviewModal = useCallback(() => {
    setPdfPreviewModal({ open: false, accreditation: null });
  }, []);

  const handleOpenEdit = useCallback((accreditation) => {
    setEditFormData({
      firstName: accreditation.firstName || "",
      lastName: accreditation.lastName || "",
      gender: accreditation.gender || "",
      dateOfBirth: accreditation.dateOfBirth || "",
      nationality: accreditation.nationality || "",
      club: accreditation.club || "",
      role: accreditation.role || "",
      email: accreditation.email || "",
      photoUrl: accreditation.photoUrl || null,
      idDocumentUrl: accreditation.idDocumentUrl || null,
      zoneCode: accreditation.zoneCode || ""
    });
    setEditErrors({});
    setEditModal({ open: true, accreditation });
  }, []);

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editErrors[name]) {
      setEditErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleEditFileChange = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      setEditErrors((prev) => ({ ...prev, [field]: validation.error }));
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setEditFormData((prev) => ({ ...prev, [field]: base64 }));
      setEditErrors((prev) => ({ ...prev, [field]: null }));
    } catch {
      setEditErrors((prev) => ({ ...prev, [field]: "Failed to process file" }));
    }
  };

  const handleSaveEdit = async () => {
    const newErrors = {};
    if (!editFormData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!editFormData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!editFormData.gender) newErrors.gender = "Gender is required";
    if (!editFormData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!editFormData.nationality) newErrors.nationality = "Nationality is required";
    if (!editFormData.club.trim()) newErrors.club = "Club is required";
    if (!editFormData.role) newErrors.role = "Role is required";
    if (!editFormData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      newErrors.email = "Invalid email format";
    }
    setEditErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setEditSaving(true);
    try {
      const updatePayload = {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        gender: editFormData.gender,
        dateOfBirth: editFormData.dateOfBirth,
        nationality: editFormData.nationality,
        club: editFormData.club,
        role: editFormData.role,
        email: editFormData.email,
        photoUrl: editFormData.photoUrl,
        idDocumentUrl: editFormData.idDocumentUrl
      };
      if (editModal.accreditation.status === "approved" && editFormData.zoneCode) {
        updatePayload.zoneCode = editFormData.zoneCode;
      }
      await AccreditationsAPI.update(editModal.accreditation.id, updatePayload);
      toast.success("Accreditation updated successfully");
      setEditModal({ open: false, accreditation: null });
      setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
    } catch (error) {
      console.error("Edit save error:", error);
      toast.error("Failed to save changes: " + (error.message || "Unknown error"));
    } finally {
      setEditSaving(false);
    }
  };

  // Share link handlers
  const handleOpenShareLink = useCallback((accreditation) => {
    const defaultDate = accreditation.expiresAt
      ? new Date(accreditation.expiresAt).toISOString().split("T")[0]
      : "";
    const defaultTime = accreditation.expiresAt
      ? new Date(accreditation.expiresAt).toTimeString().slice(0, 5)
      : "23:59";
    setShareLinkData({
      expiryDate: defaultDate,
      expiryTime: defaultTime
    });
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

      setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
      toast.success("Expiry updated and link generated!");
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Failed to generate link: " + (error.message || "Unknown error"));
    } finally {
      setUpdatingExpiry(false);
    }
  }, [shareLinkData, shareLinkModal.accreditation, selectedEvent, toast]);

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

  // Delete handlers
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
      setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmModal.accreditation, selectedEvent, toast]);

  const handleApprove = (accreditation) => {
    setApproveData({ zoneCode: "" });
    setApproveModal({ open: true, accreditation });
  };

  const confirmApprove = async () => {
    if (!approveData.zoneCode) {
      toast.error("Please select zone access");
      return;
    }

    setApproving(true);
    try {
      const accreditation = approveModal.accreditation;
      const eventData = events.find((e) => e.id === accreditation.eventId);
      const role = accreditation.role || "Unknown";
      const prefix = ROLE_BADGE_PREFIXES[role] || role.substring(0, 3).toUpperCase() || "GEN";
      const { count: existingCount } = await supabase
        .from("accreditations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", accreditation.eventId)
        .eq("role", role)
        .eq("status", "approved");
      const badgeNumber = `${prefix}-${String((existingCount || 0) + 1).padStart(3, "0")}`;
      const approvedRecord = await AccreditationsAPI.approve(
        accreditation.id,
        approveData.zoneCode,
        badgeNumber
      );
      const updatedAccreditations = await AccreditationsAPI.getByEventId(selectedEvent);
      setAccreditations(updatedAccreditations);
      const emailResult = await sendApprovalEmail({
        to: accreditation.email,
        name: `${accreditation.firstName} ${accreditation.lastName}`,
        eventName: eventData?.name || "Event",
        eventLocation: eventData?.location || "",
        eventDates: eventData ? `${eventData.startDate} - ${eventData.endDate}` : "",
        role: accreditation.role,
        accreditationId: approvedRecord?.accreditationId || badgeNumber,
        badgeNumber: badgeNumber,
        zoneCode: approveData.zoneCode,
        reportingTimes: eventData?.reportingTimes || ""
      });
      if (emailResult.success) {
        toast.success("Accreditation approved and email sent!");
      } else {
        toast.success("Accreditation approved! Email notification may have failed.");
        console.warn("Email send failed:", emailResult.error);
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
    setRejectRemarks("");
    setRejectModal({ open: true, accreditation });
  };

  const confirmReject = async () => {
    if (!rejectRemarks.trim()) {
      toast.error("Please provide rejection remarks");
      return;
    }

    setRejecting(true);
    try {
      const accreditation = rejectModal.accreditation;
      const eventData = events.find((e) => e.id === accreditation.eventId);
      await AccreditationsAPI.reject(accreditation.id, rejectRemarks);
      setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
      const emailResult = await sendRejectionEmail({
        to: accreditation.email,
        name: `${accreditation.firstName} ${accreditation.lastName}`,
        eventName: eventData?.name || "Event",
        role: accreditation.role,
        remarks: rejectRemarks,
        resubmitUrl: eventData?.slug ? `${window.location.origin}/register/${eventData.slug}` : null
      });
      if (emailResult.success) {
        toast.success("Accreditation rejected and email sent!");
      } else {
        toast.success("Accreditation rejected! Email notification may have failed.");
        console.warn("Email send failed:", emailResult.error);
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
    setApproveData({ zoneCode: "" });
    setBulkApproveModal(true);
  };

  const confirmBulkApprove = async () => {
    if (!approveData.zoneCode) {
      toast.error("Please select zone access");
      return;
    }

    await AccreditationsAPI.bulkApprove(selectedRows, approveData.zoneCode);
    toast.success(`${selectedRows.length} accreditations approved`);
    setBulkApproveModal(false);
    setSelectedRows([]);
    setAccreditations(await AccreditationsAPI.getByEventId(selectedEvent));
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.photoUrl ? (
            <img
              src={row.photoUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
              <span className="text-lg font-medium text-white">
                {row.firstName?.[0]}{row.lastName?.[0]}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-white">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-lg text-slate-500">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (row) => (
        <Badge className={getRoleColor(row.role)}>{row.role}</Badge>
      )
    },
    {
      key: "club",
      header: "Club",
      sortable: true
    },
    {
      key: "nationality",
      header: "Country",
      sortable: true,
      render: (row) => (
        <span className="text-lg">{row.nationality}</span>
      )
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => (
        <Badge className={getStatusColor(row.status)}>
          {row.status}
        </Badge>
      )
    },
    {
      key: "expiresAt",
      header: "Expiration",
      sortable: true,
      render: (row) => {
        if (row.status !== "approved") {
          return <span className="text-lg text-slate-500">—</span>;
        }
        const expired = isExpired(row.expiresAt);
        const label = getExpirationLabel(row.expiresAt);
        const colorClass = getExpirationStatusColor(row.expiresAt);
        return (
          <Badge className={colorClass}>
            {expired ? "EXPIRED" : label}
          </Badge>
        );
      }
    },
    {
      key: "createdAt",
      header: "Submitted",
      sortable: true,
      render: (row) => (
        <span className="text-lg text-slate-400">
          {formatDate(row.createdAt)}
        </span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewModal({ open: true, accreditation: row });
            }}
            className="p-2 rounded-lg hover:bg-primary-800/30 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            className="p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-blue-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(row);
            }}
            className="p-2 rounded-lg hover:bg-emerald-500/20 transition-colors"
            title={row.status === "approved" ? "Re-approve" : "Approve"}
          >
            <CheckCircle className="w-4 h-4 text-emerald-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReject(row);
            }}
            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title={row.status === "rejected" ? "Already rejected" : "Reject"}
          >
            <XCircle className="w-4 h-4 text-red-300" />
          </button>
          {row.status === "approved" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewPDF(row);
                }}
                className="p-2 rounded-lg hover:bg-primary-500/20 transition-colors"
                title="Preview and Download PDF"
              >
                <Eye className="w-4 h-4 text-cyan-300" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBadgeGeneratorModal({ open: true, accreditation: row });
                }}
                className="p-2 rounded-lg hover:bg-emerald-500/20 transition-colors"
                title="Generate Simple Badge with QR"
              >
                <Download className="w-4 h-4 text-emerald-300" />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDeleteConfirm(row);
            }}
            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-300" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div id="accreditations_page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Accreditations</h1>
          <p className="text-slate-400 mt-1">Manage participant accreditations</p>
        </div>
        <Button variant="primary" icon={Plus}>
          Add Accreditation
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Select
                label="Event"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                options={events.map((e) => ({
                  value: e.id,
                  label: e.name
                }))}
                placeholder="Select an event"
              />
            </div>
            <div className="flex gap-4">
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" }
                ]}
                placeholder="All Status"
              />
              <Select
                label="Role"
                value={filters.role}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, role: e.target.value }))
                }
                options={ROLES.map((r) => ({ value: r, label: r }))}
                placeholder="All Roles"
              />
              <Select
                label="Country"
                value={filters.nationality}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, nationality: e.target.value }))
                }
                options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                placeholder="All Countries"
              />
            </div>
          </div>

          {/* Bulk Operations Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 mr-auto">
              <span className="text-slate-300 font-medium">{selectedRows.length} selected</span>
              {selectedRows.length > 0 && (
                <button 
                  onClick={() => setSelectedRows([])} 
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Clear
                </button>
              )}
              <button 
                onClick={() => setSelectedRows(filteredAccreditations.map(r => r.id))} 
                className="text-sm text-cyan-400 hover:text-cyan-300 ml-2"
              >
                Select All ({filteredAccreditations.length})
              </button>
            </div>

            {selectedRows.length > 0 && (
              <>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleBulkApprove}
                  icon={CheckCircle}
                >
                  Bulk Approve
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleBulkDownloadCards} 
                  loading={bulkDownloading}
                  icon={Download}
                >
                  Download Cards
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleExportExcel} icon={FileSpreadsheet}>
              Export Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportPDF} icon={FileText}>
              Export PDF
            </Button>
          </div>

          {/* Table */}
          {!selectedEvent ? (
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
            />
          )}
        </CardContent>
      </Card>

      {/* All Modals remain the same... */}
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
                <h3 className="text-2xl font-bold text-white">
                  {viewModal.accreditation.firstName} {viewModal.accreditation.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getRoleColor(viewModal.accreditation.role)}>
                    {viewModal.accreditation.role}
                  </Badge>
                  <Badge className={getStatusColor(viewModal.accreditation.status)}>
                    {viewModal.accreditation.status}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-lg text-slate-400">
                    <span className="text-slate-500">Club:</span> {viewModal.accreditation.club}
                  </p>
                  <p className="text-lg text-slate-400">
                    <span className="text-slate-500">Email:</span> {viewModal.accreditation.email}
                  </p>
                  <p className="text-lg text-slate-400">
                    <span className="text-slate-500">Nationality:</span> {viewModal.accreditation.nationality}
                  </p>
                  <p className="text-lg text-slate-400">
                    <span className="text-slate-500">Gender:</span> {viewModal.accreditation.gender}
                  </p>
                  <p className="text-lg text-slate-400">
                    <span className="text-slate-500">DOB:</span>{" "}
                    {formatDate(viewModal.accreditation.dateOfBirth)}
                    {currentEvent && (
                      <span className="text-slate-500">
                        {" "}(Age: {calculateAge(viewModal.accreditation.dateOfBirth, currentEvent.ageCalculationYear)})
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
                    <Badge className={getExpirationStatusColor(viewModal.accreditation.expiresAt)}>
                      {getExpirationLabel(viewModal.accreditation.expiresAt)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-lg text-slate-500">Accreditation ID</p>
                    <p className="text-lg font-mono text-white">
                      {viewModal.accreditation.accreditationId}
                    </p>
                  </div>
                  <div>
                    <p className="text-lg text-slate-500">Badge Number</p>
                    <p className="text-lg font-mono text-white">
                      {viewModal.accreditation.badgeNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-lg text-slate-500">Zone Access</p>
                    <p className="text-lg font-mono text-white">
                      {viewModal.accreditation.zoneCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-lg text-slate-500">Valid Until</p>
                    <p className="text-lg font-mono text-white">
                      {viewModal.accreditation.expiresAt 
                        ? formatDate(viewModal.accreditation.expiresAt)
                        : "No expiration"}
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
          <Select
            label="Zone Access"
            value={approveData.zoneCode}
            onChange={(e) =>
              setApproveData((prev) => ({ ...prev, zoneCode: e.target.value }))
            }
            options={[
              ...zones.map((z) => ({ value: z.code, label: `${z.code} - ${z.name}` })),
              { value: zones.map((z) => z.code).join(","), label: "All Zones" }
            ]}
            required
          />
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
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-primary-800/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              placeholder="Provide a reason for rejection..."
            />
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
          <Select
            label="Zone Access for All"
            value={approveData.zoneCode}
            onChange={(e) =>
              setApproveData((prev) => ({ ...prev, zoneCode: e.target.value }))
            }
            options={[
              ...zones.map((z) => ({ value: z.code, label: `${z.code} - ${z.name}` })),
              { value: zones.map((z) => z.code).join(","), label: "All Zones" }
            ]}
            required
          />
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setBulkApproveModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={confirmBulkApprove}
              className="flex-1"
            >
              Approve All
            </Button>
          </div>
        </div>
      </Modal>

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
                <div className="bg-slate-800/50 rounded-xl p-6 border border-primary-800/30">
                  <h4 className="text-lg font-semibold text-white mb-4 text-center">Card Preview (Front and Back)</h4>
                  <AccreditationCardPreview
                    accreditation={pdfPreviewModal.accreditation}
                    event={events.find(e => e.id === pdfPreviewModal.accreditation.eventId)}
                    zones={zones}
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

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="primary"
                    icon={downloadingId === pdfPreviewModal.accreditation.id ? Loader2 : Download}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="flex-1"
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation, false)}
                    disabled={downloadingId === pdfPreviewModal.accreditation.id}
                  >
                    Download PDF ({PDF_SIZES[selectedPdfSize]?.label.split(" ")[0]})
                  </Button>
                  <Button
                    variant="secondary"
                    icon={ExternalLink}
                    className="flex-1"
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation, true)}
                    disabled={downloadingId === pdfPreviewModal.accreditation.id}
                  >
                    Open in New Tab
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    icon={downloadingId === pdfPreviewModal.accreditation.id ? Loader2 : FileDown}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="flex-1"
                    onClick={() => handleDownloadImages(pdfPreviewModal.accreditation)}
                    disabled={downloadingId === pdfPreviewModal.accreditation.id}
                  >
                    Download as Images ({IMAGE_SIZES[selectedImageSize]?.label.split(" ")[0]})
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Printer}
                    className="flex-1"
                    onClick={handlePrintPDF}
                    disabled={downloadingId === pdfPreviewModal.accreditation.id}
                  >
                    Print Card
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, accreditation: null })}
        title="Edit Accreditation"
        size="lg"
      >
        {editModal.accreditation && (
          <div className="p-6 space-y-6">
            <p className="text-lg text-slate-400 font-extralight">
              Editing accreditation for{" "}
              <span className="font-semibold text-white">
                {editModal.accreditation.firstName} {editModal.accreditation.lastName}
              </span>
            </p>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="firstName"
                  value={editFormData.firstName}
                  onChange={handleEditInputChange}
                  error={editErrors.firstName}
                  required
                  placeholder="First name"
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={editFormData.lastName}
                  onChange={handleEditInputChange}
                  error={editErrors.lastName}
                  required
                  placeholder="Last name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Gender"
                  name="gender"
                  value={editFormData.gender}
                  onChange={handleEditInputChange}
                  error={editErrors.gender}
                  required
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" }
                  ]}
                />
                <Input
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                  value={editFormData.dateOfBirth}
                  onChange={handleEditInputChange}
                  error={editErrors.dateOfBirth}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Affiliation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SearchableSelect
                  label="Nationality"
                  value={editFormData.nationality}
                  onChange={(e) => handleEditInputChange({ target: { name: "nationality", value: e.target.value } })}
                  error={editErrors.nationality}
                  required
                  options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                  placeholder="Select country"
                />
                <Input
                  label="Club/Organization"
                  name="club"
                  value={editFormData.club}
                  onChange={handleEditInputChange}
                  error={editErrors.club}
                  required
                  placeholder="Club or organization"
                />
              </div>

              <Select
                label="Role"
                name="role"
                value={editFormData.role}
                onChange={handleEditInputChange}
                error={editErrors.role}
                required
                options={ROLES.map((r) => ({ value: r, label: r }))}
              />
            </div>

            {editModal.accreditation.status === "approved" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Zone Access</h3>
                <Select
                  label="Zone Access"
                  name="zoneCode"
                  value={editFormData.zoneCode}
                  onChange={handleEditInputChange}
                  options={[
                    ...zones.map((z) => ({ value: z.code, label: `${z.code} - ${z.name}` })),
                    { value: zones.map((z) => z.code).join(","), label: "All Zones" }
                  ]}
                  placeholder="Select zone access"
                />
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Contact</h3>
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={editFormData.email}
                onChange={handleEditInputChange}
                error={editErrors.email}
                required
                placeholder="email@example.com"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditModal({ open: false, accreditation: null })}
                className="flex-1"
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Save}
                onClick={handleSaveEdit}
                className="flex-1"
                loading={editSaving}
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={shareLinkModal.open}
        onClose={() => setShareLinkModal({ open: false, accreditation: null })}
        title="Share Accreditation Link"
      >
        {shareLinkModal.accreditation && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-primary-800/30">
              <p className="text-lg text-slate-400 font-extralight">
                Generate a shareable link for{" "}
                <span className="font-semibold text-white">
                  {shareLinkModal.accreditation.firstName} {shareLinkModal.accreditation.lastName}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiry Date"
                  type="date"
                  value={shareLinkData.expiryDate}
                  onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
                <Input
                  label="Expiry Time"
                  type="time"
                  value={shareLinkData.expiryTime}
                  onChange={(e) => setShareLinkData(prev => ({ ...prev, expiryTime: e.target.value }))}
                  required
                />
              </div>

              <Button
                variant="primary"
                icon={Clock}
                onClick={generateShareLink}
                loading={updatingExpiry}
                disabled={updatingExpiry || !shareLinkData.expiryDate}
                className="w-full"
              >
                {updatingExpiry ? "Generating..." : "Generate Link"}
              </Button>
            </div>

            {generatedLink && (
              <div className="space-y-3">
                <label className="block text-lg font-medium text-slate-300">
                  Shareable Link
                </label>
                <div className="flex gap-2">
                  <input
                    id="share-link-input"
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-primary-800/30 rounded-lg text-white text-lg font-mono"
                  />
                  <Button
                    variant={linkCopied ? "success" : "secondary"}
                    icon={linkCopied ? Check : Copy}
                    onClick={copyShareLink}
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShareLinkModal({ open: false, accreditation: null })}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmModal.open}
        onClose={() => setDeleteConfirmModal({ open: false, accreditation: null })}
        title="Delete Accreditation"
      >
        {deleteConfirmModal.accreditation && (
          <div className="p-6 space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-lg text-red-300">
                Are you sure you want to permanently delete the accreditation for{" "}
                <span className="font-semibold text-white">
                  {deleteConfirmModal.accreditation.firstName} {deleteConfirmModal.accreditation.lastName}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
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
                icon={Trash2}
                onClick={confirmDeleteAccreditation}
                className="flex-1"
                loading={deleting}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Badge Generator Modal */}
      <Modal
        isOpen={badgeGeneratorModal.open}
        onClose={() => setBadgeGeneratorModal({ open: false, accreditation: null })}
        title="Generate Simple Badge"
        size="xl"
      >
        {badgeGeneratorModal.accreditation && (
          <div className="p-6">
            <BadgeGenerator
              accreditation={badgeGeneratorModal.accreditation}
              event={events.find(e => e.id === badgeGeneratorModal.accreditation.eventId)}
              zones={zones}
              onClose={() => setBadgeGeneratorModal({ open: false, accreditation: null })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
