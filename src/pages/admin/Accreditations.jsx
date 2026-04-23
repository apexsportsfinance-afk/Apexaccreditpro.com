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
  ImageIcon,
  CreditCard,
  User,
  FileText,
  Files
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
import { useAuth } from "../../contexts/AuthContext";
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
import { useBackground } from "../../contexts/BackgroundContext";
import {
  sendApprovalEmail,
  sendRejectionEmail
} from "../../lib/email";
import ComposeEmailModal from "../../components/accreditation/ComposeEmailModal";
import { generatePdfAttachment } from "../../lib/pdfEmailHelper";
import {
  cn,
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
  const { canAccessEvent, isViewer } = useAuth();
  const { addToQueue, currentTask, queue } = useBackground();

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
  const [pdfSize, setPdfSize] = useState("a6"); // Default size
  const [approving, setApproving] = useState(false);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [badgeGeneratorModal, setBadgeGeneratorModal] = useState({ open: false, accreditation: null });
  /* ─── Render Participating Sports Badges ─── */
  const renderParticipatingSports = (accreditation) => {
    const sports = accreditation?.selected_sports || accreditation?.selectedSports;
    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      return <p className="text-slate-500 italic text-sm">No sports selected</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {sports.map((sport, idx) => (
          <Badge key={idx} variant="primary" className="bg-primary-500/10 text-primary-400 border-primary-500/20">
            {sport}
          </Badge>
        ))}
      </div>
    );
  };

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
  const [loading, setLoading] = useState(true);
  const initializedRef = React.useRef(false);
  const [emailModal, setEmailModal] = useState({ open: false, accreditation: null });
  const [imageDownloadingId, setImageDownloadingId] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [frontBackgroundUrl, setFrontBackgroundUrl] = useState("");
  const [categoryDocuments, setCategoryDocuments] = useState({});

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        const allEventsData = await EventsAPI.getAll();
        const filteredEvents = allEventsData.filter(e => canAccessEvent(e.id));
        setEvents(filteredEvents);

        const eventParam = searchParams.get("event");
        const targetEventId = (eventParam && canAccessEvent(eventParam))
          ? eventParam
          : (filteredEvents.length > 0 ? filteredEvents[0].id : null);

        if (targetEventId) {
          // Setting this will trigger the second useEffect
          setSelectedEvent(targetEventId);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
        toast.error("Failed to load events list.");
        setLoading(false);
      } finally {
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
        // APX-PERF: All 6 data calls in parallel instead of waterfall
        const results = await Promise.allSettled([
          AccreditationsAPI.getByEventId(selectedEvent),
          ZonesAPI.getByEventId(selectedEvent),
          supabase.from("event_categories").select("*, category:categories(*)").eq("event_id", selectedEvent),
          GlobalSettingsAPI.getClubs(selectedEvent),
          GlobalSettingsAPI.get(`event_${selectedEvent}_front_bg`),
          GlobalSettingsAPI.get(`event_${selectedEvent}_category_documents`)
        ]);

        const [accResult, zoneResult, ecResult, clubResult, bgResult, catDocsResult] = results;

        if (accResult.status === "fulfilled") setAccreditations(accResult.value);
        else { console.error("Failed to load accreditations:", accResult.reason); toast.error("Failed to load accreditations."); }

        if (zoneResult.status === "fulfilled") setZones(zoneResult.value);
        if (ecResult.status === "fulfilled" && ecResult.value?.data) setEventCategories(ecResult.value.data);
        if (clubResult.status === "fulfilled") setClubs(clubResult.value || []);
        else setClubs([]);
        if (bgResult.status === "fulfilled") setFrontBackgroundUrl(bgResult.value || "");
        else setFrontBackgroundUrl("");
        if (catDocsResult.status === "fulfilled") setCategoryDocuments(catDocsResult.value || {});
        else setCategoryDocuments({});

        searchParams.set("event", selectedEvent);
        setSearchParams(searchParams);
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
    const existingZones = accreditation.zoneCode
      ? accreditation.zoneCode.split(",").map(z => z.trim()).filter(Boolean)
      : [];
    setApproveData({ zoneCodes: existingZones, sendEmail: true });
    setApproveModal({ open: true, accreditation });
  };

  const confirmApprove = async () => {
    if (!approveData.zoneCodes || approveData.zoneCodes.length === 0) {
      toast.error("Please select zone access");
      return;
    }

    try {
      const accreditation = approveModal.accreditation;

      // Sequential background processing via Global Queue
      addToQueue({
        id: accreditation.id,
        accreditation,
        eventId: selectedEvent,
        approveData,
        pdfSize, // Pass requested size
        onSuccess: (updated) => {
          setAccreditations(prev => prev.map(a => a.id === updated.id ? updated : a));
        }
      });

      setApproveModal({ open: false, accreditation: null });
      toast.info("Added to processing queue");

    } catch (err) {
      console.error("Queue error:", err);
      toast.error("Failed to add to processing queue");
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
            resubmitUrl: eventData?.slug ? `${window.location.origin}/register/${eventData.slug}` : null,
            eventId: accreditation.eventId
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
      // Add all selected items to the background queue
      selectedRows.forEach(rowId => {
        const acc = accreditations.find(a => a.id === rowId);
        if (!acc) return;

        addToQueue({
          id: acc.id,
          accreditation: acc,
          eventId: selectedEvent,
          approveData: {
            ...approveData,
            zoneCodes: approveData.zoneCodes
          },
          pdfSize,
          onSuccess: (updated) => {
            setAccreditations(prev => prev.map(a => a.id === updated.id ? updated : a));
          }
        });
      });

      toast.info(`Added ${selectedRows.length} items to processing queue`);
      setBulkApproveModal(false);
      setSelectedRows([]);
    } catch (error) {
      console.error("Bulk approval error:", error);
      toast.error("Failed to add items to queue");
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

  const handlePreviewPDF = useCallback(async (accreditation) => {
    setPdfPreviewLoading(true);
    setPdfPreviewModal({ open: true, accreditation });
    setTimeout(() => { setPdfPreviewLoading(false); }, 500);
  }, []);

  const closePdfPreviewModal = useCallback(() => {
    setPdfPreviewModal({ open: false, accreditation: null });
  }, []);

  const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false) => {
    const pdfAccreditation = accreditations.find(a => a.id === accreditation.id) || accreditation;

    // Priority: Use pre-cached PDF if available from latest data
    if (pdfAccreditation.documents?.accreditation_pdf) {
      const baseUrl = pdfAccreditation.documents.accreditation_pdf;
      const url = baseUrl.includes("?") ? `${baseUrl}&t=${Date.now()}` : `${baseUrl}?t=${Date.now()}`;
      
      if (openInBrowser) {
        window.open(url, '_blank');
        toast.success("PDF opened from cache!");
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = "_blank";
        link.download = `${pdfAccreditation.firstName}_${pdfAccreditation.lastName}_Card.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Downloading cached PDF...");
      }
      return;
    }

    const id = pdfAccreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    
    // Dispatch to background queue
    addToQueue({
      type: "single_pdf_generate",
      id,
      accreditation: pdfAccreditation,
      eventId: selectedEvent,
      pdfSize: selectedPdfSize,
      onSuccess: (updated) => {
        setAccreditations(prev => prev.map(a => a.id === updated.id ? updated : a));
        setDownloadingId(null);
        
        // Final action: download or open
        const url = updated.documents?.accreditation_pdf;
        if (url) {
          if (openInBrowser) {
            window.open(url, '_blank');
          } else {
            const link = document.createElement('a');
            link.href = url;
            link.target = "_blank";
            link.download = `${updated.firstName}_${updated.lastName}_Card.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          toast.success(openInBrowser ? "PDF opened!" : "PDF downloaded!");
        }
      }
    });

    toast.info("Added to background processing...");
    closePdfPreviewModal();
  }, [downloadingId, toast, selectedPdfSize, accreditations, addToQueue, selectedEvent, closePdfPreviewModal]);

  const handleDownloadImages = useCallback(async (accreditation) => {
    const id = accreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    
    addToQueue({
      type: "single_images_generate",
      id,
      accreditation,
      eventId: selectedEvent,
      scale: IMAGE_SIZES[selectedImageSize]?.scale || 3,
      onSuccess: ({ frontBlob, backBlob, accreditation: acc }) => {
        setDownloadingId(null);
        const baseName = `${acc.firstName}_${acc.lastName}_Card`;
        
        // Front
        const a1 = document.createElement("a");
        a1.download = `${baseName}_front.png`;
        a1.href = URL.createObjectURL(frontBlob);
        document.body.appendChild(a1);
        a1.click();
        document.body.removeChild(a1);

        if (backBlob) {
          setTimeout(() => {
            const a2 = document.createElement("a");
            a2.download = `${baseName}_back.png`;
            a2.href = URL.createObjectURL(backBlob);
            document.body.appendChild(a2);
            a2.click();
            document.body.removeChild(a2);
          }, 500);
        }
        toast.success("Images downloaded!");
      }
    });

    toast.info("Added image generation to background...");
    closePdfPreviewModal();
  }, [downloadingId, toast, selectedImageSize, addToQueue, selectedEvent, closePdfPreviewModal]);

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
      render: (_, row) => {
        const isDuplicate = duplicateIds.has(row.id);

        return (
          <div className="flex items-center gap-3 py-1">
            <div className="relative group">
              {row.photoUrl ? (
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border group-hover:border-primary-500 transition-colors">
                  <img src={row.photoUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-base-alt flex items-center justify-center text-muted border-2 border-border">
                  <User className="w-6 h-6" />
                </div>
              )}
              {isDuplicate && (
                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1 shadow-lg" title="Potential Duplicate">
                  <AlertTriangle className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-main text-lg truncate">
                  {row.firstName} {row.lastName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">{row.gender}</span>
                {row.accreditationId && (
                  <>
                    <span className="text-border">•</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">{row.id?.substring(0, 8)}</span>
                  </>
                )}
              </div>
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
      render: (_, row) => (
        <Badge className="w-32 shrink-0">{row.role}</Badge>
      )
    },
    {
      key: "age",
      header: "Age",
      sortable: true,
      className: "w-[80px]",
      render: (_, row) => {
        const age = (row.role === 'Athlete' && currentEvent) 
          ? calculateAge(row.dateOfBirth, currentEvent.ageCalculationYear) 
          : null;
        return (
          <span className="text-sm font-bold text-slate-300">
            {age !== null ? age : "---"}
          </span>
        );
      }
    },
    { key: "club", header: "Club", sortable: true, className: "min-w-[200px]" },
    {
      key: "nationality",
      header: "Country",
      sortable: true,
      className: "w-[100px]",
      render: (_, row) => <span className="text-lg">{row.nationality}</span>
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      className: "w-[160px]", // Increased width for better spacing
      render: (_, row) => {
        const isProcessing = currentTask?.id === row.id || (queue && queue.some(t => t.id === row.id));
        return (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {isProcessing ? (
              <>
                <Badge variant="success" className="w-28 justify-center gap-1.5 animate-pulse shadow-sm border-emerald-500/30">
                  PROCESSING...
                </Badge>
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Under Process
                </div>
              </>
            ) : (
              <Badge
                variant={
                  row.status === "approved"
                    ? "success"
                    : row.status === "rejected"
                      ? "danger"
                      : "warning"
                }
                className="w-24 justify-center"
              >
                {row.status?.toUpperCase() || "PENDING"}
              </Badge>
            )}
            {(row.paymentAmount > 0 || !!row.stripeSessionId) && row.paymentStatus === 'paid' && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 w-fit">
                <Check className="w-2.5 h-2.5" />
                Paid
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
      render: (_, row) => {
        if (row.status !== "approved") {
          return <span className="text-sm text-muted font-medium italic">—</span>;
        }
        const expired = isExpired(row.expiresAt);
        const label = getExpirationLabel(row.expiresAt);
        return (
          <Badge className="w-24 shrink-0 whitespace-nowrap">
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
      render: (_, row) => (
        <span className="text-sm text-slate-400 font-medium">{formatDate(row.createdAt)}</span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[220px]",
      render: (_, row) => (
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
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-blue-500/20"
            )}
            title={isViewer ? "Viewing Only" : "Edit"}
            disabled={isViewer}
          >
            <Edit className="w-3.5 h-3.5 text-blue-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleApprove(row); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-500/20"
            )}
            title={isViewer ? "Viewing Only" : (row.status === "approved" ? "Re-approve" : "Approve")}
            disabled={isViewer}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleReject(row); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-red-500/20"
            )}
            title={isViewer ? "Viewing Only" : (row.status === "rejected" ? "Already rejected" : "Reject")}
            disabled={isViewer}
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
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-500/20"
                )}
                title={isViewer ? "Viewing Only" : "Generate Simple Badge with QR"}
                disabled={isViewer}
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenShareLink(row); }}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-cyan-500/20"
                )}
                title={isViewer ? "Viewing Only" : "Share Link"}
                disabled={isViewer}
              >
                <Link className="w-3.5 h-3.5 text-cyan-300" />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadAllDocs(row); }}
            className="p-1.5 rounded-lg hover:bg-orange-500/20 transition-colors"
            title="Download All Documents"
            disabled={(!row.photoUrl && !row.idDocumentUrl) || imageDownloadingId === row.id}
          >
            <Files className={`w-3.5 h-3.5 ${(row.photoUrl || row.idDocumentUrl) ? "text-orange-300" : "text-slate-600"}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEmailModal({ open: true, accreditation: row }); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-violet-500/20"
            )}
            title={isViewer ? "Viewing Only" : "Send Email"}
            disabled={isViewer}
          >
            <Mail className="w-3.5 h-3.5 text-violet-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(row); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isViewer ? "opacity-30 cursor-not-allowed" : "hover:bg-red-500/20"
            )}
            title={isViewer ? "Viewing Only" : "Delete"}
            disabled={isViewer}
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Accreditations</h1>
          <p className="text-lg text-slate-400 mt-1 font-extralight">Manage participant accreditations</p>
        </div>
        <Button 
          variant="primary" 
          icon={Plus} 
          onClick={() => setEditModal({ open: true, accreditation: null })}
          disabled={isViewer}
          title={isViewer ? "Viewing Only" : ""}
        >
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
                options={events.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Select an event"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[150px]">
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
              <div className="min-w-[180px]">
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
              <div className="flex-1 min-w-[280px]">
                <SearchableSelect
                  label="Club"
                  value={filters.club}
                  onChange={(e) => setFilters((prev) => ({ ...prev, club: e.target.value }))}
                  options={[
                    ...new Set([
                      ...(clubs?.map(c => typeof c === 'string' ? c : (c?.full || c?.short)).filter(Boolean) || []),
                      ...(accreditations?.map(a => a.club).filter(Boolean) || [])
                    ])
                  ].sort((a, b) => a.localeCompare(b)).map(club => ({ value: club, label: club }))}
                  placeholder="Select/Search club..."
                />
              </div>
              <div className="min-w-[120px]">
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
                className="h-[46px] text-slate-400 hover:text-red-400 border-slate-700 hover:border-red-500/30"
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
            disabled={isViewer}
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
        categoryDocuments={categoryDocuments}
        onApprove={async (data) => {
          setEditSaving(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const adminUserId = session?.user?.id;
            const accreditation = editModal.accreditation;

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
              idDocumentUrl: data.idDocumentUrl,
              eidUrl: data.eidUrl,
              medicalUrl: data.medicalUrl,
              customMessage: data.customMessage,
              badgeColor: data.badgeColor,
              zoneCode: data.zoneCode,
              selected_sports: data.selectedSports,
              expiresAt: data.expiresAt
            };

            const updated = await AccreditationsAPI.adminEdit(accreditation.id, updatePayload, adminUserId);
            
            addToQueue({
              id: updated.id,
              accreditation: updated,
              eventId: selectedEvent,
              approveData: {
                zoneCodes: data.zoneCode ? data.zoneCode.split(",") : [],
                sendEmail: true
              },
              pdfSize: data.pdfSize, // Ensure selected size is passed to the queue
              onSuccess: (final) => {
                setAccreditations(prev => prev.map(a => a.id === final.id ? final : a));
              }
            });

            setEditModal({ open: false, accreditation: null });
            toast.info("Accreditation saved and added to processing queue");
            refreshAccreditations();
          } catch (error) {
            console.error("Approve from Edit error:", error);
            toast.error("Failed to process approval: " + (error.message || "Unknown error"));
          } finally {
            setEditSaving(false);
          }
        }}
        onSave={(data) => {

          const saveEdit = async () => {
            setEditSaving(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const adminUserId = session?.user?.id;

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
                idDocumentUrl: data.idDocumentUrl,
                eidUrl: data.eidUrl,
                medicalUrl: data.medicalUrl,
                customMessage: data.customMessage,
                badgeColor: data.badgeColor,
                zoneCode: data.zoneCode || (data.zoneCodes ? data.zoneCodes.join(",") : ""),
                selected_sports: data.selectedSports
              };
              updatePayload.expiresAt = data.expiresAt !== undefined ? data.expiresAt : null;

              if (editModal.accreditation) {
                const accId = editModal.accreditation.id;
                const status = editModal.accreditation.status;
                const isMissingBadge = status === "approved" && (!editModal.accreditation.badgeNumber || editModal.accreditation.badgeNumber === "---");

                if ((data.roleChanged && status === "approved") || isMissingBadge) {
                  const newRole = data.role;
                  const prefix = ROLE_BADGE_PREFIXES[newRole] || newRole.substring(0, 3).toUpperCase() || "GEN";
                  const { count: existingCount } = await supabase
                    .from("accreditations")
                    .select("id", { count: "exact", head: true })
                    .eq("event_id", editModal.accreditation.eventId)
                    .eq("role", newRole)
                    .eq("status", "approved")
                    .neq("id", accId);
                  
                  const newBadgeNumber = `${prefix}-${String((existingCount || 0) + 1).padStart(3, "0")}`;
                  updatePayload.badgeNumber = newBadgeNumber;
                  updatePayload.accreditationId = `ACC-2025-${accId.substring(0, 8).toUpperCase()}`;
                  
                  await AccreditationsAPI.adminEdit(accId, updatePayload, adminUserId);
                  toast.success(`Accreditation repaired! Assigned ID and badge: ${newBadgeNumber}`);
                  
                  // Clear cached PDF so it regenerates
                  const currentDocs = editModal.accreditation.documents || {};
                  if (currentDocs.accreditation_pdf) {
                    delete currentDocs.accreditation_pdf;
                    await AccreditationsAPI.update(accId, { documents: currentDocs });
                  }
                } else {
                  const updatedAcc = await AccreditationsAPI.adminEdit(accId, updatePayload, adminUserId);
                  toast.success("Accreditation updated successfully");

                  // If status is approved, trigger background regeneration of badge/PDF
                  if (status === "approved") {
                    // IMMEDIATELY invalidate PDF cache in database so subsequent downloads know to wait/regenerate
                    const currentDocs = updatedAcc.documents || {};
                    if (currentDocs.accreditation_pdf) {
                      const { documents, ...rest } = updatedAcc;
                      const newDocs = { ...documents };
                      delete newDocs.accreditation_pdf;
                      await AccreditationsAPI.update(accId, { documents: newDocs });
                      updatedAcc.documents = newDocs; // Update local object for the queue
                    }

                    addToQueue({
                      id: updatedAcc.id,
                      accreditation: updatedAcc,
                      eventId: selectedEvent,
                      approveData: {
                        zoneCodes: updatedAcc.zoneCode ? updatedAcc.zoneCode.split(",") : [],
                        sendEmail: false 
                      },
                      pdfSize: data.pdfSize || "a6",
                      onSuccess: (final) => {
                        setAccreditations(prev => prev.map(a => a.id === final.id ? final : a));
                      }
                    });
                    toast.info("Updating badge and PDF in background...");
                  }
                }
              } else {
                // Add new
                updatePayload.eventId = selectedEvent;
                updatePayload.status = "pending"; // Start pending, queue will approve
                const newRecord = await AccreditationsAPI.adminAdd(updatePayload, adminUserId);
                
                // Add to background processing queue to generate Badge, ID, PDF, and Email
                addToQueue({
                  id: newRecord.id,
                  accreditation: newRecord,
                  eventId: selectedEvent,
                  approveData: {
                    zoneCodes: data.zoneCode ? data.zoneCode.split(",") : [],
                    sendEmail: true
                  },
                  pdfSize: data.pdfSize,
                  onSuccess: (final) => {
                    setAccreditations(prev => {
                      if (prev.some(a => a.id === final.id)) {
                        return prev.map(a => a.id === final.id ? final : a);
                      }
                      return [...prev, final];
                    });
                  }
                });

                toast.info("New accreditation added to processing queue!");
              }

              setEditModal({ open: false, accreditation: null });
              if (selectedEvent) await refreshAccreditations();
            } catch (error) {
              console.error("Save error:", error);
              toast.error("Failed to save: " + (error.message || "Unknown error"));
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
                <h3 className="text-2xl font-bold text-white">
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
                        {" "}(Age: {calculateAge(viewModal.accreditation.dateOfBirth, currentEvent.ageCalculationYear) || "---"})
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
                  <div>
                    <p className="text-lg text-slate-500">Accreditation ID</p>
                    <p className="text-lg font-mono text-white">{viewModal.accreditation.accreditationId}</p>
                  </div>
                  <div>
                    <p className="text-lg text-slate-500">Badge Number</p>
                    <p className="text-lg font-mono text-white">{viewModal.accreditation.badgeNumber}</p>
                  </div>
                  <div>
                    <p className="text-lg text-slate-500">Zone Access</p>
                    <p className="text-lg font-mono text-white">{viewModal.accreditation.zoneCode}</p>
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

            <div className="border-t border-slate-700/50 pt-6">
              <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Participating Sports
              </h4>
              {renderParticipatingSports(viewModal.accreditation)}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={Edit}
                className="flex-1"
                disabled={isViewer}
                title={isViewer ? "Viewing Only" : ""}
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
                disabled={isViewer}
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
                disabled={isViewer}
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
                  disabled={isViewer}
                  title={isViewer ? "Viewing Only" : ""}
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
          {/* Profile Header */}
          <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-cyan-500/30 flex-shrink-0 bg-slate-900">
              {approveModal.accreditation?.photoUrl ? (
                <img src={approveModal.accreditation.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <User className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate">
                {approveModal.accreditation?.firstName} {approveModal.accreditation?.lastName}
              </h3>
              <p className="text-lg text-cyan-400 font-medium">
                {approveModal.accreditation?.role} • {approveModal.accreditation?.nationality}
              </p>
              <p className="text-sm text-slate-400 truncate mt-0.5">
                {approveModal.accreditation?.club}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Participating Sports */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Participating Sports
              </h4>
              {renderParticipatingSports(approveModal.accreditation)}
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Review Documents
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                {(() => {
                  const currentEventObj = events.find(e => e.id === selectedEvent);
                  const role = approveModal.accreditation?.role;
                  const catData = eventCategories.find(c => (c.category?.name || c.name) === role);
                  const catId = catData?.category_id || role;
                  const categorySpecificDocs = categoryDocuments[catId];

                  let docs = categorySpecificDocs || [...(currentEventObj?.requiredDocuments || [])];

                  // Ensure picture and passport are always in the review list if the URLs exist
                  if (approveModal.accreditation?.photoUrl && !docs.find(d => (d.id === 'picture' || d === 'picture'))) {
                    docs = [{ id: 'picture', label: 'Photo' }, ...docs];
                  }
                  if (approveModal.accreditation?.idDocumentUrl && !docs.find(d => (d.id === 'passport' || d === 'passport'))) {
                    docs = [...docs, { id: 'passport', label: 'ID / Passport' }];
                  }

                  // If still empty, use defaults
                  if (docs.length === 0) {
                    docs = [
                      { id: "picture", label: "Photo" },
                      { id: "passport", label: "Passport" }
                    ];
                  }

                  return docs.map(doc => {
                    const docId = typeof doc === 'string' ? doc : doc.id;
                    const docLabel = (typeof doc === 'object' ? doc.label : null) || docId;

                    // Skip picture/photo as they are handled elsewhere or showing at top
                    if (
                      docId.toLowerCase() === 'picture' ||
                      docId.toLowerCase() === 'photo' ||
                      docLabel.toLowerCase() === 'picture' ||
                      docLabel.toLowerCase() === 'photo'
                    ) return null;

                    const eventDoc = (currentEventObj?.requiredDocuments || []).find(d => d.id === docId);
                    const label = (typeof doc === 'object' ? doc.label : null) || eventDoc?.label || (docId ? docId.charAt(0).toUpperCase() + docId.slice(1) : "Document");

                    const isPassport = docId === 'passport';
                    const isPicture = docId === 'picture';
                    const url = isPicture
                      ? approveModal.accreditation?.photoUrl
                      : isPassport
                        ? approveModal.accreditation?.idDocumentUrl
                        : approveModal.accreditation?.documents?.[docId];

                    return (
                      <div key={docId} className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">{label}</p>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block relative group">
                            <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group-hover:border-primary-500 transition-colors flex items-center justify-center">
                              {url.toLowerCase().endsWith('.pdf') ? (
                                <FileText className="w-8 h-8 text-slate-500" />
                              ) : (
                                <img src={url} alt={label} className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </a>
                        ) : (
                          <div className="w-full h-24 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                            EMPTY
                          </div>
                        )}
                      </div>
                    );
                  });

                })()}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadAllDocs(approveModal.accreditation)}
                className="w-full mt-3 text-lg"
              >
                Download All Documents
              </Button>
            </div>

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
                    const isSelected = (approveData.zoneCodes || []).includes(zone.code);
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
                        className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${isSelected
                            ? "border-primary-500 bg-primary-500/20"
                            : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
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
            </div>

            {/* PDF Size Selection */}
            <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
              <label className="block text-lg font-bold text-white uppercase tracking-wider">
                PDF Badge Size <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: "a4", label: "A4" },
                  { id: "a5", label: "A5" },
                  { id: "a6", label: "A6" },
                  { id: "pvc140", label: "PVC 140" },
                  { id: "card", label: "Card" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPdfSize(s.id)}
                    className={`py-2 rounded-lg border-2 font-black transition-all ${
                      pdfSize === s.id
                        ? "border-primary-500 bg-primary-500/20 text-white"
                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={approveData.sendEmail}
                  onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
                />
                <div>
                  <p className="text-lg font-medium text-white">Send Email Notification</p>
                  <p className="text-sm text-slate-400">Send approval email with PDF attachment to the athlete/coach</p>
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

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Attached Documents
            </h4>
            <div className="flex gap-4">
              {rejectModal.accreditation?.photoUrl && (
                <a href={rejectModal.accreditation.photoUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors">
                  <img src={rejectModal.accreditation.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                </a>
              )}
              {rejectModal.accreditation?.idDocumentUrl && (
                <a href={rejectModal.accreditation.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                  {rejectModal.accreditation.idDocumentUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <img src={rejectModal.accreditation.idDocumentUrl} alt="ID" className="w-full h-full object-cover" />}
                </a>
              )}
              {rejectModal.accreditation?.eidUrl && (
                <a href={rejectModal.accreditation.eidUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                  {rejectModal.accreditation.eidUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <img src={rejectModal.accreditation.eidUrl} alt="EID" className="w-full h-full object-cover" />}
                </a>
              )}
              {rejectModal.accreditation?.medicalUrl && (
                <a href={rejectModal.accreditation.medicalUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded overflow-hidden border border-slate-700 hover:border-primary-500 transition-colors flex items-center justify-center bg-slate-900">
                  {rejectModal.accreditation.medicalUrl.toLowerCase().endsWith('.pdf') ? <FileText className="w-8 h-8 text-slate-500" /> : <img src={rejectModal.accreditation.medicalUrl} alt="Med" className="w-full h-full object-cover" />}
                </a>
              )}
              {(!rejectModal.accreditation?.photoUrl && !rejectModal.accreditation?.idDocumentUrl && !rejectModal.accreditation?.eidUrl && !rejectModal.accreditation?.medicalUrl) && (
                <p className="text-sm text-slate-500">No documents attached</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={Download}
              onClick={() => handleDownloadAllDocs(rejectModal.accreditation)}
              className="mt-1"
            >
              Download All
            </Button>
          </div>

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
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${isSelected
                          ? "border-primary-500 bg-primary-500/20"
                          : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
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

            {/* Bulk PDF Size Selection */}
            <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
              <label className="block text-lg font-bold text-white uppercase tracking-wider">
                PDF Badge Size for All <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: "a4", label: "A4" },
                  { id: "a5", label: "A5" },
                  { id: "a6", label: "A6" },
                  { id: "pvc140", label: "PVC 140" },
                  { id: "card", label: "Card" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPdfSize(s.id)}
                    className={`py-2 rounded-lg border-2 font-black transition-all ${
                      pdfSize === s.id
                        ? "border-primary-500 bg-primary-500/20 text-white"
                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Notification Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={approveData.sendEmail}
                  onChange={(e) => setApproveData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/40"
                />
                <div>
                  <p className="text-lg font-medium text-white">Send Email Notifications</p>
                  <p className="text-sm text-slate-400">Send approval emails with PDFs to all selected applicants</p>
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
                <div className="bg-slate-800/50 rounded-xl p-6 border border-primary-800/30">
                  <h4 className="text-lg font-semibold text-white mb-4 text-center">Card Preview (Front and Back)</h4>
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

          <div className="space-y-4">
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
