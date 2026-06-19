import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, MapPin, Phone, Mail, User, Upload, Loader2, ImageOff,
  AlertCircle, CheckCircle, ArrowLeft, Cpu, Calendar, ChevronDown, Plus
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ThemeToggle from "../../components/ui/ThemeToggle";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { useToast } from "../../components/ui/Toast";
import { EventsAPI } from "../../lib/storage";
import { TeamAPI } from "../../services/teamApi";
import { COUNTRIES, UAE_EMIRATES, getDialCode, validatePhoneForCountry } from "../../lib/utils";
import { uploadToStorage } from "../../lib/uploadToStorage";

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function TeamRegister() {
  const { slug } = useParams();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    country: "",
    city: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    logo_url: ""
  });

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const eventData = await EventsAPI.getBySlug(slug);
        setEvent(eventData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [slug]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadToStorage(file, "team-logos");
      setFormData(prev => ({ ...prev, logo_url: url }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload logo. Please try again.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleRegisterAnother = () => {
    setFormData({
      name: "",
      short_name: "",
      country: "",
      city: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      logo_url: ""
    });
    setSubmitted(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Team / University name is required");
      return;
    }

    const phoneError = validatePhoneForCountry(formData.contact_phone, formData.country);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }

    setSubmitting(true);
    try {
      await TeamAPI.submitPublicTeamRegistration({ event_id: event.id, ...formData });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SwimmingBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full shadow-lg shadow-indigo-500/20" />
              <Cpu className="absolute -top-2 -right-2 w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-lg text-indigo-600 mt-4">Loading event...</p>
          </div>
        </div>
      </SwimmingBackground>
    );
  }

  if (!event) {
    return (
      <SwimmingBackground>
        <div id="team_register_not-found" className="min-h-screen flex items-center justify-center p-4">
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
        <div id="team_register_closed" className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-white/95 backdrop-blur-2xl border border-white rounded-2xl p-8 shadow-2xl max-w-md"
          >
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Registration Closed</h1>
            <p className="text-lg text-slate-500 mb-6">
              Team registration for {event.name} is not currently open. Please contact the event organizers for assistance.
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

  if (submitted) {
    return (
      <SwimmingBackground>
        <div id="team_register_success" className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md bg-white/95 backdrop-blur-2xl rounded-2xl p-8 shadow-2xl border border-white"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-indigo-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800 mb-3">Registration Submitted</h1>
            <p className="text-lg text-slate-600 mb-6">
              Thanks! Your team registration for <span className="font-semibold">{event.name}</span> has been
              submitted and is pending review by the event admins.
            </p>
            <Button variant="primary" icon={Plus} onClick={handleRegisterAnother} className="w-full mb-3">
              Register Another Team
            </Button>
            <Link to="/">
              <Button variant="secondary" icon={ArrowLeft} className="w-full">
                Return to Home
              </Button>
            </Link>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  return (
    <SwimmingBackground>
      <div className="min-h-screen relative py-8 px-4 text-main font-body">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <ThemeToggle />
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            {event.logoUrl ? (
              <div className="w-full max-w-[500px] mx-auto mb-8 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-indigo-300/60 shadow-2xl shadow-indigo-500/20">
                <img src={event.logoUrl} alt="Event Logo" className="w-full h-auto max-h-[200px] object-contain" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-ocean-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
                <Building2 className="w-12 h-12 text-white" />
              </div>
            )}

            <h1 className="text-3xl lg:text-4xl text-main font-black drop-shadow-sm mb-2">
              {event.name}
            </h1>
            <h2 className="text-xl lg:text-2xl text-cyan-700 font-bold drop-shadow-md">
              Team Registration
            </h2>
            {(event.location || event.startDate) && (
              <p className="text-lg text-slate-600 mt-4 font-medium flex items-center justify-center gap-2">
                <Calendar className="w-5 h-5" />
                {event.location} • {formatDateDisplay(event.startDate)} to {formatDateDisplay(event.endDate)}
              </p>
            )}
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            noValidate
            className="bg-white light-form border border-border/50 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Team / University Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. American University of Sharjah"
                icon={Building2}
                required
              />
              <Input
                label="Short Name"
                value={formData.short_name}
                onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
                placeholder="e.g. AUS"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Country</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-primary-500" />
                  <select
                    value={formData.country}
                    onChange={(e) => {
                      const newCountry = e.target.value;
                      setFormData(prev => {
                        const dial = getDialCode(newCountry);
                        const phone = !prev.contact_phone && dial ? `${dial} ` : prev.contact_phone;
                        return { ...prev, country: newCountry, city: "", contact_phone: phone };
                      });
                    }}
                    className="w-full py-2.5 rounded-lg border text-lg bg-base border-border text-main outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all appearance-none country-select"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-muted" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">City / Emirate</label>
                {formData.country === "United Arab Emirates" ? (
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-primary-500" />
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full py-2.5 rounded-lg border text-lg bg-base border-border text-main outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all appearance-none country-select"
                    >
                      <option value="">Select an emirate</option>
                      {UAE_EMIRATES.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-muted" />
                  </div>
                ) : (
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="e.g. Sharjah"
                    icon={MapPin}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-main mb-4">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Contact Name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  icon={User}
                />
                <Input
                  label="Contact Phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder={getDialCode(formData.country) ? `${getDialCode(formData.country)} 50 000 0000` : "e.g. +971 50 000 0000"}
                  icon={Phone}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Contact Email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="e.g. john@example.com"
                    icon={Mail}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-main">Team Logo (Optional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-border bg-base-alt flex items-center justify-center overflow-hidden shrink-0">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="w-5 h-5 text-muted" />
                    )}
                  </div>
                  <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main text-sm font-medium hover:border-primary-500 transition-all">
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> {formData.logo_url ? "Change Photo" : "Upload Photo"}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="or paste an image URL"
                  className="w-full bg-base-alt border border-border rounded-xl px-4 py-2 text-xs text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              Submit Registration
            </Button>
          </motion.form>
        </div>
      </div>
    </SwimmingBackground>
  );
}
