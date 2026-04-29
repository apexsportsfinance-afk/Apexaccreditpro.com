import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Shield,
  User,
  Mail,
  Flag,
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Waves,
  Droplets,
  Timer,
  AlertTriangle,
  Loader2,
  Search,
  X
} from "lucide-react";
import { Flag as FlagIcon, Mail as MailIcon, Upload as UploadIcon, Calendar, Search as SearchIcon, Loader2 as Loader2Icon, CheckCircle as CheckCircleIcon, Smartphone, User as UserIcon, Files } from "lucide-react";
import TermsModal from "../../components/TermsModal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import SearchableSelect from "../../components/ui/SearchableSelect";
import MultiSearchableSelect from "../../components/ui/MultiSearchableSelect";
import Modal from "../../components/ui/Modal";
import ThemeToggle from "../../components/ui/ThemeToggle";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { useTheme } from "../../contexts/ThemeContext";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../../lib/storage";
import { COUNTRIES, ROLES, validateFile, fileToBase64 } from "../../lib/utils";
import { SportEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { registerTranslations } from "../../lib/translations";

const DEFAULT_DOCUMENTS = [
  { id: "picture", label: "Picture", accept: "image/jpeg,image/png,image/webp" },
  { id: "passport", label: "Passport", accept: "image/jpeg,image/png,image/webp,application/pdf" },
  { id: "eid", label: "EID (Emirates ID)", accept: "image/jpeg,image/png,image/webp,application/pdf" },
  { id: "guardian_id", label: "Parent or Guardian ID", accept: "image/jpeg,image/png,image/webp,application/pdf" }
];

  function formatDateDisplay(dateStr) {
   if (!dateStr) return "";
   const parts = dateStr.split("-");
   if (parts.length === 3) {
     return `${parts[2]}/${parts[1]}/${parts[0]}`;
   }
   return dateStr;
 }

const COUNTRY_PHONE_CODES = [
  { code: "+971", country: "UAE" },
  { code: "+966", country: "KSA" },
  { code: "+965", country: "Kuwait" },
  { code: "+968", country: "Oman" },
  { code: "+974", country: "Qatar" },
  { code: "+973", country: "Bahrain" },
  { code: "+20", country: "Egypt" },
  { code: "+962", country: "Jordan" },
  { code: "+961", country: "Lebanon" },
  { code: "+44", country: "UK" },
  { code: "+1", country: "USA/Canada" },
  { code: "+91", country: "India" },
  { code: "+92", country: "Pakistan" },
  { code: "+63", country: "Philippines" },
];

const formatEmiratesID = (value) => {
  const digits = value.replace(/\D/g, "").substring(0, 15);
  let formatted = "";
  if (digits.length > 0) {
    formatted = digits.substring(0, 3);
    if (digits.length > 3) {
      formatted += "-" + digits.substring(3, 7);
      if (digits.length > 7) {
        formatted += "-" + digits.substring(7, 14);
        if (digits.length > 14) {
          formatted += "-" + digits.substring(14, 15);
        }
      }
    }
  }
  return formatted;
};

export default function Register() {
  const { slug } = useParams();
  const [language, setLanguage] = useState(localStorage.getItem("register_lang") || "en");
  
  const t = (key) => {
    // Check for label overrides from event config first
    if (labelOverrides && labelOverrides[key]) {
      return labelOverrides[key];
    }
    // Fallback to translations
    return registerTranslations[language]?.[key] || registerTranslations["en"]?.[key] || key;
  };

  const toggleLanguage = () => {
    const newLang = language === "en" ? "ar" : "en";
    setLanguage(newLang);
    localStorage.setItem("register_lang", newLang);
  };
  const [documentOptions, setDocumentOptions] = useState([]);
  const [globalCategories, setGlobalCategories] = useState([]); // Buffer for UUID-to-Name resolution
  const [event, setEvent] = useState(null);
  const [eventCategories, setEventCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [sportEvents, setSportEvents] = useState([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    club: "",
    role: "",
    email: "",
    countryCode: "+971",
    phone: "",
    showPhone: false,
    photo: null,
    idDocument: null,
    documents: {},
    sportName: "",
    selectedSports: [],
    customFields: {}
  });
  const [selectedSportEvents, setSelectedSportEvents] = useState([]);
  const [teamRoles, setTeamRoles] = useState(["athlete", "coach", "head coach", "team admin", "team doctor", "team manager", "team official", "team physiotherapist"]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [categoryAllowlist, setCategoryAllowlist] = useState({});
  const [categorySports, setCategorySports] = useState({});
  const [categoryDocuments, setCategoryDocuments] = useState({});
  const [categoryCustomFields, setCategoryCustomFields] = useState({});
  const [visibilityConfig, setVisibilityConfig] = useState({ affiliation: true, contact: true, documents: true, phone: "optional" });
  const [labelOverrides, setLabelOverrides] = useState({});

  useEffect(() => {
    const loadEvent = async () => {
      const eventData = await EventsAPI.getBySlug(slug);
      setEvent(eventData);
      if (eventData) {
        try {
          const eventCats = await EventCategoriesAPI.getByEventId(eventData.id);
          const allGlobalCats = await CategoriesAPI.getActive();
          setGlobalCategories(allGlobalCats || []);
          
          if (eventCats.length > 0) {
            setEventCategories(eventCats.map(ec => ec.category).filter(Boolean));
          } else {
            setEventCategories(allGlobalCats || []);
          }
          
          // Identify Team roles based on parentId or names
          try {
            const allCategories = await CategoriesAPI.getAll();
            const teamParent = allCategories.find(c => c.name.toLowerCase() === "team");
            if (teamParent) {
              const children = allCategories.filter(c => c.parentId === teamParent.id);
              if (children.length > 0) {
                setTeamRoles(children.map(c => c.name.toLowerCase()));
              }
            }
          } catch (err) {
            console.warn("Failed to dynamically identify team roles, using defaults", err);
          }
        } catch (err) {
          console.error("Failed to load categories:", err);
          setEventCategories([]);
        }
        try {
          const evs = await SportEventsAPI.getByEventId(eventData.id);
          setSportEvents(evs);
        } catch { /* silent */ }
      // Fetch standard club list for dropdown
      try {
        const clubData = await GlobalSettingsAPI.getClubs(eventData.id);
        setClubs(clubData);
      } catch (err) {
        console.error("Failed to load clubs:", err);
        setClubs([]);
      }
      // Fetch dynamic category allowlist restrictions
      try {
        const allowlistRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_allowlist`);
        if (allowlistRaw) {
          setCategoryAllowlist(typeof allowlistRaw === 'string' ? JSON.parse(allowlistRaw) : allowlistRaw);
        }
      } catch (err) {
        console.error("Failed to load allowlist:", err);
      }
      
      // Fetch dynamic category sports restrictions
      try {
        const sportsRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_sports`);
        if (sportsRaw) {
          setCategorySports(typeof sportsRaw === 'string' ? JSON.parse(sportsRaw) : sportsRaw);
        }
      } catch (err) {
        console.error("Failed to load category sports:", err);
      }

      // Fetch dynamic category documents restrictions
      try {
        const docsRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_documents`);
        if (docsRaw) {
          setCategoryDocuments(typeof docsRaw === 'string' ? JSON.parse(docsRaw) : docsRaw);
        }
      } catch (err) {
        console.error("Failed to load category documents:", err);
      }

      // Fetch dynamic category custom fields allocations
      try {
        const fieldsRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_custom_fields`);
        if (fieldsRaw) {
          setCategoryCustomFields(typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw);
        }
      } catch (err) {
        console.error("Failed to load category custom fields:", err);
      }

      // Fetch event sport category
      try {
        const sportRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_sport`);
        if (sportRaw) {
          try {
            const parsedSport = JSON.parse(sportRaw);
            eventData.sportList = Array.isArray(parsedSport) ? parsedSport : [parsedSport];
            eventData.sport = eventData.sportList.join(", ");
          } catch(e) {
            eventData.sportList = [sportRaw];
            eventData.sport = sportRaw;
          }
        }
      } catch (err) {
        console.error("Failed to load sport:", err);
      }

      // Load custom fields
      try {
        const val = await GlobalSettingsAPI.get(`event_${eventData.id}_custom_fields`);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) setCustomFieldsConfig(parsed);
        }
      } catch (e) {
        console.error("Failed to load custom fields config", e);
      }

      // Load visibility settings
      try {
        const val = await GlobalSettingsAPI.get(`event_${eventData.id}_visibility`);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') setVisibilityConfig(parsed);
        }
      } catch (e) {
        console.error("Failed to load visibility settings", e);
      }

      // Load label overrides
      try {
        const val = await GlobalSettingsAPI.get(`event_${eventData.id}_label_overrides`);
        if (val) setLabelOverrides(JSON.parse(val));
      } catch (e) {
        console.error("Failed to load label overrides", e);
      }

      // Re-set event state with all properties including fetched ones
      setEvent({ ...eventData });
      
      // Removed auto-select sports logic per request
      }
      setLoading(false);
    };
    loadEvent();
  }, [slug]);

  const getRequiredDocuments = () => {
    const formatToAccept = (formatStr) => {
      if (!formatStr) return "image/jpeg,image/png,image/webp,application/pdf";
      const f = formatStr.toLowerCase();
      const types = [];
      if (f.includes("pdf")) types.push("application/pdf");
      if (f.includes("jpg") || f.includes("jpeg")) types.push("image/jpeg");
      if (f.includes("png")) types.push("image/png");
      if (f.includes("webp")) types.push("image/webp");
      return types.length > 0 ? types.join(",") : "image/jpeg,image/png,image/webp,application/pdf";
    };

    if (!event) return [DEFAULT_DOCUMENTS[0], DEFAULT_DOCUMENTS[1]];
    
    // Find the selected category object by name to get its ID (using robust normalized matching)
    const selectedCat = eventCategories.find(c => (c.name || '').trim().toLowerCase() === (formData.role || '').trim().toLowerCase());
    const catId = selectedCat ? selectedCat.id : null;
    
    let docs = event.requiredDocuments;
    
    // Try to find category-specific documents with multiple strategies
    if (categoryDocuments && formData.role) {
      let catDocs = null;
      const normalizedRole = formData.role.trim().toLowerCase();

      // Strategy 1: Look up by UUID (The primary key)
      if (catId && categoryDocuments[catId] && Array.isArray(categoryDocuments[catId]) && categoryDocuments[catId].length > 0) {
        catDocs = categoryDocuments[catId];
      }

      // Strategy 2: Look up by role name string directly (case-insensitive key match)
      if (!catDocs) {
        const nameMatchKey = Object.keys(categoryDocuments).find(k => k.trim().toLowerCase() === normalizedRole);
        if (nameMatchKey && Array.isArray(categoryDocuments[nameMatchKey]) && categoryDocuments[nameMatchKey].length > 0) {
          catDocs = categoryDocuments[nameMatchKey];
        }
      }

      // Strategy 3: Exhaustive search — check every key in docs config against eventCategories
      if (!catDocs) {
        for (const [key, value] of Object.entries(categoryDocuments)) {
          const matchingCat = eventCategories.find(c => 
            c.id === key || 
            (c.name || '').trim().toLowerCase() === key.trim().toLowerCase()
          );
          
          if (matchingCat && matchingCat.name.trim().toLowerCase() === normalizedRole && Array.isArray(value) && value.length > 0) {
            catDocs = value;
            break;
          }
        }
      }

      if (catDocs) {
        docs = catDocs;
      } else {
        // Log mismatch if still failing to help debug in browser console
        console.warn(`[Accreditation] No custom docs found for role "${formData.role}". CatID: ${catId}. Keys in categoryDocuments:`, Object.keys(categoryDocuments));
      }
    }

    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      return [DEFAULT_DOCUMENTS[0], DEFAULT_DOCUMENTS[1]];
    }
    
    // Create a master lookup from the event's primary documents list
    // This allows category-specific document list (which might only have IDs) to find their labels
    const masterDocs = event.requiredDocuments || [];

    return docs.map(doc => {
      // 1. If it's already an active rich object with a non-ID-looking label, use it
      if (typeof doc === 'object' && doc.label && !doc.label.startsWith('custom_')) {
         return {
          id: doc.id,
          label: doc.label,
          format: doc.format,
          accept: formatToAccept(doc.format)
        };
      }

      // 2. Identify the target ID
      const targetId = typeof doc === 'string' ? doc : doc.id;

      // 3. Find in master list (for custom documents defined in event settings)
      const masterFound = masterDocs.find(d => d.id === targetId);
      if (masterFound && masterFound.label) {
        return {
          id: targetId,
          label: masterFound.label,
          format: masterFound.format || "JPEG, PNG, PDF",
          accept: formatToAccept(masterFound.format)
        };
      }

      // 4. Find in DEFAULT_DOCUMENTS (Picture, Passport, etc.)
      const defaultFound = DEFAULT_DOCUMENTS.find(d => d.id === targetId);
      if (defaultFound) return defaultFound;

      // 5. Hard Fallback (Capitalize the ID)
      return { 
        id: targetId, 
        label: targetId.charAt(0).toUpperCase() + targetId.slice(1).replace(/_/g, ' '), 
        accept: "image/jpeg,image/png,image/webp,application/pdf" 
      };
    });

  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "role") {
      let newClub = "";
      
      const normalizedRole = (value || '').trim().toLowerCase();
      const selectedCat = eventCategories.find(c => (c.name || '').trim().toLowerCase() === normalizedRole);
      const catId = selectedCat ? selectedCat.id : null;
      
      // Auto-fill club explicitly handling robust lookups
      let restrictedOrgs = null;
      if (categoryAllowlist && normalizedRole) {
        if (catId && categoryAllowlist[catId]) restrictedOrgs = categoryAllowlist[catId];
        
        // Exhaustive fallback: Search all keys against global generic category names
        if (!restrictedOrgs) {
          for (const [key, value] of Object.entries(categoryAllowlist)) {
            const gCat = globalCategories.find(g => g.id === key);
            if (gCat && (gCat.name || '').trim().toLowerCase() === normalizedRole && Array.isArray(value) && value.length > 0) {
              restrictedOrgs = value;
              break;
            }
          }
        }
        
        if (!restrictedOrgs) {
          const exactKey = Object.keys(categoryAllowlist).find(k => k.trim().toLowerCase() === normalizedRole);
          if (exactKey) restrictedOrgs = categoryAllowlist[exactKey];
        }
      }
      if (restrictedOrgs && restrictedOrgs.length === 1) {
        newClub = restrictedOrgs[0];
      }
      
      // Auto-fill sports
      let restrictedSports = null;
      if (categorySports && normalizedRole) {
        if (catId && categorySports[catId]) restrictedSports = categorySports[catId];
        
        if (!restrictedSports) {
          for (const [key, value] of Object.entries(categorySports)) {
            const gCat = globalCategories.find(g => g.id === key);
            if (gCat && (gCat.name || '').trim().toLowerCase() === normalizedRole && Array.isArray(value) && value.length > 0) {
              restrictedSports = value;
              break;
            }
          }
        }
        
        if (!restrictedSports) {
          const exactKey = Object.keys(categorySports).find(k => k.trim().toLowerCase() === normalizedRole);
          if (exactKey) restrictedSports = categorySports[exactKey];
        }
      }
      let newSports = [];
      if (restrictedSports && restrictedSports.length === 1) {
        newSports = [restrictedSports[0]];
      } else if (event?.sportList && event.sportList.length === 1) {
        newSports = [event.sportList[0]];
      }

      setFormData((prev) => ({ ...prev, [name]: value, club: newClub, selectedSports: newSports }));
    } else if (name.startsWith("custom_")) {
      const fieldId = name.replace("custom_", "");
      let finalValue = value;
      
      // Auto-format Emirates ID custom fields
      const fieldConfig = customFieldsConfig.find(f => f.id === fieldId);
      const label = (language === 'ar' ? fieldConfig?.label_ar : fieldConfig?.label_en) || '';
      if (label.toLowerCase().includes("emirates id") || fieldId.toLowerCase().includes("eid") || fieldId.toLowerCase().includes("emirates_id")) {
        finalValue = formatEmiratesID(value);
      }

      setFormData((prev) => ({
        ...prev,
        customFields: { ...prev.customFields, [fieldId]: finalValue }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    
    if (name === "nationality") {
      setErrors((prev) => ({ ...prev, nationality: null }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (name === "firstName" || name === "lastName") {
      setDuplicateError(null);
    }
  };

  const handleFileChange = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, [field]: validation.error }));
      return;
    }

    setUploadingDocs(prev => ({...prev, [field]: true}));
    try {
      const data = await uploadToStorage(file, "registrations");
      
      setFormData((prev) => ({ ...prev, [field]: data.url }));
      setErrors((prev) => ({ ...prev, [field]: null }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [field]: "Failed to upload file. " + (err.message || "") }));
    } finally {
      setUploadingDocs(prev => ({...prev, [field]: false}));
    }
  };

  const handleDocumentFileChange = async (e, docId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, [`doc_${docId}`]: validation.error }));
      return;
    }

    setUploadingDocs(prev => ({...prev, [docId]: true}));
    try {
      const data = await uploadToStorage(file, "documents");

      setFormData((prev) => ({
        ...prev,
        documents: { ...prev.documents, [docId]: data.url }
      }));
      setErrors((prev) => ({ ...prev, [`doc_${docId}`]: null }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [`doc_${docId}`]: "Failed to upload file. " + (err.message || "") }));
    } finally {
      setUploadingDocs(prev => ({...prev, [docId]: false}));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.nationality) newErrors.nationality = "Nationality is required";
    
    // Conditional validation for Affiliation
    if (visibilityConfig.affiliation !== false) {
      if (!formData.club.trim()) newErrors.club = "Organization/Club/Academy is required";
      if (!formData.role) newErrors.role = "Role is required";
      
      const isTeamRole = formData.role && (teamRoles.includes(formData.role.toLowerCase()) || formData.role.toLowerCase().includes("athlete") || formData.role.toLowerCase().includes("coach"));
      const selectedCat = eventCategories.find(c => c.name === formData.role);
      const catId = selectedCat ? selectedCat.id : formData.role;
      const hasCategorySports = categorySports && categorySports[catId] && categorySports[catId].length > 0;

      if ((isTeamRole || hasCategorySports) && event?.sportList && event.sportList.length > 0 && (!formData.selectedSports || formData.selectedSports.length === 0)) {
        newErrors.sportName = "Sport selection is required";
      }
    }

    // Conditional validation for Contact
    if (visibilityConfig.contact !== false) {
      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
    }

    // Conditional validation for Documents
    if (visibilityConfig.documents !== false) {
      const reqDocs = getRequiredDocuments();
      reqDocs.forEach((doc) => {
        if (!formData.documents[doc.id]) {
          newErrors[`doc_${doc.id}`] = `${doc.label} is required`;
        }
      });
    }

    if (!termsAccepted) {
      newErrors.terms = "You must accept the terms and conditions";
    }

    // Validation for Custom Fields - ONLY validate fields visible to this role (APX-Fix)
    const visibleCustomFields = getFilteredCustomFields();
    visibleCustomFields.forEach(field => {
      if (field.required && !formData.customFields[field.id]) {
        newErrors[`custom_${field.id}`] = `${language === 'ar' ? field.label_ar : field.label_en} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getFilteredCustomFields = () => {
    if (!customFieldsConfig || customFieldsConfig.length === 0) return [];
    if (!formData.role) return []; // Opt-in: don't show fields until role is selected

    const normalizedRole = formData.role.trim().toLowerCase();
    const selectedCat = eventCategories.find(c => (c.name || '').trim().toLowerCase() === normalizedRole);
    const catId = selectedCat ? selectedCat.id : null;

    let allowedKeys = null;
    if (categoryCustomFields) {
      // 1. Match by ID
      if (catId && categoryCustomFields[catId]) {
        allowedKeys = categoryCustomFields[catId];
      }
      // 2. Match by Name
      if (!allowedKeys) {
        const nameMatchKey = Object.keys(categoryCustomFields).find(k => k.trim().toLowerCase() === normalizedRole);
        if (nameMatchKey) allowedKeys = categoryCustomFields[nameMatchKey];
      }
    }

    // If no config found for this role, default to showing NONE (per user request: opt-in)
    // "if i dont select any then it should not show any extra field"
    if (!allowedKeys || !Array.isArray(allowedKeys) || allowedKeys.length === 0) return [];

    return customFieldsConfig.filter(field => {
      // Check if the field itself is allowed
      return allowedKeys.includes(field.id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      // APX-UX: Scroll to first error
      setTimeout(() => {
        const firstError = document.querySelector('.text-red-500');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setSubmitting(true);
    setDuplicateError(null);
    try {
      const duplicateCheck = await AccreditationsAPI.checkDuplicate(
        event.id,
        formData.firstName,
        formData.lastName,
        formData.club,
        formData.dateOfBirth
      );
      if (duplicateCheck.isDuplicate) {
        setDuplicateError({
          message: `A registration with the name "${formData.firstName} ${formData.lastName}", organization "${formData.club}", and same date of birth already exists for this event.`,
          status: duplicateCheck.existingRecord?.status || "pending"
        });
        setSubmitting(false);
        return;
      }

      const requiredDocs = getRequiredDocuments();
      const firstDoc = requiredDocs[0];
      const secondDoc = requiredDocs[1];

      // APX-P0: Generate foolproof submission secret
      const submissionSecret = `apex_v1_${event.id?.substring(0, 8)}`;

      await AccreditationsAPI.create({
        eventId: event.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        nationality: formData.nationality,
        club: formData.club,
        role: formData.role,
        email: formData.email,
        phone: (visibilityConfig.phone === "visible" || (visibilityConfig.phone === "optional" && formData.showPhone)) ? `${formData.countryCode}${formData.phone}` : "",
        selectedSports: (formData.selectedSports && formData.selectedSports.length > 0) ? formData.selectedSports : (formData.sportName ? [formData.sportName] : []),
        // APX-Fix: Use actual document IDs from event config, not hardcoded 'picture'/'passport'
        photoUrl: (firstDoc ? formData.documents[firstDoc.id] : null) || formData.documents['picture'] || formData.photo,
        idDocumentUrl: (secondDoc ? formData.documents[secondDoc.id] : null) || formData.documents['passport'] || formData.idDocument,
        eidUrl: formData.documents['eid'] || null,
        medicalUrl: formData.documents['medical'] || formData.documents['guardian_id'] || null,
        documents: formData.documents, // APX: Pass all documents for storage.js mapping
        customFields: formData.customFields
      }, submissionSecret);
      setSubmitted(true);
    } catch (error) {
      console.error("Registration submission error:", error);
      if (error.message && error.message.includes("DUPLICATE_NAME")) {
        setDuplicateError({
          message: `An athlete named "${formData.firstName} ${formData.lastName}" has already registered for this event.`,
          status: "pending"
        });
      } else {
        // Surface the exact Supabase error for easier diagnosis
        const code = error.code ? ` [${error.code}]` : "";
        const hint = error.hint ? ` — ${error.hint}` : "";
        const detail = error.details ? ` (${error.details})` : "";
        const msg = error.message || "Unknown error";
        setErrors({
          submit: `Submission failed${code}: ${msg}${hint}${detail}`
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleOptions = () => {
    if (eventCategories.length > 0) {
      return eventCategories.map(cat => ({
        value: cat.name,
        label: cat.name
      }));
    }
    return ROLES.map((r) => ({ value: r, label: r }));
  };

  if (loading) {
    return (
      <SwimmingBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full shadow-lg shadow-cyan-500/20" />
              <Droplets className="absolute -top-2 -right-2 w-6 h-6 text-cyan-400 animate-bounce" />
            </div>
            <p className="text-lg text-cyan-600 mt-4">Loading event...</p>
          </div>
        </div>
      </SwimmingBackground>
    );
  }

  if (!event) {
    return (
      <SwimmingBackground>
        <div id="register_not-found" className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Event Not Found</h1>
            <p className="text-lg text-slate-500 mb-6">
              The registration link you followed is invalid or the event does not exist.
            </p>
            <Link to="/">
              <Button variant="secondary" icon={ArrowLeft}>
                Go Home
              </Button>
            </Link>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  if (!event.registrationOpen) {
    return (
      <SwimmingBackground>
        <div id="register_closed" className="min-h-screen flex items-center justify-center p-4 md:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-lg"
          >
            {/* Main Card */}
            <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-[2rem] shadow-[0_24px_80px_-16px_rgba(0,0,0,0.25)] overflow-hidden">
              <div className="p-6 md:p-10 text-center">
                {/* Badge Icon (Reduced size) */}
                <div className="mb-6 relative inline-block">
                  <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" />
                  <div className="relative w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 rotate-12">
                    <AlertCircle className="w-8 h-8 text-white -rotate-12" />
                  </div>
                </div>

                {/* Status Header */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[9px] font-black uppercase tracking-[0.2em] mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Registration: Closed
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase leading-none">
                  {t("registrationClosed")}
                </h1>
                
                <h2 className="text-lg md:text-xl font-bold text-primary-600 mb-6 tracking-tight uppercase opacity-90">
                  {event.name}
                </h2>

                <div className="relative max-h-[40vh] overflow-y-auto scrollbar-hide">
                  {event.registrationClosedMessage ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-7 text-left">
                      <div className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                        {event.registrationClosedMessage}
                      </div>
                    </div>
                  ) : (
                    <p className="text-base text-slate-500 font-medium italic">
                      {language === "ar" ? "يرجى الاتصال بمنظمي الحدث للحصول على المساعدة." : "Please contact event organizers for assistance."}
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-slate-50/50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] items-center gap-1 font-black uppercase tracking-[0.3em] text-slate-400 flex">
                  <Shield className="w-3 h-3" />
                  Apex Sports
                </span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>

            {/* Bottom attribution */}
            <p className="mt-6 text-center text-white/30 text-[9px] font-black uppercase tracking-[0.4em]">
              Official Accreditation Portal
            </p>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  if (submitted) {
    return (
      <SwimmingBackground>
        <div id="register_success" className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md bg-base rounded-2xl p-8 shadow-2xl shadow-primary-500/10 border-2 border-border"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-6 relative shadow-lg shadow-emerald-500/30"
            >
              <CheckCircle className="w-10 h-10 text-white" />
              <Droplets className="absolute -top-2 -right-2 w-6 h-6 text-cyan-400 animate-bounce" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800 mb-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>{t("successTitle")}</h1>
            <p className="text-lg text-slate-600 mb-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {t("successDesc").replace("{event}", event.name)}
            </p>
            <div className="bg-white border-2 border-cyan-200 rounded-xl p-4 shadow-inner" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <p className="text-lg text-slate-500 mb-1">{language === 'ar' ? 'البريد الإلكتروني المرجعي' : 'Reference Email'}</p>
              <p className="text-xl font-mono text-slate-800 font-semibold">{formData.email}</p>
            </div>
            <div className="mt-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                {t("registerAnother")}
              </Button>
            </div>
            <div className="mt-6">
              <Link to="/">
                <Button variant="secondary" icon={ArrowLeft} className="w-full">
                  Return to Home
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  const requiredDocuments = getRequiredDocuments();

  return (
    <SwimmingBackground>
      <div id="register_page" className="min-h-screen relative py-8 px-4 text-main font-body">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-white font-bold transition-all flex items-center gap-2 shadow-lg"
          >
            {language === "en" ? "العربية" : "English"}
          </button>
          <ThemeToggle />
        </div>
        <div className="absolute top-20 right-10 opacity-20 pointer-events-none">
          <Droplets className="w-12 h-12 text-cyan-500 animate-bounce" style={{ animationDuration: "3s" }} />
        </div>
        <div className="absolute bottom-40 left-10 opacity-15 pointer-events-none">
          <Waves className="w-16 h-16 text-blue-400" />
        </div>
        <div className="absolute top-1/2 right-5 opacity-10 pointer-events-none">
          <Timer className="w-20 h-20 text-cyan-400" />
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {event.logoUrl ? (
              <div className="w-full max-w-[500px] mx-auto mb-8 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-cyan-300 shadow-2xl shadow-cyan-500/20 relative">
                <img
                  src={event.logoUrl}
                  alt="Event Logo"
                  className="w-full h-auto max-h-[200px] object-contain"
                />
                <Droplets className="absolute -top-4 -right-4 w-8 h-8 text-cyan-500 drop-shadow-lg" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-ocean-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30 relative overflow-hidden">
                <Shield className="w-12 h-12 text-white relative z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-cyan-300/40 to-transparent animate-pulse" />
              </div>
            )}

            <h1 className="text-3xl lg:text-4xl text-main font-black drop-shadow-sm mb-2 transition-colors">
              {event.name}
            </h1>
            <h2 className="text-xl lg:text-2xl text-cyan-100 font-bold drop-shadow-md">
              {t("formTitle")}
            </h2>
            <p className="text-lg text-white/90 mt-4 font-medium drop-shadow-md">
              {event.location} • {formatDateDisplay(event.startDate)} to {formatDateDisplay(event.endDate)}
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            noValidate
            dir={language === "ar" ? "rtl" : "ltr"}
            className={`bg-white light-form border border-border/50 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl relative overflow-hidden transition-colors ${language === "ar" ? "font-arabic" : ""}`}
          >
            <div className={`absolute top-0 ${language === "ar" ? "right-1/3" : "left-1/3"} w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/20 to-cyan-200/0 pointer-events-none`} />
            <div className={`absolute top-0 ${language === "ar" ? "left-1/3" : "right-1/3"} w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/20 to-cyan-200/0 pointer-events-none`} />

            {duplicateError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl relative z-10"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-lg font-semibold text-amber-700">Duplicate Registration Detected</p>
                    <p className="text-lg text-amber-600 mt-1">{duplicateError.message}</p>
                    <p className="text-lg text-amber-500 mt-2">
                      Status: <span className="font-semibold capitalize">{duplicateError.status}</span>
                    </p>
                    <p className="text-lg text-amber-500 mt-1">
                      If this is not you, please use a different name or contact the event organizers.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="space-y-4 relative z-[100]">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <User className={`${language === "ar" ? "ml-2" : ""}`} />
                {t("personalInfo")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t("firstName")}
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  error={errors.firstName}
                  required
                  placeholder={t("placeholderFirstName")}
                  light
                />
                <Input
                  label={t("lastName")}
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  error={errors.lastName}
                  required
                  placeholder={t("placeholderLastName")}
                  light
                />
                <Select
                  label={t("gender")}
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  error={errors.gender}
                  required
                  light
                  placeholder={t("placeholderGender")}
                  options={[
                    { value: "Male", label: t("male") },
                    { value: "Female", label: t("female") }
                  ]}
                />
                <Input
                  label={t("dateOfBirth")}
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  error={errors.dateOfBirth}
                  required
                  light
                />
              </div>
 
              <div className="relative z-[70]">
                <SearchableSelect
                  label={t("nationality")}
                  value={formData.nationality}
                  onChange={(e) => handleInputChange({ target: { name: "nationality", value: e.target.value } })}
                  error={errors.nationality}
                  required
                  options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                  placeholder={t("placeholderNationality")}
                  light
                  className="relative"
                />
              </div>
            </div>
              {/* Affiliation Information */}
              {visibilityConfig.affiliation !== false && (
                <div className="space-y-4 relative z-[90]">
                  <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                    <Flag className={`${language === "ar" ? "ml-2" : ""}`} />
                    {t("affiliation_info")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={`block text-sm font-semibold text-cyan-700 ${language === "ar" ? "text-right" : ""}`}>
                        {t("category_role")} <span className="text-red-500">*</span>
                      </label>
                      <Select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        error={errors.role}
                        options={getRoleOptions()}
                        placeholder={t("select_role")}
                        light
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="relative z-[80]">
                {(() => {
                  const normalizedRole = (formData.role || '').trim().toLowerCase();
                  const selectedCat = eventCategories.find(c => (c.name || '').trim().toLowerCase() === normalizedRole);
                  const catId = selectedCat ? selectedCat.id : null;
                  
                  let restrictedOrgs = null;
                  if (categoryAllowlist && normalizedRole) {
                    if (catId && categoryAllowlist[catId]) restrictedOrgs = categoryAllowlist[catId];
                    
                    if (!restrictedOrgs) {
                      for (const [key, value] of Object.entries(categoryAllowlist)) {
                        const gCat = globalCategories.find(g => g.id === key);
                        if (gCat && (gCat.name || '').trim().toLowerCase() === normalizedRole && Array.isArray(value) && value.length > 0) {
                          restrictedOrgs = value;
                          break;
                        }
                      }
                    }
                    
                    if (!restrictedOrgs) {
                      const exactKey = Object.keys(categoryAllowlist).find(k => k.trim().toLowerCase() === normalizedRole);
                      if (exactKey) restrictedOrgs = categoryAllowlist[exactKey];
                    }
                  }
                  
                  return (
                    <>
                      {(() => {
                        if (restrictedOrgs && restrictedOrgs.length > 0) {
                          if (restrictedOrgs.length === 1) {
                            return (
                              <Input
                                label="Organization/Club/Academy *"
                                name="club"
                                value={formData.club || restrictedOrgs[0]}
                                onChange={handleInputChange}
                                error={errors.club}
                                required
                                disabled
                                light
                              />
                            );
                          }
                          return (
                            <SearchableSelect
                              label="Organization/Club/Academy *"
                              value={formData.club}
                              onChange={(e) => handleInputChange({ target: { name: "club", value: e.target.value } })}
                              error={errors.club}
                              required
                              light
                              placeholder="Search and select..."
                              options={restrictedOrgs.map((c) => ({ value: c, label: c }))}
                            />
                          );
                        }
                        
                        if (formData.role && (teamRoles.includes(formData.role.toLowerCase()) || formData.role.toLowerCase().includes("athlete") || formData.role.toLowerCase().includes("coach")) && clubs.length > 0) {
                          return (
                            <SearchableSelect
                              label="Organization/Club/Academy *"
                              value={formData.club}
                              onChange={(e) => handleInputChange({ target: { name: "club", value: e.target.value } })}
                              error={errors.club}
                              required
                              options={clubs.map(c => {
                                const name = typeof c === 'string' ? c : (c?.full || c?.short);
                                return name ? { value: name, label: name } : null;
                              }).filter(Boolean)}
                              placeholder="Select organization, club or academy"
                              light
                            />
                          );
                        }

                        return (
                          <Input
                            label="Organization/Club/Academy"
                            name="club"
                            value={formData.club}
                            onChange={handleInputChange}
                            error={errors.club}
                            required
                            placeholder="Enter organization, club or academy"
                            light
                          />
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Participating Sport (Moved & Conditioned to Team roles) */}
              {(() => {
                const isTeamRole = formData.role && (teamRoles.includes(formData.role.toLowerCase()) || formData.role.toLowerCase().includes("athlete") || formData.role.toLowerCase().includes("coach"));
                
                const normalizedRole = (formData.role || '').trim().toLowerCase();
                const selectedCat = eventCategories.find(c => (c.name || '').trim().toLowerCase() === normalizedRole);
                const catId = selectedCat ? selectedCat.id : null;
                
                let restrictedSports = null;
                if (categorySports && normalizedRole) {
                  if (catId && categorySports[catId]) restrictedSports = categorySports[catId];
                  if (!restrictedSports) {
                    const exactKey = Object.keys(categorySports).find(k => k.trim().toLowerCase() === normalizedRole);
                    if (exactKey) restrictedSports = categorySports[exactKey];
                  }
                }

                if ((isTeamRole || (restrictedSports && restrictedSports.length > 0)) && event?.sportList && event.sportList.length > 0) {
                  const availableSports = restrictedSports && restrictedSports.length > 0 ? restrictedSports : event.sportList;
                  
                  if (availableSports.length === 1) {
                    return (
                      <div className="relative z-[70] space-y-2">
                        <Input
                          label="Participating Sports *"
                          name="sportName"
                          value={availableSports[0]}
                          onChange={() => {}}
                          disabled
                          light
                        />
                      </div>
                    );
                  }

                  return (
                    <div className="relative z-[70] space-y-2">
                      <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest px-1">{t("participatingSports")} *</label>
                      <MultiSearchableSelect
                        options={availableSports.map(s => ({ value: s, label: s }))}
                        value={formData.selectedSports || []}
                        onChange={(val) => setFormData(prev => ({ ...prev, selectedSports: val }))}
                        placeholder={t("placeholderSports")}
                        error={errors.sportName}
                        light
                      />
                      {errors.sportName && <p className="text-red-500 text-xs px-1">{errors.sportName}</p>}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Event Details section — shown only when Athlete role is selected and sport events exist */}
              {formData.role && formData.role.toLowerCase().includes("athlete") && sportEvents.length > 0 && (
                <div className="relative z-[60]">
                  <EventScheduleDropdown
                    sportEvents={sportEvents}
                    selectedSportEvents={selectedSportEvents}
                    setSelectedSportEvents={setSelectedSportEvents}
                  />
                </div>
              )}

              {/* Custom Fields */}
              {(() => {
                const filteredFields = getFilteredCustomFields();
                if (filteredFields.length === 0) return null;

                return (
                  <div className="space-y-4 relative z-[50]">
                    <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                      <Files className="w-6 h-6" />
                      Additional Information
                    </h2>
                    {filteredFields.map((field, idx) => (
                      <div key={idx} className="space-y-4">
                        {field.type === 'select' ? (
                          <Select
                            label={language === "ar" ? field.label_ar : field.label_en}
                            name={`custom_${field.id}`}
                            value={formData.customFields[field.id] || ""}
                            onChange={handleInputChange}
                            error={errors[`custom_${field.id}`]}
                            required={field.required}
                            light
                            placeholder={language === "ar" ? "اختر خياراً..." : "Select an option..."}
                            options={(() => {
                              let opts = [];
                              if (Array.isArray(field.options)) {
                                opts = field.options;
                              } else if (typeof field.options === 'string') {
                                opts = field.options.split(",").map(o => o.trim()).filter(Boolean);
                              }
                              return opts.map(opt => ({ 
                                value: typeof opt === 'string' ? opt : (opt.value || opt.label || opt), 
                                label: typeof opt === 'string' ? opt : (opt.label || opt.value || opt)
                              }));
                            })()}
                          />
                        ) : (
                          <Input
                            label={language === "ar" ? field.label_ar : field.label_en}
                            name={`custom_${field.id}`}
                            value={formData.customFields[field.id] || ""}
                            onChange={handleInputChange}
                            error={errors[`custom_${field.id}`]}
                            required={field.required}
                            light
                            placeholder={language === "ar" ? "أدخل التفاصيل..." : "Enter details..."}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

            {/* Contact Details */}
            {visibilityConfig.contact !== false && (
              <div className="space-y-4 relative z-[40] border-t border-cyan-100 pt-6">
                <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                  <Mail className={`${language === "ar" ? "ml-2" : ""}`} />
                  {t("contact_details")}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-6">
                  <div className="flex flex-col h-full">
                    <Input
                      label={t("email")}
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      error={errors.email}
                      placeholder="e.g., example@domain.com"
                      icon={Mail}
                      required
                      light
                    />
                  </div>

                  {/* Phone Input Logic based on Admin Visibility Setting */}
                  {visibilityConfig.phone === "visible" ? (
                    /* Always Show Mode */
                    <div className="flex flex-col h-full space-y-1.5">
                      <label className={`block text-lg font-medium text-slate-700 mb-1.5 ${language === "ar" ? "text-right" : ""}`}>
                        {t("phone")}
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="countryCode"
                          value={formData.countryCode}
                          onChange={handleInputChange}
                          className="w-24 px-3 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all outline-none font-medium"
                        >
                          {COUNTRY_PHONE_CODES.map(c => (
                            <option key={c.code} value={c.code}>{c.code} ({c.country})</option>
                          ))}
                        </select>
                        <div className="flex-1 relative">
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className={`w-full px-4 py-3 pl-11 rounded-xl border-2 transition-all outline-none text-slate-700 font-medium bg-white border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10`}
                            placeholder="50 123 4567"
                          />
                          <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                      {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    </div>
                  ) : visibilityConfig.phone === "optional" || !visibilityConfig.phone ? (
                    /* User Switch (Optional) Mode */
                    <>
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border-2 border-slate-100 hover:border-cyan-100 transition-colors cursor-pointer group">
                        <input
                          type="checkbox"
                          id="showPhone"
                          name="showPhone"
                          checked={formData.showPhone}
                          onChange={(e) => setFormData(prev => ({ ...prev, showPhone: e.target.checked }))}
                          className="w-5 h-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <label htmlFor="showPhone" className="text-lg font-medium text-slate-700 cursor-pointer flex-1">
                          Include Phone Number / WhatsApp
                        </label>
                      </div>

                      {formData.showPhone && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="flex flex-col h-full space-y-1.5"
                        >
                          <label className={`block text-lg font-medium text-slate-700 mb-1.5 ${language === "ar" ? "text-right" : ""}`}>
                            {t("phone")}
                          </label>
                          <div className="flex gap-2">
                            <select
                              name="countryCode"
                              value={formData.countryCode}
                              onChange={handleInputChange}
                              className="w-24 px-3 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all outline-none font-medium"
                            >
                              {COUNTRY_PHONE_CODES.map(c => (
                                <option key={c.code} value={c.code}>{c.code} ({c.country})</option>
                              ))}
                            </select>
                            <div className="flex-1 relative">
                              <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className={`w-full px-4 py-3 pl-11 rounded-xl border-2 transition-all outline-none text-slate-700 font-medium bg-white border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10`}
                                placeholder="50 123 4567"
                              />
                              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            </div>
                          </div>
                          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </motion.div>
                      )}
                    </>
                  ) : null /* Hidden Mode */}
                </div>
                </div>
              </div>
            )}

            {/* Document Upload */}
            {visibilityConfig.documents !== false && (
              <div className="space-y-4 relative z-[30] border-t border-cyan-100 pt-6">
                <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                  <Upload className={`${language === "ar" ? "ml-2" : ""}`} />
                  {t("documents")}
                </h2>

                <div className="space-y-4">
                  {getRequiredDocuments().map((doc) => (
                    <div key={doc.id}>
                      <label className="block text-lg font-medium text-slate-700 mb-1.5">
                        {doc.label} ({doc.format || (doc.accept.includes("pdf") ? "JPEG, PNG, PDF" : "JPEG, PNG")} - Max 5MB)
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept={doc.accept}
                          onChange={(e) => handleDocumentFileChange(e, doc.id)}
                          className="w-full text-lg text-slate-600 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-lg file:font-medium file:bg-gradient-to-r file:from-cyan-500 file:to-blue-600 file:text-white hover:file:from-cyan-600 hover:file:to-blue-700 file:cursor-pointer cursor-pointer py-2"
                        />
                      </div>
                      {uploadingDocs[doc.id] && (
                        <p className="text-lg text-amber-500 mt-1 flex items-center gap-1">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                        </p>
                      )}
                      {errors[`doc_${doc.id}`] && (
                        <p className="text-lg text-red-500 mt-1">{errors[`doc_${doc.id}`]}</p>
                      )}
                      {formData.documents[doc.id] && (
                        <p className="text-lg text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> {doc.label} uploaded
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200 relative z-10">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked && errors.terms) {
                    setErrors((prev) => ({ ...prev, terms: null }));
                  }
                }}
                className={`mt-1.5 w-6 h-6 rounded border-cyan-300 bg-white text-cyan-500 focus:ring-cyan-400/50 ${!hasViewedTerms ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                disabled={!hasViewedTerms}
              />
              <div>
                <label htmlFor="terms" className={`text-lg transition-colors ${!hasViewedTerms ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'} block`}>
                  {t("termsConfirm")}{" "}
                  <button
                    type="button"
                    onClick={() => setTermsModalOpen(true)}
                    className="text-cyan-600 hover:text-cyan-500 underline font-medium"
                  >
                    {t("termsLink")}
                  </button>
                  {!hasViewedTerms && <span className="text-sm text-cyan-600 ml-2 animate-pulse">({t("termsUnlock")})</span>}
                </label>
                {errors.terms && (
                  <p className="text-lg text-red-500 mt-1">{errors.terms}</p>
                )}
              </div>
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg relative z-[1]">
                <p className="text-lg text-red-600">{errors.submit}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25 relative z-[1] min-h-[52px]"
              size="lg"
              loading={submitting}
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </motion.form>
        </div>

        <TermsModal
          isOpen={termsModalOpen}
          onClose={() => setTermsModalOpen(false)}
          onAccept={() => setHasViewedTerms(true)}
          content={event?.termsAndConditions}
        />
      </div>
    </SwimmingBackground>
  );
}

/* ─── Event Schedule Searchable Dropdown ───────────────────── */
function EventScheduleDropdown({ sportEvents, selectedSportEvents, setSelectedSportEvents }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = sportEvents.filter(ev =>
    ev.eventName.toLowerCase().includes(search.toLowerCase()) ||
    (ev.eventCode && ev.eventCode.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleEvent = (ev) => {
    const isSelected = selectedSportEvents.some(s => s.eventCode === ev.eventCode);
    setSelectedSportEvents(prev =>
      isSelected
        ? prev.filter(s => s.eventCode !== ev.eventCode)
        : [...prev, ev]
    );
  };

  return (
    <div className="space-y-3 relative z-[1]">
      <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-primary-500" />
        Event Schedule
      </h2>
      <p className="text-lg text-muted font-extralight">
        Select the events you want to participate in:
      </p>

      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border-2 border-border bg-base text-left flex items-center justify-between transition-all hover:border-primary-500/50 focus:ring-2 focus:ring-primary-500/30"
      >
        <span className="text-main font-medium text-lg">
          {selectedSportEvents.length > 0
            ? `${selectedSportEvents.length} event${selectedSportEvents.length !== 1 ? "s" : ""} selected`
            : "Tap to select events"
          }
        </span>
        <div className="flex items-center gap-2">
          {selectedSportEvents.length > 0 && (
            <span className="bg-primary-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
              {selectedSportEvents.length}
            </span>
          )}
          <svg className={`w-5 h-5 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="border-2 border-border rounded-xl bg-base overflow-hidden shadow-xl">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-base-alt">
            <Search className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-lg text-main placeholder-muted focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-1 text-muted hover:text-main">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Event List */}
          <div className="relative">
            <div className="max-h-52 overflow-y-auto overscroll-contain divide-y divide-border">
              {filtered.length > 0 ? filtered.map((ev, i) => {
                const isSelected = selectedSportEvents.some(s => s.eventCode === ev.eventCode);
                return (
                  <div
                    key={ev.id || i}
                    onClick={() => toggleEvent(ev)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-primary-500/10 ${
                      isSelected
                        ? "bg-primary-500/5"
                        : "hover:bg-base-alt"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary-500 bg-primary-500"
                        : "border-border bg-base"
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ev.eventCode && (
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">{ev.eventCode}</span>
                        )}
                        <span className={`text-lg truncate ${isSelected ? "text-primary-600 dark:text-primary-400 font-medium" : "text-main font-normal"}`}>
                          {ev.eventName}
                        </span>
                      </div>
                      {(ev.gender || ev.date) && (
                        <p className="text-sm text-muted mt-0.5">
                          {[ev.gender, ev.date].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="px-4 py-6 text-center text-muted text-lg">
                  No events matching "{search}"
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-base-alt flex items-center justify-between">
            <span className="text-sm text-muted">
              {filtered.length} event{filtered.length !== 1 ? "s" : ""} available
            </span>
            {selectedSportEvents.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSportEvents([])}
                className="text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Events Chips */}
      {selectedSportEvents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSportEvents.map(ev => (
            <span
              key={ev.eventCode}
              className="inline-flex items-center gap-1 bg-primary-500/10 text-primary-700 dark:text-primary-400 text-sm font-medium pl-3 pr-1.5 py-1.5 rounded-full border border-primary-500/20"
            >
              {ev.eventCode ? `${ev.eventCode} – ` : ""}{ev.eventName}
              <button
                type="button"
                onClick={() => toggleEvent(ev)}
                className="p-0.5 rounded-full hover:bg-primary-500/20 transition-colors ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
