import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
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
import Button from "../../components/ui/Button";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import MultiSearchableSelect from "../../components/ui/MultiSearchableSelect";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../../lib/storage";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { formatDate, fileToBase64 } from "../../lib/utils";
import { generateClubExports } from "../../lib/exportUtils";
import AttendanceSheet from "../../components/attendance/AttendanceSheet";
import AttendanceStats from "../../components/accreditation/AttendanceStats";
import AttendanceBadge from "../../components/accreditation/AttendanceBadge";
import ExportModal from "../../components/ui/ExportModal";
import { getInviteLinks, createInviteLink, updateInviteLink, toggleInviteLink, deleteInviteLink, getLinkStatus } from "../../lib/inviteLinksApi";
import AuditLogView from "./events/AuditLogView";

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

export default function Events() {
  const { id, subpage } = useParams();
  const navigate = useNavigate();
  const { canAccessEvent, user } = useAuth();
  const isSuperAdminOnly = user?.role === "super_admin";
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [eventCounts, setEventCounts] = useState({});
  const [editingEvent, setEditingEvent] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [copiedScannerEventId, setCopiedScannerEventId] = useState(null);
  const [copiedAthleteInfoEventId, setCopiedAthleteInfoEventId] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, slug: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [deleting, setDeleting] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [formData, setFormData] = useState({
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
    requiredDocuments: [
      { id: "picture", label: "Picture", format: "JPEG, PNG, WEBP" },
      { id: "passport", label: "Passport", format: "JPEG, PNG, WEBP, PDF" }
    ]
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

  const loadEvents = async () => {
    try {
      const data = await EventsAPI.getAll();
      const filteredData = data.filter(e => canAccessEvent(e.id));
      setEvents(filteredData);
      
      if (filteredData.length > 0) {
        const eventIds = filteredData.map(e => e.id);
        const counts = await AccreditationsAPI.getCountsByEventIds(eventIds);
        setEventCounts(counts);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

  const loadCategories = async () => {
    const cats = await CategoriesAPI.getActive();
    setAvailableCategories(cats);
  };

  const resetForm = () => {
    setFormData({
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
      requiredDocuments: [
        { id: "picture", label: "Picture", format: "JPEG, PNG, WEBP" },
        { id: "passport", label: "Passport", format: "JPEG, PNG, WEBP, PDF" }
      ]
    });
    setEditingEvent(null);
  };

  const handleOpenModal = async (event = null) => {
    if (event) {
      let extSport = ["Swimming"];
      try {
        const val = await GlobalSettingsAPI.get(`event_${event.id}_sport`);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              extSport = parsed;
            } else if (typeof val === 'string') {
              extSport = [val]; // Legacy single string
            }
          } catch(e1) {
             extSport = [val]; // Legacy single string
          }
        } else if (event.sportList && event.sportList.length > 0) {
          // Priority 2: Use sportList from DB column
          extSport = event.sportList;
        }
      } catch (e) {}

      setEditingEvent(event);
      setFormData({
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
        requiredDocuments: (() => {
          const docs = event.requiredDocuments || ["picture", "passport"];
          // Backward compatibility: Convert strings to objects if needed
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
        })()
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
    const pin = import.meta.env.VITE_SCANNER_PIN || "1234";
    return `${window.location.origin}/scanner?event_id=${eventId}&mode=info&public=true&pin=${pin}`;
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
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            // SS 1 logic: Column P (index 15) is Short Name, Column Q (index 16) is Full Name
            // Fallback to searching for "club" in header if columns P/Q aren't present
            let shortNameIdx = 15;
            let fullNameIdx = 16;
            
            if (data[0] && data[0].length < 17) {
              const header = data[0].map(h => String(h).toLowerCase());
              const foundIndex = header.indexOf("club");
              if (foundIndex !== -1) {
                shortNameIdx = foundIndex;
                fullNameIdx = foundIndex;
              } else {
                shortNameIdx = 0;
                fullNameIdx = 0;
              }
            }

            const extracted = data.slice(1)
              .map(row => {
                const short = String(row[shortNameIdx] || "").trim();
                const full = String(row[fullNameIdx] || "").trim();
                if (!full) return null;
                return full;
              })
              .filter(val => val && val.length > 0);
            
            const uniqueClubs = [...new Set(extracted)].sort();
            setParsedClubs(uniqueClubs);
            toast.success(`Extracted ${uniqueClubs.length} unique clubs`);
            setParsingClubs(false);
          } catch (err) {
            console.error("XLSX parse error:", err);
            toast.error("Failed to parse file");
            setParsingClubs(false);
          }
        };
        reader.readAsBinaryString(file);
      } else if (extension === 'pdf') {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(" ");
        }

        // SS 2 logic: Under "Team" heading, pattern is [Serial] [ShortName] [FullName]
        // Search for the "Team" column and extract lines that look like [Num] [Code] [Name]
        const teamMatch = fullText.match(/Team\s+Relays\s+Athletes/i);
        let extractedClubs = [];
        
        if (teamMatch) {
          const tableText = fullText.substring(teamMatch.index);
          // Regex to match Serial (1-3 digits), Code (2-6 uppercase/chars), Name (rest of line until next num)
          // Simplified: split into lines and find rows starting with a number
          const lines = tableText.split(/\n|\s{3,}/).map(l => l.trim()).filter(l => l.length > 5);
          lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 3 && /^\d+$/.test(parts[0]) && parts[1].length >= 2 && parts[1].toUpperCase() === parts[1]) {
              const short = parts[1];
              const full = parts.slice(2).join(" ");
              // Guard against capturing the whole line with numbers at end (Relays, Athletes, etc)
              // We know athletes/entries follow. Usually they are separated by more space.
              // Taking only the text parts.
              const cleanFull = full.split(/\d+/)[0].trim();
              if (cleanFull) {
                extractedClubs.push(cleanFull);
              }
            }
          });
        }

        if (extractedClubs.length === 0) {
          // Fallback to basic extraction
          const lines = fullText.split(/\s{2,}|\n/).map(l => l.trim()).filter(l => l.length > 3);
          extractedClubs = [...new Set(lines)];
        }

        const uniqueClubs = [...new Set(extractedClubs)].sort();
        setParsedClubs(uniqueClubs);
        toast.success(`Extracted ${uniqueClubs.length} potential club entries from PDF`);
        setParsingClubs(false);
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
      ) : subpage === "categories" ? (
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
      ) : subpage === "template" ? (
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
      ) : subpage === "clubs" ? (
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
      ) : subpage === "attendance" ? (
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
      ) : subpage === "invite-links" ? (
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
      ) : subpage === "terms" ? (
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
      ) : subpage === "audit-log" ? (
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
                        </div>

                        {!event.registrationOpen && (
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
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">QR Scanner Link</label>
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
                             PIN: {import.meta.env.VITE_SCANNER_PIN || "1234"}
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
                      <div className="flex items-center gap-3">
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

                    <div className="bg-base-alt rounded-2xl p-6 border border-border flex items-center justify-around shadow-inner">
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
                </CardContent>
              </Card>

              {/* Action Sections */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                <DetailActionCard 
                  title="Scanner Audit Log" 
                  description="View all scan attempts, download CSV/Excel logs, and view sport summaries"
                  icon={ShieldAlert}
                  color="from-amber-600 to-orange-500"
                  onClick={() => navigate(`/admin/events/${id}/audit-log`)}
                />
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
function TermsView({ event, onSave }) {
  const [content, setContent] = useState(event.termsAndConditions || "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await EventsAPI.update(event.id, { termsAndConditions: content });
      toast.success("Terms and Conditions updated successfully");
      if (onSave) onSave();
    } catch (err) {
      console.error("Failed to save terms:", err);
      toast.error("Failed to save terms: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="text-xl font-bold text-white">Custom Terms & Conditions</h3>
            <p className="text-sm text-slate-400 mt-1">
              These terms will be displayed to all participants during the registration process.
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            loading={saving}
            icon={CheckCircle2}
          >
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80 leading-relaxed font-light">
              <span className="font-bold text-amber-400">Note:</span> If left empty, the system will use the default Apex Sports terms. You can use standard text. New lines will be preserved.
            </p>
          </div>
          
          <div className="relative group">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your custom terms and conditions here..."
              className="w-full h-[500px] bg-base-alt/50 border border-border rounded-xl p-6 text-main text-lg font-light leading-relaxed focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all resize-none"
            />
            <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within:text-primary-400 transition-colors pointer-events-none">
              Rich Text Editor
            </div>
          </div>
          
          <div className="flex justify-end">
            <p className="text-xs text-slate-500 italic">
              * Remember to include health waivers and media release authorizations if specific to this event.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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


// --- SUB-PAGE VIEWS ---

function BadgeColorPicker({ defaultValue, name }) {
  const [color, setColor] = useState(defaultValue || COLOR_PRESETS[0]);
  
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">Badge Color</label>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2.5 mb-2">
        {COLOR_PRESETS.map(c => (
          <button 
            type="button" 
            key={c} 
            onClick={() => setColor(c)} 
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${color === c ? 'border-white shadow-xl scale-110' : 'border-transparent'}`} 
            style={{ backgroundColor: c }} 
            title={c}
          />
        ))}
        <div className="w-px h-6 bg-slate-700/50 mx-1 flex-shrink-0" />
        <div className="flex items-center gap-2">
          <label 
            className={`relative w-8 h-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-105 flex items-center justify-center overflow-hidden ${!COLOR_PRESETS.includes(color) ? 'border-white shadow-xl shadow-white/10' : 'border-slate-500 bg-slate-800'}`} 
            style={{ backgroundColor: !COLOR_PRESETS.includes(color) ? color : undefined }}
            title="Custom RGB/Hex Color"
          >
             <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="opacity-0 absolute w-full h-full cursor-pointer" />
             {COLOR_PRESETS.includes(color) && <Palette className="w-4 h-4 text-slate-400" />}
          </label>
          {!COLOR_PRESETS.includes(color) && (
            <span className="text-xs font-mono text-slate-200 font-bold px-2 py-1 bg-slate-800 rounded uppercase border border-slate-700">{color}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Pick a preset or custom RGB/HEX color to print on physical badge ribbons.</p>
    </div>
  );
}

function CategoriesView({ event, availableCategories, onClose }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState([]);
  const toast = useToast();

  const [eventClubs, setEventClubs] = useState([]);
  const [eventSports, setEventSports] = useState([]);
  const [categoryAllowlists, setCategoryAllowlists] = useState({});
  const [categorySports, setCategorySports] = useState({});
  const [categoryDocuments, setCategoryDocuments] = useState({});

  const [catModal, setCatModal] = useState({ open: false, mode: "add_main", data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, data: null });
  const [allowlistModal, setAllowlistModal] = useState({ open: false, categoryId: null });
  const [tempAllowlist, setTempAllowlist] = useState([]);
  const [tempSports, setTempSports] = useState([]);
  const [tempDocuments, setTempDocuments] = useState([]);
  const [allowlistSearch, setAllowlistSearch] = useState("");

  useEffect(() => {
    loadData();
  }, [event.id]);

  useEffect(() => {
    setCats(availableCategories);
  }, [availableCategories]);

  const loadData = async () => {
    try {
      const [data, clubsList, allowlistRaw, sportsRaw, eventSportsRaw, docsRaw] = await Promise.all([
        EventCategoriesAPI.getByEventId(event.id),
        GlobalSettingsAPI.getClubs(event.id),
        GlobalSettingsAPI.get(`event_${event.id}_category_allowlist`),
        GlobalSettingsAPI.get(`event_${event.id}_category_sports`),
        GlobalSettingsAPI.get(`event_${event.id}_sport`),
        GlobalSettingsAPI.get(`event_${event.id}_category_documents`)
      ]);
      setSelectedCategories(data.map(r => r.categoryId));
      
      const parsedClubs = clubsList.map(c => c.full || c.short || c).sort();
      setEventClubs(parsedClubs);

      if (eventSportsRaw) {
        try {
          const parsed = JSON.parse(eventSportsRaw);
          setEventSports(Array.isArray(parsed) ? parsed : [eventSportsRaw]);
        } catch(e) {
          setEventSports([eventSportsRaw]);
        }
      } else {
        setEventSports(event.sportList && event.sportList.length > 0 ? event.sportList : ["Swimming"]);
      }
      
      if (allowlistRaw) {
        setCategoryAllowlists(typeof allowlistRaw === 'string' ? JSON.parse(allowlistRaw) : allowlistRaw);
      }
      if (sportsRaw) {
        setCategorySports(typeof sportsRaw === 'string' ? JSON.parse(sportsRaw) : sportsRaw);
      }
      if (docsRaw) {
        setCategoryDocuments(typeof docsRaw === 'string' ? JSON.parse(docsRaw) : docsRaw);
      }
    } catch (err) {
      console.error("Failed to load category data", err);
    }
  };

  const toggleCategory = (id) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await EventCategoriesAPI.setForEvent(event.id, selectedCategories);
      await GlobalSettingsAPI.set(`event_${event.id}_category_allowlist`, JSON.stringify(categoryAllowlists));
      await GlobalSettingsAPI.set(`event_${event.id}_category_sports`, JSON.stringify(categorySports));
      await GlobalSettingsAPI.set(`event_${event.id}_category_documents`, JSON.stringify(categoryDocuments));
      toast.success("Categories and rules updated successfully");
      onClose();
    } catch (err) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const openCatModal = (mode, data = null) => {
    const categoryId = data?.id;
    if (mode === "edit" && categoryId) {
      setTempAllowlist(categoryAllowlists[categoryId] || []);
      setTempSports(categorySports[categoryId] || []);
      setTempDocuments(categoryDocuments[categoryId] || []);
    } else {
      setTempAllowlist([]);
      setTempSports([]);
      setTempDocuments([]);
    }
    setCatModal({ open: true, mode, data });
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawName = formData.get("name");
    const payload = {
      name: rawName,
      slug: rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substr(2, 4),
      badgeColor: formData.get("badgeColor") || "#0ea5e9",
      description: formData.get("description") || "",
      parentId: catModal.mode === "add_sub" ? catModal.data.parentId : (catModal.data?.parentId || null),
      status: "active"
    };

    try {
      let savedCat;
      if (catModal.mode.startsWith("add")) {
        savedCat = await CategoriesAPI.create(payload);
        setCats(prev => [...prev, savedCat].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Category created");
      } else {
        savedCat = await CategoriesAPI.update(catModal.data.id, payload);
        setCats(prev => prev.map(c => c.id === savedCat.id ? savedCat : c));
        toast.success("Category updated");
      }

      // Update event-specific allocations if we have a category ID
      const finalId = savedCat.id;
      if (finalId) {
        setCategoryAllowlists(prev => ({ ...prev, [finalId]: tempAllowlist }));
        setCategorySports(prev => ({ ...prev, [finalId]: tempSports }));
        setCategoryDocuments(prev => ({ ...prev, [finalId]: tempDocuments }));
      }

      setCatModal({ open: false, mode: "add_main", data: null });
    } catch (err) {
      toast.error("Failed to save category");
    }
  };

  const handleDeleteCat = async () => {
    if (!deleteModal.data) return;
    try {
      const inUse = await CategoriesAPI.isInUse(deleteModal.data.id);
      if (inUse) {
        toast.error("Cannot delete category currently assigned to attendees");
        return;
      }
      await CategoriesAPI.delete(deleteModal.data.id);
      setCats(prev => prev.filter(c => c.id !== deleteModal.data.id && c.parentId !== deleteModal.data.id));
      toast.success("Category deleted");
      setDeleteModal({ open: false, data: null });
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };



  const mainCategories = cats.filter(c => !c.parentId);
  const subCategories = cats.filter(c => !!c.parentId);

  const groupedCategories = mainCategories.map(parent => ({
    ...parent,
    children: subCategories.filter(child => child.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name))
  })).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-3xl font-black text-main mb-2 tracking-tighter uppercase italic">Categories Management</h3>
              <p className="text-slate-400 font-light text-lg">Define roles, edit names, and set exclusive club dropdown limits for registration.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" icon={Plus} onClick={() => openCatModal('add_main')}>
                Add Main Group
              </Button>
              <Button onClick={save} loading={saving}>Save Config</Button>
            </div>
          </div>

          <div className="space-y-8">
            {groupedCategories.map(parent => (
              <div key={parent.id} className="bg-base-alt/50 rounded-3xl border border-border overflow-hidden shadow-xl group/parent">
                {/* Parent Category Header */}
                <div className="flex items-center justify-between p-6 bg-base-alt border-b border-border transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-primary-500 rounded-full" />
                    <h4 className="text-2xl font-black text-main tracking-widest uppercase">{parent.name}</h4>
                    <span className="px-3 py-1 bg-base border border-border rounded-lg text-xs font-bold text-muted">{parent.children.length} roles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openCatModal('add_sub', { parentId: parent.id })} className="text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 mr-2">
                       Add Sub-Role
                    </Button>
                    <button onClick={() => openCatModal('edit', parent)} className="p-2 bg-base hover:bg-border border border-border rounded-lg text-muted hover:text-main transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteModal({ open: true, data: parent })} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories Grid */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {parent.children.map(cat => (
                    <div
                      key={cat.id}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-300 flex flex-col group ${
                        selectedCategories.includes(cat.id)
                          ? "border-primary-500 bg-primary-500/10 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.3)]"
                          : "border-border bg-base/50 hover:border-primary-500/30 hover:bg-base-alt"
                      }`}
                    >
                      <div 
                        className="flex items-start justify-between cursor-pointer mb-4"
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 mt-0.5 transition-colors ${
                            selectedCategories.includes(cat.id) ? "bg-primary-500 border-primary-500 text-white" : "border-border text-transparent"
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h5 className={`text-base font-bold uppercase tracking-wide leading-none mb-1.5 ${selectedCategories.includes(cat.id) ? "text-primary-600 dark:text-white" : "text-main group-hover:text-primary-600 dark:group-hover:text-primary-400"}`}>
                              {cat.name}
                            </h5>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Color chip */}
                              <div className="w-3 h-3 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: cat.badgeColor }} />
                              {cat.description && (
                                <p className="text-xs font-medium text-muted line-clamp-1">{cat.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer controls */}
                      <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="flex flex-col gap-1.5 flex-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                                categoryAllowlists[cat.id]?.length > 0 
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20" 
                                : "bg-base text-muted border border-border"
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {categoryAllowlists[cat.id]?.length > 0 ? `${categoryAllowlists[cat.id].length} Clubs` : "Clubs: All"}
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              categorySports[cat.id]?.length > 0 
                                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20" 
                                : "bg-base text-muted border border-border"
                            }`}
                          >
                            <Activity className="w-3.5 h-3.5" />
                            {categorySports[cat.id]?.length > 0 ? `${categorySports[cat.id].length} Sports` : "Sports: All"}
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              categoryDocuments[cat.id]?.length > 0 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {categoryDocuments[cat.id]?.length > 0 ? `${categoryDocuments[cat.id].length} Docs` : "Docs: Default"}
                          </button>
                        </div>

                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat) }} className="p-1.5 text-slate-500 hover:text-white bg-transparent hover:bg-slate-800 rounded transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: cat }) }} className="p-1.5 text-slate-500 hover:text-red-400 bg-transparent hover:bg-red-500/10 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {parent.children.length === 0 && (
                    <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                      <p className="text-slate-500 font-light text-lg">No sub-roles defined for this group.</p>
                      <Button variant="ghost" className="mt-2 text-primary-400" onClick={() => openCatModal('add_sub', { parentId: parent.id })}>Add Sub-Role</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Models go here (Add/Edit Category, Delete Category, Allowlist Configurator) */}
      <Modal isOpen={catModal.open} onClose={() => setCatModal({ open: false, mode: 'add_main', data: null })} title={catModal.mode === 'edit' ? "Edit Category" : catModal.mode === "add_sub" ? "Add Sub-Role" : "Add Parent Group"}>
        <form onSubmit={handleSaveCat} className="p-6 space-y-5">
          <Input 
             label="Category Name" 
             name="name" 
             defaultValue={catModal.data?.name || ""} 
             placeholder="e.g. VIP, Media, Athlete" 
             required 
          />
          <Input 
             label="Description (Optional)" 
             name="description" 
             defaultValue={catModal.data?.description || ""} 
             placeholder="Brief description of this role" 
          />
          <BadgeColorPicker defaultValue={catModal.data?.badgeColor} name="badgeColor" />

          {/* New Sport and Club Allocations */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Allowed Sports</label>
              <MultiSearchableSelect 
                options={(eventSports || ["Swimming"]).map(s => ({ value: s, label: s }))}
                value={tempSports}
                onChange={setTempSports}
                placeholder="Select sports for this category..."
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, all event sports will be available to this role.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Exclusive Clubs</label>
              <MultiSearchableSelect 
                options={eventClubs.map(c => ({ value: c, label: c }))}
                value={tempAllowlist}
                onChange={setTempAllowlist}
                placeholder="Search and select clubs..."
                creatable={true}
                creatableText="Add club/organization:"
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, all clubs will be available to this role.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Required Documents</label>
              <MultiSearchableSelect 
                options={(event.requiredDocuments || []).map(d => ({ value: d.id || d, label: d.label || d }))}
                value={tempDocuments}
                onChange={setTempDocuments}
                placeholder="Select required documents..."
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, the event's default required documents will be used.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setCatModal({ open: false, mode: 'add_main', data: null })} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">{catModal.mode === 'edit' ? "Save Changes" : "Create Category"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, data: null })} title="Confirm Delete">
        <div className="p-6 space-y-6">
           <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
             <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
             <div>
               <h4 className="text-lg font-bold text-red-400">Permanently Delete?</h4>
               <p className="text-slate-300 mt-1 leading-relaxed">You are about to delete <span className="font-bold text-white">{deleteModal.data?.name}</span>. This action cannot be undone.</p>
             </div>
           </div>
           <div className="flex gap-3">
             <Button variant="secondary" onClick={() => setDeleteModal({ open: false, data: null })} className="flex-1">Cancel</Button>
             <Button variant="danger" onClick={handleDeleteCat} className="flex-1">Yes, Delete</Button>
           </div>
        </div>
      </Modal>


    </div>
  );
}

function TemplateView({ event, onClose, onSave }) {
  const [templateData, setTemplateData] = useState({
    headerArabic: event.headerArabic || "",
    headerSubtitle: event.headerSubtitle || "",
    logoUrl: event.logoUrl || "",
    backTemplateUrl: event.backTemplateUrl || "",
    sponsorLogos: event.sponsorLogos || [],
    frontBackgroundUrl: ""
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const fetchFrontBg = async () => {
      try {
        const bg = await GlobalSettingsAPI.get(`event_${event.id}_front_bg`);
        if (bg) setTemplateData(prev => ({ ...prev, frontBackgroundUrl: bg }));
      } catch (err) {
        console.error("Failed to load front background");
      }
    };
    fetchFrontBg();
  }, [event.id]);

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setTemplateData(prev => ({ ...prev, [field]: base64 }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { frontBackgroundUrl, ...dbTemplateData } = templateData;
      await EventsAPI.update(event.id, dbTemplateData);
      await GlobalSettingsAPI.set(`event_${event.id}_front_bg`, frontBackgroundUrl || "");
      toast.success("Template settings saved");
      if (onSave) onSave();
      onClose();
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-800">
      <CardContent className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-main mb-2">Accreditation Template</h3>
            <p className="text-slate-400 font-light">Customize visuals for physical and digital badges</p>
          </div>
          <Button onClick={save} loading={saving}>Save Configuration</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Front Configuration */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary-400" />
              Front Layout
            </h4>
            
            <div className="space-y-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
              <Input 
                label="Header (Arabic)"
                value={templateData.headerArabic}
                onChange={e => setTemplateData(prev => ({ ...prev, headerArabic: e.target.value }))}
                placeholder="e.g., دبي للألعاب المائية"
              />
              <Input 
                label="Subtitle / Location"
                value={templateData.headerSubtitle}
                onChange={e => setTemplateData(prev => ({ ...prev, headerSubtitle: e.target.value }))}
                placeholder="e.g., Hamdan Sports Complex"
              />
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Event Logo</label>
                <div className="flex items-center gap-6">
                  {templateData.logoUrl ? (
                    <div className="relative group">
                      <img src={templateData.logoUrl} className="w-24 h-24 object-contain rounded-xl bg-white/5 p-2" alt="Logo" />
                      <button 
                        onClick={() => setTemplateData(prev => ({ ...prev, logoUrl: "" }))}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-all text-slate-500">
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold">UPLOAD</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "logoUrl")} className="hidden" />
                    </label>
                  )}
                  <p className="text-xs text-slate-500 max-w-[200px]">Transparent PNG or high-res SVG recommended. Max 2MB.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Front Body Background</label>
                <div className="flex items-center gap-6">
                  {templateData.frontBackgroundUrl ? (
                    <div className="relative group">
                      <img src={templateData.frontBackgroundUrl} className="w-24 h-24 object-cover rounded-xl bg-white/5 p-2" alt="Front Bg" />
                      <button 
                        onClick={() => setTemplateData(prev => ({ ...prev, frontBackgroundUrl: "" }))}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-all text-slate-500">
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold text-center">UPLOAD BG</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "frontBackgroundUrl")} className="hidden" />
                    </label>
                  )}
                  <p className="text-xs text-slate-500 max-w-[200px]">Background image to fill the white space of the front card. Max 2MB.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Back Configuration */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <FileImage className="w-5 h-5 text-emerald-400" />
              Back Template & Sponsors
            </h4>

            <div className="space-y-6 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Back Graphic</label>
                <div className="relative aspect-[3/4] max-w-[200px] border-2 border-dashed border-slate-700 rounded-2xl overflow-hidden group">
                  {templateData.backTemplateUrl ? (
                    <>
                      <img src={templateData.backTemplateUrl} className="w-full h-full object-cover" alt="Back Template" />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button variant="ghost" icon={Trash2} onClick={() => setTemplateData(prev => ({ ...prev, backTemplateUrl: "" }))}>Clear</Button>
                      </div>
                    </>
                  ) : (
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                      <Upload className="w-8 h-8 text-slate-600 mb-2" />
                      <span className="text-xs font-bold text-slate-500 uppercase">Upload Back</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "backTemplateUrl")} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Sponsor Logos (Max 6)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {templateData.sponsorLogos.map((logo, i) => (
                    <div key={i} className="relative group h-24 bg-white rounded-xl flex items-center justify-center p-3 border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                      <img src={logo} className="w-full h-full object-contain" alt="Sponsor" />
                      <button 
                         onClick={() => setTemplateData(prev => ({ ...prev, sponsorLogos: prev.sponsorLogos.filter((_, idx) => idx !== i) }))}
                         className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {templateData.sponsorLogos.length < 6 && (
                    <label className="h-24 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-500/10 transition-all text-slate-400 bg-slate-800/30">
                      <Plus className="w-6 h-6 mb-1 text-slate-400" />
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await fileToBase64(file);
                          setTemplateData(prev => ({ ...prev, sponsorLogos: [...prev.sponsorLogos, base64] }));
                        }
                      }} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClubsAnalyticsView({ event }) {
  const [clubs, setClubs] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [event.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clubsData, accs, attendanceData] = await Promise.all([
        GlobalSettingsAPI.getClubs(event.id),
        AccreditationsAPI.getByEventId(event.id),
        AttendanceAPI.getEventAttendance(event.id)
      ]);
      
      setClubs(clubsData);
      // Fetch v2 metadata manually if we need the filename
      const v2Raw = await GlobalSettingsAPI.get(`event_${event.id}_clubs_v2`);
      if (v2Raw) {
        const parsed = JSON.parse(v2Raw);
        if (parsed.metadata) setUploadedFile(parsed.metadata);
      }
      
      setAccreditations(accs || []);
      setAttendanceRecords(attendanceData || []);
    } catch (err) {
      console.error("Failed to load clubs analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setParsing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        let clubNames = [];
        
        if (file.name.endsWith('.pdf')) {
          const text = await parsePDFText(file);
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          let headIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('registered') && lines[i].toLowerCase().includes('club')) {
              headIdx = i;
              break;
            }
          }

          const dataLines = headIdx !== -1 ? lines.slice(headIdx + 1) : lines;
          
          clubNames = dataLines.map(line => {
            const parts = line.split(/\s+/);
            if (parts.length < 3) return null;
            
            // Typical line: 01 ABA-ZZ Aba Aquatics 24 ...
            // Or: ABA-ZZ Aba Aquatics 24
            const firstPartIsNumber = /^\d+$/.test(parts[0]);
            const startIdx = firstPartIsNumber ? 1 : 0;
            const code = parts[startIdx];
            
            // Find where the numbers start after the name
            let countStr = "0";
            let nameEndIdx = parts.length - 1;
            for (let i = startIdx + 2; i < parts.length; i++) {
              if (/^\d+$/.test(parts[i])) {
                countStr = parts[i];
                nameEndIdx = i;
                break;
              }
            }
            
            const fullName = parts.slice(startIdx + 1, nameEndIdx).join(" ");
            if (!fullName || fullName.length < 2) return null;

            return {
              short: code,
              full: toProperCase(fullName),
              fileRegistered: parseInt(countStr) || 0
            };
          }).filter(Boolean);
        } else {
          // Excel or CSV
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

          // SS logic: Column P (15) is Short, Q (16) is Full, S (18) is Reg
          // But we'll be flexible and check R (17) and T (19) if S is 0
          clubNames = data.slice(0)
            .map(row => {
              const full = toProperCase(String(row[16] || row[0] || "").trim());
              if (!full || full.length < 2) return null;
              
              const valS = parseInt(row[18]) || 0;
              const valR = parseInt(row[17]) || 0;
              const valT = parseInt(row[19]) || 0;
              
              return {
                short: String(row[15] || row[0] || "").trim(),
                full: full,
                fileRegistered: valS || valR || valT || 0
              };
            })
            .filter(Boolean);
        }

        // Unique clubs by Full Name
        const uniqueClubs = [];
        const seen = new Set();
        for (const club of clubNames) {
          if (!seen.has(club.full.toLowerCase())) {
            seen.add(club.full.toLowerCase());
            uniqueClubs.push(club);
          }
        }
        uniqueClubs.sort((a, b) => a.full.localeCompare(b.full));
        
        if (uniqueClubs.length > 0) {
          const metadata = { name: file.name, timestamp: new Date().toISOString() };
          await GlobalSettingsAPI.setClubs(event.id, uniqueClubs, metadata);
          setClubs(uniqueClubs);
          setUploadedFile(metadata);
          toast.success(`Successfully imported ${uniqueClubs.length} clubs`);
        } else {
          toast.error("No clubs found in file");
        }
      } catch (err) {
        console.error("Parsing failed", err);
        toast.error("Failed to parse file");
      } finally {
        setParsing(false);
      }
    };

    if (file.name.endsWith('.pdf')) {
      reader.onload(); // trigger immediate for PDF as we use parsePDFText
    } else {
      reader.readAsBinaryString(file);
    }
    e.target.value = '';
  };

  const clearClubs = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmClearClubs = async () => {
    try {
      await GlobalSettingsAPI.setClubs(event.id, []);
      setClubs([]);
      setUploadedFile(null);
      setShowDeleteConfirm(false);
      toast.success("Clubs list cleared");
    } catch {
      toast.error("Failed to clear list");
    }
  };

  const analytics = useMemo(() => {
    if (!Array.isArray(clubs) || !Array.isArray(accreditations)) return [];

    const rawAnalytics = clubs.map((club, index) => {
      const clubFull = club?.full || (typeof club === 'string' ? club : "");
      const clubShort = club?.short || clubFull || "N/A";
      const clubNameStr = String(clubFull).trim();
      const clubTerm = clubNameStr.toLowerCase();
      const fileRegistered = club?.fileRegistered || 0;

      // Filter for all registrations for this club
      const clubAccs = accreditations.filter(a => {
        const c = String(a.club || "").trim().toLowerCase();
        return c === clubTerm;
      });
      
      // Registered Athletes (only roles containing "Athlete")
      const registeredAthletes = clubAccs.filter(a => String(a.role || "").toLowerCase().includes("athlete"));
      
      // Approved Athlete Accreditations
      const approvedAthletes = registeredAthletes.filter(a => a.status === "approved");
      
      // Calculate Attendance
      const clubAttendance = attendanceRecords.filter(record => 
        clubAccs.some(acc => acc.id === record.athlete_id)
      );
      
      const presentAthletesCount = clubAttendance.filter(record => {
        const acc = clubAccs.find(a => a.id === record.athlete_id);
        return acc && String(acc.role || "").toLowerCase().includes("athlete");
      }).length;

      const presentCoachesCount = clubAttendance.filter(record => {
        const acc = clubAccs.find(a => a.id === record.athlete_id);
        const role = String(acc.role || "").toLowerCase();
        return acc && !role.includes("athlete"); // Every non-athlete is counted as staff/coach
      }).length;
      
      // Get latest check-in time for the badge display
      let latestTime = null;
      if (clubAttendance.length > 0) {
        const latestRecord = [...clubAttendance].sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date))[0];
        latestTime = new Date(latestRecord.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return {
        sr: index + 1,
        short: clubShort,
        full: clubNameStr || "Unknown Club",
        registered: registeredAthletes.length,
        fileRegistered: fileRegistered,
        approved: approvedAthletes.length,
        approvedNames: approvedAthletes.map(a => `${a.firstName || ""} ${a.lastName || ""}`.trim()).join(", "),
        attendanceCount: clubAttendance.length,
        presentAthletes: presentAthletesCount,
        presentCoaches: presentCoachesCount,
        latestTime: latestTime
      };
    }).filter(r => r.full !== "Unknown Club");

    if (!searchTerm.trim()) return rawAnalytics;
    
    const term = searchTerm.toLowerCase();
    return rawAnalytics.filter(r => 
      String(r.full).toLowerCase().includes(term) || 
      String(r.short).toLowerCase().includes(term)
    );
  }, [clubs, accreditations, searchTerm]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(new Set(analytics.map(r => r.full)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (full, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(full);
    } else {
      newSelected.delete(full);
    }
    setSelectedRows(newSelected);
  };

  const handleOldExportData = () => {
    // Legacy Basic Export: Keeping exact functionality intact for the basic summary
    if (analytics.length === 0) return;
    const exportData = analytics.map(r => ({
      "SR#": r.sr,
      "Club Short Name": r.short,
      "Club Full Name": r.full,
      "Registered (File)": r.fileRegistered,
      "Registered (Live)": r.registered,
      "Accreditations Issued": r.approved,
      "Issued Athletes List": r.approvedNames
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Club Analytics");
    XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '_')}_Club_Analytics.xlsx`);
    toast.success("Summary Exported");
  };

  const executeExport = async (selectedClubObjects, format, setProgressMsg) => {
    try {
      // Map to just full names
      const clubNames = selectedClubObjects.map(c => c.full);
      await generateClubExports(event.id, event.name, clubNames, format, setProgressMsg);
      toast.success("Files Archived and Downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile Export");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="p-8 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
            <h3 className="text-2xl font-bold text-main mb-2 tracking-tight">Club Analytics</h3>
              <p className="text-slate-400 font-light max-w-md">Real-time tracking of athlete registrations and approved accreditations per club.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {uploadedFile && (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active List</span>
                    <span className="text-xs text-white font-mono truncate max-w-[150px]">{uploadedFile.name}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800 mx-1" />
                  <div className="flex gap-1">
                    <button onClick={() => document.getElementById('club-import').click()} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all" title="Change File">
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={clearClubs} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete File">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search club..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-base-alt border border-border rounded-xl text-main text-lg placeholder:text-muted focus:outline-none focus:border-cyan-500/50 transition-all min-w-[240px]"
                />
              </div>
              <Button variant="secondary" icon={Download} onClick={() => setExportModalOpen(true)} disabled={analytics.length === 0}>Export Data</Button>
              {!uploadedFile && (
                <Button icon={parsing ? undefined : Upload} loading={parsing} onClick={() => document.getElementById('club-import').click()}>
                  Import Club List
                </Button>
              )}
              <input id="club-import" type="file" className="hidden" accept=".csv,.xlsx,.pdf" onChange={handleFileUpload} />
            </div>
          </div>

          <div className="px-6 pt-6">
            <AttendanceStats analytics={analytics} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800">
                  <th className="p-5 w-12 text-center">
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-slate-950 transition-colors"
                        checked={analytics.length > 0 && selectedRows.size === analytics.length}
                        onChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide">SR#</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide">Club / Academy</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Registered Athletes</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Accreditations Issued</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Live Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {analytics.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Users className="w-16 h-16 text-slate-500" />
                        <p className="text-xl font-light text-slate-500 italic">No clubs registered for this event yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  analytics.map((row) => (
                    <tr key={row.sr} className={`group border-b border-slate-800/30 transition-all ${selectedRows.has(row.full) ? 'bg-primary-500/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-slate-950 transition-colors cursor-pointer"
                            checked={selectedRows.has(row.full)}
                            onChange={(e) => handleSelectRow(row.full, e.target.checked)}
                          />
                        </div>
                      </td>
                      <td className="p-5 text-muted font-mono text-xs">{String(row.sr).padStart(2, '0')}</td>
                      <td className="p-5">
                        <div className="flex flex-col cursor-pointer" onClick={() => handleSelectRow(row.full, !selectedRows.has(row.full))}>
                          <span className={`font-bold transition-colors tracking-tight ${selectedRows.has(row.full) ? 'text-primary-600 dark:text-primary-300' : 'text-main group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                            {row.full}
                          </span>
                          <span className="text-[10px] text-muted font-mono mt-0.5">{row.short}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base text-muted text-xs font-bold border border-border">
                            {row.fileRegistered} REGISTERED
                          </span>
                          {row.registered > 0 && (
                            <span className="text-[10px] text-muted font-medium uppercase italic">
                              Live: {row.registered}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black tracking-widest ${
                          row.approved > 0 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-slate-800/30 text-slate-600 border border-slate-800"
                        }`}>
                          {row.approved} APPROVED
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <AttendanceBadge 
                          athletesCount={row.presentAthletes}
                          coachesCount={row.presentCoaches}
                          time={row.latestTime} 
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Stats Bar */}
      {analytics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Clubs" value={analytics.length} icon={Users} color="from-blue-500 to-cyan-500" />
          <StatCard 
            label="Total Registered Athletes" 
            value={analytics.reduce((sum, r) => sum + r.fileRegistered, 0)} 
            icon={Trophy} 
            color="from-primary-500 to-purple-500" 
          />
          <StatCard 
            label="Total Accreditations Issued" 
            value={analytics.reduce((sum, r) => sum + r.approved, 0)} 
            icon={CheckCircle2} 
            color="from-emerald-500 to-teal-500" 
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="border-slate-800 bg-slate-900/40 overflow-hidden relative group">
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${color}`} />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">{label}</p>
            <p className="text-3xl font-black text-main tracking-tighter">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteLinksView({ event }) {
  const toast = useToast();
  const [links, setLinks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(null);
  const [editingLinkId, setEditingLinkId] = React.useState(null);
  const [availableClubs, setAvailableClubs] = React.useState([]);

  const defaultForm = {
    label: "", mode: "multi", maxUses: "", expiresIn: "48h", customExpiry: "",
    role: "", club: [], requirePayment: false, paymentAmount: ""
  };
  const [form, setForm] = React.useState(defaultForm);

  const roleOptions = [
    { value: "participant", label: "Participant" },
    { value: "coach", label: "Coach" },
    { value: "official", label: "Official" },
    { value: "vip", label: "VIP" },
    { value: "media", label: "Media" },
    { value: "crew", label: "Crew / Staff" },
    { value: "sponsor", label: "Sponsor" },
    { value: "spectator", label: "Spectator" }
  ];

  React.useEffect(() => {
    const fetchClubs = async () => {
      try {
        const clubsData = await CategoriesAPI.getActive();
        const uniqueClubs = Array.from(new Set(clubsData.map(c => c.clubName).filter(Boolean))).sort();
        setAvailableClubs(uniqueClubs);
      } catch (err) { }
    };
    fetchClubs();
  }, []);

  const clubs = React.useMemo(() => {
    return availableClubs.map(c => ({ value: c, label: c }));
  }, [availableClubs]);

  const loadLinks = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInviteLinks(event.id);
      setLinks(data.reverse()); // newest first
    } catch { setLinks([]); }
    finally { setLoading(false); }
  }, [event.id]);

  React.useEffect(() => { loadLinks(); }, [loadLinks]);

  const getExpiryDate = () => {
    if (form.expiresIn === "never") return null;
    if (form.expiresIn === "custom") return form.customExpiry ? new Date(form.customExpiry).toISOString() : null;
    const hours = { "12h": 12, "24h": 24, "48h": 48, "72h": 72, "168h": 168 }[form.expiresIn] || 48;
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  };

  const handleCreateOrUpdate = async () => {
    if (!form.label.trim()) { toast.error("Label is required"); return; }
    setCreating(true);
    try {
      const payload = {
        label: form.label,
        mode: form.mode,
        maxUses: form.mode === "single" ? 1 : (form.maxUses ? parseInt(form.maxUses) : null),
        expiresAt: getExpiryDate(),
        role: form.role || null,
        club: form.club && form.club.length > 0 ? form.club : null,
        requirePayment: form.requirePayment,
        paymentAmount: form.requirePayment ? parseFloat(form.paymentAmount) : null
      };

      if (editingLinkId) {
        await updateInviteLink(event.id, editingLinkId, payload);
        toast.success("Invite link updated!");
      } else {
        await createInviteLink(event.id, payload);
        toast.success("Invite link created!");
      }

      setShowCreate(false);
      setEditingLinkId(null);
      setForm(defaultForm);
      loadLinks();
    } catch (err) {
      toast.error(`Failed to ${editingLinkId ? "update" : "create"} link: ` + (err.message || ""));
    } finally { setCreating(false); }
  };

  const openEdit = (link) => {
    setEditingLinkId(link.id);
    setForm({
      label: link.label || "",
      mode: link.mode || "multi",
      maxUses: link.maxUses ? link.maxUses.toString() : "",
      expiresIn: link.expiresAt ? "custom" : "never",
      customExpiry: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
      role: link.role || "",
      club: link.club ? (Array.isArray(link.club) ? link.club : [link.club]) : [],
      requirePayment: link.requirePayment || false,
      paymentAmount: link.paymentAmount ? link.paymentAmount.toString() : ""
    });
    setShowCreate(true);
  };

  const handleToggle = async (link) => {
    try {
      await toggleInviteLink(event.id, link.id, !link.isActive);
      toast.success(link.isActive ? "Link deactivated" : "Link activated");
      loadLinks();
    } catch { toast.error("Failed to toggle link"); }
  };

  const handleDelete = async (link) => {
    if (!window.confirm(`Delete invite link "${link.label}"?`)) return;
    try {
      await deleteInviteLink(event.id, link.id);
      toast.success("Invite link deleted");
      loadLinks();
    } catch { toast.error("Failed to delete link"); }
  };

  const getInviteUrl = (link) =>
    `${window.location.origin}/register/${event.slug}/invite/${link.token}`;

  const handleCopy = async (link) => {
    const url = getInviteUrl(link);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(link.id);
      toast.success("Invite link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const statusColors = {
    active: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    inactive: "bg-slate-700/30 border-slate-600/30 text-slate-500",
    expired: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    exhausted: "bg-red-500/10 border-red-500/30 text-red-400"
  };

  const statusDots = { active: "bg-emerald-400 animate-pulse", inactive: "bg-slate-500", expired: "bg-amber-400", exhausted: "bg-red-400" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Private Invite Links</h3>
          <p className="text-sm text-slate-400 mt-1">Generate secret registration links for specific people while main registration stays closed.</p>
        </div>
        <Button icon={Plus} onClick={() => {
          setEditingLinkId(null);
          setForm(defaultForm);
          setShowCreate(true);
        }}>Create Link</Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="p-6 space-y-4">
            <h4 className="text-lg font-bold text-white">{editingLinkId ? "Edit Invite Link" : "New Invite Link"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Label <span className="text-red-400">*</span></label>
                <input
                  value={form.label}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Late Registrations - Coaches"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Link Expires In</label>
                <select
                  value={form.expiresIn}
                  onChange={e => setForm(p => ({ ...p, expiresIn: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="12h">12 Hours</option>
                  <option value="24h">24 Hours</option>
                  <option value="48h">48 Hours (default)</option>
                  <option value="72h">72 Hours</option>
                  <option value="168h">1 Week</option>
                  <option value="custom">Custom Date/Time</option>
                  <option value="never">Never Expires</option>
                </select>
              </div>
            </div>
            {form.expiresIn === "custom" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Custom Expiry</label>
                <input type="datetime-local" value={form.customExpiry}
                  onChange={e => setForm(p => ({ ...p, customExpiry: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Restrict to Role <span className="text-slate-500 text-xs">(optional)</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Any Role</option>
                  {roleOptions.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Restrict to Clubs <span className="text-slate-500 text-xs">(optional)</span>
                </label>
                <MultiSearchableSelect
                  options={clubs}
                  value={form.club}
                  onChange={val => setForm(p => ({ ...p, club: val }))}
                  placeholder="Select organizations..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Usage Mode</label>
              <div className="flex gap-3">
                {[
                  { value: "multi", label: "Multi-Use", desc: "Same link for multiple people" },
                  { value: "single", label: "Single-Use", desc: "Expires after 1 submission" }
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, mode: opt.value, maxUses: opt.value === "single" ? "1" : "" }))}
                    className={`flex-1 p-3 rounded-xl border text-left transition-all ${form.mode === opt.value ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"}`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.mode === "multi" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max Uses <span className="text-slate-500">(optional — leave blank for unlimited)</span></label>
                <input
                  type="number" min="1" value={form.maxUses}
                  onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-40 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${form.requirePayment ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Require Payment</p>
                    <p className="text-xs text-slate-500">Enable Stripe fee for this registration link</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, requirePayment: !p.requirePayment }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.requirePayment ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.requirePayment ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {form.requirePayment && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 translate-x-11">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">AED</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.paymentAmount}
                        onChange={e => setForm(p => ({ ...p, paymentAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                    <p className="text-xs text-slate-400 italic">Fee per athlete registration</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreateOrUpdate} loading={creating} disabled={creating}>
                {editingLinkId ? "Save Changes" : "Generate Link"}
              </Button>
              <Button variant="ghost" onClick={() => {
                setShowCreate(false);
                setEditingLinkId(null);
                setForm(defaultForm);
              }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading invite links...</div>
      ) : links.length === 0 ? (
        <Card className="border-slate-800">
          <CardContent className="p-12 text-center">
            <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No invite links yet</p>
            <p className="text-slate-600 text-sm mt-1">Create your first private invite link above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const status = getLinkStatus(link);
            const url = getInviteUrl(link);
            return (
              <Card key={link.id} className="border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-main font-semibold">{link.label}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${statusColors[status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]}`} />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${link.mode === "single" ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"}`}>
                          {link.mode === "single" ? "Single-Use" : "Multi-Use"}
                        </span>
                        {(link.role || (link.club && link.club.length > 0)) && (
                           <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                             Restricted Link
                           </span>
                        )}
                        {link.requirePayment && (
                          <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CreditCard className="w-2.5 h-2.5" />
                            AED {link.paymentAmount?.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-muted truncate block max-w-md">{url}</code>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <span>{link.useCount || 0}{link.maxUses ? `/${link.maxUses}` : ""} uses</span>
                        {link.expiresAt && (
                          <span>Expires: {new Date(link.expiresAt).toLocaleString()}</span>
                        )}
                        {!link.expiresAt && <span>Never expires</span>}
                        {link.role && <span>• Role: <span className="text-main">{link.role}</span></span>}
                        {link.club && link.club.length > 0 && (() => {
                          const clubsArray = Array.isArray(link.club) ? link.club : [link.club];
                          return (
                            <span title={clubsArray.join(", ")}>
                              • Clubs: <span className="text-main truncate max-w-[150px] inline-block align-bottom">
                                {clubsArray.length === 1 ? clubsArray[0] : `${clubsArray.length} clubs selected`}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(link)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-base hover:bg-border border border-border rounded-lg text-muted text-xs font-medium transition-colors"
                        title="Copy link"
                      >
                        {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === link.id ? "Copied!" : "Copy"}
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Open link">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => openEdit(link)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Edit link">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(link)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${link.isActive ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"}`}
                        title={link.isActive ? "Deactivate" : "Activate"}
                      >
                        {link.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(link)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-colors"
                        title="Delete link"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

