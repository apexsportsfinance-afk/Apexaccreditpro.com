import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Shield, User, Mail, Flag, Upload,
  CheckCircle, AlertCircle, ArrowLeft, Waves,
  Droplets, Timer, AlertTriangle, Loader2, Lock, Clock
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Modal from "../../components/ui/Modal";
import TermsModal from "../../components/TermsModal";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import AccreditationCard from "../../components/accreditation/AccreditationCard";
import { supabase, supabaseUrl, supabaseAnonKey } from "../../lib/supabase";
import { EventsAPI, AccreditationsAPI, EventCategoriesAPI, CategoriesAPI } from "../../lib/storage";
import { COUNTRIES, ROLES, validateFile } from "../../lib/utils";
import { SportEventsAPI, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { validateInviteToken, incrementLinkUseCount } from "../../lib/inviteLinksApi";

const DEFAULT_DOCUMENTS = [
  { id: "picture", label: "Picture", accept: "image/jpeg,image/png,image/webp" },
  { id: "passport", label: "Passport", accept: "image/jpeg,image/png,image/webp,application/pdf" },
  { id: "eid", label: "EID (Emirates ID)", accept: "image/jpeg,image/png,image/webp,application/pdf" },
  { id: "guardian_id", label: "Parent or Guardian ID", accept: "image/jpeg,image/png,image/webp,application/pdf" }
];

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function InviteRegister() {
  const { eventSlug, token } = useParams();

  const [status, setStatus] = useState("loading"); // loading | valid | invalid | expired | exhausted | inactive | submitted
  const [invalidReason, setInvalidReason] = useState("");
  const [event, setEvent] = useState(null);
  const [accreditation, setAccreditation] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [eventCategories, setEventCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [sportEvents, setSportEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [categoryAllowlist, setCategoryAllowlist] = useState({});
  const [categoryDocuments, setCategoryDocuments] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [teamRoles, setTeamRoles] = useState(["athlete", "coach", "head coach", "team admin", "team doctor", "team manager", "team official", "team physiotherapist"]);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", gender: "", dateOfBirth: "",
    nationality: "", club: "", role: "", email: "", documents: {}
  });
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Load event by slug
        const eventData = await EventsAPI.getBySlug(eventSlug);
        if (!eventData) {
          setInvalidReason("Event not found.");
          setStatus("invalid");
          return;
        }
        setEvent(eventData);

        // Validate the token
        const result = await validateInviteToken(token, eventData.id);
        if (!result.valid) {
          setStatus(result.reason); // expired | limit_reached | inactive | invalid
          return;
        }

        if (result.link) {
          setFormData(prev => ({
            ...prev,
            role: result.link.role || prev.role,
            club: result.link.club || prev.club
          }));
        }
        setInviteLink(result.link);

        // Load categories, clubs, etc.
        try {
          const eventCats = await EventCategoriesAPI.getByEventId(eventData.id);
          if (eventCats.length > 0) {
            setEventCategories(eventCats.map(ec => ec.category).filter(Boolean));
          } else {
            const allCats = await CategoriesAPI.getActive();
            setEventCategories(allCats);
          }
          const allCategories = await CategoriesAPI.getAll();
          const teamParent = allCategories.find(c => c.name.toLowerCase() === "team");
          if (teamParent) {
            const children = allCategories.filter(c => c.parentId === teamParent.id);
            if (children.length > 0) setTeamRoles(children.map(c => c.name.toLowerCase()));
          }
        } catch { setEventCategories([]); }

        try {
          const evs = await SportEventsAPI.getByEventId(eventData.id);
          setSportEvents(evs);
        } catch { /* silent */ }

        try {
          const clubData = await GlobalSettingsAPI.getClubs(eventData.id);
          setClubs(clubData);
        } catch { setClubs([]); }

        try {
          const allowlistRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_allowlist`);
          if (allowlistRaw) setCategoryAllowlist(typeof allowlistRaw === "string" ? JSON.parse(allowlistRaw) : allowlistRaw);
        } catch { /* silent */ }

        try {
          const docsRaw = await GlobalSettingsAPI.get(`event_${eventData.id}_category_documents`);
          if (docsRaw) setCategoryDocuments(typeof docsRaw === "string" ? JSON.parse(docsRaw) : docsRaw);
        } catch { /* silent */ }

        setStatus("valid");
      } catch (err) {
        console.error("Invite init error:", err);
        setStatus("invalid");
      }
    };
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    const error = query.get('error');
    const recordId = query.get('record_id');

    if (sessionId) {
      handlePaymentVerification(sessionId);
      return;
    }

    if (error) {
      handlePaymentFailure(error, recordId);
      return;
    }

    init();
  }, [eventSlug, token]);

  const handlePaymentFailure = async (errorType, recordId) => {
    // [APX-S6] CASE B: Payment Failed / Cancelled
    setStatus("valid"); // Go back to form
    setErrors({ 
      submit: errorType === 'cancelled' ? "Payment was cancelled. You can try again below." : "Payment failed. Please try again or use a different card." 
    });

    // Mark as failed in DB for admin visibility (Optional architectural refinement)
    if (recordId) {
      try {
        await AccreditationsAPI.update(recordId, { payment_status: 'failed' });
      } catch (err) {
        console.warn("Failed to mark record as failed:", err);
      }
    }

    // Remove params from URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handlePaymentVerification = async (sessionId) => {
    setStatus("loading");
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${authSession?.access_token || supabaseAnonKey}`
        },
        body: JSON.stringify({ sessionId, type: 'accreditation' })
      });
      const data = await res.json();
      
      if (data.success || data.status === 'paid') {
        // [APX-S6] CASE A: Payment Successful
        const meta = data.session?.metadata || {};
        const dbAcc = data.accreditation || {};
        setAccreditation(dbAcc);
        
        setFormData(prev => ({
          ...prev,
          email: meta.customerEmail || prev.email,
          firstName: meta.customerName?.split(' ')[0] || prev.firstName,
          lastName: meta.customerName?.split(' ').slice(1).join(' ') || prev.lastName
        }));
        
        // Even if DB hasn't updated yet (webhook lag), we show success because Stripe confirmed it
        setStatus("submitted");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Case B: Payment failed or still pending
        setErrors({ submit: data.error || "Payment was not successful. Your registration is saved as 'Pending' in our system." });
        setStatus("valid");
      }
    } catch (err) {
      console.error("Payment verification error:", err);
      setErrors({ submit: "Unable to verify payment immediately. Our team will confirm it via webhook shortly." });
      setStatus("valid");
    }
  };

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

    if (!docs || !Array.isArray(docs) || docs.length === 0) return [DEFAULT_DOCUMENTS[0], DEFAULT_DOCUMENTS[1]];
    
    return docs.map(doc => {
      if (typeof doc === 'string') {
        const found = DEFAULT_DOCUMENTS.find(d => d.id === doc);
        return found || { id: doc, label: doc.charAt(0).toUpperCase() + doc.slice(1), accept: "image/jpeg,image/png,image/webp,application/pdf" };
      }
      return {
        id: doc.id,
        label: doc.label,
        format: doc.format,
        accept: formatToAccept(doc.format)
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "role") {
      const selectedCat = eventCategories.find(c => c.name === value);
      const catId = selectedCat ? selectedCat.id : value;
      const restrictedOrgs = categoryAllowlist && categoryAllowlist[catId];
      const newClub = restrictedOrgs && restrictedOrgs.length === 1 ? restrictedOrgs[0] : "";
      setFormData(prev => ({ ...prev, [name]: value, club: newClub }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    if (name === "firstName" || name === "lastName") setDuplicateError(null);
  };

  const handleDocumentFileChange = async (e, docId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, [`doc_${docId}`]: validation.error }));
      return;
    }
    setUploadingDocs(prev => ({ ...prev, [docId]: true }));
    try {
      const data = await uploadToStorage(file, "registrations");
      setFormData(prev => ({ ...prev, documents: { ...prev.documents, [docId]: data.url } }));
      setErrors(prev => ({ ...prev, [`doc_${docId}`]: null }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [`doc_${docId}`]: "Failed to upload. " + (err.message || "") }));
    } finally {
      setUploadingDocs(prev => ({ ...prev, [docId]: false }));
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
    if (!termsAccepted) newErrors.terms = "You must accept the terms and conditions";
    const reqDocs = getRequiredDocuments();
    reqDocs.forEach(doc => {
      if (!formData.documents[doc.id]) newErrors[`doc_${doc.id}`] = `${doc.label} is required`;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setDuplicateError(null);
    try {
      const duplicateCheck = await AccreditationsAPI.checkDuplicate(
        event.id, formData.firstName, formData.lastName, formData.club, formData.dateOfBirth
      );
      if (duplicateCheck.isDuplicate) {
        setDuplicateError({
          message: `A registration with the name "${formData.firstName} ${formData.lastName}" already exists for this event.`,
          status: duplicateCheck.existingRecord?.status || "pending"
        });
        setSubmitting(false);
        return;
      }
      const reqDocs = getRequiredDocuments();
      const submissionSecret = `apex_v1_${event.id?.substring(0, 8)}`;

      if (inviteLink?.requirePayment) {
        // [APX-S6] IMMEDIATE CREATION: Create record in PENDING/DRAFT state before payment
        const draftRecord = await AccreditationsAPI.create({
          eventId: event.id,
          firstName: formData.firstName,
          lastName: formData.lastName,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          club: formData.club,
          role: formData.role,
          email: formData.email,
          photoUrl: formData.documents['picture'] || null,
          idDocumentUrl: formData.documents['passport'] || null,
          eidUrl: formData.documents['eid'] || null,
          medicalUrl: formData.documents['guardian_id'] || formData.documents['medical'] || null,
          payment_status: 'pending',
          payment_amount: inviteLink.paymentAmount || 0,
          status: 'pending' // Use 'pending' as the draft state
        }, submissionSecret);

        setAccreditation(draftRecord);

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`
          },
          body: JSON.stringify({
            type: 'accreditation',
            eventId: event.id,
            eventSlug: eventSlug,
            customerEmail: formData.email,
            customerName: `${formData.firstName} ${formData.lastName}`,
            accreditationId: draftRecord.id, // Pass existing record ID
            inviteLinkId: inviteLink.id,
            metadata: {
              amount: inviteLink.paymentAmount,
              token: token,
              accreditationRecordId: draftRecord.id, // Authoritative ID for webhook
              inviteLinkId: inviteLink.id // Pass for usage tracking
            }
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        } else {
          throw new Error(data.error || "Failed to initialize payment");
        }
      }

      // FREE REGISTRATION: Create record immediately and mark as unpaid/0

      const accRecord = await AccreditationsAPI.create({
        eventId: event.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        nationality: formData.nationality,
        club: formData.club,
        role: formData.role,
        email: formData.email,
        photoUrl: formData.documents['picture'] || null,
        idDocumentUrl: formData.documents['passport'] || null,
        eidUrl: formData.documents['eid'] || null,
        medicalUrl: formData.documents['guardian_id'] || formData.documents['medical'] || null,
        payment_status: 'unpaid',
        payment_amount: 0
      }, submissionSecret);

      setAccreditation(accRecord);

      // Increment link use count
      if (inviteLink) await incrementLinkUseCount(event.id, inviteLink.id);

      setStatus("submitted");
    } catch (error) {
      if (error.message && error.message.includes("DUPLICATE_NAME")) {
        setDuplicateError({
          message: `"${formData.firstName} ${formData.lastName}" has already registered for this event.`,
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
    if (eventCategories.length > 0) return eventCategories.map(cat => ({ value: cat.name, label: cat.name }));
    return ROLES.map(r => ({ value: r, label: r }));
  };

  // --- Render States ---

  if (status === "loading") {
    const isVerifying = new URLSearchParams(window.location.search).has('session_id');
    return (
      <SwimmingBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full shadow-lg shadow-cyan-500/20 mx-auto" />
            <p className="text-lg text-cyan-600 mt-4">
              {isVerifying ? "Finalizing your registration..." : "Validating invite link..."}
            </p>
            {isVerifying && (
              <p className="text-sm text-slate-400 mt-2">This may take a moment. Please do not close this window.</p>
            )}
          </div>
        </div>
      </SwimmingBackground>
    );
  }

  const errorScreens = {
    invalid: { icon: AlertCircle, color: "red", title: "Invalid Link", desc: invalidReason || "This invite link is invalid or does not exist." },
    expired: { icon: Clock, color: "amber", title: "Link Expired", desc: "This invite link has expired and is no longer accepting registrations." },
    limit_reached: { icon: AlertCircle, color: "orange", title: "Link Limit Reached", desc: "This invite link has reached its maximum number of uses." },
    exhausted: { icon: AlertCircle, color: "orange", title: "Link Exhausted", desc: "This invite link has reached its maximum number of uses." },
    inactive: { icon: Lock, color: "slate", title: "Link Deactivated", desc: "This invite link has been deactivated by the event organizer." },
  };

  if (errorScreens[status]) {
    const { icon: IconComp, color, title, desc } = errorScreens[status];
    return (
      <SwimmingBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md bg-white rounded-2xl p-8 shadow-2xl border border-slate-200">
            <IconComp className={`w-16 h-16 text-${color}-400 mx-auto mb-4`} />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
            <p className="text-lg text-slate-500 mb-6">{desc}</p>
            <p className="text-sm text-slate-400">Please contact the event organizer for assistance.</p>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  if (status === "submitted") {
    return (
      <SwimmingBackground>
        <div id="invite_register_success" className="min-h-screen flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md w-full bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border-2 border-cyan-200">
            
            <div className="space-y-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
              
              <h1 className="text-2xl font-bold text-slate-800">Registration Received!</h1>
              <p className="text-lg text-slate-600">
                Your accreditation {inviteLink?.requirePayment ? "payment is being processed" : "request"} for <span className="font-semibold text-cyan-700">{event?.name}</span>.
                You will receive a confirmation email shortly.
              </p>
              
              <div className="bg-slate-50 border-2 border-cyan-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Reference Email</span>
                  <span className="font-mono text-slate-700">{formData.email}</span>
                </div>
                {inviteLink?.requirePayment && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Payment Status</span>
                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                      <Clock className="w-3 h-3" /> Pending Webhook
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100">
                <Button variant="ghost" className="w-full" onClick={() => window.location.href = '/'}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Return to Home
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  const requiredDocuments = getRequiredDocuments();

  return (
    <SwimmingBackground>
      <div id="invite_register_page" className="min-h-screen relative py-8 px-4">
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            {event?.logoUrl ? (
              <div className="w-full max-w-[500px] mx-auto mb-6 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-cyan-300 shadow-2xl shadow-cyan-500/20">
                <img src={event.logoUrl} alt="Event Logo" className="w-full h-auto max-h-[200px] object-contain" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-ocean-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
                <Shield className="w-12 h-12 text-white" />
              </div>
            )}

            {/* Invite badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/30 text-violet-700 text-xs font-bold uppercase tracking-widest mb-3">
              <Lock className="w-3 h-3" />
              Private Invite Registration
            </div>

            <h1 className="text-2xl lg:text-3xl text-white font-bold drop-shadow-lg">
              Accreditation Registration Form
            </h1>
            <p className="text-xl text-white/90 mt-2 font-medium drop-shadow-md">
              {event?.name} • {formatDateDisplay(event?.startDate)}
            </p>
            {inviteLink?.label && (
              <p className="text-sm text-white/60 mt-1">Invite: {inviteLink.label}</p>
            )}
          </motion.div>

          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            onSubmit={handleSubmit} noValidate
            className="bg-white/90 backdrop-blur-xl border border-cyan-300 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl shadow-cyan-500/30">

            {duplicateError && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-lg font-semibold text-amber-700">Duplicate Registration Detected</p>
                    <p className="text-lg text-amber-600 mt-1">{duplicateError.message}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 relative z-50">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <User className="w-6 h-6 text-cyan-600" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} required placeholder="Enter first name" light />
                <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} required placeholder="Enter last name" light />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Gender" name="gender" value={formData.gender} onChange={handleInputChange} error={errors.gender} required light placeholder="Select gender"
                  options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
                <Input label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} error={errors.dateOfBirth} required light />
              </div>
              <div className="relative z-[60]">
                <SearchableSelect label="Nationality" value={formData.nationality}
                  onChange={e => handleInputChange({ target: { name: "nationality", value: e.target.value } })}
                  error={errors.nationality} required options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))} placeholder="Select your nationality" light />
              </div>
            </div>

            {/* Affiliation */}
            <div className="space-y-4 relative z-40">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <Flag className="w-6 h-6 text-cyan-600" /> Affiliation
              </h2>
              
              <div className="relative z-[30]">
                {inviteLink?.role ? (
                  <Input label="Category/Role" value={formData.role} disabled light className="opacity-75 bg-slate-100" />
                ) : (
                  <Select label="Category/Role" name="role" value={formData.role} onChange={handleInputChange} error={errors.role} required light placeholder="Select category/role" options={getRoleOptions()} />
                )}
              </div>

              <div className="relative z-[20]">
                {inviteLink?.club ? (
                  <Input label="Organization/Club/Academy" value={formData.club} disabled light className="opacity-75 bg-slate-100" title="Pre-filled from invite" />
                ) : (
                  (() => {
                    const selectedCat = eventCategories.find(c => c.name === formData.role);
                    const catId = selectedCat ? selectedCat.id : formData.role;
                    const restrictedOrgs = formData.role ? categoryAllowlist[catId] : null;
                    if (restrictedOrgs && restrictedOrgs.length > 0) {
                      return (
                        <SearchableSelect label="Organization/Club/Academy *" value={formData.club}
                          onChange={e => handleInputChange({ target: { name: "club", value: e.target.value } })}
                          error={errors.club} required options={restrictedOrgs.map(name => ({ value: name, label: name }))} placeholder="Select Organization" light disabled={restrictedOrgs.length === 1} />
                      );
                    }
                    if (formData.role && (teamRoles.includes(formData.role.toLowerCase()) || formData.role.toLowerCase().includes("athlete") || formData.role.toLowerCase().includes("coach")) && clubs.length > 0) {
                      return (
                        <SearchableSelect label="Organization/Club/Academy *" value={formData.club}
                          onChange={e => handleInputChange({ target: { name: "club", value: e.target.value } })}
                          error={errors.club} required options={clubs.map(c => { const name = typeof c === "string" ? c : (c?.full || c?.short); return name ? { value: name, label: name } : null; }).filter(Boolean)} placeholder="Select organization" light />
                      );
                    }
                    return (
                      <Input label="Organization/Club/Academy" name="club" value={formData.club} onChange={handleInputChange} error={errors.club} required placeholder="Enter organization, club or academy" light />
                    );
                  })()
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4 relative z-30">
              <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                <Mail className="w-6 h-6 text-cyan-600" /> Contact
              </h2>
              <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} required placeholder="your.email@example.com" light />
            </div>

            {/* Documents - ONLY SHOWN AFTER ROLE IS SELECTED */}
            {formData.role && (
              <div className="space-y-4 relative z-20">
                <h2 className="text-2xl font-bold text-cyan-700 flex items-center gap-2">
                  <Upload className="w-6 h-6 text-cyan-600" /> Documents
                </h2>
                <div className="space-y-4">
                  {requiredDocuments.map(doc => (
                    <div key={doc.id}>
                      <label className="block text-lg font-medium text-slate-700 mb-1.5">
                        {doc.label} ({doc.format || (doc.accept.includes("pdf") ? "JPEG, PNG, PDF" : "JPEG, PNG")} - Max 5MB)
                      </label>
                      <input type="file" accept={doc.accept} onChange={e => handleDocumentFileChange(e, doc.id)}
                        className="w-full text-lg text-slate-600 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-lg file:font-medium file:bg-gradient-to-r file:from-cyan-500 file:to-blue-600 file:text-white hover:file:from-cyan-600 hover:file:to-blue-700 file:cursor-pointer cursor-pointer py-2" />
                      {uploadingDocs[doc.id] && <p className="text-lg text-amber-500 mt-1 flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</p>}
                      {errors[`doc_${doc.id}`] && <p className="text-lg text-red-500 mt-1">{errors[`doc_${doc.id}`]}</p>}
                      {formData.documents[doc.id] && <p className="text-lg text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {doc.label} uploaded</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200 relative z-10">
               <input type="checkbox" id="terms" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); if (e.target.checked && errors.terms) setErrors(prev => ({ ...prev, terms: null })); }}
                className={`mt-1.5 w-6 h-6 rounded border-cyan-300 bg-white text-cyan-500 ${!hasViewedTerms ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                disabled={!hasViewedTerms} />
              <div>
                <label htmlFor="terms" className={`text-lg transition-colors ${!hasViewedTerms ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'} block`}>
                  I confirm all information provided is accurate and agree to the{" "}
                  <button
                     type="button"
                     onClick={() => setTermsModalOpen(true)}
                     className="text-cyan-600 hover:text-cyan-500 underline font-medium"
                   >
                     Terms and Conditions
                   </button>
                   {!hasViewedTerms && <span className="text-sm text-cyan-600 ml-2 animate-pulse">(Click to read & unlock)</span>}
                </label>
                {errors.terms && <p className="text-lg text-red-500 mt-1">{errors.terms}</p>}
              </div>
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-lg text-red-600">{errors.submit}</p>
              </div>
            )}

            <Button type="submit" loading={submitting} disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25 min-h-[52px]">
              {submitting ? "Submitting..." : 
               inviteLink?.requirePayment ? `Pay AED ${inviteLink.paymentAmount?.toFixed(2)} & Submit` : 
               "Submit Accreditation Request"}
            </Button>
          </motion.form>
        </div>
        <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} onAccept={() => setHasViewedTerms(true)} content={event?.termsAndConditions} />
      </div>
    </SwimmingBackground>
  );
}
