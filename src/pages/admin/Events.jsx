import React, { useState, useEffect } from "react";
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
  FileText
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import {
  EventsAPI,
  AccreditationsAPI,
  CategoriesAPI,
  EventCategoriesAPI
} from "../../lib/storage";
import { formatDate, fileToBase64 } from "../../lib/utils";

const DOCUMENT_OPTIONS = [
  { id: "picture", label: "Picture" },
  { id: "passport", label: "Passport" },
  { id: "eid", label: "EID (Emirates ID)" },
  { id: "guardian_id", label: "Parent or Guardian ID" }
];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [allAccreditations, setAllAccreditations] = useState([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedEventForTemplate, setSelectedEventForTemplate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, slug: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [deleting, setDeleting] = useState(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [selectedEventForCategories, setSelectedEventForCategories] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    parentId: "",
    badgeColor: "#2563eb"
  });
  const [savingNewCategory, setSavingNewCategory] = useState(false);
  const [deleteCategoryModal, setDeleteCategoryModal] = useState({ open: false, category: null });
  const [deletingCategory, setDeletingCategory] = useState(false);
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
  const [templateData, setTemplateData] = useState({
    backTemplateUrl: "",
    logoUrl: "",
    headerArabic: "",
    headerSubtitle: "",
    sponsorLogos: []
  });
  const toast = useToast();

  useEffect(() => {
    loadEvents();
    loadCategories();
  }, []);

  const loadEvents = async () => {
    const data = await EventsAPI.getAll();
    const accreditationsData = await AccreditationsAPI.getAll();
    setEvents(data);
    setAllAccreditations(accreditationsData);
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

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({ ...prev, [field]: base64 }));
      toast.success("Image uploaded successfully");
    } catch {
      toast.error("Failed to upload image");
    }
  };

  const handleTemplateFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setTemplateData((prev) => ({ ...prev, [field]: base64 }));
      toast.success("Image uploaded successfully");
    } catch {
      toast.error("Failed to upload image");
    }
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

  const openTemplateModal = (event) => {
    setSelectedEventForTemplate(event);
    setTemplateData({
      backTemplateUrl: event.backTemplateUrl || "",
      logoUrl: event.logoUrl || "",
      headerArabic: event.headerArabic || "",
      headerSubtitle: event.headerSubtitle || "",
      sponsorLogos: event.sponsorLogos || []
    });
    setTemplateModalOpen(true);
  };

  const saveTemplateSettings = async () => {
    if (selectedEventForTemplate) {
      await EventsAPI.update(selectedEventForTemplate.id, templateData);
      toast.success("Accreditation template updated");
      setTemplateModalOpen(false);
      loadEvents();
    }
  };

  const openCategoriesModal = async (event) => {
    setSelectedEventForCategories(event);
    setSavingCategories(true);
    try {
      const eventCats = await EventCategoriesAPI.getByEventId(event.id);
      setSelectedCategories(eventCats.map(ec => ec.categoryId));
    } catch (err) {
      console.error("Failed to load event categories:", err);
      setSelectedCategories([]);
    } finally {
      setSavingCategories(false);
    }
    setCategoriesModalOpen(true);
    setCategorySearch("");
    const groups = {};
    availableCategories.forEach(cat => {
      if (!cat.parentId) {
        groups[cat.id] = true;
      }
    });
    setExpandedGroups(groups);
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const buildCategoryHierarchy = () => {
    const mainCategories = availableCategories.filter(cat => !cat.parentId);
    const subCategories = availableCategories.filter(cat => cat.parentId);

    return mainCategories.map(main => ({
      ...main,
      children: subCategories.filter(sub => sub.parentId === main.id)
    }));
  };

  const getFilteredHierarchy = () => {
    const hierarchy = buildCategoryHierarchy();
    const searchLower = categorySearch.toLowerCase().trim();

    if (!searchLower) return hierarchy;

    return hierarchy
      .map(group => {
        const groupMatches = group.name.toLowerCase().includes(searchLower);
        const matchingChildren = group.children.filter(child =>
          child.name.toLowerCase().includes(searchLower)
        );

        if (groupMatches || matchingChildren.length > 0) {
          return {
            ...group,
            children: groupMatches ? group.children : matchingChildren
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const selectAllInGroup = (groupId) => {
    const childIds = availableCategories
      .filter(c => c.parentId === groupId)
      .map(c => c.id);

    const allSelected = childIds.every(id => selectedCategories.includes(id));

    if (allSelected) {
      setSelectedCategories(prev => prev.filter(id => !childIds.includes(id)));
    } else {
      setSelectedCategories(prev => [...new Set([...prev, ...childIds])]);
    }
  };

  const isGroupFullySelected = (groupId) => {
    const childIds = availableCategories
      .filter(c => c.parentId === groupId)
      .map(c => c.id);
    return childIds.length > 0 && childIds.every(id => selectedCategories.includes(id));
  };

  const isGroupPartiallySelected = (groupId) => {
    const childIds = availableCategories
      .filter(c => c.parentId === groupId)
      .map(c => c.id);
    const selectedCount = childIds.filter(id => selectedCategories.includes(id)).length;
    return selectedCount > 0 && selectedCount < childIds.length;
  };

  const saveCategoriesSettings = async () => {
    if (!selectedEventForCategories) return;
    setSavingCategories(true);
    try {
      await EventCategoriesAPI.setForEvent(selectedEventForCategories.id, selectedCategories);
      toast.success("Event categories updated successfully");
      setCategoriesModalOpen(false);
    } catch (error) {
      console.error("Save categories error:", error);
      toast.error("Failed to update categories: " + (error.message || "Unknown error"));
    } finally {
      setSavingCategories(false);
    }
  };

  const handleAddCategory = () => {
    setNewCategoryData({
      name: "",
      parentId: "",
      badgeColor: "#2563eb"
    });
    setAddCategoryModal(true);
  };

  const saveNewCategory = async () => {
    if (!newCategoryData.name.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    setSavingNewCategory(true);
    try {
      const slug = newCategoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await CategoriesAPI.create({
        name: newCategoryData.name,
        slug: slug,
        parentId: newCategoryData.parentId || null,
        badgeColor: newCategoryData.badgeColor,
        status: "active"
      });

      toast.success("Category created successfully");
      setAddCategoryModal(false);
      await loadCategories();
    } catch (error) {
      console.error("Create category error:", error);
      toast.error("Failed to create category: " + (error.message || "Unknown error"));
    } finally {
      setSavingNewCategory(false);
    }
  };

  const handleDeleteCategory = (category, e) => {
    e.stopPropagation();
    setDeleteCategoryModal({ open: true, category });
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryModal.category) return;

    setDeletingCategory(true);
    try {
      const inUse = await CategoriesAPI.isInUse(deleteCategoryModal.category.id);
      if (inUse) {
        toast.error("Cannot delete: This category is assigned to existing accreditations");
        setDeletingCategory(false);
        return;
      }

      await CategoriesAPI.delete(deleteCategoryModal.category.id);
      toast.success("Category deleted successfully");
      setDeleteCategoryModal({ open: false, category: null });
      setSelectedCategories(prev => prev.filter(id => id !== deleteCategoryModal.category.id));
      await loadCategories();
    } catch (error) {
      console.error("Delete category error:", error);
      toast.error("Failed to delete category: " + (error.message || "Unknown error"));
    } finally {
      setDeletingCategory(false);
    }
  };

  const getMainCategories = () => {
    return availableCategories.filter(cat => !cat.parentId);
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
      setShareModal({ open: true, slug });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Events</h1>
          <p className="text-lg text-slate-400 font-extralight">
            Manage your competition events
          </p>
        </div>
        <Button icon={Plus} onClick={() => handleOpenModal()}>
          Create Event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Events Yet"
          description="Create your first event to start accepting accreditation registrations"
          action={() => handleOpenModal()}
          actionLabel="Create Event"
          actionIcon={Plus}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.map((event, index) => {
            const accreditations = (Array.isArray(allAccreditations) ? allAccreditations : []).filter((a) => a.eventId === event.id);
            const pending = accreditations.filter((a) => a.status === "pending").length;
            const approved = accreditations.filter((a) => a.status === "approved").length;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{event.name}</h3>
                      <p className="text-lg text-slate-500 mt-1">{event.location}</p>
                    </div>
                    <Badge variant={event.registrationOpen ? "success" : "warning"}>
                      {event.registrationOpen ? "Open" : "Closed"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {event.description && (
                      <p className="text-lg text-slate-400 font-extralight">
                        {event.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-lg text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-lg text-slate-400">
                      <LinkIcon className="w-4 h-4" />
                      <code className="text-primary-400">/register/{event.slug}</code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyRegistrationLink(event.slug);
                        }}
                        className="p-1 hover:bg-slate-700 rounded"
                        title={copiedSlug === event.slug ? "Copied!" : "Copy link"}
                      >
                        {copiedSlug === event.slug ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <a
                        href={`/register/${event.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-slate-700 rounded"
                        title="Open registration"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2 text-lg text-slate-400">
                      <FileText className="w-4 h-4" />
                      <span className="truncate">
                        Required: {getDocumentLabel(event.requiredDocuments)}
                      </span>
                    </div>

                    {event.backTemplateUrl && (
                      <div className="flex items-center gap-2 text-lg text-emerald-400">
                        <FileImage className="w-4 h-4" />
                        <span>Accreditation template configured</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-slate-800">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{accreditations.length}</p>
                        <p className="text-lg text-slate-500">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-400">{pending}</p>
                        <p className="text-lg text-slate-500">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">{approved}</p>
                        <p className="text-lg text-slate-500">Approved</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Tags}
                        onClick={() => openCategoriesModal(event)}
                        className="flex-1"
                      >
                        Categories
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={FileImage}
                        onClick={() => openTemplateModal(event)}
                        className="flex-1"
                      >
                        Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                        onClick={() => handleOpenModal(event)}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(event)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
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

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="registrationOpen"
              checked={formData.registrationOpen}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  registrationOpen: e.target.checked
                }))
              }
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/50"
            />
            <label htmlFor="registrationOpen" className="text-lg text-slate-300">
              Registration Open
            </label>
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

      {/* Template Settings Modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Accreditation Template Settings"
        size="lg"
      >
        <div className="p-6 space-y-6">
          <p className="text-lg text-slate-400 font-extralight">
            Configure the accreditation card template for <span className="text-white font-medium">{selectedEventForTemplate?.name}</span>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">
                Back Page Template Image
              </label>
              <p className="text-lg text-slate-500 mb-2">
                Upload the schedule/access zones image for the back of the accreditation card
              </p>
              <div className="flex items-center gap-4">
                {templateData.backTemplateUrl ? (
                  <div className="relative w-32 h-48 rounded-lg overflow-hidden border border-slate-700">
                    <img
                      src={templateData.backTemplateUrl}
                      alt="Back template"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setTemplateData((prev) => ({ ...prev, backTemplateUrl: "" }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-48 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                    <Upload className="w-6 h-6 text-slate-500 mb-2" />
                    <span className="text-lg text-slate-500">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleTemplateFileUpload(e, "backTemplateUrl")}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">
                Event Logo
              </label>
              <div className="flex items-center gap-4">
                {templateData.logoUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                    <img
                      src={templateData.logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain bg-white p-1"
                    />
                    <button
                      onClick={() => setTemplateData((prev) => ({ ...prev, logoUrl: "" }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                    <ImageIcon className="w-5 h-5 text-slate-500" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleTemplateFileUpload(e, "logoUrl")}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <Input
              label="Header Text (Arabic/Secondary)"
              value={templateData.headerArabic}
              onChange={(e) =>
                setTemplateData((prev) => ({ ...prev, headerArabic: e.target.value }))
              }
              placeholder="دبي الدولية للألعاب المائية"
            />

            <Input
              label="Header Subtitle"
              value={templateData.headerSubtitle}
              onChange={(e) =>
                setTemplateData((prev) => ({ ...prev, headerSubtitle: e.target.value }))
              }
              placeholder="AQUATICS CHAMPIONSHIP"
            />

            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">
                Sponsor / Partner Logos
              </label>
              <p className="text-lg text-slate-500 mb-3">
                Upload sponsor logos to display on accreditation badges. All 6 uploaded logos will display on cards.
              </p>
              <div className="flex flex-wrap gap-3 mb-3">
                {(templateData.sponsorLogos || []).map((logo, index) => (
                  <div key={index} className="relative w-24 h-16 rounded-md overflow-hidden border border-slate-700 bg-white p-1">
                    <img src={logo} alt={`Sponsor ${index + 1}`} className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setTemplateData(prev => ({
                        ...prev,
                        sponsorLogos: prev.sponsorLogos.filter((_, i) => i !== index)
                      }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(templateData.sponsorLogos || []).length < 6 && (
                  <label className="flex flex-col items-center justify-center w-24 h-16 border-2 border-dashed border-slate-600 rounded-md cursor-pointer hover:border-primary-500 transition-colors">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] text-slate-500 mt-0.5">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith("image/")) return;
                        if (file.size > 5 * 1024 * 1024) return;
                        try {
                          const base64 = await fileToBase64(file);
                          setTemplateData(prev => ({
                            ...prev,
                            sponsorLogos: [...(prev.sponsorLogos || []), base64]
                          }));
                        } catch { /* skip */ }
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setTemplateModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={saveTemplateSettings} className="flex-1">
              Save Template Settings
            </Button>
          </div>
        </div>
      </Modal>

      {/* Categories Modal with Hierarchical Structure */}
      <Modal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        title="Event Categories"
        size="lg"
      >
        <div className="p-6 space-y-6">
          <p className="text-lg text-slate-400 font-extralight">
            Select which participant categories are available for{" "}
            <span className="text-white font-medium">{selectedEventForCategories?.name}</span>
          </p>

          {/* Search Input and Add Button */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              />
            </div>
            <Button
              variant="secondary"
              icon={PlusCircle}
              onClick={handleAddCategory}
            >
              Add Category
            </Button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {availableCategories.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Tags className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No categories available.</p>
                <p className="text-lg">Create categories in the Categories section first.</p>
              </div>
            ) : getFilteredHierarchy().length === 0 && categorySearch.trim() ? (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No categories match your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getFilteredHierarchy().map((group) => {
                  const isExpanded = expandedGroups[group.id] || categorySearch.trim();
                  const fullySelected = isGroupFullySelected(group.id);
                  const partiallySelected = isGroupPartiallySelected(group.id);

                  return (
                    <div key={group.id} className="border border-slate-700 rounded-lg overflow-hidden">
                      {/* Group Header */}
                      <div
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          fullySelected
                            ? "bg-primary-500/20"
                            : partiallySelected
                            ? "bg-primary-500/10"
                            : "bg-slate-800/70 hover:bg-slate-800"
                        }`}
                      >
                        <div
                          onClick={() => toggleGroupExpanded(group.id)}
                          className="flex items-center gap-3 flex-1"
                        >
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: group.badgeColor || "#2563eb" }}
                          />
                          <div className="flex-1">
                            <p className="text-lg font-semibold text-white">{group.name}</p>
                            <p className="text-lg text-slate-500">
                              {group.children.length} subcategories
                            </p>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>

                        {/* Select All Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInGroup(group.id);
                          }}
                          className={`ml-3 px-3 py-1.5 rounded-md text-lg font-medium transition-colors ${
                            fullySelected
                              ? "bg-primary-500 text-white"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          {fullySelected ? "Deselect All" : "Select All"}
                        </button>
                      </div>

                      {/* Subcategories */}
                      {isExpanded && group.children.length > 0 && (
                        <div className="p-3 bg-slate-900/50 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {group.children.map((category) => {
                            const isSelected = selectedCategories.includes(category.id);
                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => toggleCategory(category.id)}
                                className={`p-3 rounded-lg border-2 transition-all duration-200 text-left relative group/cat ${
                                  isSelected
                                    ? "border-primary-500 bg-primary-500/20"
                                    : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.badgeColor || group.badgeColor || "#2563eb" }}
                                  />
                                  <p className={`text-lg font-medium truncate flex-1 ${isSelected ? "text-white" : "text-slate-300"}`}>
                                    {category.name}
                                  </p>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                                  )}
                                </div>
                                {/* Delete button on hover */}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCategory(category, e)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/cat:opacity-100 transition-opacity hover:bg-red-600"
                                  title="Delete category"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <p className="text-lg text-slate-400">
              {selectedCategories.length} categories selected
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setCategoriesModalOpen(false)}
                disabled={savingCategories}
              >
                Cancel
              </Button>
              <Button
                onClick={saveCategoriesSettings}
                loading={savingCategories}
                disabled={savingCategories}
              >
                Save Categories
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={addCategoryModal}
        onClose={() => setAddCategoryModal(false)}
        title="Add New Category"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-400 font-extralight">
            Create a new participant category that can be assigned to events.
          </p>

          <Input
            label="Category Name"
            value={newCategoryData.name}
            onChange={(e) => setNewCategoryData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Senior Men, Junior Women"
            required
          />

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Parent Category (Optional)
            </label>
            <select
              value={newCategoryData.parentId}
              onChange={(e) => setNewCategoryData(prev => ({ ...prev, parentId: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
            >
              <option value="">No Parent (Main Category)</option>
              {getMainCategories().map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Badge Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newCategoryData.badgeColor}
                onChange={(e) => setNewCategoryData(prev => ({ ...prev, badgeColor: e.target.value }))}
                className="w-12 h-10 rounded cursor-pointer border border-slate-700"
              />
              <span className="text-lg text-slate-400">{newCategoryData.badgeColor}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setAddCategoryModal(false)}
              className="flex-1"
              disabled={savingNewCategory}
            >
              Cancel
            </Button>
            <Button
              onClick={saveNewCategory}
              className="flex-1"
              loading={savingNewCategory}
              disabled={savingNewCategory}
            >
              Create Category
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Category Confirmation Modal */}
      <Modal
        isOpen={deleteCategoryModal.open}
        onClose={() => !deletingCategory && setDeleteCategoryModal({ open: false, category: null })}
        title="Delete Category"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Delete this category?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                This will permanently remove the category and unassign it from all events.
              </p>
            </div>
          </div>
          <p className="text-lg text-slate-300 font-extralight">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{deleteCategoryModal.category?.name}</span>?
          </p>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setDeleteCategoryModal({ open: false, category: null })}
              className="flex-1"
              disabled={deletingCategory}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={confirmDeleteCategory}
              className="flex-1"
              loading={deletingCategory}
              disabled={deletingCategory}
            >
              {deletingCategory ? "Deleting..." : "Delete Category"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={shareModal.open}
        onClose={() => setShareModal({ open: false, slug: "" })}
        title="Share Registration Link"
      >
        <div className="p-6 space-y-4">
          <p className="text-lg text-slate-300 font-extralight">
            Copy the registration link below and share it with participants.
          </p>
          <div className="flex gap-2">
            <input
              id="share-link-input"
              type="text"
              readOnly
              value={getRegistrationLink(shareModal.slug)}
              className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-lg font-mono"
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={handleManualCopy} icon={Copy}>
              Copy
            </Button>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShareModal({ open: false, slug: "" })}
            >
              Close
            </Button>
            <a
              href={getRegistrationLink(shareModal.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="primary" icon={ExternalLink} className="w-full">
                Open Link
              </Button>
            </a>
          </div>
        </div>
      </Modal>

      {/* Delete Event Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => !deleting && setDeleteModal({ open: false, event: null })}
        title="Delete Event"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">This action is permanent</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                Deleting this event will also remove all its accreditations, zones, and categories permanently.
              </p>
            </div>
          </div>
          <p className="text-lg text-slate-300 font-extralight">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{deleteModal.event?.name}</span>?
          </p>
          <div className="flex gap-3 pt-4">
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
              icon={Trash2}
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
    </div>
  );
}
