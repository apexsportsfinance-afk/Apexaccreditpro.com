import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Upload,
  FileImage,
  Image as ImageIcon,
  Tags,
  Search,
  ChevronDown,
  PlusCircle,
  X,
  FileText,
  FileEdit,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  Users,
  Trophy,
  CheckCircle2,
  Activity,
  Download,
  Palette,
  Shield,
  Lock,
  QrCode,
  Trash,
  CreditCard,
  ShieldAlert
} from "lucide-react";

import { extractTextFromPdf as parsePDFText } from "../../lib/pdfParser";
import { OUTPUT_TYPES } from "../../lib/constants";
import { uploadToStorage } from "../../lib/uploadToStorage";
import Button from "../../components/ui/Button";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import MultiSearchableSelect from "../../components/ui/MultiSearchableSelect";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI, MainScannerAPI } from "../../lib/storage";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { cn, formatDate, fileToBase64 } from "../../lib/utils";
import { generateClubExports } from "../../lib/exportUtils";
import AttendanceSheet from "../../components/attendance/AttendanceSheet";
import AttendanceStats from "../../components/accreditation/AttendanceStats";
import AttendanceBadge from "../../components/accreditation/AttendanceBadge";
import ExportModal from "../../components/ui/ExportModal";
import AuditLogView from "./events/AuditLogView";
import MessageSettingsPanel, { defaultMessages } from "../../components/MessageSettingsPanel";
import InviteLinksView from "./events/InviteLinksView";
import StatCard from "./events/StatCard";
import TermsView from "./events/TermsView";
import CategoriesView from "./events/CategoriesView";
import TemplateView from "./events/TemplateView";
import ClubsAnalyticsView from "./events/ClubsAnalyticsView";

const DOCUMENT_OPTIONS = [
  { id: "picture", label: "Picture" },
  { id: "passport", label: "Passport" },
  { id: "eid", label: "EID (Emirates ID)" },
  { id: "guardian_id", label: "Parent or Guardian ID" }
];

const COLOR_PRESETS = [
  "#0ea5e9", "#0284c7", "#0369a1", "#06b6d4", "#0891b2",
  "#0e7490", "#3b82f6", "#2563eb", "#1d4ed8", "#6366f1",
  "#4f46e5", "#3730a3", "#14b8a6", "#0d9488", "#0f766e"
];

const toProperCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
};

const OVERRIDABLE_FIELDS = [
  { id: 'personalInfo', label: 'Personal Info Heading' },
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'gender', label: 'Gender' },
  { id: 'dateOfBirth', label: 'Date of Birth' },
  { id: 'nationality', label: 'Nationality' },
  { id: 'affiliation_info', label: 'Affiliation Heading' },
  { id: 'category_role', label: 'Category/Role' },
  { id: 'organization', label: 'Organization' },
  { id: 'participatingSports', label: 'Participating Sports' },
  { id: 'contact_details', label: 'Contact Details Heading' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'documents', label: 'Documents Heading' },
  { id: 'termsLink', label: 'Terms & Conditions Link' },
  { id: 'submit', label: 'Submit Button' }
];

export default function Events() {
  const { id, subpage } = useParams();
  const navigate = useNavigate();
  const { canAccessEvent, user, hasExactModuleAccess } = useAuth();
  const isSuperAdminOnly = user?.role === "super_admin";
  const hasFullEventAccess = hasExactModuleAccess("/admin/events");
  const hasAuditLogAccess = hasExactModuleAccess("/admin/events/audit-log");
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [eventCounts, setEventCounts] = useState({});
  const [editingEvent, setEditingEvent] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [copiedScannerEventId, setCopiedScannerEventId] = useState(null);
  const [copiedAthleteInfoEventId, setCopiedAthleteInfoEventId] = useState(null);
  const [copiedServiceCheckinSlug, setCopiedServiceCheckinSlug] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, slug: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [deleting, setDeleting] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [duplicateError, setDuplicateError] = useState(null);
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);
  const [bookingConfigModal, setBookingConfigModal] = useState({ open: false, fieldId: null, data: null });
  const [visibilityConfig, setVisibilityConfig] = useState({ affiliation: true, contact: true, documents: true, phone: "optional" });
  const [showLabelOverrides, setShowLabelOverrides] = useState(false);
  const [mainGateModal, setMainGateModal] = useState({ open: false, eventId: null });
  const [mainGateConfig, setMainGateConfig] = useState(null);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [formData, setFormData] = useState({
    outputType: OUTPUT_TYPES.ACCREDITATION_PASS,
    name: "",
    slug: "",
    sportList: [],
    description: "",
    startDate: "",
    endDate: "",
    location: "",
    ageCalculationYear: new Date().getFullYear(),
    registrationOpen: true,
    reportingTimes: "",
    headerArabic: "",
    headerSubtitle: "",
    logoUrl: "",
    backTemplateUrl: "",
    sponsorLogos: [],
    customFields: [],
    visibility: { affiliation: true, contact: true, documents: true, phone: "optional" },
    requiredDocuments: [
      { id: "picture", label: "Picture", format: "JPEG, PNG, WEBP" },
      { id: "passport", label: "Passport", format: "JPEG, PNG, WEBP, PDF" }
    ],
    labelOverrides: {},
    fieldConfig: {}
  });
  const [localClosedMessage, setLocalClosedMessage] = useState("");
  const [isSavingMessage, setIsSavingMessage] = useState(false);

  useEffect(() => {
    if (id && events.length > 0) {
      const event = events.find(e => e.id === id);
      if (event) {
        setLocalClosedMessage(prev => {
          // Only update if it's currently empty or if it's different from what we have 
          // (avoiding overwriting while typing, although blur/save usually handles this)
          if (!prev || prev !== event.registrationClosedMessage) {
            return event.registrationClosedMessage || "";
          }
          return prev;
        });
      }
    }
  }, [id, events]);

  const toast = useToast();

  useEffect(() => {
    loadEvents();
    loadCategories();
  }, []);

  const [fetchingEvents, setFetchingEvents] = useState(true);

  const loadEvents = async () => {
    try {
      setFetchingEvents(true);
      
      const fetchPromise = async () => {
        const data = await EventsAPI.getAllMinimal();
        const filteredData = data.filter(e => canAccessEvent(e.id));
        setEvents(filteredData);
        
        if (filteredData.length > 0) {
          // APX-PERF: Load event counts asynchronously so they don't block the UI
          const now = new Date();
          now.setDate(now.getDate() - 30);
          
          const activeEventIds = filteredData.filter(e => {
            if (e.registrationOpen) return true;
            if (!e.endDate) return true;
            return new Date(e.endDate) >= now;
          }).map(e => e.id);
          
          if (activeEventIds.length > 0) {
            // Kick off background fetch without awaiting
            AccreditationsAPI.getCountsByEventIds(activeEventIds).then(counts => {
              const finalCounts = { ...counts };
              filteredData.forEach(e => {
                if (!activeEventIds.includes(e.id)) {
                  finalCounts[e.id] = { archived: true, total: '-', pending: '-', approved: '-' };
                }
              });
              setEventCounts(finalCounts);
            }).catch(err => {
              console.error("Background counts fetch failed:", err);
            });
          } else {
            const finalCounts = {};
            filteredData.forEach(e => {
              finalCounts[e.id] = { archived: true, total: '-', pending: '-', approved: '-' };
            });
            setEventCounts(finalCounts);
          }
        }
      };

      // APX-102: Emergency timeout to prevent infinite spinning
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000)
      );

      await Promise.race([fetchPromise(), timeoutPromise]);
    } catch (error) {
      console.error("Failed to load events:", error);
      if (error.message.includes("timed out")) {
        toast.error("Loading events took too long. Showing partial data.");
      }
    } finally {
      setFetchingEvents(false);
    }
  };

  const loadCategories = async () => {
    const cats = await CategoriesAPI.getActive();
    setAvailableCategories(cats);
  };

  const resetForm = () => {
    setFormData({
      outputType: OUTPUT_TYPES.ACCREDITATION_PASS,
      name: "",
      slug: "",
      sportList: ["Swimming"],
      description: "",
      startDate: "",
      endDate: "",
      location: "",
      ageCalculationYear: new Date().getFullYear(),
      registrationOpen: true,
      reportingTimes: "",
      headerArabic: "",
      headerSubtitle: "",
      logoUrl: "",
      backTemplateUrl: "",
      sponsorLogos: [],
      customFields: [],
      visibility: { affiliation: true, contact: true, documents: true, phone: "optional" },
      requiredDocuments: [
        { id: "picture", label: "Picture", format: "JPEG, PNG, WEBP" },
        { id: "passport", label: "Passport", format: "JPEG, PNG, WEBP, PDF" }
      ],
      labelOverrides: {},
      fieldConfig: {}
    });
    setEditingEvent(null);
  };

  const handleOpenModal = async (event = null) => {
    if (event) {
      const fullEvent = await EventsAPI.getById(event.id);
      event = fullEvent || event;

      // 1. Initialize variables with defaults
      let extSport = ["Swimming"];
      let customFields = [];
      let visibility = { affiliation: true, contact: true, documents: true, phone: "optional" };

      // 2. Fetch all data in parallel
      try {
        const [sportRes, customFieldsRes, visibilityRes, labelsRes, fieldConfigRes] = await Promise.all([
          GlobalSettingsAPI.get(`event_${event.id}_sport`).catch(() => null),
          GlobalSettingsAPI.get(`event_${event.id}_custom_fields`).catch(() => null),
          GlobalSettingsAPI.get(`event_${event.id}_visibility`).catch(() => null),
          GlobalSettingsAPI.get(`event_${event.id}_label_overrides`).catch(() => null),
          GlobalSettingsAPI.get(`event_${event.id}_field_config`).catch(() => null)
        ]);

        // Process Sports
        if (sportRes) {
          try {
            const parsed = JSON.parse(sportRes);
            extSport = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            extSport = [sportRes];
          }
        } else if (event.sportList && event.sportList.length > 0) {
          extSport = event.sportList;
        }

        // Process Custom Fields
        if (customFieldsRes) {
          try {
            customFields = JSON.parse(customFieldsRes);
            setCustomFieldsConfig(customFields);
          } catch (e) {
            console.error("Parse custom fields error", e);
          }
        }

        // Process Visibility
        if (visibilityRes) {
          try {
            visibility = JSON.parse(visibilityRes);
            setVisibilityConfig(visibility);
          } catch (e) {
            console.error("Parse visibility error", e);
          }
        }

        // Process Label Overrides
        let labels = {};
        if (labelsRes) {
          try {
            labels = JSON.parse(labelsRes);
          } catch (e) {
            console.error("Parse labels error", e);
          }
        }
        event.labelOverrides = labels;

        // Process Field Config
        let fieldConfig = {};
        if (fieldConfigRes) {
          try {
            fieldConfig = JSON.parse(fieldConfigRes);
          } catch (e) {
            console.error("Parse fieldConfig error", e);
          }
        }
        event.fieldConfig = fieldConfig;
      } catch (err) {
        console.error("Failed to load event settings", err);
      }

      // 3. Set editing state and form data
      setEditingEvent(event);
      setFormData({
        outputType: event.outputType || OUTPUT_TYPES.ACCREDITATION_PASS,
        name: event.name,
        slug: event.slug,
        sportList: extSport,
        description: event.description || "",
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        ageCalculationYear: event.ageCalculationYear,
        registrationOpen: event.registrationOpen,
        reportingTimes: event.reportingTimes || "",
        headerArabic: event.headerArabic || "",
        headerSubtitle: event.headerSubtitle || "",
        logoUrl: event.logoUrl || "",
        backTemplateUrl: event.backTemplateUrl || "",
        sponsorLogos: event.sponsorLogos || [],
        customFields: customFields,
        visibility: visibility,
        requiredDocuments: (() => {
          const docs = event.requiredDocuments || ["picture", "passport"];
          return docs.map(doc => {
            if (typeof doc === 'string') {
              const option = DOCUMENT_OPTIONS.find(d => d.id === doc);
              return { 
                id: doc, 
                label: option ? option.label : toProperCase(doc),
                format: doc === 'picture' ? 'JPEG, PNG, WEBP' : 'JPEG, PNG, WEBP, PDF'
              };
            }
            return doc;
          });
        })(),
        labelOverrides: event.labelOverrides || {},
        fieldConfig: event.fieldConfig || {}
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name)
    }));
  };


  const addDocumentRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requiredDocuments: [
        ...(prev.requiredDocuments || []),
        { id: `custom_${Date.now()}`, label: "", format: "JPEG, PNG, PDF" }
      ]
    }));
  };

  const removeDocumentRequirement = (id) => {
    setFormData(prev => ({
      ...prev,
      requiredDocuments: (prev.requiredDocuments || []).filter(d => d.id !== id)
    }));
  };

  const updateDocumentRequirement = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      requiredDocuments: (prev.requiredDocuments || []).map(d => 
        d.id === id ? { ...d, [field]: value } : d
      )
    }));
  };

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      customFields: [
        ...(prev.customFields || []),
        { id: `cf_${Date.now()}`, label_en: "", label_ar: "", type: "text", required: false, options: "", showOnBadge: false }
      ]
    }));
  };

  const removeCustomField = (id) => {
    setFormData(prev => ({
      ...prev,
      customFields: (prev.customFields || []).filter(cf => cf.id !== id)
    }));
  };

  const updateCustomField = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: (prev.customFields || []).map(cf => 
        cf.id === id ? { ...cf, [field]: value } : cf
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!formData.requiredDocuments || formData.requiredDocuments.length === 0) {
      toast.error("Please select at least one required document");
      return;
    }
    const saveEvent = async () => {
      try {
        let savedEventId;
        const { sportList, ...apiData } = formData;
        
        if (editingEvent) {
          const dataToUpdate = { ...apiData };
          if (formData.slug === editingEvent.slug) {
            delete dataToUpdate.slug;
          }
          await EventsAPI.update(editingEvent.id, dataToUpdate);
          savedEventId = editingEvent.id;
          toast.success("Event updated successfully");
        } else {
          const newEvent = await EventsAPI.create(apiData);
          savedEventId = newEvent.id;
          toast.success("Event created successfully");
        }
        
        if (savedEventId) {
          await GlobalSettingsAPI.set(`event_${savedEventId}_sport`, formData.sportList);
          await GlobalSettingsAPI.set(`event_${savedEventId}_custom_fields`, JSON.stringify(formData.customFields || []));
          await GlobalSettingsAPI.set(`event_${savedEventId}_visibility`, JSON.stringify(formData.visibility || { affiliation: true, contact: true, documents: true, phone: "optional" }));
          await GlobalSettingsAPI.set(`event_${savedEventId}_label_overrides`, JSON.stringify(formData.labelOverrides || {}));
          await GlobalSettingsAPI.set(`event_${savedEventId}_field_config`, JSON.stringify(formData.fieldConfig || {}));
        }

        handleCloseModal();
        loadEvents();
      } catch (error) {
        console.error("Save event error:", error);
        if (error?.code === "23505" || (error?.message && error.message.includes("duplicate key"))) {
          toast.error("This URL slug is already in use. Please choose a different slug.");
        } else {
          toast.error("Failed to save event: " + (error?.message || "Unknown error"));
        }
      }
    };
    saveEvent();
  };

  const handleDelete = async (event) => {
    setDeleteModal({ open: true, event });
  };

  const confirmDelete = async () => {
    if (!deleteModal.event) return;
    setDeleting(true);
    try {
      await EventsAPI.delete(deleteModal.event.id);
      toast.success("Event and all related data deleted successfully");
      setDeleteModal({ open: false, event: null });
      await loadEvents();
    } catch (error) {
      console.error("Delete event error:", error);
      toast.error("Failed to delete event: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };


  const getRegistrationLink = (slug) => {
    return `${window.location.origin}/register/${slug}`;
  };

  const getScannerLink = (eventId) => {
    return `${window.location.origin}/scanner?event_id=${eventId}&mode=attendance`;
  };

  const getAthleteInfoLink = (eventId) => {
    const pin = import.meta.env.VITE_SCANNER_PIN;
    return `${window.location.origin}/scanner?event_id=${eventId}&mode=info&public=true${pin ? `&pin=${pin}` : ''}`;
  };

  const getServiceCheckinLink = (slug) => {
    return `${window.location.origin}/service-checkin/${slug}`;
  };

  const copyRegistrationLink = async (slug) => {
    const link = getRegistrationLink(slug);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopiedSlug(slug);
        toast.success("Registration link copied to clipboard");
        setTimeout(() => setCopiedSlug(null), 2000);
      } else {
        setShareModal({ open: true, slug });
      }
    } catch {
      toast.info("Please copy the link manually");
    }
  };

  const openMainGateSettings = async (eventId) => {
    try {
      const config = await MainScannerAPI.getConfig(eventId);
      const scannerPin = await GlobalSettingsAPI.get(`event_${eventId}_scanner_pin`);
      setMainGateConfig({
        ignoreDuplicates: config?.ignoreDuplicates ?? true,
        scannerPin: scannerPin || "",
        settings: {
          messages: config?.settings?.messages || { ...defaultMessages, secondScan: { text: "Access Granted", voice: "Access Granted", audioUrl: null } },
          voiceEnabled: config?.settings?.voiceEnabled ?? true,
          voiceSettings: config?.settings?.voiceSettings || { language: 'en-US', volume: 1.0 }
        }
      });
      setMainGateModal({ open: true, eventId });
    } catch (err) {
      console.error("Failed to load Main Gate Settings:", err);
      toast.error("Failed to load Main Gate settings.");
    }
  };

  const saveMainGateSettings = async () => {
    try {
      await MainScannerAPI.saveConfig(mainGateModal.eventId, mainGateConfig);
      if (mainGateConfig.scannerPin) {
        await GlobalSettingsAPI.set(`event_${mainGateModal.eventId}_scanner_pin`, mainGateConfig.scannerPin);
      } else {
        await GlobalSettingsAPI.remove(`event_${mainGateModal.eventId}_scanner_pin`);
      }
      toast.success("Main Gate settings saved!");
      setMainGateModal({ open: false, eventId: null });
    } catch (err) {
      console.error("Failed to save Main Gate Settings:", err);
      toast.error("Failed to save settings.");
    }
  };

  const copyScannerLink = async (eventId) => {
    const link = getScannerLink(eventId);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopiedScannerEventId(eventId);
        toast.success("Scanner link copied to clipboard");
        setTimeout(() => setCopiedScannerEventId(null), 2000);
      } else {
        toast.info("Please copy the link manually");
      }
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const copyAthleteInfoLink = async (eventId) => {
    const link = getAthleteInfoLink(eventId);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopiedAthleteInfoEventId(eventId);
        toast.success("Athlete Info Hub link copied");
        setTimeout(() => setCopiedAthleteInfoEventId(null), 2000);
      } else {
        toast.info("Please copy manually");
      }
    } catch {
      toast.error("Failed to copy");
    }
  };

  const copyServiceCheckinLink = async (slug) => {
    const link = getServiceCheckinLink(slug);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopiedServiceCheckinSlug(slug);
        toast.success("Service Check-in link copied");
        setTimeout(() => setCopiedServiceCheckinSlug(null), 2000);
      } else {
        toast.info("Please copy manually");
      }
    } catch {
      toast.error("Failed to copy");
    }
  };

  const openClubsModal = async (event) => {
    setSelectedEventForClubs(event);
    setParsedClubs([]);
    setClubsModalOpen(true);
    
    // Load existing clubs if any
    try {
      const clubsStr = await GlobalSettingsAPI.get(`event_${event.id}_clubs`);
      if (clubsStr) {
        setParsedClubs(JSON.parse(clubsStr));
      }
    } catch (err) {
      console.error("Failed to load existing clubs:", err);
    }
  };

  const handleClubsFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    setParsingClubs(true);

    try {
      let clubs = [];
      if (extension === 'csv' || extension === 'xlsx') {
        const XLSX = await import("xlsx");
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            if (!jsonData || jsonData.length === 0) {
              toast.error("The file appears to be empty");
              setParsingClubs(false);
              return;
            }

            // SS 1 logic: Column P (index 15) is Short Name, Column Q (index 16) is Full Name
            // Fallback to searching for "club" in header if columns P/Q aren't present
            let shortNameIdx = 15;
            let fullNameIdx = 16;
            
            if (jsonData[0] && jsonData[0].length < 17) {
              const header = jsonData[0].map(h => String(h || "").toLowerCase());
              const foundIndex = header.indexOf("club");
              if (foundIndex !== -1) {
                shortNameIdx = foundIndex;
                fullNameIdx = foundIndex;
              } else {
                // Try searching for partial match "team" or "club"
                const fallbackIdx = header.findIndex(h => h.includes("club") || h.includes("team"));
                if (fallbackIdx !== -1) {
                  shortNameIdx = fallbackIdx;
                  fullNameIdx = fallbackIdx;
                } else {
                  shortNameIdx = 0;
                  fullNameIdx = 0;
                }
              }
            }

            const firstRow = jsonData[0] || [];
            const isHeader = firstRow.some(cell => {
              const val = String(cell || "").toLowerCase();
              return val.includes("club") || val.includes("team") || val.includes("academy") || 
                     val.includes("name") || val.includes("sr#") || val.includes("serial");
            });

            const dataToProcess = isHeader ? jsonData.slice(1) : jsonData;

            const extracted = dataToProcess
              .map(row => {
                const full = String(row[fullNameIdx] || "").trim();
                return full;
              })
              .filter(val => val && val.length > 0);
            
            const uniqueClubs = [...new Set(extracted)].sort();
            if (uniqueClubs.length === 0) {
              toast.error("No valid club names found in the file. Please check column headers.");
            } else {
              setParsedClubs(uniqueClubs);
              toast.success(`Extracted ${uniqueClubs.length} unique clubs`);
            }
            setParsingClubs(false);
          } catch (err) {
            console.error("XLSX parse error:", err);
            toast.error(`Parse Error: ${err.message || "Unknown error"}`);
            setParsingClubs(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'pdf') {
        try {
          const pdfjsLib = await import("pdfjs-dist");
          // Use a local worker if possible, or ensure the version matches
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(item => item.str).join(" ");
          }

          // SS 2 logic: Under "Team" heading, pattern is [Serial] [ShortName] [FullName]
          const teamMatch = fullText.match(/Team\s+Relays\s+Athletes/i);
          let extractedClubs = [];
          
          if (teamMatch) {
            const tableText = fullText.substring(teamMatch.index);
            const lines = tableText.split(/\n|\s{3,}/).map(l => l.trim()).filter(l => l.length > 5);
            lines.forEach(line => {
              const parts = line.split(/\s+/);
              if (parts.length >= 3 && /^\d+$/.test(parts[0]) && parts[1].length >= 2 && parts[1].toUpperCase() === parts[1]) {
                const full = parts.slice(2).join(" ");
                const cleanFull = full.split(/\d+/)[0].trim();
                if (cleanFull) {
                  extractedClubs.push(cleanFull);
                }
              }
            });
          }

          if (extractedClubs.length === 0) {
            // Fallback: search for lines that look like [Num] [Code] [Name] anywhere
            const lines = fullText.split(/\s{2,}|\n/).map(l => l.trim()).filter(l => l.length > 3);
            extractedClubs = lines.filter(l => /^\d+\s+[A-Z]{2,6}\s+[A-Za-z]/.test(l))
                                  .map(l => l.split(/\s+/).slice(2).join(" ").split(/\d+/)[0].trim());
            
            if (extractedClubs.length === 0) {
              // Final fallback: just take unique lines that look like club names
              extractedClubs = [...new Set(lines.filter(l => l.length > 10 && !l.includes("Page")))];
            }
          }

          const uniqueClubs = [...new Set(extractedClubs)].sort();
          if (uniqueClubs.length === 0) {
            toast.error("No clubs detected in PDF. This parser is tuned for standard HY-TEK reports.");
          } else {
            setParsedClubs(uniqueClubs);
            toast.success(`Extracted ${uniqueClubs.length} potential club entries from PDF`);
          }
          setParsingClubs(false);
        } catch (pdfErr) {
          console.error("PDF parse error:", pdfErr);
          toast.error(`PDF Error: ${pdfErr.message || "Failed to parse PDF contents"}`);
          setParsingClubs(false);
        }
      } else {
        toast.error("Unsupported file format");
        setParsingClubs(false);
      }
    } catch (err) {
      console.error("File upload error:", err);
      toast.error("Failed to process file");
      setParsingClubs(false);
    }
  };

  const saveClubsList = async () => {
    if (!selectedEventForClubs || parsedClubs.length === 0) return;
    setSavingClubs(true);
    try {
      await GlobalSettingsAPI.set(`event_${selectedEventForClubs.id}_clubs`, JSON.stringify(parsedClubs));
      toast.success("Clubs list updated successfully");
      setClubsModalOpen(false);
    } catch (err) {
      console.error("Save clubs error:", err);
      toast.error("Failed to save clubs list");
    } finally {
      setSavingClubs(false);
    }
  };

  const removeClub = (index) => {
    setParsedClubs(prev => prev.filter((_, i) => i !== index));
  };

  const clearClubs = async () => {
    if (!selectedEventForClubs) return;
    if (!window.confirm("Are you sure you want to clear the clubs list for this event?")) return;
    
    try {
      await GlobalSettingsAPI.remove(`event_${selectedEventForClubs.id}_clubs`);
      setParsedClubs([]);
      toast.success("Clubs list cleared");
    } catch (err) {
      toast.error("Failed to clear list");
    }
  };

  const handleManualCopy = () => {
    const link = getRegistrationLink(shareModal.slug);
    const input = document.getElementById("share-link-input");
    if (input) {
      input.select();
      input.setSelectionRange(0, link.length);
      try {
        document.execCommand("copy");
        toast.success("Link copied to clipboard");
        setShareModal({ open: false, slug: "" });
      } catch {
        toast.info("Please copy the link manually using Ctrl+C / Cmd+C");
      }
    }
  };

  const getDocumentLabel = (docIds) => {
    if (!docIds || docIds.length === 0) return "None selected";
    if (docIds.length === DOCUMENT_OPTIONS.length) return "All documents";
    return docIds.map(doc => {
      if (typeof doc === 'string') {
        const option = DOCUMENT_OPTIONS.find(d => d.id === doc);
        return option ? option.label : doc;
      }
      return doc.label;
    }).join(", ");
  };

  if (fetchingEvents) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (id && events.length > 0 && !events.find(e => e.id === id)) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Event Not Found"
        description="The event you are looking for does not exist or you do not have permission to access it."
        action={() => navigate("/admin/events")}
        actionLabel="Back to Events List"
      />
    );
  }

  return (
    <div id="events_page" className="space-y-6">
      {/* Header section with back button if in detail view */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {id && (
            <button 
              onClick={() => navigate("/admin/events")} 
              className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
              title="Back to all events"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-main mb-2">
              {id ? "Manage Event" : "Events"}
            </h1>
            <p className="text-lg text-muted font-extralight">
              {id ? "Configure and manage this specific event" : "Manage your competition events"}
            </p>
          </div>
        </div>
        {!id && isSuperAdminOnly && (
          <Button icon={Plus} onClick={() => handleOpenModal()}>
            Create Event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Events Yet"
          description={isSuperAdminOnly ? "Create your first event to start managing accreditations" : "No events are currently available for management."}
          action={isSuperAdminOnly ? () => handleOpenModal() : null}
          actionLabel={isSuperAdminOnly ? "Create Event" : ""}
          actionIcon={isSuperAdminOnly ? Plus : null}
        />
      ) : !id ? (
        /* --- LIST VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/admin/events/${event.id}`)}
              className="group cursor-pointer"
            >
              <Card className="h-full border-slate-800 hover:border-primary-500/50 hover:bg-slate-800/30 transition-all duration-300">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-main truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {event.name}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">{event.location}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transform group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : subpage === "categories" && hasFullEventAccess ? (
        /* --- CATEGORIES SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Categories Management</h2>
              </div>
              <CategoriesView 
                event={event} 
                availableCategories={availableCategories}
                onClose={() => navigate(`/admin/events/${id}`)}
              />
            </div>
          );
        })()
      ) : subpage === "template" && hasFullEventAccess ? (
        /* --- TEMPLATE SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Template Configuration</h2>
              </div>
              <TemplateView 
                event={event} 
                onClose={() => navigate(`/admin/events/${id}`)}
                onSave={loadEvents}
              />
            </div>
          );
        })()
      ) : subpage === "clubs" && hasFullEventAccess ? (
        /* --- CLUBS SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Event Clubs & Analytics</h2>
              </div>
              <ClubsAnalyticsView 
                event={event} 
                onClose={() => navigate(`/admin/events/${id}`)}
                onUpload={() => loadEvents()}
              />
            </div>
          );
        })()
      ) : subpage === "attendance" && hasFullEventAccess ? (
        /* --- ATTENDANCE SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Event Attendance</h2>
              </div>
              <AttendanceSheet event={event} onClose={() => navigate(`/admin/events/${id}`)} />
            </div>
          );
        })()
      ) : subpage === "invite-links" && hasFullEventAccess ? (
        /* --- INVITE LINKS SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Private Invite Links</h2>
              </div>
              <InviteLinksView event={event} />
            </div>
          );
        })()
      ) : subpage === "terms" && hasFullEventAccess ? (
        /* --- TERMS SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Terms & Conditions</h2>
              </div>
              <TermsView event={event} onSave={() => loadEvents()} />
            </div>
          );
        })()
      ) : subpage === "audit-log" && hasAuditLogAccess ? (
        /* --- AUDIT LOG SUB-PAGE --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => navigate(`/admin/events/${id}`)}
                  className="p-2 bg-base-alt hover:bg-border rounded-xl text-muted hover:text-main transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-main">Scanner Audit Ledger</h2>
              </div>
              <AuditLogView event={event} />
            </div>
          );
        })()
      ) : (
        /* --- DETAIL VIEW (DEFAULT) --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return (
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-critical mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-main mb-2">Event Not Found</h2>
              <p className="text-muted mb-6">The event you are looking for does not exist or has been deleted.</p>
              <Button onClick={() => navigate("/admin/events")}>Go Back to Events</Button>
            </div>
          );

          const counts = eventCounts[event.id] || { total: 0, pending: 0, approved: 0 };
          const link = getRegistrationLink(event.slug);
          const scannerLink = `${window.location.origin}/scanner?event_id=${event.id}`;
          const athleteInfoLink = getAthleteInfoLink(event.id);

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Event Info Card */}
              <Card className="border-border overflow-hidden bg-base shadow-2xl">
                <div className="h-1 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500" />
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold text-main">{event.name}</h2>
                          {hasFullEventAccess && (
                            <div className="ms-4 flex items-center gap-3">
                              <button 
                              onClick={async () => {
                                try {
                                  await EventsAPI.update(event.id, { registrationOpen: !event.registrationOpen });
                                  loadEvents();
                                  toast.success(`Registration ${!event.registrationOpen ? 'opened' : 'closed'}`);
                                } catch (err) {
                                  toast.error("Failed to toggle status");
                                }
                              }}
                              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border-2 transition-all duration-300 active:scale-95 shadow-xl group/toggle ${
                                event.registrationOpen 
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 shadow-emerald-500/10" 
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 shadow-amber-500/10"
                              }`}
                              title={event.registrationOpen ? "Click to Close Registration" : "Click to Open Registration"}
                            >
                              <div className={`w-2 h-2 rounded-full animate-pulse ${event.registrationOpen ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              <span className="text-xs font-black uppercase tracking-[0.25em]">
                                {event.registrationOpen ? "Registration Open" : "Registration Closed"}
                              </span>
                            </button>
                          </div>
                          )}
                        </div>

                        {!event.registrationOpen && hasFullEventAccess && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-base-alt border border-border rounded-xl p-3 max-w-xl group/msg shadow-xl backdrop-blur-xl"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">
                                      Closed Notification Message
                                    </label>
                                    <Edit className="w-3 h-3 text-muted" />
                                  </div>
                                  <textarea
                                    value={localClosedMessage}
                                    onChange={(e) => setLocalClosedMessage(e.target.value)}
                                    placeholder="e.g. Registration is currently closed. Please contact info@apex.com"
                                    className="w-full bg-transparent border-none p-0 text-sm text-main placeholder:text-muted focus:ring-0 resize-none min-h-[36px] font-light leading-relaxed scrollbar-hide"
                                    rows={1}
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    icon={Check}
                                    loading={isSavingMessage}
                                    disabled={localClosedMessage === (event.registrationClosedMessage || "")}
                                    onClick={async () => {
                                      setIsSavingMessage(true);
                                      try {
                                        await EventsAPI.update(event.id, { registrationClosedMessage: localClosedMessage });
                                        await loadEvents();
                                        toast.success("Notification message updated");
                                      } catch (err) {
                                        toast.error("Failed to update message");
                                      } finally {
                                        setIsSavingMessage(false);
                                      }
                                    }}
                                  >
                                    Update Message
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted font-light flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary-500" />
                        {event.location} • {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </p>
                    </div>
                    
                    {isSuperAdminOnly && (
                      <div className="flex gap-2 h-fit">
                        <Button variant="secondary" icon={Edit} onClick={() => handleOpenModal(event)}>Edit Settings</Button>
                        <Button variant="ghost" icon={Trash2} onClick={() => handleDelete(event)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">Delete</Button>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <div className="max-w-3xl">
                      <p className="text-sm text-muted leading-relaxed font-extralight italic">
                        "{event.description}"
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Registration Link</label>
                        <div className="flex items-center gap-2 bg-base-alt border border-border rounded-xl px-3 py-2 group shadow-sm">
                          <LinkIcon className="w-4 h-4 text-primary-500 flex-shrink-0" />
                          <code className="text-primary-600 dark:text-primary-400 flex-1 truncate text-sm font-bold">{link}</code>
                          <button
                            onClick={() => copyRegistrationLink(event.slug)}
                            className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors"
                            title="Copy link"
                          >
                            {copiedSlug === event.slug ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted block">QR Scanner Link</label>
                          {hasFullEventAccess && (
                            <button onClick={() => openMainGateSettings(event.id)} className="flex items-center gap-1 text-[10px] font-bold text-primary-400 hover:text-primary-300">
                              <Edit className="w-3 h-3" /> Configure Gate
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 bg-base-alt border border-border rounded-xl px-3 py-2 group shadow-sm">
                          <Activity className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                          <code className="text-cyan-600 dark:text-cyan-400 flex-1 truncate text-sm font-bold">{getScannerLink(event.id)}</code>
                          <button
                            onClick={() => copyScannerLink(event.id)}
                            className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors"
                            title="Copy link"
                          >
                            {copiedScannerEventId === event.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Athlete Info Hub (Self-Service)</label>
                          <span className="text-[10px] font-mono font-bold text-emerald-600/70 dark:text-emerald-500/60 transition-colors group-hover:text-emerald-400">
                             PIN: {import.meta.env.VITE_SCANNER_PIN || "Not Set"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-base-alt border border-border rounded-xl px-3 py-2 group shadow-sm">
                          <Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <code className="text-emerald-600 dark:text-emerald-400 flex-1 truncate text-xs font-bold">{getAthleteInfoLink(event.id)}</code>
                          <button
                            onClick={() => copyAthleteInfoLink(event.id)}
                            className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors"
                            title="Copy link"
                          >
                            {copiedAthleteInfoEventId === event.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a href={getAthleteInfoLink(event.id)} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5 mt-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Service Check-in (Staff)</label>
                        </div>
                        <div className="flex items-center gap-2 bg-base-alt border border-border rounded-xl px-3 py-2 group shadow-sm">
                          <LinkIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <code className="text-orange-600 dark:text-orange-400 flex-1 truncate text-xs font-bold">{getServiceCheckinLink(event.slug)}</code>
                          <button
                            onClick={() => copyServiceCheckinLink(event.slug)}
                            className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors"
                            title="Copy link"
                          >
                            {copiedServiceCheckinSlug === event.slug ? <Check className="w-4 h-4 text-orange-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a href={getServiceCheckinLink(event.slug)} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-base rounded-lg text-muted hover:text-main transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-4">
                        <div className="flex items-center gap-1.5 text-main bg-base-alt px-2.5 py-1.5 rounded-lg border border-border">
                          <FileText className="w-3.5 h-3.5 text-primary-500" />
                          <span className="text-xs font-medium">Docs: {getDocumentLabel(event.requiredDocuments)}</span>
                        </div>
                        {event.backTemplateUrl && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 font-medium">
                            <FileImage className="w-3.5 h-3.5" />
                            <span className="text-xs">Template Configured</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-base-alt rounded-2xl p-6 border border-border relative overflow-hidden shadow-inner">
                      {counts.archived ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-base-alt/80 backdrop-blur-sm z-10">
                          <span className="text-sm font-black text-muted uppercase tracking-[0.3em]">Archived Event</span>
                        </div>
                      ) : null}
                      <div className={`flex items-center justify-around ${counts.archived ? 'opacity-30 blur-sm' : ''}`}>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-main mb-1">{counts.total}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Total</p>
                        </div>
                        <div className="w-px h-12 bg-border" />
                        <div className="text-center">
                          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">{counts.pending}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Pending</p>
                        </div>
                        <div className="w-px h-12 bg-border" />
                        <div className="text-center">
                          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{counts.approved}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Approved</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Sections */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {hasFullEventAccess && (
                  <>
                    <DetailActionCard 
                      title="Categories" 
                      description="Manage roles, registration fees, and badge colors for this event"
                      icon={Tags}
                      color="from-primary-600 to-blue-500"
                      onClick={() => navigate(`/admin/events/${id}/categories`)}
                    />
                    <DetailActionCard 
                      title="Accreditation Template" 
                      description="Configure card headers, sponsor logos, and back-side access zones"
                      icon={FileImage}
                      color="from-emerald-600 to-teal-500"
                      onClick={() => navigate(`/admin/events/${id}/template`)}
                    />
                    <DetailActionCard 
                      title="Event Clubs List" 
                      description="Upload and manage the list of registered clubs for searchable selection"
                      icon={Upload}
                      color="from-purple-600 to-indigo-500"
                      onClick={() => navigate(`/admin/events/${id}/clubs`)}
                    />
                    <DetailActionCard 
                      title="Attendance Module" 
                      description="View live event scanner check-ins and download attendance reports"
                      icon={Activity}
                      color="from-cyan-600 to-sky-500"
                      onClick={() => navigate(`/admin/events/${id}/attendance`)}
                    />
                    <DetailActionCard 
                      title="Private Invite Links" 
                      description="Generate secret registration links for late submissions without opening main registration"
                      icon={Lock}
                      color="from-violet-600 to-purple-500"
                      onClick={() => navigate(`/admin/events/${id}/invite-links`)}
                    />
                    <DetailActionCard 
                      title="Terms & Conditions" 
                      description="Customize the legal terms and health waivers displayed during registration"
                      icon={Shield}
                      color="from-blue-600 to-cyan-500"
                      onClick={() => navigate(`/admin/events/${id}/terms`)}
                    />
                  </>
                )}
                {hasAuditLogAccess && (
                  <DetailActionCard 
                    title="Scanner Audit Log" 
                    description="View all scan attempts, download CSV/Excel logs, and view sport summaries"
                    icon={ShieldAlert}
                    color="from-amber-600 to-orange-500"
                    onClick={() => navigate(`/admin/events/${id}/audit-log`)}
                  />
                )}
              </div>
            </motion.div>
          );
        })()
      )}

      {/* Create/Edit Event Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingEvent ? "Edit Event" : "Create Event"}
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
              Output Type
            </label>
            <select
              value={formData.outputType}
              onChange={(e) => setFormData(prev => ({ ...prev, outputType: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:ring-1 focus:ring-primary-500 transition-all"
              required
            >
              {Object.values(OUTPUT_TYPES).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <Input
            label="Event Name"
            value={formData.name}
            onChange={handleNameChange}
            placeholder="International Swimming Championship 2025"
            required
          />

          <Input
            label="URL Slug"
            value={formData.slug}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, slug: e.target.value }))
            }
            placeholder="swimming-2025"
            required
          />

          <div className="space-y-1.5">
            <MultiSearchableSelect
              label="UAE Sport Category"
              required
              creatable={true}
              value={formData.sportList || []}
              onChange={(newValues) => setFormData(prev => ({ ...prev, sportList: newValues }))}
              options={[
                { value: "Swimming", label: "Swimming" },
                { value: "Cricket", label: "Cricket" },
                { value: "Karate", label: "Karate" },
                { value: "Football", label: "Football" },
                { value: "Athletics", label: "Athletics" },
                { value: "Basketball", label: "Basketball" },
                { value: "Volleyball", label: "Volleyball" }
              ]}
              placeholder="Select or type new sports..."
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              placeholder="Describe your event..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, startDate: e.target.value }))
              }
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, endDate: e.target.value }))
              }
              required
            />
          </div>

          <Input
            label="Location"
            value={formData.location}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, location: e.target.value }))
            }
            placeholder="Dubai Sports Complex"
          />

          <Input
            label="Age Calculation Year"
            type="number"
            value={formData.ageCalculationYear}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                ageCalculationYear: parseInt(e.target.value)
              }))
            }
          />

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Reporting Times
            </label>
            <textarea
              value={formData.reportingTimes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reportingTimes: e.target.value }))
              }
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              placeholder="Athletes: 1 hour before event. Officials: 2 hours before session."
            />
          </div>

          {/* Required Documents Selection */}
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" />
                Required Documents for Registration
              </div>
            </label>
            <p className="text-lg text-slate-500 mb-6">
              Configure which documents participants must upload during registration.
            </p>
            
            <div className="space-y-4">
              {(formData.requiredDocuments || []).map((doc, index) => (
                <div 
                  key={doc.id} 
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 relative group"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Document Name</label>
                      <input
                        type="text"
                        value={doc.label}
                        onChange={(e) => updateDocumentRequirement(doc.id, 'label', e.target.value)}
                        placeholder="e.g. Passport, Emirates ID"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Required Format</label>
                      <input
                        type="text"
                        value={doc.format}
                        onChange={(e) => updateDocumentRequirement(doc.id, 'format', e.target.value)}
                        placeholder="e.g. PDF, JPEG, Max 5MB"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeDocumentRequirement(doc.id)}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                    title="Remove Document"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addDocumentRequirement}
                className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-primary-400 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all flex items-center justify-center gap-2 group"
              >
                <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Add Required Document</span>
              </button>
            </div>
            
            {(!formData.requiredDocuments || formData.requiredDocuments.length === 0) && (
              <p className="text-sm text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Please add at least one required document for registration.
              </p>
            )}
          </div>

          {/* Form Visibility Settings */}
          <div className="border-t border-slate-700 pt-6">
            <label className="block text-lg font-medium text-slate-300 mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-400" />
                Form Section Visibility
              </div>
            </label>
            <p className="text-lg text-slate-500 mb-6">
              Toggle which core sections are visible on the registration form.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={formData.visibility?.affiliation}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      visibility: { ...prev.visibility, affiliation: e.target.checked }
                    }))}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Affiliation Section</span>
                    <span className="block text-xs text-slate-500">Category/Role, Organization, Club</span>
                  </div>
                </label>
              </div>
              <div className="flex flex-col p-3 bg-slate-900/50 border border-slate-700 rounded-xl space-y-4">
                <label className="flex items-center gap-3 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={formData.visibility?.contact}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      visibility: { ...prev.visibility, contact: e.target.checked }
                    }))}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Contact Details Section</span>
                    <span className="block text-xs text-slate-500">Email, Phone, Communication</span>
                  </div>
                </label>

                {formData.visibility?.contact && (
                  <div className="pl-8 pt-2 border-t border-slate-800 space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Phone Visibility Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'hidden', label: 'Hidden', icon: Lock },
                        { id: 'visible', label: 'Always Show', icon: CheckCircle2 },
                        { id: 'optional', label: 'User Toggle', icon: Activity }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            visibility: { ...prev.visibility, phone: mode.id }
                          }))}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                            (formData.visibility?.phone || 'optional') === mode.id
                              ? "bg-primary-500/10 border-primary-500 text-primary-400"
                              : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700"
                          }`}
                        >
                          <mode.icon className="w-4 h-4" />
                          <span className="text-[10px] font-medium leading-tight text-center">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={formData.visibility?.documents}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      visibility: { ...prev.visibility, documents: e.target.checked }
                    }))}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Documents Section</span>
                    <span className="block text-xs text-slate-500">Photo, ID, Custom Documents</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Field Label Overrides */}
          <div className="border-t border-slate-700 pt-6">
            <button 
              type="button"
              onClick={() => setShowLabelOverrides(!showLabelOverrides)}
              className="w-full flex items-center justify-between group text-left"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span className="text-lg font-medium text-slate-300">Standard Field Configuration</span>
                </div>
                <p className="text-sm text-slate-500">
                  Customize display names, visibility, and requirements of standard fields.
                </p>
              </div>
              <div className={`p-1.5 rounded-lg bg-slate-800 text-slate-400 transition-all ${showLabelOverrides ? 'rotate-180 bg-amber-500/10 text-amber-500' : 'group-hover:bg-slate-700'}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </button>
            
            {showLabelOverrides && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-6 pb-2">
                  {OVERRIDABLE_FIELDS.map((field) => (
                    <div key={field.id} className="space-y-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {field.label}
                        </label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[10px] uppercase font-semibold text-slate-500">Show</span>
                            <div className="relative inline-flex items-center">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.fieldConfig?.[field.id]?.show !== false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  fieldConfig: {
                                    ...prev.fieldConfig,
                                    [field.id]: { ...(prev.fieldConfig?.[field.id] || {}), show: e.target.checked }
                                  }
                                }))}
                              />
                              <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </div>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[10px] uppercase font-semibold text-slate-500">Req.</span>
                            <div className="relative inline-flex items-center">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.fieldConfig?.[field.id]?.required !== false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  fieldConfig: {
                                    ...prev.fieldConfig,
                                    [field.id]: { ...(prev.fieldConfig?.[field.id] || {}), required: e.target.checked }
                                  }
                                }))}
                              />
                              <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={formData.labelOverrides?.[field.id] || ""}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          labelOverrides: {
                            ...(prev.labelOverrides || {}),
                            [field.id]: e.target.value
                          }
                        }))}
                        placeholder={`Custom ${field.label}...`}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Custom Fields Configuration */}
          <div className="border-t border-slate-700 pt-6">
            <button 
              type="button"
              onClick={() => setShowCustomFields(!showCustomFields)}
              className="w-full flex items-center justify-between group text-left"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  <span className="text-lg font-medium text-slate-300">Custom Fields (Requirements)</span>
                </div>
                <p className="text-sm text-slate-500">
                  Add extra fields for athletes to fill (e.g. Emirates, Region).
                </p>
              </div>
              <div className={`p-1.5 rounded-lg bg-slate-800 text-slate-400 transition-all ${showCustomFields ? 'rotate-180 bg-emerald-500/10 text-emerald-500' : 'group-hover:bg-slate-700'}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </button>
            
            {showCustomFields && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-6 pb-2">
                  {(formData.customFields || []).map((field, index) => (
                    <div 
                      key={field.id} 
                      className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 relative group space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Label (English) *</label>
                          <input
                            type="text"
                            value={field.label_en}
                            onChange={(e) => updateCustomField(field.id, 'label_en', e.target.value)}
                            placeholder="e.g. Emirates"
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Label (Arabic) *</label>
                          <input
                            type="text"
                            value={field.label_ar}
                            onChange={(e) => updateCustomField(field.id, 'label_ar', e.target.value)}
                            placeholder="مثال: الإمارة"
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-primary-500 outline-none transition-all text-right font-arabic"
                            dir="rtl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Field Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateCustomField(field.id, 'type', e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:ring-1 focus:ring-primary-500 transition-all"
                          >
                            <option value="text">Single Line Text</option>
                            <option value="select">Dropdown Menu</option>
                            <option value="medical_booking">Medical Test Calendar Booking</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-6 h-full pt-6">
                          <label className="flex items-center gap-2 cursor-pointer group/check">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateCustomField(field.id, 'required', e.target.checked)}
                              className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500 focus:ring-primary-500/50"
                            />
                            <span className="text-sm font-medium text-slate-400 group-hover/check:text-slate-200 transition-colors">Required Field</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer group/badge">
                            <input
                              type="checkbox"
                              checked={field.showOnBadge}
                              onChange={(e) => updateCustomField(field.id, 'showOnBadge', e.target.checked)}
                              className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/50"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-emerald-500/80 group-hover/badge:text-emerald-400 transition-colors">Show on Badge</span>
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-none">Accreditation Card</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {field.type === 'select' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Options (Comma separated) *</label>
                          <input
                            type="text"
                            value={field.options || ""}
                            onChange={(e) => updateCustomField(field.id, 'options', e.target.value)}
                            placeholder="Dubai, Abu Dhabi, Sharjah..."
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                          />
                        </div>
                      )}
                      
                      {field.type === 'medical_booking' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Booking Slots Configuration</label>
                          <div className="flex items-center gap-3">
                            <Button 
                              type="button" 
                              variant="secondary"
                              onClick={() => {
                                let parsed = { tests: [], duration: 15, capacity: 5, dateRanges: [] };
                                try { if (field.options) parsed = JSON.parse(field.options); } catch(e) {}
                                setBookingConfigModal({ open: true, fieldId: field.id, data: parsed });
                              }}
                            >
                              Configure Dates & Slots
                            </Button>
                            {field.options && field.options.length > 5 && (
                              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">Configured</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id)}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                        title="Remove Field"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-2 group"
                  >
                    <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-lg">Add Custom Requirement Field</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>


          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingEvent ? "Update Event" : "Create Event"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Main Gate Settings Modal */}
      {mainGateModal.open && mainGateConfig && (
        <Modal isOpen={true} onClose={() => setMainGateModal({ open: false, eventId: null })} title="Main Gate Settings">
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="flex-1 mr-4">
                <h4 className="text-sm font-bold text-white">Scanner PIN</h4>
                <p className="text-xs text-slate-400">Optional. Overrides the global PIN for all scanners in this event.</p>
              </div>
              <div className="w-32">
                <Input
                  type="text"
                  placeholder="e.g. 9999"
                  value={mainGateConfig.scannerPin || ""}
                  onChange={(e) => setMainGateConfig(p => ({ ...p, scannerPin: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div>
                <h4 className="text-sm font-bold text-white">Count Duplicate Scans</h4>
                <p className="text-xs text-slate-400">If enabled, second scans will increment attendance counts.</p>
              </div>
              <button
                type="button"
                onClick={() => setMainGateConfig(p => ({ ...p, ignoreDuplicates: !p.ignoreDuplicates }))}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  (!mainGateConfig.ignoreDuplicates) ? "bg-primary-500" : "bg-slate-700"
                )}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  (!mainGateConfig.ignoreDuplicates) ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>
            <MessageSettingsPanel formData={mainGateConfig} setFormData={setMainGateConfig} />
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
              <Button variant="ghost" onClick={() => setMainGateModal({ open: false, eventId: null })}>Cancel</Button>
              <Button variant="primary" onClick={saveMainGateSettings}>Save Settings</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Medical Booking Configuration Modal */}
      <Modal
        isOpen={bookingConfigModal.open}
        onClose={() => setBookingConfigModal({ open: false, fieldId: null, data: null })}
        title="Configure Medical Booking Calendar"
      >
        {bookingConfigModal.data && (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-primary-400 uppercase tracking-widest">Medical Tests Offered</h4>
              <p className="text-xs text-slate-400">Comma separated tests (e.g. Eye Test, Physical Assessment, ECG)</p>
              <input
                type="text"
                value={(bookingConfigModal.data.tests || []).join(', ')}
                onChange={(e) => {
                  const tests = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setBookingConfigModal(prev => ({...prev, data: {...prev.data, tests}}));
                }}
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Eye Test, Physical Assessment, Blood Test"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Slot Duration (Minutes)</label>
                <input
                  type="number"
                  value={bookingConfigModal.data.duration || 15}
                  onChange={(e) => setBookingConfigModal(prev => ({...prev, data: {...prev.data, duration: parseInt(e.target.value) || 15}}))}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
                  min="5" max="120"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Capacity (Athletes per slot)</label>
                <input
                  type="number"
                  value={bookingConfigModal.data.capacity || 5}
                  onChange={(e) => setBookingConfigModal(prev => ({...prev, data: {...prev.data, capacity: parseInt(e.target.value) || 1}}))}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
                  min="1" max="1000"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-primary-400 uppercase tracking-widest">Available Days & Times</h4>
                <Button 
                  size="sm" 
                  onClick={() => setBookingConfigModal(prev => ({
                    ...prev, 
                    data: {
                      ...prev.data, 
                      dateRanges: [...(prev.data.dateRanges || []), { date: '', startTime: '09:00', endTime: '17:00' }]
                    }
                  }))}
                >
                  Add Day
                </Button>
              </div>
              
              <div className="space-y-3">
                {(bookingConfigModal.data.dateRanges || []).map((range, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <input
                      type="date"
                      value={range.date}
                      onChange={(e) => {
                        const newRanges = [...bookingConfigModal.data.dateRanges];
                        newRanges[idx].date = e.target.value;
                        setBookingConfigModal(prev => ({...prev, data: {...prev.data, dateRanges: newRanges}}));
                      }}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full"
                    />
                    <span className="text-slate-500">From</span>
                    <input
                      type="time"
                      value={range.startTime}
                      onChange={(e) => {
                        const newRanges = [...bookingConfigModal.data.dateRanges];
                        newRanges[idx].startTime = e.target.value;
                        setBookingConfigModal(prev => ({...prev, data: {...prev.data, dateRanges: newRanges}}));
                      }}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    />
                    <span className="text-slate-500">To</span>
                    <input
                      type="time"
                      value={range.endTime}
                      onChange={(e) => {
                        const newRanges = [...bookingConfigModal.data.dateRanges];
                        newRanges[idx].endTime = e.target.value;
                        setBookingConfigModal(prev => ({...prev, data: {...prev.data, dateRanges: newRanges}}));
                      }}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    />
                    <button 
                      onClick={() => {
                        const newRanges = [...bookingConfigModal.data.dateRanges];
                        newRanges.splice(idx, 1);
                        setBookingConfigModal(prev => ({...prev, data: {...prev.data, dateRanges: newRanges}}));
                      }}
                      className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!bookingConfigModal.data.dateRanges || bookingConfigModal.data.dateRanges.length === 0) && (
                  <p className="text-xs text-amber-500">No days configured. Add a day to allow bookings.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button variant="secondary" onClick={() => setBookingConfigModal({ open: false, fieldId: null, data: null })} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  updateCustomField(bookingConfigModal.fieldId, 'options', JSON.stringify(bookingConfigModal.data));
                  setBookingConfigModal({ open: false, fieldId: null, data: null });
                }} 
                className="flex-1"
              >
                Save Configuration
              </Button>
            </div>
          </div>
        )}
      </Modal>



      {/* Delete Event Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => !deleting && setDeleteModal({ open: false, event: null })}
        title="Delete Event"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Permanently delete this event?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                Event <span className="font-bold text-white">{deleteModal.event?.name}</span> and ALL related data (accreditations, zones, categories) will be permanently removed. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteModal({ open: false, event: null })}
              className="flex-1"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              className="flex-1"
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Event"}
            </Button>
          </div>
        </div>
      </Modal>



      {/* Share Link Modal */}
      <Modal
        isOpen={shareModal.open}
        onClose={() => setShareModal({ open: false, slug: "" })}
        title="Copy Registration Link"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-400 font-extralight">
            Copy this link to share the registration form:
          </p>
          <div className="flex gap-2">
            <input
              id="share-link-input"
              type="text"
              readOnly
              value={getRegistrationLink(shareModal.slug)}
              className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-lg focus:outline-none"
            />
            <Button onClick={handleManualCopy} icon={Copy}>
              Copy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}



// --- SUB-COMPONENTS ---

function DetailActionCard({ title, description, icon: Icon, color, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group w-full text-left h-full"
    >
      <div className="relative overflow-hidden rounded-2xl p-5 h-full bg-base-alt/40 backdrop-blur-xl border border-border group-hover:border-primary-500/50 transition-all duration-500 shadow-xl">
        <div className={`absolute -inset-24 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 blur-[80px] transition-opacity duration-700 pointer-events-none`} />
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500`} />
        <div className="relative mb-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg transition-all duration-500 overflow-hidden group-hover:shadow-primary-500/25`}>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Icon className="w-6 h-6 relative z-10" />
          </div>
        </div>
        <div className="relative z-10 space-y-2">
          <h3 className="text-base font-black text-main group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all duration-300 uppercase tracking-tighter leading-none">
            {title}
          </h3>
          <p className="text-muted text-[11px] font-medium leading-relaxed group-hover:text-main transition-colors duration-300">
            {description}
          </p>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <div className="h-[2px] w-6 bg-border group-hover:w-10 group-hover:bg-primary-500 transition-all duration-700" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted group-hover:text-primary-500 transition-colors duration-500">
            Configure Module
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-500" />
        </div>
      </div>
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 blur-xl transition-opacity duration-700 -z-10`} />
    </motion.button>
  );
}
