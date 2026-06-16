import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { BookingsAPI, AuditAPI } from "../../lib/storage";
import { useHardwareScanner } from "../../hooks/useHardwareScanner";
import { useQrCamera } from "../../hooks/useQrCamera";
import { toast } from "sonner";
import { 
  Camera, CheckCircle, Search, XCircle, Clock, Calendar, Activity, X, 
  MapPin, Shield, User, Hash, ChevronRight
} from "lucide-react";
import { cn } from "../../lib/utils";

export default function ServiceCheckin() {
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [eventData, setEventData] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingConfig, setBookingConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  
  // Scanner setup
  const qrRef = useRef(null);
  
  useEffect(() => {
    // Fetch event details
    const fetchEvent = async () => {
      const { data } = await supabase.from("events").select("*").eq("slug", eventSlug).maybeSingle();
      if (data) {
        setEventData(data);
        const config = await BookingsAPI.getConfig(data.id);
        setBookingConfig(config);
      }
    };
    if (eventSlug) fetchEvent();
  }, [eventSlug]);

  const onScanSuccess = async (scannedText) => {
    if (loading || !eventData) return;
    
    // Extract ID if it's a URL
    let cleanId = scannedText.trim();
    if (cleanId.includes("/verify/")) {
      cleanId = cleanId.split("/verify/").pop();
    } else if (cleanId.includes("ACC-")) {
      cleanId = cleanId.split("ACC-").pop();
    }
    
    lookupAthlete(cleanId);
  };
  
  const { scanning, cameraError, setCameraError, startScanner, stopScanner } = useQrCamera(qrRef, onScanSuccess);
  useHardwareScanner(true, onScanSuccess);
  
  const lookupAthlete = async (idToLookup) => {
    setLoading(true);
    setAthlete(null);
    setBookings([]);
    
    try {
      const cleanId = idToLookup.includes("ACC-") ? idToLookup.split("-").pop() : idToLookup;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToLookup) || 
                     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
      
      let query = supabase.from("accreditations").select("*");
      
      if (isUUID) {
        const uuid = idToLookup.length === 36 ? idToLookup : cleanId;
        query = query.eq("id", uuid);
      } else {
        const filters = [`accreditation_id.eq.${idToLookup}`, `badge_number.eq.${idToLookup}`];
        if (idToLookup !== cleanId) {
          filters.push(`accreditation_id.eq.${cleanId}`, `badge_number.eq.${cleanId}`);
        }
        query = query.or(filters.join(","));
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error("Participant not found");
      
      // Ensure the participant belongs to the current event context
      if (data.event_id !== eventData?.id) {
        throw new Error("Participant belongs to a different event");
      }
      
      setAthlete(data);
      
      // Fetch bookings
      const pBookings = await BookingsAPI.getParticipantBooking(eventData.id, data.id);
      setBookings(pBookings || []);
      
    } catch (err) {
      toast.error(err.message || "Failed to lookup participant");
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = (e) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    lookupAthlete(manualId.trim());
  };
  
  const issueToken = async (serviceName) => {
    if (!athlete || !eventData) return;
    try {
      await AuditAPI.log("service_token_issued", {
        eventId: eventData.id,
        athleteId: athlete.id,
        serviceName: serviceName,
        timestamp: new Date().toISOString()
      });
      toast.success(`${serviceName} token issued successfully!`);
    } catch (err) {
      toast.error("Failed to issue token");
    }
  };
  
  return (
    <div className="min-h-screen bg-[#050b18] text-slate-200 p-6 sm:p-10 font-inter">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-[#0a1120] p-6 rounded-3xl border border-white/10 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Service Check-in</h1>
            <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase mt-1">{eventData?.name || "Loading event..."}</p>
          </div>
          <button onClick={() => navigate('/admin/events')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 hover:border-white/20">
            <X className="w-6 h-6 text-slate-300" />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scanner Panel */}
          <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
            <div className="bg-[#0a1120] p-6 rounded-3xl border border-white/10 shadow-xl flex-1">
              <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-6 flex items-center gap-2"><Camera className="w-5 h-5 text-emerald-500" /> Scanner</h2>
              
              <div className={cn("relative bg-black rounded-2xl overflow-hidden mb-6 border-2 flex items-center justify-center transition-all", scanning ? "border-emerald-500/50" : "border-white/5 aspect-square")}>
                {/* ALWAYS render the div container so html5-qrcode can mount to it */}
                <div 
                  id="service-qr-reader" 
                  ref={qrRef} 
                  className={cn("w-full bg-black overflow-hidden", !scanning && "hidden")}
                ></div>

                {!scanning && (
                  <div className="text-center p-8 absolute inset-0 flex flex-col items-center justify-center bg-white/5">
                    <Camera className="w-16 h-16 text-slate-600 mb-4" />
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Camera Off</p>
                  </div>
                )}
                
                {scanning && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[scan_2s_ease-in-out_infinite] pointer-events-none z-10" />
                )}
              </div>
              
              <button 
                onClick={scanning ? stopScanner : startScanner}
                className={cn(
                  "w-full py-4 rounded-xl text-white font-black uppercase text-sm tracking-widest transition-all shadow-lg",
                  scanning 
                    ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30" 
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                )}
              >
                {scanning ? "Stop Scanner" : "Start Camera"}
              </button>

              {cameraError && (
                <p className="mt-4 text-xs font-bold text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{cameraError}</p>
              )}
            </div>
            
            <div className="bg-[#0a1120] p-6 rounded-3xl border border-white/10 shadow-xl">
              <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-blue-500" /> Manual Entry</h2>
              <form onSubmit={handleManualLookup} className="flex gap-3">
                <input 
                  type="text" 
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  placeholder="Badge ID / UUID"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-5 py-3.5 text-sm font-medium outline-none focus:border-emerald-500/50 text-white placeholder:text-slate-600 transition-colors"
                />
                <button type="submit" disabled={loading || !manualId.trim()} className="p-4 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors font-black">
                  <Search className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>

          {/* Profile Panel */}
          <div className="lg:col-span-2">
            <div className="bg-[#0a1120] p-8 rounded-3xl border border-white/10 min-h-[600px] h-full flex flex-col shadow-xl">
              {loading ? (
                <div className="flex flex-col items-center justify-center flex-1 text-emerald-500 space-y-6">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-black uppercase tracking-widest text-emerald-400">Looking up profile...</p>
                </div>
              ) : athlete ? (
                <div className="space-y-8 flex-1 animate-in fade-in zoom-in-95 duration-300">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-8 gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-black rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-xl">
                        {athlete.photo_url ? (
                          <img src={athlete.photo_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                          {athlete.first_name} {athlete.last_name}
                          {athlete.status === "approved" ? (
                            <div className="bg-emerald-500/20 p-1.5 rounded-full"><CheckCircle className="w-6 h-6 text-emerald-500" /></div>
                          ) : (
                            <div className="bg-red-500/20 p-1.5 rounded-full"><XCircle className="w-6 h-6 text-red-500" /></div>
                          )}
                        </h2>
                        <p className="text-lg font-bold text-slate-400 uppercase tracking-widest mt-1">{athlete.club || "No Club specified"}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest rounded-lg border border-blue-500/30">
                            {athlete.role}
                          </span>
                          {athlete.nationality && (
                            <span className="px-3 py-1 bg-white/5 text-slate-300 text-xs font-black uppercase tracking-widest rounded-lg border border-white/10">
                              {athlete.nationality}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-5 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Hash className="w-4 h-4 text-slate-400" /> Badge ID</p>
                      <p className="text-lg font-black text-white">{athlete.badge_number || "N/A"}</p>
                    </div>
                    <div className="p-5 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-slate-400" /> UUID</p>
                      <p className="text-sm font-mono text-slate-300 break-all">{athlete.accreditation_id?.split('-').pop() || athlete.id.split('-').pop()}</p>
                    </div>
                  </div>

                  {/* Bookings */}
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" /> Scheduled Services / Bookings
                    </h3>
                    
                    {bookings.length > 0 ? (
                      <div className="space-y-4">
                        {bookings.map(b => {
                          const slotDef = bookingConfig?.slots?.find(s => s.id === b.slot_id);
                          return (
                            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl shadow-sm gap-5">
                              <div>
                                <h4 className="text-lg font-black text-emerald-400 uppercase flex items-center gap-2">
                                  <Activity className="w-5 h-5 text-emerald-500" /> {b.group_name}
                                </h4>
                                <p className="text-xs font-bold text-slate-400 uppercase mt-2 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" /> {slotDef ? `${slotDef.date} • ${slotDef.time_frame}` : "Time details unavailable"}
                                </p>
                              </div>
                              <button 
                                onClick={() => issueToken(b.group_name)}
                                className="w-full sm:w-auto px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-colors shrink-0"
                              >
                                Fulfill Token
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 bg-black/30 border border-white/5 rounded-2xl text-center border-dashed">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-500">No active bookings found</p>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-orange-500 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" /> Generic Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button onClick={() => issueToken("Meal Collection")} className="p-5 bg-black/40 border border-white/5 hover:border-orange-500/50 hover:bg-orange-500/10 rounded-2xl text-sm font-black uppercase text-slate-300 hover:text-orange-400 transition-all text-left flex items-center justify-between group shadow-sm">
                        Meal Collection <ChevronRight className="w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                      </button>
                      <button onClick={() => issueToken("Equipment Issue")} className="p-5 bg-black/40 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-2xl text-sm font-black uppercase text-slate-300 hover:text-blue-400 transition-all text-left flex items-center justify-between group shadow-sm">
                        Equipment Issue <ChevronRight className="w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-20 opacity-40">
                  <Search className="w-24 h-24 mx-auto mb-6 text-slate-500" />
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">Ready to Scan</h3>
                  <p className="text-sm font-bold tracking-widest uppercase text-slate-400 mt-3 max-w-sm mx-auto">Scan an athlete's QR badge or enter their ID to pull up service profiles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
