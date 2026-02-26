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
  AlertTriangle
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Modal from "../../components/ui/Modal";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../../lib/storage";
import { COUNTRIES, ROLES, validateFile, fileToBase64 } from "../../lib/utils";

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

export default function Register() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [eventCategories, setEventCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    club: "",
    role: "",
    email: "",
    photo: null,
    idDocument: null,
    documents: {}
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);

  useEffect(() => {
    const loadEvent = async () => {
      const eventData = await EventsAPI.getBySlug(slug);
      setEvent(eventData);
      if (eventData) {
        try {
          const eventCats = await EventCategoriesAPI.getByEventId(eventData.id);
          if (eventCats.length > 0) {
            setEventCategories(eventCats.map(ec => ec.category).filter(Boolean));
          } else {
            const allCats = await CategoriesAPI.getActive();
            setEventCategories(allCats);
          }
        } catch (err) {
          console.error("Failed to load categories:", err);
          setEventCategories([]);
        }
      }
      setLoading(false);
    };
    loadEvent();
  }, [slug]);

  const getRequiredDocuments = () => {
    if (!event) return [DEFAULT_DOCUMENTS[0], DEFAULT_DOCUMENTS[1]];
    const docs = event.requiredDocuments;
    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      return [DEFAULT_DOCUMENTS[0], DEFAULT_DOCUMENTS[1]];
    }
    return DEFAULT_DOCUMENTS.filter(d => docs.includes(d.id));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    try {
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({ ...prev, [field]: base64 }));
      setErrors((prev) => ({ ...prev, [field]: null }));
    } catch {
      setErrors((prev) => ({ ...prev, [field]: "Failed to process file" }));
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

    try {
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({
        ...prev,
        documents: { ...prev.documents, [docId]: base64 }
      }));
      setErrors((prev) => ({ ...prev, [`doc_${docId}`]: null }));
    } catch {
      setErrors((prev) => ({ ...prev, [`doc_${docId}`]: "Failed to process file" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.nationality) newErrors.nationality = "Nationality is required";
    if (!formData.club.trim()) newErrors.club = "Organization/Club/Academy is required";
    if (!formData.role) newErrors.role = "Role is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!termsAccepted) {
      newErrors.terms = "You must accept the terms and conditions";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setDuplicateError(null);
    try {
      const duplicateCheck = await AccreditationsAPI.checkDuplicateName(
        event.id,
        formData.firstName,
        formData.lastName
      );
      if (duplicateCheck.isDuplicate) {
        setDuplicateError({
          message: `An athlete named "${formData.firstName} ${formData.lastName}" has already registered for this event.`,
          status: duplicateCheck.existingRecord?.status || "pending"
        });
        setSubmitting(false);
        return;
      }

      const requiredDocs = getRequiredDocuments();
      const firstDoc = requiredDocs[0];
      const secondDoc = requiredDocs[1];

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
        photoUrl: firstDoc ? (formData.documents[firstDoc.id] || formData.photo) : formData.photo,
        idDocumentUrl: secondDoc ? (formData.documents[secondDoc.id] || formData.idDocument) : formData.idDocument
      });
      setSubmitted(true);
    } catch (error) {
      if (error.message && error.message.includes("DUPLICATE_NAME")) {
        setDuplicateError({
          message: `An athlete named "${formData.firstName} ${formData.lastName}" has already registered for this event.`,
          status: "pending"
        });
      } else {
        setErrors({ submit: "Failed to submit registration. Please try again." });
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
        <div id="register_closed" className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Registration Closed</h1>
            <p className="text-lg text-slate-500 mb-4">
              Registration for {event.name} is currently closed.
            </p>
            <p className="text-lg text-slate-400">
              Please contact the event organizers for more information.
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
            className="text-center max-w-md bg-white rounded-2xl p-8 shadow-2xl shadow-cyan-500/30 border-2 border-cyan-200"
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
            <h1 className="text-2xl font-bold text-slate-800 mb-3">Registration Submitted!</h1>
            <p className="text-lg text-slate-600 mb-6">
              Your accreditation request for <span className="font-semibold text-cyan-700">{event.name}</span> has been submitted successfully.
              You will receive an email notification once your application is reviewed.
            </p>
            <div className="bg-white border-2 border-cyan-200 rounded-xl p-4 shadow-inner">
              <p className="text-lg text-slate-500 mb-1">Reference Email</p>
              <p className="text-xl font-mono text-slate-800 font-semibold">{formData.email}</p>
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
      <div id="register_page" className="min-h-screen relative py-8 px-4">
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

            <h1 className="text-2xl lg:text-3xl text-white font-bold drop-shadow-lg">
              Accreditation Registration Form
            </h1>
            <p className="text-xl text-white/90 mt-3 font-medium drop-shadow-md">
              {event.location} • {formatDateDisplay(event.startDate)} to {formatDateDisplay(event.endDate)}
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            noValidate
            className="bg-white/90 backdrop-blur-xl border border-cyan-300 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl shadow-cyan-500/30 relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/3 w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/20 to-cyan-200/0 pointer-events-none" />
            <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/20 to-cyan-200/0 pointer-events-none" />

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

            <div className="space-y-4 relative z-10">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <User className="w-6 h-6 text-cyan-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  error={errors.firstName}
                  required
                  placeholder="Enter first name"
                  light
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  error={errors.lastName}
                  required
                  placeholder="Enter last name"
                  light
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  error={errors.gender}
                  required
                  light
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
                  error={errors.dateOfBirth}
                  required
                  light
                />
              </div>
            </div>

            <div className="space-y-4 relative z-50">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <Flag className="w-6 h-6 text-cyan-600" />
                Affiliation
              </h2>

              {/* REORDERED: Category/Role first */}
              <Select
                label="Category/Role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                error={errors.role}
                required
                light
                options={getRoleOptions()}
              />

              {/* Organization/Club/Academy second */}
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

              {/* Nationality last - full width for emphasis */}
              <div className="relative z-[9999]">
                <SearchableSelect
                  label="Nationality"
                  value={formData.nationality}
                  onChange={(e) => handleInputChange({ target: { name: "nationality", value: e.target.value } })}
                  error={errors.nationality}
                  required
                  options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                  placeholder="Select your nationality"
                  light
                  className="relative z-[9999]"
                />
              </div>
            </div>

            <div className="space-y-4 relative z-[1]">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <Mail className="w-6 h-6 text-cyan-600" />
                Contact
              </h2>

              <Input
                label="Email Address (Personal / Coach / Club)"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={errors.email}
                required
                placeholder="your.email@example.com"
                light
              />
            </div>

            <div className="space-y-4 relative z-[1]">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <Upload className="w-6 h-6 text-cyan-600" />
                Documents
              </h2>

              <div className="space-y-4">
                {requiredDocuments.map((doc) => (
                  <div key={doc.id}>
                    <label className="block text-lg font-medium text-slate-700 mb-1.5">
                      {doc.label} (JPEG, PNG{doc.accept.includes("pdf") ? ", PDF" : ""} - Max 5MB)
                    </label>
                    <input
                      type="file"
                      accept={doc.accept}
                      onChange={(e) => handleDocumentFileChange(e, doc.id)}
                      className="w-full text-lg text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-lg file:font-medium file:bg-gradient-to-r file:from-cyan-500 file:to-blue-600 file:text-white hover:file:from-cyan-600 hover:file:to-blue-700"
                    />
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

            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200 relative z-[1]">
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
                className="mt-1.5 w-5 h-5 rounded border-cyan-300 bg-white text-cyan-500 focus:ring-cyan-400/50 cursor-pointer"
              />
              <div>
                <label htmlFor="terms" className="text-lg text-slate-700 cursor-pointer block">
                  I confirm that all information provided is accurate and I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setTermsModalOpen(true)}
                    className="text-cyan-600 hover:text-cyan-500 underline font-medium"
                  >
                    Terms and Conditions
                  </button>
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
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25 relative z-[1]"
              size="lg"
              loading={submitting}
            >
              Submit Registration
            </Button>
          </motion.form>
        </div>

        <Modal
          isOpen={termsModalOpen}
          onClose={() => setTermsModalOpen(false)}
          title="Terms and Conditions"
          light
        >
          <div className="p-6 space-y-4 text-slate-600">
            <p className="text-lg">
              1. By registering for this event, you certify that you are in good health and physically capable of participating in activities.
            </p>
            <p className="text-lg">
              2. You permit the use of your name and image in broadcasts, telecasts, and promotional materials related to the competition.
            </p>
            <p className="text-lg">
              3. The organizers are not liable for any personal injury or property loss during the event. Proper attire and safety equipment must be used.
            </p>
            <p className="text-lg">
              4. You agree to follow all rules, safety guidelines, and instructions provided by event officials.
            </p>
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setTermsModalOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      </div>
    </SwimmingBackground>
  );
}