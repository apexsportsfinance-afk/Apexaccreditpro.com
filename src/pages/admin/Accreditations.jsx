import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { motion } from "framer-motion";
import EditAccreditationModal from "../../components/EditAccreditationModal";
import {
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Loader2,
  Edit,
  Link,
  Copy,
  Check,
  Plus,
  Search,
  AlertCircle,
  AlertTriangle,
  Mail,
  ImageIcon,
  CreditCard,
  User,
  FileText,
  Files,
  Clock,
  Timer
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
import MembershipCardPreview from "../../components/accreditation/MembershipCardPreview";
import { OUTPUT_TYPES } from "../../lib/constants";
import BadgeGenerator from "../../components/accreditation/BadgeGenerator";
import {
  EventsAPI,
  AccreditationsAPI,
  ZonesAPI,
  EventCategoriesAPI
} from "../../lib/storage";
import { GlobalSettingsAPI, AthleteEventsAPI } from "../../lib/broadcastApi";
import { supabase } from "../../lib/supabase";
import { useBackground } from "../../contexts/BackgroundContext";
import {
  sendApprovalEmail,
  sendRejectionEmail
} from "../../lib/email";
import ComposeEmailModal from "../../components/accreditation/ComposeEmailModal";
import AccreditationDetailsModal from "../../components/accreditation/AccreditationDetailsModal";
import ApproveAccreditationModal from "../../components/accreditation/ApproveAccreditationModal";
import RejectAccreditationModal from "../../components/accreditation/RejectAccreditationModal";
import BulkApproveModal from "../../components/accreditation/BulkApproveModal";
import ShareLinkModal from "../../components/accreditation/ShareLinkModal";
import DeleteAccreditationModal from "../../components/accreditation/DeleteAccreditationModal";
import { generatePdfAttachment } from "../../lib/pdfEmailHelper";
import {
  cn,
  formatDate,
  calculateAge,
  ROLES,
  ROLE_BADGE_PREFIXES,
  COUNTRIES,
  getCountryCode3,
  getCountryFlag,
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
import StorageImage from "../../components/ui/StorageImage";
import { resolveFileUrl } from "../../lib/storage/fileUrl";
import { openStoredFile } from "../../lib/storage/openStoredFile";
import BulkOperations from "../../components/accreditation/BulkOperations";
import { downloadSinglePhoto, downloadFullRecord, bulkDownloadPhotos } from "../../lib/imageDownload";

// Open or download a stored accreditation PDF, resolving the stored reference
// through the storage layer so it works in both public and private (signed-URL)
// modes. Open-in-browser keeps the gesture via openStoredFile; download builds a
// resolved anchor. Flag-off behaviour is unchanged.
async function openOrDownloadStoredPdf(url, { openInBrowser, filename }) {
  if (openInBrowser) {
    openStoredFile(url);
    return;
  }
  const resolved = await resolveFileUrl(url);
  if (!resolved) return;
  const link = document.createElement("a");
  link.href = resolved;
  link.target = "_blank";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Accreditations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { canAccessEvent, isViewer, profileLoaded } = useAuth();
  const { addToQueue, currentTask, queue } = useBackground();

  const [events, setEvents] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [totalAccreditations, setTotalAccreditations] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [zones, setZones] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [fullEventDetails, setFullEventDetails] = useState(null);
  const [eventCategories, setEventCategories] = useState([]);
  const [filters, setFilters] = useState({ status: "", role: "", nationality: "", club: "" });
  const [searchTerm, setSearchTerm] = useState("");
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
      return <p className="text-muted italic text-sm">No sports selected</p>;
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
  const [onlyFrontPage, setOnlyFrontPage] = useState(false);
  const [frontBackgroundUrl, setFrontBackgroundUrl] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [categoryDocuments, setCategoryDocuments] = useState({});
  const [clubs, setClubs] = useState([]);
  const [activeEventSports, setActiveEventSports] = useState([]);
  const [athleteEvents, setAthleteEvents] = useState([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // Wait until the user's profile (including allowedEventIds for
    // event-restricted roles) has finished loading. Otherwise canAccessEvent
    // would filter out every event for non-admin users before their event
    // allocations are known, leaving them stuck on "Select an Event".
    if (!profileLoaded) return;

    const initializeData = async () => {
      setLoading(true);
      try {
        const allEventsData = await EventsAPI.getAllMinimal();
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
  }, [profileLoaded]);


  useEffect(() => {
    if (!selectedEvent || !initializedRef.current) return;
    const loadEventData = async () => {
      setLoading(true);
      try {
        // APX-PERF: Parallel data calls optimized to prevent connection pool exhaustion
        // APX-102: Emergency timeout to prevent infinite spinning
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000)
        );

        const fetchPromise = Promise.allSettled([
          AccreditationsAPI.getPaginatedByEventId(selectedEvent, { 
            limit: 100, 
            offset: 0,
            status: filters.status || null,
            role: filters.role || null,
            nationality: filters.nationality || null,
            club: filters.club || null,
            searchTerm: debouncedSearchTerm
          }),
          ZonesAPI.getByEventId(selectedEvent),
          supabase.from("event_categories").select("*, category:categories(*)").eq("event_id", selectedEvent),
          EventsAPI.getById(selectedEvent),
          GlobalSettingsAPI.getAll()
        ]);

        const results = await Promise.race([fetchPromise, timeoutPromise]);

        const [accResult, zoneResult, ecResult, fullEventResult, settingsResult] = results;

        if (fullEventResult.status === "fulfilled" && fullEventResult.value) {
          setFullEventDetails(fullEventResult.value);
        } else {
          setFullEventDetails(null);
        }

        if (accResult.status === "fulfilled") {
          const { data: accData, count } = accResult.value;
          setAccreditations(accData);
          setTotalAccreditations(count);
        } else { console.error("Failed to load accreditations:", accResult.reason); toast.error("Failed to load accreditations."); }

        if (zoneResult.status === "fulfilled") setZones(zoneResult.value);
        if (ecResult.status === "fulfilled" && ecResult.value?.data) setEventCategories(ecResult.value.data);

        // Process Global Settings from the single bulk fetch
        if (settingsResult.status === "fulfilled") {
          const settings = settingsResult.value || {};
          
          const clubsData = settings[`event_${selectedEvent}_clubs`];
          setClubs(clubsData ? JSON.parse(clubsData) : []);
          
          setFrontBackgroundUrl(settings[`event_${selectedEvent}_front_bg`] || "");
          
          const catDocsData = settings[`event_${selectedEvent}_category_documents`];
          setCategoryDocuments(catDocsData ? JSON.parse(catDocsData) : {});
          
          const onlyFrontVal = settings[`event_${selectedEvent}_only_front_page`];
          setOnlyFrontPage(onlyFrontVal === "true" || onlyFrontVal === true);
          
          const customFieldsData = settings[`event_${selectedEvent}_custom_fields`];
          try {
            setCustomFields(customFieldsData ? JSON.parse(customFieldsData) : []);
          } catch (e) {
            setCustomFields([]);
          }
          
          const sportRaw = settings[`event_${selectedEvent}_sport`];
          let sportList = [];
          if (sportRaw) {
            try {
              const parsed = JSON.parse(sportRaw);
              sportList = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              sportList = [sportRaw];
            }
          }
          setActiveEventSports(sportList);
        } else {
          setClubs([]);
          setFrontBackgroundUrl("");
          setCategoryDocuments({});
          setOnlyFrontPage(false);
          setCustomFields([]);
          setActiveEventSports([]);
        }

        searchParams.set("event", selectedEvent);
        setSearchParams(searchParams);
      } catch (error) {
        console.error("Failed to load event data:", error);
        toast.error("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadEventData();
    setSelectedRows([]);
  }, [selectedEvent, filters, debouncedSearchTerm]);

  const refreshAccreditations = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const { data, count } = await AccreditationsAPI.getPaginatedByEventId(selectedEvent, { 
        limit: accreditations.length || 100, 
        offset: 0,
        status: filters.status || null,
        role: filters.role || null,
        nationality: filters.nationality || null,
        club: filters.club || null,
        searchTerm: debouncedSearchTerm
      });
      setAccreditations(data);
      setTotalAccreditations(count);
    } catch (error) {
      console.error("Failed to refresh accreditations:", error);
    }
  }, [selectedEvent, accreditations.length, filters, debouncedSearchTerm]);

  const resetFilters = useCallback(() => {
    setFilters({ status: "", role: "", nationality: "", club: "" });
    setSearchTerm("");
    toast.success("Filters cleared");
  }, [toast]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !selectedEvent) return;
    setIsLoadingMore(true);
    try {
      const nextOffset = accreditations.length;
      const { data, count } = await AccreditationsAPI.getPaginatedByEventId(selectedEvent, { 
        limit: 100, 
        offset: nextOffset,
        status: filters.status || null,
        role: filters.role || null,
        nationality: filters.nationality || null,
        club: filters.club || null,
        searchTerm: debouncedSearchTerm
      });
      setAccreditations(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newRecords = data.filter(a => !existingIds.has(a.id));
        return [...prev, ...newRecords];
      });
      setTotalAccreditations(count);
    } catch (err) {
      console.error("Failed to load more:", err);
      toast.error("Failed to load more accreditations");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, selectedEvent, accreditations.length, filters, debouncedSearchTerm, toast]);

  const filteredAccreditations = useMemo(() => {
    // APX-NOTE: Filtering now happens primarily on the server for performance.
    // This memo remains as a safety wrapper to ensure the state is always an array.
    return Array.isArray(accreditations) ? accreditations : [];
  }, [accreditations]);

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

  const currentEvent = fullEventDetails || events.find((e) => e.id === selectedEvent);

  const handleOpenView = useCallback(async (accreditation) => {
    try {
      // Fetch full record including documents for the modal
      const [fullRecord, events] = await Promise.all([
        AccreditationsAPI.getById(accreditation.id),
        AthleteEventsAPI.getForAthlete(accreditation.accreditationId || accreditation.id)
      ]);
      setAthleteEvents(events || []);
      setViewModal({ open: true, accreditation: fullRecord || accreditation });
    } catch (error) {
      console.error("Failed to fetch full record:", error);
      setViewModal({ open: true, accreditation });
    }
  }, []);

  const handleOpenEdit = useCallback(async (accreditation) => {
    try {
      // Fetch full record including documents for editing
      const fullRecord = await AccreditationsAPI.getById(accreditation.id);
      setEditModal({ open: true, accreditation: fullRecord || accreditation });
    } catch (error) {
      console.error("Failed to fetch full record for edit:", error);
      setEditModal({ open: true, accreditation });
    }
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
        type: "accreditation_approval",
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
          type: "accreditation_approval",
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

  const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false, forceRegenerate = false) => {
    const pdfAccreditation = accreditations.find(a => a.id === accreditation.id) || accreditation;

    // Priority: Use pre-cached PDF if available from latest data
    if (!forceRegenerate && pdfAccreditation.documents?.accreditation_pdf) {
      const baseUrl = pdfAccreditation.documents.accreditation_pdf;
      const url = baseUrl.includes("?") ? `${baseUrl}&t=${Date.now()}` : `${baseUrl}?t=${Date.now()}`;
      
      await openOrDownloadStoredPdf(url, {
        openInBrowser,
        filename: `${pdfAccreditation.firstName}_${pdfAccreditation.lastName}_Card.pdf`,
      });
      toast.success(openInBrowser ? "PDF opened from cache!" : "Downloading cached PDF...");
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
          openOrDownloadStoredPdf(url, {
            openInBrowser,
            filename: `${updated.firstName}_${updated.lastName}_Card.pdf`,
          });
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
      className: "min-w-[220px]",
      render: (_, row) => {
        const isDuplicate = duplicateIds.has(row.id);

        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <div className="relative group">
              {row.photoUrl ? (
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border group-hover:border-primary-500 transition-colors">
                  <StorageImage src={row.photoUrl} loading="lazy" alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-base-alt flex items-center justify-center text-muted border-2 border-border">
                  <User className="w-5 h-5" />
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
                <span className="font-bold text-main text-[15px] truncate">
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
      className: "w-[110px]",
      render: (_, row) => (
        <Badge className="w-24 shrink-0">{row.role}</Badge>
      )
    },
    {
      key: "age",
      header: "Age",
      sortable: true,
      className: "w-[70px]",
      render: (_, row) => {
        const age = (row.role === 'Athlete' && currentEvent) 
          ? calculateAge(row.dateOfBirth, currentEvent.ageCalculationYear) 
          : null;
        return (
          <span className="text-sm font-bold text-main">
            {age !== null ? age : "---"}
          </span>
        );
      }
    },
    { key: "club", header: "Club", sortable: true, className: "min-w-[180px]" },
    {
      key: "nationality",
      header: "Country",
      sortable: true,
      className: "w-[100px]",
      render: (_, row) => {
        const flagUrl = getCountryFlag(row.nationality);
        const code = getCountryCode3(row.nationality);
        return (
          <div className="flex items-center gap-2">
            {flagUrl ? (
              <img 
                src={flagUrl} 
                alt="" 
                className="w-5.5 h-3.5 object-cover rounded-[3px] border border-border/40 shadow-sm shrink-0" 
              />
            ) : (
              <div className="w-5.5 h-3.5 rounded-[3px] bg-base-alt border border-border shrink-0" />
            )}
            <span className="text-sm font-semibold text-main">{code}</span>
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      className: "w-[130px]",
      render: (_, row) => {
        const isProcessing = currentTask?.id === row.id || (queue && queue.some(t => t.id === row.id));
        return (
          <div className="flex flex-col items-center gap-1 py-0.5">
            {isProcessing ? (
              <>
                <Badge variant="success" className="w-24 justify-center gap-1 animate-pulse shadow-sm border-emerald-500/30">
                  PROCESSING
                </Badge>
                <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-emerald-400 uppercase">
                  <Loader2 className="w-2 h-2 animate-spin" />
                  Process
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
                className="w-20 justify-center"
              >
                {row.status?.toUpperCase() || "PENDING"}
              </Badge>
            )}
            {(row.paymentAmount > 0 || !!row.stripeSessionId) && row.paymentStatus === 'paid' && (
              <div className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 w-fit">
                <Check className="w-2 h-2" />
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
      className: "w-[110px]",
      render: (_, row) => {
        if (row.status !== "approved") {
          return <span className="text-sm text-muted font-medium italic">—</span>;
        }
        const expired = isExpired(row.expiresAt);
        const label = getExpirationLabel(row.expiresAt);
        return (
          <Badge className="w-20 shrink-0 whitespace-nowrap">
            {expired ? "Expired" : label}
          </Badge>
        );
      }
    },
    {
      key: "createdAt",
      header: "Submitted",
      sortable: true,
      className: "w-[120px]",
      render: (_, row) => (
        <span className="text-sm text-muted font-medium">{formatDate(row.createdAt)}</span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[260px] min-w-[260px]",
      render: (_, row) => (
        <div className="flex items-center flex-nowrap gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenView(row); }}
            className="p-1 rounded-lg hover:bg-primary-800/30 transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
            className={cn(
              "p-1 rounded-lg transition-colors",
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
              "p-1 rounded-lg transition-colors",
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
              "p-1 rounded-lg transition-colors",
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
                className="p-1 rounded-lg hover:bg-primary-500/20 transition-colors"
                title="Preview and Download PDF"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-300" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setBadgeGeneratorModal({ open: true, accreditation: row }); }}
                className={cn(
                  "p-1 rounded-lg transition-colors",
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
                  "p-1 rounded-lg transition-colors",
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
            className="p-1 rounded-lg hover:bg-orange-500/20 transition-colors"
            title="Download All Documents"
            disabled={(!row.photoUrl && !row.idDocumentUrl) || imageDownloadingId === row.id}
          >
            <Files className={`w-3.5 h-3.5 ${(row.photoUrl || row.idDocumentUrl) ? "text-orange-300" : "text-muted"}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEmailModal({ open: true, accreditation: row }); }}
            className={cn(
              "p-1 rounded-lg transition-colors",
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
              "p-1 rounded-lg transition-colors",
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
          <h1 className="text-3xl font-bold text-main">Accreditations</h1>
          <p className="text-lg text-muted mt-1 font-extralight">Manage participant accreditations</p>
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
                className="h-[46px] text-muted hover:text-red-400 border-border hover:border-red-500/30"
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
            customFields={customFields}
            onClearSelection={setSelectedRows}
            onBulkEdit={handleBulkEdit}
            onBulkApprove={handleBulkApprove}
            disabled={isViewer}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
              <p className="text-lg text-muted">Loading accreditations...</p>
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
            <>
              <DataTable
                data={filteredAccreditations}
                columns={columns}
                searchable={true}
                externalSearchValue={searchTerm}
                onExternalSearchChange={(val) => setSearchTerm(val)}
                selectable
                selectedRows={selectedRows}
                onSelectRows={setSelectedRows}
                onRowClick={(row) => setViewModal({ open: true, accreditation: row })}
                rowClassName={(row) => duplicateIds.has(row.id) ? "bg-amber-900/10 hover:bg-amber-900/20" : ""}
              />
              {accreditations.length < totalAccreditations && (
                <div className="flex justify-center mt-8 pb-4">
                  <Button
                    variant="secondary"
                    onClick={handleLoadMore}
                    loading={isLoadingMore}
                    className="min-w-[240px] py-3 bg-base-alt border-border hover:bg-base-alt text-main font-bold tracking-widest uppercase shadow-lg transition-all"
                  >
                    {isLoadingMore ? "Loading..." : `Load More (${accreditations.length} of ${totalAccreditations})`}
                  </Button>
                </div>
              )}
            </>
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
        currentEvent={currentEvent ? { ...currentEvent, sportList: activeEventSports } : null}
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
              customFields: data.customFields,
              badgeColor: data.badgeColor,
              zoneCode: data.zoneCode,
              selectedSports: data.selectedSports,
              expiresAt: data.expiresAt
            };

            const updated = await AccreditationsAPI.adminEdit(accreditation.id, updatePayload, adminUserId);
            
            addToQueue({
              type: "accreditation_approval",
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
                customFields: data.customFields,
                badgeColor: data.badgeColor,
                zoneCode: data.zoneCode || (data.zoneCodes ? data.zoneCodes.join(",") : ""),
                selectedSports: data.selectedSports
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
                  updatePayload.accreditationId = `ACC-${new Date().getFullYear()}-${accId.substring(0, 8).toUpperCase()}`;
                  
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
                      type: "accreditation_approval",
                      id: updatedAcc.id,
                      accreditation: updatedAcc,
                      eventId: selectedEvent,
                      approveData: {
                        zoneCodes: updatedAcc.zoneCode ? updatedAcc.zoneCode.split(",") : [],
                        sendEmail: data.sendEmail
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
                  type: "accreditation_approval",
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

      {/* View Details Modal */}
      <AccreditationDetailsModal
        isOpen={viewModal.open}
        onClose={() => setViewModal({ open: false, accreditation: null })}
        accreditation={viewModal.accreditation}
        athleteEvents={athleteEvents}
        currentEvent={currentEvent}
        imageDownloadingId={imageDownloadingId}
        isViewer={isViewer}
        handleDownloadPhoto={handleDownloadPhoto}
        handleDownloadAllDocs={handleDownloadAllDocs}
        handleOpenEdit={handleOpenEdit}
        handleApprove={handleApprove}
        handleReject={handleReject}
        handlePreviewPDF={handlePreviewPDF}
        handleOpenShareLink={handleOpenShareLink}
      />

      {/* Approve Modal */}
      <ApproveAccreditationModal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, accreditation: null })}
        accreditation={approveModal.accreditation}
        zones={zones}
        currentEvent={currentEvent}
        eventCategories={eventCategories}
        categoryDocuments={categoryDocuments}
        approveData={approveData}
        setApproveData={setApproveData}
        approving={approving}
        confirmApprove={confirmApprove}
        pdfSize={pdfSize}
        setPdfSize={setPdfSize}
        handleDownloadAllDocs={handleDownloadAllDocs}
      />

      {/* Reject Modal */}
      <RejectAccreditationModal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, accreditation: null })}
        accreditation={rejectModal.accreditation}
        rejectData={rejectData}
        setRejectData={setRejectData}
        rejecting={rejecting}
        confirmReject={confirmReject}
        handleDownloadAllDocs={handleDownloadAllDocs}
      />

      {/* Bulk Approve Modal */}
      <BulkApproveModal
        isOpen={bulkApproveModal}
        onClose={() => setBulkApproveModal(false)}
        selectedRowsCount={selectedRows.length}
        zones={zones}
        approveData={approveData}
        setApproveData={setApproveData}
        approving={approving}
        confirmBulkApprove={confirmBulkApprove}
        pdfSize={pdfSize}
        setPdfSize={setPdfSize}
      />

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
              <div className="flex flex-col items-center justify-center py-12 animate-pulse space-y-6">
                <div className="flex gap-8 justify-center flex-wrap">
                  {/* Front Card Skeleton */}
                  <div className="w-[300px] h-[450px] bg-base-alt rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 w-full h-32 bg-base-alt"></div>
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-slate-600/50 border-4 border-border"></div>
                    <div className="mt-56 flex flex-col items-center space-y-3 px-6">
                      <div className="h-6 w-48 bg-base-alt rounded-md"></div>
                      <div className="h-4 w-32 bg-base-alt rounded-md"></div>
                    </div>
                    <div className="absolute bottom-6 w-full px-6 flex justify-between items-end">
                      <div className="w-20 h-20 bg-base-alt rounded-lg"></div>
                      <div className="flex flex-col space-y-2">
                        <div className="w-24 h-4 bg-base-alt rounded-md"></div>
                        <div className="w-16 h-4 bg-base-alt rounded-md"></div>
                      </div>
                    </div>
                  </div>

                  {/* Back Card Skeleton */}
                  <div className="w-[300px] h-[450px] bg-base-alt rounded-2xl border border-white/5 shadow-2xl p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="h-12 w-full bg-base-alt rounded-lg"></div>
                      <div className="h-4 w-5/6 bg-base-alt rounded-md"></div>
                      <div className="h-4 w-4/6 bg-base-alt rounded-md"></div>
                      <div className="h-4 w-full bg-base-alt rounded-md"></div>
                    </div>
                    <div className="h-16 w-full bg-base-alt rounded-lg"></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-muted">
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold uppercase tracking-widest">Generating High-Res Preview...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-base-alt rounded-xl p-6 border border-primary-800/30">
                  <h4 className="text-lg font-semibold text-main mb-4 text-center">Card Preview (Front and Back)</h4>
                  {events.find(e => e.id === pdfPreviewModal.accreditation.eventId)?.outputType === OUTPUT_TYPES.MEMBERSHIP_CARD ? (
                    <MembershipCardPreview
                      accreditation={pdfPreviewModal.accreditation}
                      event={events.find(e => e.id === pdfPreviewModal.accreditation.eventId)}
                      zones={zones}
                      eventCategories={eventCategories}
                      frontBackgroundUrl={frontBackgroundUrl}
                      customFieldConfigs={customFields}
                      onlyFrontPage={onlyFrontPage}
                    />
                  ) : (
                    <AccreditationCardPreview
                      accreditation={pdfPreviewModal.accreditation}
                      event={events.find(e => e.id === pdfPreviewModal.accreditation.eventId)}
                      zones={zones}
                      eventCategories={eventCategories}
                      frontBackgroundUrl={frontBackgroundUrl}
                      customFieldConfigs={customFields}
                      onlyFrontPage={onlyFrontPage}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-alt rounded-lg p-4 border border-primary-800/30">
                  <div>
                    <label className="block text-lg font-medium text-main mb-2">
                      PDF Size
                    </label>
                    <select
                      value={selectedPdfSize}
                      onChange={(e) => setSelectedPdfSize(e.target.value)}
                      className="w-full px-4 py-2.5 bg-base-alt border border-primary-700/50 rounded-lg text-main focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
                    >
                      {Object.entries(PDF_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>{size.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-main mb-2">
                      Image Size
                    </label>
                    <select
                      value={selectedImageSize}
                      onChange={(e) => setSelectedImageSize(e.target.value)}
                      className="w-full px-4 py-2.5 bg-base-alt border border-primary-700/50 rounded-lg text-main focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-lg"
                    >
                      {Object.entries(IMAGE_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>{size.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation)}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="w-full text-sm"
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation, false, true)}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="w-full text-sm !bg-amber-600 hover:!bg-amber-700"
                    title="Force regenerate a new HQ PDF and overwrite the old cache"
                  >
                    Regenerate HQ PDF
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Eye}
                    onClick={() => handleDownloadPDF(pdfPreviewModal.accreditation, true)}
                    className="w-full text-sm"
                  >
                    Open in Browser
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadImages(pdfPreviewModal.accreditation)}
                    loading={downloadingId === pdfPreviewModal.accreditation.id}
                    className="w-full text-sm"
                  >
                    Download Images
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handlePrintPDF}
                    className="w-full text-sm"
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
      <ShareLinkModal
        isOpen={shareLinkModal.open}
        onClose={() => setShareLinkModal({ open: false, accreditation: null })}
        accreditation={shareLinkModal.accreditation}
        shareLinkData={shareLinkData}
        setShareLinkData={setShareLinkData}
        generateShareLink={generateShareLink}
        updatingExpiry={updatingExpiry}
        generatedLink={generatedLink}
        copyShareLink={copyShareLink}
        linkCopied={linkCopied}
      />

      {/* Delete Confirmation Modal */}
      <DeleteAccreditationModal
        isOpen={deleteConfirmModal.open}
        onClose={() => setDeleteConfirmModal({ open: false, accreditation: null })}
        accreditation={deleteConfirmModal.accreditation}
        deleting={deleting}
        confirmDeleteAccreditation={confirmDeleteAccreditation}
      />

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
