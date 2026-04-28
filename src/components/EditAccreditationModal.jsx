import React, { useState, useEffect, useMemo } from "react";
import { useBackground } from "../contexts/BackgroundContext";
import { Upload, X, Check, User, Camera, AlertTriangle, Info, Plus, Clock, CalendarX, Calendar, FileText, Eye, Download, Image as ImageIcon } from "lucide-react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import SearchableSelect from "./ui/SearchableSelect";
import MultiSearchableSelect from "./ui/MultiSearchableSelect";
import Modal from "./ui/Modal";
import { COUNTRIES, ROLES, validateFile, fileToBase64, ROLE_BADGE_PREFIXES, getBadgePrefix } from "../lib/utils";
import { uploadToStorage } from "../lib/uploadToStorage";
import { GlobalSettingsAPI } from "../lib/broadcastApi";
import { AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../lib/storage";

function ZoneAccessSelector({ zones, selectedRole, selectedCodes, onToggle, onSelectAll, onClearAll }) {
  const roleZones = useMemo(() => {
    if (!selectedRole || zones.length === 0) return zones;
    const filtered = zones.filter(z => {
      const ar = z.allowedRoles || [];
      return ar.length === 0 || ar.includes(selectedRole);
    });
    return filtered.length > 0 ? filtered : zones;
  }, [zones, selectedRole]);

  const hasRoleFilter = selectedRole && roleZones.length < zones.length;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {hasRoleFilter && (
          <p className="text-lg text-cyan-400 font-extralight">
            Showing {roleZones.length} zone(s) linked to role <span className="font-medium">{selectedRole}</span>
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={() => onSelectAll(roleZones)} className="text-lg text-cyan-400 hover:text-cyan-300">
            Select Shown
          </button>
          <span className="text-slate-600">|</span>
          <button type="button" onClick={onClearAll} className="text-lg text-slate-400 hover:text-slate-300">
            Clear
          </button>
          {hasRoleFilter && (
            <>
              <span className="text-slate-600">|</span>
              <button type="button" onClick={() => onSelectAll(zones)} className="text-lg text-slate-500 hover:text-slate-300">
                All zones
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {roleZones.map(zone => {
          const isSelected = selectedCodes.includes(zone.code);
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onToggle(zone.code)}
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
                {isSelected && <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-lg text-slate-500 font-extralight">
        {selectedCodes.length} zone(s) selected
      </p>
    </>
  );
}

export default function EditAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  zones = [],
  eventCategories = [],
  onSave,
  onApprove,
  saving = false,
  currentEvent = null,
  clubs = [],
  categoryDocuments = {}
}) {
  const { currentTask, queue } = useBackground();


  const [formData, setFormData] = useState({
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
    documents: {}, // Generic documents storage
    badgeColor: "#2563eb",
    zoneCodes: [],
    selectedSports: [],
    customFields: {}
  });
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);
  const [expiryMode, setExpiryMode] = useState("none");
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  const [errors, setErrors] = useState({});
  const [originalRole, setOriginalRole] = useState("");
  const [customRoleMode, setCustomRoleMode] = useState(false);
  const [pdfSize, setPdfSize] = useState("a6");

  useEffect(() => {
    if (accreditation) {
      const zc = accreditation.zoneCode
        ? accreditation.zoneCode.split(",").map(z => z.trim()).filter(Boolean)
        : [];
      const role = accreditation.role || "";
      const documents = accreditation.documents || {};
      
      // APX-Debug: Log the raw data to identify where documents are stored
      console.log("[EditModal] Raw accreditation data:", {
        photoUrl: accreditation.photoUrl,
        idDocumentUrl: accreditation.idDocumentUrl,
        documents: accreditation.documents,
        documentsKeys: Object.keys(documents)
      });
      
      // APX-Fix: Find photo and passport URLs from custom document IDs
      // Events may use custom IDs like "custom_123" instead of "picture"/"passport"
      const eventDocs = currentEvent?.requiredDocuments || [];
      const pictureDocConfig = eventDocs.find(d => 
        d.label?.toLowerCase().includes('picture') || d.label?.toLowerCase().includes('photo')
      );
      const passportDocConfig = eventDocs.find(d => 
        d.label?.toLowerCase().includes('passport') || d.label?.toLowerCase().includes('national id')
      );
      const medicalDocConfig = eventDocs.find(d => 
        d.label?.toLowerCase().includes('medical') || d.label?.toLowerCase().includes('certificate')
      );
      
      // Resolve photo URL: try standard keys first, then custom event document IDs
      let photoUrl = accreditation.photoUrl 
        || documents.picture || documents.photo || documents.Picture
        || (pictureDocConfig ? documents[pictureDocConfig.id] : null)
        || null;
      
      // Resolve passport/ID URL
      const idDocumentUrl = accreditation.idDocumentUrl 
        || documents.passport || documents.Passport
        || (passportDocConfig ? documents[passportDocConfig.id] : null)
        || null;

      // APX-Fix: Ensure all document URLs are in the documents map so the grid can find them
      const mergedDocuments = {
        ...documents,
        picture: documents.picture || photoUrl || null,
        passport: documents.passport || idDocumentUrl || null,
        eid: documents.eid || accreditation.eidUrl || null,
        medical: documents.medical || accreditation.medicalUrl 
          || (medicalDocConfig ? documents[medicalDocConfig.id] : null) || null,
      };

      setFormData({
        firstName: accreditation.firstName || "",
        lastName: accreditation.lastName || "",
        gender: accreditation.gender || "",
        dateOfBirth: accreditation.dateOfBirth || "",
        nationality: accreditation.nationality || "",
        club: accreditation.club || "",
        role: role,
        email: accreditation.email || "",
        photoUrl: photoUrl,
        idDocumentUrl: idDocumentUrl,
        documents: mergedDocuments,
        badgeColor: accreditation.badgeColor || "#2563eb",
        zoneCodes: zc,
        selectedSports: accreditation.selectedSports || accreditation.selected_sports || [],
        customFields: accreditation.customFields || {}
      });

      // Load custom field configs for the event to render inputs
      if (currentEvent?.id) {
        GlobalSettingsAPI.get(`event_${currentEvent.id}_custom_fields`).then(val => {
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) setCustomFieldsConfig(parsed);
            } catch (e) {
              console.error("[EditModal] Failed to parse custom fields config", e);
            }
          }
        });
      }

      setOriginalRole(role);
      setErrors({});
      if (accreditation.expiresAt) {
        setExpiryMode("custom");
        setCustomExpiryDate(new Date(accreditation.expiresAt).toISOString().split("T")[0]);
      } else {
        setExpiryMode("none");
        setCustomExpiryDate("");
      }
      const roleOpts = getRoleOptionsInternal(eventCategories);
      const isKnownRole = roleOpts.some(o => o.value === role);
      setCustomRoleMode(role !== "" && !isKnownRole);
    }
  }, [accreditation, eventCategories]);

  const getRoleOptionsInternal = (cats) => {
    if (cats && cats.length > 0) {
      return cats.map(cat => {
        const categoryData = cat.category || cat;
        const name = categoryData?.name || cat?.name;
        if (name) return { value: name, label: name };
        return null;
      }).filter(Boolean);
    }
    return ROLES.map(r => ({ value: r, label: r }));
  };

  const getRoleOptions = () => getRoleOptionsInternal(eventCategories);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCustomFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldId]: value }
    }));
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    if (value === "__custom__") {
      setCustomRoleMode(true);
      setFormData(prev => ({ ...prev, role: "" }));
    } else {
      setCustomRoleMode(false);
      setFormData(prev => ({ ...prev, role: value }));
    }
    if (errors.role) {
      setErrors(prev => ({ ...prev, role: null }));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, photoUrl: validation.error }));
      return;
    }
    try {
      const data = await uploadToStorage(file, "edits");

      setFormData(prev => ({ ...prev, photoUrl: data.url }));
      setErrors(prev => ({ ...prev, photoUrl: null }));
    } catch (err) {
      setErrors(prev => ({ ...prev, photoUrl: "Failed to upload image: " + (err.message || "") }));
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photoUrl: null }));
  };

  const handleIDUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, idDocumentUrl: validation.error }));
      return;
    }
    try {
      const data = await uploadToStorage(file, "edits");
      setFormData(prev => ({ ...prev, idDocumentUrl: data.url }));
      setErrors(prev => ({ ...prev, idDocumentUrl: null }));
    } catch (err) {
      setErrors(prev => ({ ...prev, idDocumentUrl: "Failed to upload document: " + (err.message || "") }));
    }
  };

  const handleRemoveID = () => {
    setFormData(prev => ({ ...prev, idDocumentUrl: null }));
  };

  const handleDocumentUpload = async (e, docId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Special case for photo and passport if needed, but generic works too
    if (docId === 'picture') {
      return handlePhotoUpload(e);
    }
    if (docId === 'passport') {
      return handleIDUpload(e);
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, [docId]: validation.error }));
      return;
    }
    try {
      const data = await uploadToStorage(file, "edits");
      setFormData(prev => ({
        ...prev,
        documents: { ...prev.documents, [docId]: data.url }
      }));
      setErrors(prev => ({ ...prev, [docId]: null }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [docId]: "Failed to upload document: " + (err.message || "") }));
    }
  };

  const handleRemoveDocument = (docId) => {
    if (docId === 'picture') return handleRemovePhoto();
    if (docId === 'passport') return handleRemoveID();

    setFormData(prev => {
      const newDocs = { ...prev.documents };
      delete newDocs[docId];
      return { ...prev, documents: newDocs };
    });
  };

  const toggleZone = (zoneCode) => {
    setFormData(prev => {
      const current = prev.zoneCodes;
      if (current.includes(zoneCode)) {
        return { ...prev, zoneCodes: current.filter(z => z !== zoneCode) };
      } else {
        return { ...prev, zoneCodes: [...current, zoneCode] };
      }
    });
  };

  const selectAllZones = (zoneList) => {
    const list = Array.isArray(zoneList) ? zoneList : zones;
    setFormData(prev => ({ ...prev, zoneCodes: list.map(z => z.code) }));
  };

  const clearAllZones = () => {
    setFormData(prev => ({ ...prev, zoneCodes: [] }));
  };

  const getAge = () => {
    if (!formData.dateOfBirth || !currentEvent?.ageCalculationYear) return null;
    const dob = new Date(formData.dateOfBirth);
    const calcDate = new Date(currentEvent.ageCalculationYear, 11, 31);
    const age = Math.floor((calcDate - dob) / (365.25 * 24 * 60 * 60 * 1000));
    return age;
  };

  const getPreviewBadgePrefix = (role) => {
    if (eventCategories && eventCategories.length > 0) {
      const catData = eventCategories.find(cat => {
        const cd = cat.category || cat;
        return (cd?.name || cat?.name) === role;
      });
      if (catData) {
        const cd = catData.category || catData;
        return getBadgePrefix(role, cd?.badgePrefix || null);
      }
    }
    return getBadgePrefix(role);
  };

  const isAthlete = formData.role?.toLowerCase()?.includes("athlete");
  const age = getAge();
  const isApproved = accreditation?.status === "approved";
  const roleChanged = isApproved && formData.role && formData.role !== originalRole;
  const newBadgePrefix = roleChanged ? getPreviewBadgePrefix(formData.role) : null;

  const handleSubmit = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (expiryMode === "custom" && !customExpiryDate) {
      newErrors.expiryDate = "Please select a date or choose No expiration";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    let expiresAt = null;
    if (expiryMode === "event" && currentEvent?.endDate) {
      expiresAt = new Date(currentEvent.endDate + "T23:59:00").toISOString();
    } else if (expiryMode === "custom" && customExpiryDate) {
      expiresAt = new Date(customExpiryDate + "T23:59:00").toISOString();
    }
    onSave({
      ...formData,
      eidUrl: formData.documents?.eid || null,
      medicalUrl: formData.documents?.medical || null,
      expiresAt: expiresAt,
      zoneCode: formData.zoneCodes.join(","),
      selectedSports: formData.selectedSports,
      customFields: formData.customFields,
      roleChanged,
      originalRole
    });
  };

  const roleOptions = getRoleOptions();
  const isKnownRole = roleOptions.some(o => o.value === formData.role);
  const selectValue = customRoleMode || (!isKnownRole && formData.role !== "") ? "__custom__" : formData.role;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={accreditation ? "Edit Accreditation" : "Add Accreditation"} size="lg">
      <div id="edit-accreditation-modal" className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        <div className="text-lg text-slate-400 font-extralight">
          {accreditation ? (
            <>
              Editing accreditation for{" "}
              <span className="text-cyan-400 font-medium">
                {accreditation.firstName} {accreditation.lastName}
              </span>
            </>
          ) : (
            "Create a new accreditation record"
          )}
          {isApproved && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-lg rounded border border-emerald-500/30">
              Approved
            </span>
          )}
        </div>

        {isApproved && accreditation?.badgeNumber && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div>
              <p className="text-lg text-slate-300 font-extralight">
                Current Badge: <span className="font-mono text-cyan-300 font-medium">{accreditation.badgeNumber}</span>
                {accreditation.accreditationId && (
                  <span className="ml-3 text-slate-500">ID: {accreditation.accreditationId}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {roleChanged && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-lg text-amber-300 font-medium">Badge Number Will Be Updated</p>
              <p className="text-lg text-amber-400 font-extralight mt-1">
                Changing role from <span className="font-medium">{originalRole}</span> to{" "}
                <span className="font-medium">{formData.role}</span> will assign a new badge number
                with prefix <span className="font-mono font-medium">{newBadgePrefix}-XXX</span>.
              </p>
            </div>
          </div>
        )}

        {/* Photo Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Personal Information</h3>
          <div className="flex items-start gap-4">
            <div className="relative">
              {formData.photoUrl ? (
                <div className="w-32 h-40 rounded-lg overflow-hidden border-2 border-primary-500/30 relative group">
                  <img
                    src={formData.photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-lg rounded-lg flex items-center gap-1.5 transition-colors">
                      <Camera className="w-4 h-4" />
                      Change
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-lg rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-40 rounded-lg bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
                  <User className="w-10 h-10 text-white/70" />
                </div>
              )}
            </div>
            <div className="flex-1">
              {formData.photoUrl ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Photo Uploaded</span>
                  </div>
                  <p className="text-lg text-slate-400 font-extralight">
                    Hover over the image to change or remove it
                  </p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-lg text-slate-400">Upload Photo</span>
                  <span className="text-lg text-slate-500 mt-1">JPEG, PNG - Max 5MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
              {errors.photoUrl && (
                <p className="text-lg text-red-400 mt-2">{errors.photoUrl}</p>
              )}
            </div>
          </div>
        </div>

        {/* Required Documents Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(() => {
            const role = formData.role;
            const catData = eventCategories.find(c => {
              const cd = c.category || c;
              return (cd?.name || c?.name) === role;
            });
            // APX-Fix: use .id (the correct mapped field), not .category_id
            const catId = catData?.id || catData?.category?.id || role;
            const categorySpecificDocs = categoryDocuments[catId];
            
            let docs = categorySpecificDocs || currentEvent?.requiredDocuments || [
              { id: "picture", label: "Picture", format: "JPEG, PNG, WEBP" },
              { id: "passport", label: "Passport", format: "JPEG, PNG, WEBP, PDF" }
            ];

            return docs
              .map(doc => {
                const docId = typeof doc === 'string' ? doc : doc.id;
                const docLabel = (typeof doc === 'object' ? doc.label : null) || docId;
                
                // Don't show picture here as it's handled in the top section
                // We check ID (picture/photo) and Label (Picture/Photo) 
                if (
                  docId.toLowerCase() === 'picture' || 
                  docId.toLowerCase() === 'photo' || 
                  docLabel.toLowerCase() === 'picture' || 
                  docLabel.toLowerCase() === 'photo'
                ) return null;


                const eventDoc = (currentEvent?.requiredDocuments || []).find(d => d.id === docId);
                const label = (typeof doc === 'object' ? doc.label : null) || eventDoc?.label || (docId ? docId.charAt(0).toUpperCase() + docId.slice(1) : "Document");
                
                const isPassport = docId === 'passport';
                // APX-Fix: check documents map first, then fall back to dedicated fields
                const url = isPassport
                  ? (formData.idDocumentUrl || formData.documents['passport'])
                  : (formData.documents[docId] || null);
                const error = isPassport ? errors.idDocumentUrl : errors[docId];
                const handleUpload = (e) => handleDocumentUpload(e, docId);
                const handleRemove = () => handleRemoveDocument(docId);

                return (
                  <div key={docId} className="space-y-3">
                    <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">{label}</h3>
                    <div className="flex flex-col gap-4">
                      <div className="relative mx-auto">
                        {url ? (
                          <div className="w-32 h-40 rounded-lg bg-slate-800 border-2 border-primary-500/30 flex items-center justify-center relative group overflow-hidden">
                            {url.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-12 h-12 text-primary-400 opacity-50" />
                            ) : (
                              <img src={url} alt={label} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 px-2">
                              <label className="w-full cursor-pointer px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                                <Upload className="w-4 h-4" /> Change
                                <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
                              </label>
                              <div className="flex gap-2 w-full">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center transition-colors"><Eye className="w-4 h-4" /></a>
                                <button type="button" onClick={handleRemove} className="flex-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="w-32 h-40 rounded-lg bg-slate-800 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 cursor-pointer hover:border-primary-500/50 transition-colors">
                            <FileText className="w-10 h-10 text-slate-600 mb-2" />
                            <span className="text-xs text-slate-500">Upload {label}</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
                          </label>
                        )}
                      </div>
                      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                    </div>
                  </div>
                );
              })
              .filter(Boolean);
          })()}

        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            error={errors.firstName}
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            error={errors.lastName}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" }
            ]}
          />
          <Input
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
          />
        </div>

        <div className="relative z-[100]">
          <SearchableSelect
            label="Nationality"
            value={formData.nationality}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, nationality: e.target.value }));
              if (errors.nationality) setErrors(prev => ({ ...prev, nationality: null }));
            }}
            options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
            placeholder="Select nationality"
          />
        </div>

        {isAthlete && age !== null && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <p className="text-lg text-cyan-400 font-extralight">
              <span className="font-medium">Age:</span> {age} years
              {currentEvent?.ageCalculationYear && (
                <span className="text-slate-500 ml-2">(calculated as of Dec 31, {currentEvent.ageCalculationYear})</span>
              )}
            </p>
          </div>
        )}

        {/* Role / Category Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Role / Category</h3>
          <Select
            label="Role *"
            name="role"
            value={selectValue}
            onChange={handleRoleChange}
            options={[...roleOptions, { value: "__custom__", label: "Other / Enter manually..." }]}
            placeholder="Select a category"
            required
          />
          {(customRoleMode || (!isKnownRole && formData.role !== "")) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-lg font-medium text-slate-300">Custom Role Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="Enter role title..."
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomRoleMode(false);
                      setFormData(prev => ({ ...prev, role: "" }));
                    }}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-700/50 pt-3">
                <label className="block text-lg font-medium text-slate-300">Custom Role Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg shadow-inner overflow-hidden flex-shrink-0 border border-slate-600">
                    <input
                      type="color"
                      value={formData.badgeColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, badgeColor: e.target.value }))}
                      className="w-16 h-16 -ml-3 -mt-3 cursor-pointer"
                      title="Choose Custom Color"
                    />
                  </div>
                  <div className="block">
                    <input
                      type="text"
                      value={formData.badgeColor.toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          setFormData(prev => ({ ...prev, badgeColor: val }));
                        }
                      }}
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-white text-base focus:outline-none focus:border-cyan-500 font-mono w-28 uppercase"
                      maxLength={7}
                      placeholder="#HEX"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 ml-2">
                    {["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea", "#0891b2", "#ea580c"].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, badgeColor: preset }))}
                        className="w-6 h-6 rounded border border-slate-600 hover:scale-110 transition-transform shadow-sm"
                        style={{ backgroundColor: preset }}
                        title={`Quick Preset: ${preset}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-lg text-cyan-400 font-extralight mt-1">
                  Select a specific color for this manual role to override the default hue.
                </p>
              </div>
            </div>
          )}
          {eventCategories && eventCategories.length > 0 ? (
            <p className="text-lg text-emerald-400 font-extralight">
              {roleOptions.length} categories available from event settings
            </p>
          ) : (
            <p className="text-lg text-amber-400 font-extralight">
              Using default categories (no custom categories defined for this event)
            </p>
          )}
        </div>

        {/* Affiliation Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Affiliation</h3>
          {clubs && clubs.length > 0 ? (
            <div className="relative z-[80]">
              <SearchableSelect
                label="Organization / Club / Academy"
                value={formData.club}
                onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                options={clubs.map(c => {
                  const name = typeof c === 'string' ? c : (c?.full || c?.short);
                  return name ? { value: name, label: name } : null;
                }).filter(Boolean)}
                placeholder="Search and select club..."
              />
            </div>
          ) : (
            <Input
              label="Organization / Club / Academy"
              name="club"
              value={formData.club}
              onChange={handleInputChange}
              placeholder="Enter club or organization name"
            />
          )}

          {/* Dynamic Custom Fields Section */}
          {customFieldsConfig.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-700/50">
              <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Additional Event Data
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFieldsConfig.map(cfg => {
                  const value = formData.customFields[cfg.id] || "";
                  const label = cfg.label_en || cfg.label || cfg.id;
                  
                  if (cfg.type === "select" && cfg.options) {
                    return (
                      <Select
                        key={cfg.id}
                        label={label}
                        value={value}
                        onChange={(e) => handleCustomFieldChange(cfg.id, e.target.value)}
                        options={cfg.options.split(",").map(opt => ({ value: opt.trim(), label: opt.trim() }))}
                        required={cfg.required}
                      />
                    );
                  }
                  
                  return (
                    <Input
                      key={cfg.id}
                      label={label}
                      value={value}
                      onChange={(e) => handleCustomFieldChange(cfg.id, e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}...`}
                      required={cfg.required}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Sports Section - Simplified for Athletes */}
          {isAthlete && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Participating Sports
              </h3>

              {/* Edit Selector (handles both display and editing) */}
              <div className="relative z-[70]">
                <MultiSearchableSelect
                  options={(currentEvent?.sportList || currentEvent?.sport_list || []).map(s => ({ value: s, label: s }))}
                  value={formData.selectedSports || []}
                  onChange={(val) => setFormData(prev => ({ ...prev, selectedSports: val }))}
                  placeholder="Select/change sport(s)"
                  light
                />
              </div>
            </div>
          )}
        </div>

        {/* Zone Access Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Zone Access</h3>
          {zones && zones.length > 0 ? (
            <ZoneAccessSelector
              zones={zones}
              selectedRole={formData.role}
              selectedCodes={formData.zoneCodes}
              onToggle={toggleZone}
              onSelectAll={selectAllZones}
              onClearAll={clearAllZones}
            />
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-lg text-amber-400 font-extralight">
                No zones defined for this event. Please add zones in the Zones settings first.
              </p>
            </div>
          )}
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
                type="button"
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

        {/* Contact Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Contact</h3>
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            error={errors.email}
            required
          />
        </div>

        {/* Expiry Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Accreditation Expiry</h3>
          <p className="text-lg text-slate-400 font-extralight">
            Control when this accreditation expires. Expired accreditations will show as EXPIRED on scans.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setExpiryMode("none")}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${expiryMode === "none"
                  ? "border-primary-500 bg-primary-500/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                }`}
            >
              <CalendarX className={`w-5 h-5 flex-shrink-0 ${expiryMode === "none" ? "text-primary-400" : "text-slate-500"}`} />
              <div className="flex-1">
                <p className={`text-lg font-medium ${expiryMode === "none" ? "text-white" : "text-slate-300"}`}>No expiration</p>
                <p className="text-lg text-slate-500 font-extralight">Accreditation never expires</p>
              </div>
              {expiryMode === "none" && <Check className="w-4 h-4 text-primary-400 ml-auto" />}
            </button>
            {currentEvent?.endDate && (
              <button
                type="button"
                onClick={() => setExpiryMode("event")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${expiryMode === "event"
                    ? "border-cyan-500 bg-cyan-500/20"
                    : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                  }`}
              >
                <Calendar className={`w-5 h-5 flex-shrink-0 ${expiryMode === "event" ? "text-cyan-400" : "text-slate-500"}`} />
                <div className="flex-1">
                  <p className={`text-lg font-medium ${expiryMode === "event" ? "text-white" : "text-slate-300"}`}>Expire on event end date</p>
                  <p className="text-lg text-slate-500 font-extralight">Expires: {currentEvent.endDate}</p>
                </div>
                {expiryMode === "event" && <Check className="w-4 h-4 text-cyan-400 ml-auto" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpiryMode("custom")}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${expiryMode === "custom"
                  ? "border-amber-500 bg-amber-500/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                }`}
            >
              <Clock className={`w-5 h-5 flex-shrink-0 ${expiryMode === "custom" ? "text-amber-400" : "text-slate-500"}`} />
              <div className="flex-1">
                <p className={`text-lg font-medium ${expiryMode === "custom" ? "text-white" : "text-slate-300"}`}>Custom expiry date</p>
                <p className="text-lg text-slate-500 font-extralight">Set a specific date</p>
              </div>
              {expiryMode === "custom" && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
            </button>
          </div>
          {expiryMode === "custom" && (
            <div className="mt-2">
              <Input
                label="Custom Expiry Date"
                type="date"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                error={errors.expiryDate}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
          >
            Cancel
          </Button>
          {accreditation && accreditation.status !== "approved" && (
            <Button
              variant="success"
              onClick={() => {
                const expiresAt = expiryMode === "event" && currentEvent?.endDate
                  ? new Date(currentEvent.endDate + "T23:59:00").toISOString()
                  : expiryMode === "custom" && customExpiryDate
                    ? new Date(customExpiryDate + "T23:59:00").toISOString()
                    : null;

                onApprove({
                  ...formData,
                  expiresAt,
                  zoneCode: formData.zoneCodes.join(","),
                  selectedSports: formData.selectedSports,
                  customFields: formData.customFields,
                  roleChanged,
                  pdfSize // Pass the selected PDF size
                });
              }}
              className="flex-1"
              icon={Check}
              loading={saving}
              disabled={saving || (accreditation && (currentTask?.id === accreditation.id || (queue && queue.some(t => t.id === accreditation.id))))}
            >
              {(accreditation && (currentTask?.id === accreditation.id || (queue && queue.some(t => t.id === accreditation.id)))) ? "PROCESSING..." : "Approve Accreditation"}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            loading={saving}
            disabled={saving || (accreditation && (currentTask?.id === accreditation.id || (queue && queue.some(t => t.id === accreditation.id))))}
          >
            {saving ? "Saving..." : (accreditation && (currentTask?.id === accreditation.id || (queue && queue.some(t => t.id === accreditation.id)))) ? "PROCESSING..." : accreditation ? (roleChanged ? "Save & Update Badge" : "Save Changes") : "Add Accreditation"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
