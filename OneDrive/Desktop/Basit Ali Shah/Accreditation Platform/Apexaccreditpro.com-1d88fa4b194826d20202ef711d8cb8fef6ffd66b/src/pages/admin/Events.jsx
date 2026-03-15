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
  Palette
} from "lucide-react";
import * as XLSX from "xlsx";
import { extractTextFromPdf as parsePDFText } from "../../lib/pdfParser";
import Button from "../../components/ui/Button";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../../lib/storage";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { formatDate, fileToBase64 } from "../../lib/utils";
const DOCUMENT_OPTIONS = [
  { id: "picture", label: "Picture" },
  { id: "passport", label: "Passport" },
  { id: "eid", label: "EID (Emirates ID)" },
  { id: "guardian_id", label: "Parent or Guardian ID" }
];

const COLOR_PRESETS = [
  "#2563eb", "#7c3aed", "#0d9488", "#d97706", "#e11d48",
  "#475569", "#b45309", "#059669", "#dc2626", "#1d4ed8",
  "#6d28d9", "#0369a1", "#047857", "#b91c1c", "#0891b2"
];

const toProperCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
};

export default function Events() {
  const { id, subpage } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [eventCounts, setEventCounts] = useState({});
  const [editingEvent, setEditingEvent] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, slug: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [deleting, setDeleting] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
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
    requiredDocuments: ["picture", "passport"]
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
      setEvents(data);
      if (data.length > 0) {
        const eventIds = data.map(e => e.id);
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
      requiredDocuments: ["picture", "passport"]
    });
    setEditingEvent(null);
  };

  const handleOpenModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        name: event.name,
        slug: event.slug,
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
        requiredDocuments: event.requiredDocuments || ["picture", "passport"]
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


  const toggleDocumentRequired = (docId) => {
    setFormData((prev) => {
      const current = prev.requiredDocuments || [];
      if (current.includes(docId)) {
        return { ...prev, requiredDocuments: current.filter(id => id !== docId) };
      } else {
        return { ...prev, requiredDocuments: [...current, docId] };
      }
    });
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
        if (editingEvent) {
          const dataToUpdate = { ...formData };
          if (formData.slug === editingEvent.slug) {
            delete dataToUpdate.slug;
          }
          await EventsAPI.update(editingEvent.id, dataToUpdate);
          toast.success("Event updated successfully");
        } else {
          await EventsAPI.create(formData);
          toast.success("Event created successfully");
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
    return docIds.map(id => {
      const doc = DOCUMENT_OPTIONS.find(d => d.id === id);
      return doc ? doc.label : id;
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
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Back to all events"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {id ? "Manage Event" : "Events"}
            </h1>
            <p className="text-lg text-slate-400 font-extralight">
              {id ? "Configure and manage this specific event" : "Manage your competition events"}
            </p>
          </div>
        </div>
        {!id && (
          <Button icon={Plus} onClick={() => handleOpenModal()}>
            Create Event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Events Yet"
          description="Create your first event to start managing accreditations"
          action={() => handleOpenModal()}
          actionLabel="Create Event"
          actionIcon={Plus}
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
                      <h3 className="text-xl font-semibold text-white truncate group-hover:text-primary-400 transition-colors">
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
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-white">Categories Management</h2>
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
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-white">Template Configuration</h2>
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
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-white">Event Clubs & Analytics</h2>
              </div>
              <ClubsAnalyticsView 
                event={event} 
                onClose={() => navigate(`/admin/events/${id}`)}
                onUpload={() => loadEvents()}
              />
            </div>
          );
        })()
      ) : (
        /* --- DETAIL VIEW (DEFAULT) --- */
        (() => {
          const event = events.find(e => e.id === id);
          if (!event) return (
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Event Not Found</h2>
              <p className="text-slate-400 mb-6">The event you are looking for does not exist or has been deleted.</p>
              <Button onClick={() => navigate("/admin/events")}>Go Back to Events</Button>
            </div>
          );

          const counts = eventCounts[event.id] || { total: 0, pending: 0, approved: 0 };
          const link = getRegistrationLink(event.slug);

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Event Info Card */}
              <Card className="border-slate-800 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500" />
                <CardContent className="p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <h2 className="text-3xl font-bold text-white">{event.name}</h2>
                          <div className="ms-12 flex items-center gap-3">
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
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 shadow-emerald-500/10" 
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 shadow-amber-500/10"
                              }`}
                              title={event.registrationOpen ? "Click to Close Registration" : "Click to Open Registration"}
                            >
                              <div className={`w-2 h-2 rounded-full animate-pulse ${event.registrationOpen ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              <span className="text-xs font-black uppercase tracking-[0.25em]">
                                {event.registrationOpen ? "Registration Open" : "Registration Closed"}
                              </span>
                            </button>
                            {!event.registrationOpen && (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 animate-pulse">
                                <Edit className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>

                        {!event.registrationOpen && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 max-w-xl group/msg shadow-2xl backdrop-blur-xl"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                      Closed Notification Message
                                    </label>
                                    <Edit className="w-3 h-3 text-slate-600" />
                                  </div>
                                  <textarea
                                    value={localClosedMessage}
                                    onChange={(e) => setLocalClosedMessage(e.target.value)}
                                    placeholder="e.g. Registration is currently closed. Please contact info@apex.com"
                                    className="w-full bg-transparent border-none p-0 text-base text-white placeholder:text-slate-600 focus:ring-0 resize-none min-h-[60px] font-light leading-relaxed scrollbar-hide"
                                    rows={2}
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
                      
                      <p className="text-xl text-slate-400 font-light flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary-400" />
                        {event.location} • {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 h-fit">
                      <Button variant="secondary" icon={Edit} onClick={() => handleOpenModal(event)}>Edit Settings</Button>
                      <Button variant="ghost" icon={Trash2} onClick={() => handleDelete(event)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Delete</Button>
                    </div>
                  </div>

                  {event.description && (
                    <div className="max-w-3xl">
                      <p className="text-lg text-slate-400 leading-relaxed font-extralight italic">
                        "{event.description}"
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-2">Registration Link</label>
                        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 group">
                          <LinkIcon className="w-5 h-5 text-primary-400" />
                          <code className="text-primary-300 flex-1 truncate">{link}</code>
                          <button
                            onClick={() => copyRegistrationLink(event.slug)}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Copy link"
                          >
                            {copiedSlug === event.slug ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                          </button>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-800">
                          <FileText className="w-4 h-4 text-primary-400" />
                          <span className="text-sm">Docs: {getDocumentLabel(event.requiredDocuments)}</span>
                        </div>
                        {event.backTemplateUrl && (
                          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                            <FileImage className="w-4 h-4" />
                            <span className="text-sm">Template Configured</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 flex items-center justify-around">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-white mb-1">{counts.total}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total</p>
                      </div>
                      <div className="w-px h-12 bg-slate-800" />
                      <div className="text-center">
                        <p className="text-3xl font-bold text-amber-500 mb-1">{counts.pending}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pending</p>
                      </div>
                      <div className="w-px h-12 bg-slate-800" />
                      <div className="text-center">
                        <p className="text-3xl font-bold text-emerald-500 mb-1">{counts.approved}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Approved</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <p className="text-lg text-slate-500 mb-3">
              Select which documents participants must upload during registration
            </p>
            <div className="grid grid-cols-2 gap-3">
              {DOCUMENT_OPTIONS.map((doc) => {
                const isSelected = (formData.requiredDocuments || []).includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDocumentRequired(doc.id)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? "border-primary-500 bg-primary-500/20"
                        : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? "border-primary-500 bg-primary-500" : "border-slate-500"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-lg font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>
                        {doc.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {(!formData.requiredDocuments || formData.requiredDocuments.length === 0) && (
              <p className="text-lg text-amber-400 mt-2">Please select at least one required document</p>
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
function DetailActionCard({ title, description, icon: Icon, color, onClick }) {
  return (
    <motion.button 
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group w-full text-left"
    >
      {/* Premium Glassmorphic Container */}
      <div className="relative overflow-hidden rounded-3xl p-8 h-full bg-slate-900/40 backdrop-blur-xl border border-white/5 group-hover:border-white/20 transition-all duration-500 shadow-2xl">
        
        {/* Dynamic Background Glow Effect */}
        <div className={`absolute -inset-24 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 blur-[80px] transition-opacity duration-700 pointer-events-none`} />
        
        {/* Internal Glow on Hover */}
        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${color} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500`} />

        {/* Action Icon with Internal Depth */}
        <div className="relative mb-8">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg shadow-black/40 group-hover:shadow-${color.split('-')[1]}-500/20 transition-all duration-500 overflow-hidden`}>
            {/* Subtle internal glow for the icon */}
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Icon className="w-8 h-8 relative z-10" />
          </div>
          
          {/* Animated rings around icon on hover */}
          <div className={`absolute -inset-2 border-2 border-white/5 rounded-3xl opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 pointer-events-none`} />
        </div>
        
        {/* Content Hierarchy */}
        <div className="relative z-10 space-y-3">
          <h3 className="text-2xl font-black text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/60 transition-all duration-300 uppercase tracking-tighter leading-none">
            {title}
          </h3>
          <p className="text-slate-400 text-sm font-light leading-relaxed group-hover:text-slate-300 transition-colors duration-300 max-w-[90%]">
            {description}
          </p>
        </div>

        {/* Enhanced Call-to-Action Indicator */}
        <div className="mt-10 flex items-center gap-3">
          <div className="h-[2px] w-12 bg-white/5 group-hover:w-16 group-hover:bg-gradient-to-r group-hover:from-primary-500 group-hover:to-transparent transition-all duration-700" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-primary-400 transition-colors duration-500">
            Configure Module
          </span>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400 group-hover:translate-x-2 transition-all duration-500" />
        </div>
      </div>

      {/* Outer Border Glow Support */}
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 blur-xl transition-opacity duration-700 -z-10`} />
    </motion.button>
  );
}

// --- SUB-PAGE VIEWS ---

function CategoriesView({ event, availableCategories, onClose }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState(availableCategories);
  const toast = useToast();

  useEffect(() => {
    loadSelected();
  }, [event.id]);

  useEffect(() => {
    setCats(availableCategories);
  }, [availableCategories]);

  const loadSelected = async () => {
    try {
      const data = await EventCategoriesAPI.getByEventId(event.id);
      setSelectedCategories(data.map(r => r.categoryId));
    } catch (err) {
      console.error("Failed to load event categories", err);
    }
  };

  const toggleCategory = (id) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const updateCategoryColor = async (id, newColor) => {
    try {
      await CategoriesAPI.update(id, { badgeColor: newColor });
      setCats(prev => prev.map(c => c.id === id ? { ...c, badgeColor: newColor } : c));
      toast.success("Category color updated");
    } catch (err) {
      toast.error("Failed to update color");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await EventCategoriesAPI.setForEvent(event.id, selectedCategories);
      toast.success("Categories updated successfully");
      onClose();
    } catch (err) {
      toast.error("Failed to save categories");
    } finally {
      setSaving(false);
    }
  };

  // Group categories: Parents (parentId null) and their children
  const mainCategories = cats.filter(c => !c.parentId);
  const subCategories = cats.filter(c => !!c.parentId);

  const groupedCategories = mainCategories.map(parent => ({
    ...parent,
    children: subCategories.filter(child => child.parentId === parent.id)
  }));

  // Categories without a valid parent (shouldn't happen with current data but for safety)
  const orphanCategories = subCategories.filter(child => !mainCategories.some(p => p.id === child.parentId));

  return (
    <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
      <CardContent className="p-8 space-y-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase italic">Participant Categories</h3>
            <p className="text-slate-400 font-light">Select which roles and groups can register for this event.</p>
          </div>
          <Button onClick={save} loading={saving}>Save Changes</Button>
        </div>

        <div className="space-y-6">
          {groupedCategories.map(parent => (
            <div key={parent.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/5" />
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] bg-slate-900/40 px-3 py-0.5 rounded-full border border-white/5">
                  {parent.name}
                </h4>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {parent.children.map(cat => (
                  <div
                    key={cat.id}
                    className={`relative p-2.5 rounded-lg border transition-all duration-300 flex flex-col gap-2 group ${
                      selectedCategories.includes(cat.id)
                        ? "border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/5"
                        : "border-slate-800 bg-slate-950/30 hover:border-slate-700"
                    }`}
                  >
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div 
                          className="w-3 h-3 rounded-full shadow border border-white/10 flex-shrink-0" 
                          style={{ backgroundColor: cat.badgeColor }} 
                        />
                        <span className={`font-bold uppercase tracking-tight text-[10px] truncate ${selectedCategories.includes(cat.id) ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                          {cat.name}
                        </span>
                        {selectedCategories.includes(cat.id) && <Check className="w-3 h-3 text-primary-400 ml-auto flex-shrink-0" />}
                      </div>
                      {cat.description && (
                        <p className="text-[9px] text-slate-600 font-light leading-tight line-clamp-1 group-hover:text-slate-500">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    {/* Color Picker Section */}
                    <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {COLOR_PRESETS.slice(0, 4).map(color => (
                          <button
                            key={color}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateCategoryColor(cat.id, color);
                            }}
                            className={`w-2.5 h-2.5 rounded-sm transition-all hover:scale-125 shadow-sm ${cat.badgeColor === color ? 'ring-1 ring-white ring-offset-1 ring-offset-slate-900 scale-110' : 'opacity-30 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      
                      <div className="relative group/picker">
                        <button 
                          className="p-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById(`color-picker-${cat.id}`).click();
                          }}
                          title="Change Color"
                        >
                          <Edit className="w-2.5 h-2.5" />
                        </button>
                        <input
                          id={`color-picker-${cat.id}`}
                          type="color"
                          value={cat.badgeColor}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateCategoryColor(cat.id, e.target.value);
                          }}
                          className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {orphanCategories.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/5" />
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] bg-slate-900/40 px-3 py-0.5 rounded-full border border-white/5">
                  Others
                </h4>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {orphanCategories.map(cat => (
                  <div
                    key={cat.id}
                    className={`relative p-2.5 rounded-lg border transition-all duration-300 flex flex-col gap-2 group ${
                      selectedCategories.includes(cat.id)
                        ? "border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/5"
                        : "border-slate-800 bg-slate-950/30 hover:border-slate-700"
                    }`}
                  >
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div 
                          className="w-3 h-3 rounded-full shadow border border-white/10 flex-shrink-0" 
                          style={{ backgroundColor: cat.badgeColor }} 
                        />
                        <span className={`font-bold uppercase tracking-tight text-[10px] truncate ${selectedCategories.includes(cat.id) ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                          {cat.name}
                        </span>
                        {selectedCategories.includes(cat.id) && <Check className="w-3 h-3 text-primary-400 ml-auto flex-shrink-0" />}
                      </div>
                      {cat.description && (
                        <p className="text-[9px] text-slate-600 font-light leading-tight line-clamp-1 group-hover:text-slate-500">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {COLOR_PRESETS.slice(0, 4).map(color => (
                          <button
                            key={color}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateCategoryColor(cat.id, color);
                            }}
                            className={`w-2.5 h-2.5 rounded-sm transition-all hover:scale-125 shadow-sm ${cat.badgeColor === color ? 'ring-1 ring-white ring-offset-1 ring-offset-slate-900 scale-110' : 'opacity-30 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      
                      <div className="relative group/picker">
                        <button 
                          className="p-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById(`orphan-picker-${cat.id}`).click();
                          }}
                          title="Change Color"
                        >
                          <Edit className="w-2.5 h-2.5" />
                        </button>
                        <input
                          id={`orphan-picker-${cat.id}`}
                          type="color"
                          value={cat.badgeColor}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateCategoryColor(cat.id, e.target.value);
                          }}
                          className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateView({ event, onClose, onSave }) {
  const [templateData, setTemplateData] = useState({
    headerArabic: event.headerArabic || "",
    headerSubtitle: event.headerSubtitle || "",
    logoUrl: event.logoUrl || "",
    backTemplateUrl: event.backTemplateUrl || "",
    sponsorLogos: event.sponsorLogos || []
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
      await EventsAPI.update(event.id, templateData);
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
            <h3 className="text-2xl font-bold text-white mb-2">Accreditation Template</h3>
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
                <div className="grid grid-cols-3 gap-3">
                  {templateData.sponsorLogos.map((logo, i) => (
                    <div key={i} className="relative group aspect-video bg-white/5 rounded-lg flex items-center justify-center p-2 border border-white/5">
                      <img src={logo} className="max-w-full max-h-full object-contain" alt="Sponsor" />
                      <button 
                         onClick={() => setTemplateData(prev => ({ ...prev, sponsorLogos: prev.sponsorLogos.filter((_, idx) => idx !== i) }))}
                         className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {templateData.sponsorLogos.length < 6 && (
                    <label className="aspect-video border-2 border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-slate-600 transition-all text-slate-600">
                      <Plus className="w-5 h-5" />
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
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [event.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clubsData, accs] = await Promise.all([
        GlobalSettingsAPI.getClubs(event.id),
        AccreditationsAPI.getByEventId(event.id)
      ]);
      
      setClubs(clubsData);
      // Fetch v2 metadata manually if we need the filename
      const v2Raw = await GlobalSettingsAPI.get(`event_${event.id}_clubs_v2`);
      if (v2Raw) {
        const parsed = JSON.parse(v2Raw);
        if (parsed.metadata) setUploadedFile(parsed.metadata);
      }
      
      setAccreditations(accs || []);
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
      
      return {
        sr: index + 1,
        short: clubShort,
        full: clubNameStr || "Unknown Club",
        registered: registeredAthletes.length,
        fileRegistered: fileRegistered,
        approved: approvedAthletes.length,
        approvedNames: approvedAthletes.map(a => `${a.firstName || ""} ${a.lastName || ""}`.trim()).join(", ")
      };
    }).filter(r => r.full !== "Unknown Club");

    if (!searchTerm.trim()) return rawAnalytics;
    
    const term = searchTerm.toLowerCase();
    return rawAnalytics.filter(r => 
      String(r.full).toLowerCase().includes(term) || 
      String(r.short).toLowerCase().includes(term)
    );
  }, [clubs, accreditations, searchTerm]);

  const handleExport = () => {
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
    toast.success("Exported successfully");
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="p-8 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase italic">Club Analytics</h3>
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
                  className="pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-lg placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all min-w-[240px]"
                />
              </div>
              <Button variant="secondary" icon={Download} onClick={handleExport} disabled={analytics.length === 0}>Export Data</Button>
              {!uploadedFile && (
                <Button icon={parsing ? undefined : Upload} loading={parsing} onClick={() => document.getElementById('club-import').click()}>
                  Import Club List
                </Button>
              )}
              <input id="club-import" type="file" className="hidden" accept=".csv,.xlsx,.pdf" onChange={handleFileUpload} />
            </div>

            {/* Delete Confirmation Modal */}
            <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Clear Clubs List">
              <div className="p-6">
                <p className="text-slate-300 mb-6 font-light italic">
                  Are you sure you want to delete the active club list and clear all analytics data? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                  <Button variant="secondary" className="text-red-400 border-red-500/20 hover:bg-red-500/10" onClick={confirmClearClubs}>
                    Yes, Clear List
                  </Button>
                </div>
              </div>
            </Modal>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">SR#</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Club Short Name</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Club Full Name</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Registered Athletes</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Accreditations Issued</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Attendance</th>
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
                    <tr key={row.sr} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="p-6 text-slate-600 font-mono text-xs">{String(row.sr).padStart(2, '0')}</td>
                      <td className="p-6">
                        <div className="font-black text-slate-400 group-hover:text-cyan-400 transition-colors uppercase tracking-[0.1em] text-[10px]">
                          {row.short}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="font-bold text-white group-hover:text-primary-400 transition-colors tracking-tight">
                          {row.full}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-300 text-xs font-bold border border-slate-700">
                            {row.fileRegistered} REGISTERED
                          </span>
                          {row.registered > 0 && (
                            <span className="text-[10px] text-slate-500 font-medium uppercase italic">
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
                        <div className="flex items-center justify-center gap-2 text-slate-700">
                          <Activity className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Data Soon</span>
                        </div>
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
            <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
