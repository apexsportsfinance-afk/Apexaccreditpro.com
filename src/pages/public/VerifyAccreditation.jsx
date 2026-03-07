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
        className="relative z-10 w-full max-w-xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center"
      >
        {/* Banner Section */}
        {eventSettings["banner_url"] && (
          <motion.div variants={itemVariants} className="w-full mb-6 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-white/5">
            <img src={eventSettings["banner_url"]} alt="Event banner" className="w-full h-auto object-contain bg-gray-900" />
          </motion.div>
        )}

        {/* Premium Status Indicator */}
        <motion.div
          variants={itemVariants}
          className={`w-full mb-6 flex items-center justify-between px-6 py-4 rounded-3xl border backdrop-blur-md transition-all ${
            expiry.isExpired
              ? "bg-red-500/10 border-red-500/40 shadow-lg shadow-red-950/20"
              : "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
          }`}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`p-2.5 rounded-xl shadow-inner ${expiry.isExpired ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
              {expiry.isExpired
                ? <XCircle className="w-7 h-7 text-red-500" />
                : <CheckCircle className="w-7 h-7 text-emerald-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-black text-xl leading-none uppercase tracking-tighter ${expiry.isExpired ? "text-red-400" : "text-emerald-400"}`}>
                {expiry.isExpired ? "Expired" : "Valid"} Accreditation
              </h3>
              <p className="text-white/70 text-xs font-bold mt-1.5 uppercase tracking-wide leading-tight">
                {data.events?.name}
              </p>
            </div>
          </div>
        </motion.div>

        {/* High-End Professional ID Card */}
        <motion.div 
          variants={itemVariants} 
          className="w-full bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row p-4 gap-6 items-start">
            {/* Left side: Large Portrait Photo */}
            <div className="relative flex-shrink-0 mx-auto sm:mx-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-2xl blur-sm opacity-20"></div>
              <div className="relative w-32 h-44 rounded-2xl overflow-hidden border-2 border-white bg-slate-100 shadow-lg">
                {data.photo_url ? (
                  <img
                    src={data.photo_url}
                    alt={data.first_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User className="w-16 h-16" />
                  </div>
                )}
                {expiry.isExpired && (
                  <div className="absolute inset-0 bg-red-600/80 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="text-white font-black text-[10px] tracking-widest border border-white px-2 py-0.5 rounded rotate-[-15deg] uppercase">
                      Expired
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Information Architecture */}
            <div className="flex-1 w-full flex flex-col">
              {/* Header: Name and ID */}
              <div className="mb-4 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    {data.first_name}
                    </h1>
                    <h1 className="text-2xl font-black text-cyan-600 tracking-tighter uppercase leading-none">
                    {data.last_name}
                    </h1>
                </div>
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 font-black tracking-wider uppercase border border-slate-200">
                    Badge ID: #{data.badge_number}
                </div>
              </div>

              {/* Grid Content */}
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <ProfessionalRow 
                    light 
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />} 
                    label="Role" 
                    value={data.role} 
                    />
                    {data.club && (
                        <ProfessionalRow 
                        light 
                        icon={<Building className="w-3.5 h-3.5 text-slate-400" />} 
                        label="Club" 
                        value={data.club} 
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                    {data.nationality && (
                    <ProfessionalRow
                        light
                        icon={<MapPin className="w-3.5 h-3.5 text-slate-400" />}
                        label="Citizenship"
                        value={
                        <div className="flex items-center gap-1.5 text-xs text-slate-900 font-bold">
                            {getCountryFlag(data.nationality) && (
                            <img src={getCountryFlag(data.nationality)} alt="flag" className="w-5 h-3 rounded-sm object-cover shadow-sm" />
                            )}
                            <span className="truncate">{data.nationality}</span>
                        </div>
                        }
                    />
                    )}
                    {data.date_of_birth && (
                    <ProfessionalRow
                        light
                        icon={<Cake className="w-3.5 h-3.5 text-slate-400" />}
                        label="Birthday"
                        value={<span className="text-xs text-slate-900 font-bold">{new Date(data.date_of_birth).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    />
                    )}
                </div>

                {/* Integrated Zone Codes */}
                {data.zone_code && (() => {
                    const codes = data.zone_code.split(",").map(z => z.trim()).filter(Boolean);
                    return codes.length > 0 ? (
                    <div className="pt-2">
                        <div className="flex flex-wrap gap-1.5">
                        {codes.map((code, i) => (
                        <span key={i} className="px-3 py-1 rounded-lg text-[10px] font-black text-slate-700 bg-slate-100 border border-slate-200 shadow-sm uppercase">
                            {code}
                        </span>
                        ))}
                        </div>
                    </div>
                    ) : null;
                })()}
              </div>
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

function ProfessionalRow({ icon, label, value, light }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <div className={`mt-1 flex-shrink-0 p-1.5 rounded-lg border ${light ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[10px] uppercase font-black tracking-widest mb-0.5 ${light ? "text-gray-400" : "text-white/30"}`}>{label}</p>
        <div className={`font-semibold flex items-center gap-2 ${light ? "text-gray-900" : "text-white"}`}>
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
