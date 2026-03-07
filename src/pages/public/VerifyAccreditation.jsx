import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle, XCircle, Download, Calendar,
  MessageSquare, Globe, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck,
  User, Hash, MapPin, Building, Cake, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { EventSettingsAPI, FormFieldSettingsAPI } from "../../lib/broadcastApi";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";
import { getCountryFlag } from "../../lib/utils";

export default function VerifyAccreditation() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [eventSettings, setEventSettings] = useState({});
  const [fieldSettings, setFieldSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extraExpanded, setExtraExpanded] = useState(false);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let accData, accErr;

      if (isUUID) {
        const byAcc = await supabase
          .from("accreditations")
          .select("*, events:event_id(name, start_date, logo_url)")
          .eq("accreditation_id", id)
          .limit(1)
          .maybeSingle();
        if (byAcc.data) {
          accData = byAcc.data;
        } else {
          const byId = await supabase
            .from("accreditations")
            .select("*, events:event_id(name, start_date, logo_url)")
            .eq("id", id)
            .limit(1)
            .maybeSingle();
          accData = byId.data;
          accErr = byId.error;
        }
      } else {
        const result = await supabase
          .from("accreditations")
          .select("*, events:event_id(name, start_date, logo_url)")
          .eq("accreditation_id", id)
          .limit(1)
          .maybeSingle();
        accData = result.data;
        accErr = result.error;
      }
      if (accErr) throw accErr;
      if (!accData) throw new Error("Accreditation not found");

      const [eSettings, fieldSets] = await Promise.all([
        accData?.event_id
          ? EventSettingsAPI.getAll(accData.event_id)
          : Promise.resolve({}),
        accData?.event_id
          ? FormFieldSettingsAPI.getByEventId(accData.event_id)
          : Promise.resolve({})
      ]);

      setData(accData);
      setEventSettings(eSettings);
      setFieldSettings(fieldSets || {});
    } catch (err) {
      setError(err.message || "Accreditation not found");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ScanSkeleton />;
  if (error || !data) return <ScanError error={error} />;

  const expiry = computeExpiryStatus(data);
  const selectedEvents = Array.isArray(data.selected_events) ? data.selected_events : [];
  const customMessage = data.custom_message;

  const eventBroadcast = data.role === "Athlete"
    ? (eventSettings["athlete_qr_broadcast_message"] || eventSettings["broadcast_message"])
    : eventSettings["broadcast_message"];

  const eventPdfUrl = eventSettings["pdf_url"];
  const eventResultPdfUrl = eventSettings["event_result_pdf_url"];

  const showForQR = (key) => {
    const loc = fieldSettings[key] || "both";
    return loc === "both" || loc === "qr";
  };

  const visibleEvents = extraExpanded ? selectedEvents : selectedEvents.slice(0, 5);
  const hasMoreEvents = selectedEvents.length > 5;

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div id="verify-accreditation-page" className="min-h-screen bg-[#050b18] text-slate-200 font-inter selection:bg-cyan-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-xl mx-auto px-4 py-8 md:py-12 flex flex-col items-center"
      >
        {/* Banner Section */}
        {eventSettings["banner_url"] && (
          <motion.div variants={itemVariants} className="w-full mb-6 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-white/5">
            <img src={eventSettings["banner_url"]} alt="Event banner" className="w-full h-auto object-contain bg-gray-900" />
          </motion.div>
        )}

        {/* Status Indicator */}
        <motion.div
          variants={itemVariants}
          className={`w-full mb-6 flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-md transition-all ${
            expiry.isExpired
              ? "bg-red-500/10 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              : "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${expiry.isExpired ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
              {expiry.isExpired
                ? <XCircle className="w-6 h-6 text-red-500" />
                : <CheckCircle className="w-6 h-6 text-emerald-500" />
              }
            </div>
            <div>
              <h3 className={`font-bold text-lg leading-tight ${expiry.isExpired ? "text-red-400" : "text-emerald-400"}`}>
                {expiry.label}
              </h3>
              <p className="text-white/60 text-sm font-medium">Verified Accreditation</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-1">Event</p>
            <p className="text-white font-semibold text-sm max-w-[140px] truncate">{data.events?.name}</p>
          </div>
        </motion.div>

        {/* Profile Card */}
        <motion.div variants={itemVariants} className="w-full bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Glow inside card */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] rounded-full" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Photo Section */}
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative w-40 h-40 md:w-32 md:h-32 rounded-[2rem] overflow-hidden border-2 border-white/20 bg-gray-900 shadow-inner">
                {data.photo_url ? (
                  <img
                    src={data.photo_url}
                    alt={data.first_name}
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <User className="w-16 h-16" />
                  </div>
                )}

                {expiry.isExpired && (
                  <div className="absolute inset-0 bg-red-600/60 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="text-white font-black text-sm tracking-tighter border-2 border-white px-2 py-0.5 rounded rotate-[-15deg]">
                      EXPIRED
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left space-y-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase mb-1">
                  {data.first_name} <span className="text-cyan-500">{data.last_name}</span>
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/40 font-bold group">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] tracking-widest uppercase">
                    ID #{data.badge_number}
                  </span>
                  {data.events?.logo_url && (
                      <div className="h-6 w-px bg-white/10 mx-1" />
                  )}
                  {data.events?.logo_url && (
                    <img src={data.events.logo_url} alt="Logo" className="h-5 object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                <ProfessionalRow icon={<ShieldCheck className="w-4 h-4 text-cyan-500" />} label="Role" value={data.role} />
                {data.club && <ProfessionalRow icon={<Building className="w-4 h-4 text-cyan-400" />} label="Club" value={data.club} />}
                {data.nationality && (
                  <ProfessionalRow
                    icon={<MapPin className="w-4 h-4 text-cyan-400" />}
                    label="Citizenship"
                    value={
                      <div className="flex items-center gap-2">
                        {getCountryFlag(data.nationality) && (
                          <img src={getCountryFlag(data.nationality)} alt="flag" className="w-6 h-4 rounded-sm object-cover shadow-sm" />
                        )}
                        <span>{data.nationality}</span>
                      </div>
                    }
                  />
                )}
                {data.date_of_birth && (
                  <ProfessionalRow
                    icon={<Cake className="w-4 h-4 text-cyan-400" />}
                    label="Birthday"
                    value={new Date(data.date_of_birth).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                )}
              </div>

              {/* Zone Badges */}
              {data.zone_code && (() => {
                const codes = data.zone_code.split(",").map(z => z.trim()).filter(Boolean);
                return codes.length > 0 ? (
                  <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-2">
                    {codes.map((code, i) => (
                      <span key={i} className="px-5 py-2 rounded-xl text-sm font-black text-white bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 shadow-lg">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </motion.div>

        {/* Messaging & Events Sections */}
        <div className="w-full grid grid-cols-1 gap-4 mt-4">
          <AnimatePresence>
            {/* Events Section */}
            {data.role === "Athlete" && selectedEvents.length > 0 && showForQR("events") && (
              <motion.div variants={itemVariants} className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                    Scheduled Events
                  </h2>
                  <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-2 py-1 rounded-full border border-cyan-500/20 uppercase">
                    {selectedEvents.length} Items
                  </span>
                </div>
                <div className="space-y-3">
                  {visibleEvents.map((ev, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={i}
                      className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 group-hover:border-white/10 transition-colors"
                    >
                      <span className="text-cyan-400 font-black text-sm w-12 flex-shrink-0 bg-cyan-500/5 border border-cyan-500/10 px-2 py-1 rounded text-center">
                        {ev.eventCode}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-medium text-sm block">{ev.eventName}</span>
                        {formatEventDateTime(ev) && (
                          <p className="text-white/40 text-xs font-medium mt-1 uppercase tracking-wider">{formatEventDateTime(ev)}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
                {hasMoreEvents && (
                  <button
                    onClick={() => setExtraExpanded(!extraExpanded)}
                    className="w-full mt-4 py-3 border border-white/5 rounded-xl text-white/40 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {extraExpanded ? "Collapse View" : `View ${selectedEvents.length - 5} More Events`}
                    {extraExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </motion.div>
            )}

            {/* Notifications & Documents */}
            {(customMessage || eventBroadcast) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customMessage && showForQR("custom_message") && (
                   <MessageCard title="Personal Notification" message={customMessage} icon={<MessageSquare className="w-4 h-4" />} isPersonal />
                )}
                {eventBroadcast && showForQR("global_message") && (
                   <MessageCard title="Event Broadcast" message={eventBroadcast} icon={<Globe className="w-4 h-4" />} />
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Document Quick Access */}
        <motion.div variants={itemVariants} className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DownloadButton url={data.heat_sheet_url} visible={showForQR("heat_sheet_pdf")} label="Heat Sheet" color="blue" />
          <DownloadButton url={data.event_result_url} visible={showForQR("event_result_pdf")} label="Athlete Result" color="emerald" />
          <DownloadButton url={eventPdfUrl} visible={showForQR("global_pdf")} label="Official PDF" color="gray" />
          <DownloadButton url={eventResultPdfUrl} visible={showForQR("global_pdf")} label="Event Results" color="cyan" />
        </motion.div>

        {/* Footer */}
        <motion.p variants={itemVariants} className="mt-12 text-white/20 text-[10px] uppercase font-black tracking-[0.5em] text-center">
          Apex Sports Accreditation System
        </motion.p>
      </motion.div>
    </div>
  );
}

function ProfessionalRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex-shrink-0 bg-white/5 p-1.5 rounded-lg border border-white/10">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-0.5">{label}</p>
        <div className="text-white font-semibold flex items-center gap-2">
            {value}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ title, message, icon, isPersonal }) {
  return (
    <motion.div
        variants={{ hidden: { scale: 0.95 }, visible: { scale: 1 } }}
        className={`bg-white/[0.03] border backdrop-blur-xl rounded-2xl p-6 shadow-xl ${
            isPersonal ? 'border-indigo-500/20' : 'border-blue-500/20'
        }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${isPersonal ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
          {icon}
        </div>
        <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${isPersonal ? 'text-indigo-300' : 'text-blue-300'}`}>
          {title}
        </h3>
      </div>
      <p className="text-sm text-white/80 leading-relaxed font-medium whitespace-pre-wrap">{message}</p>
    </motion.div>
  );
}

function DownloadButton({ url, visible, label, color }) {
  if (!url || !visible) return null;

  const colors = {
      blue: "from-blue-600 to-blue-700 hover:shadow-blue-900/40",
      emerald: "from-emerald-600 to-emerald-700 hover:shadow-emerald-900/40",
      gray: "from-gray-700 to-gray-800 hover:shadow-gray-900/40",
      cyan: "from-cyan-600 to-cyan-700 hover:shadow-cyan-900/40"
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex items-center justify-between gap-4 bg-gradient-to-br ${colors[color]} p-4 pl-6 rounded-2xl text-white font-bold transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0 shadow-lg`}
    >
      <div className="flex flex-col">
          <span className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5 font-black">Download</span>
          <span className="text-sm tracking-tight">{label}</span>
      </div>
      <div className="p-3 bg-black/20 rounded-xl group-hover:bg-black/30 transition-colors">
        <Download className="w-4 h-4" />
      </div>
    </a>
  );
}

function ScanSkeleton() {
  return (
    <div id="verify-skeleton" className="min-h-screen bg-[#050b18] flex items-center justify-center">
       <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] animate-pulse" />
          <div className="relative flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-t-2 border-cyan-500 animate-spin" />
            <p className="text-cyan-500 font-black text-xs uppercase tracking-[0.4em] animate-pulse">Authenticating</p>
          </div>
       </div>
    </div>
  );
}

function ScanError({ error }) {
  return (
    <div id="verify-error" className="min-h-screen bg-[#050b18] flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="inline-flex p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] mb-8">
            <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Verification Failed</h2>
        <p className="text-white/40 font-medium mb-12">{error || "The scanned accreditation code is invalid or has been revoked."}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
            Retry Scan
        </button>
      </div>
    </div>
  );
}
