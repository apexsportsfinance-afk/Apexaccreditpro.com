import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield, ChevronRight, Loader2, QrCode, Download, Printer, MapPin, Calendar, AlertCircle, Check, ArrowRight, Sparkles } from "lucide-react";
import { TicketingAPI, EventsAPI } from "../../lib/storage";
import { useToast } from "../../components/ui/Toast";
import { downloadMultiTicketPDF } from "../../components/accreditation/cardExport";
import * as QRCodeLib from "qrcode";
import { SpectatorTicketCard } from "../../components/public/SpectatorTicketCard";

export default function GenericPass() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id");
  const [step, setStep] = useState("pin"); // 'pin' | 'selection' | 'pass'
  const [pin, setPin] = useState("");
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [error, setError] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (!eventId) {
      setError("No event specified. Please check your link.");
      setLoading(false);
      return;
    }
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const data = await EventsAPI.getById(eventId);
      if (!data) throw new Error("Event not found");
      setEvent(data);
    } catch (err) {
      setError("Unable to load event details.");
    } finally {
      setLoading(false);
    }
  };

  const eventDates = useMemo(() => {
    if (!event?.startDate || !event?.endDate) return [];
    const dates = [];
    let current = new Date(event.startDate);
    const end = new Date(event.endDate);
    while (current <= end) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [event?.startDate, event?.endDate]);

  const isFullEvent = selectedDates.length === eventDates.length && eventDates.length > 1;

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      toast.error("Please enter a valid PIN");
      return;
    }

    setVerifying(true);
    try {
      const correctPin = await TicketingAPI.getSecuritySetting("generic_pass_pin");
      if (pin === correctPin) {
        if (eventDates.length > 1) {
          setStep("selection");
        } else {
          // Auto-select the only date and generate
          const onlyDate = eventDates;
          setSelectedDates(onlyDate);
          await generatePass(onlyDate);
        }
        toast.success("Access Granted");
      } else {
        toast.error("Invalid Access PIN");
        setPin("");
      }
    } catch (err) {
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const toggleDate = (date) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      return [...prev, date].sort();
    });
  };

  const generatePass = async (overrideDates = null) => {
    const datesToUse = overrideDates || selectedDates;
    if (datesToUse.length === 0 && eventDates.length > 0) {
      toast.error("Please select at least one day");
      return;
    }

    try {
      const isFull = datesToUse.length === eventDates.length && eventDates.length > 1;
      const dateString = isFull ? 'FULL-EVENT' : datesToUse.join(',');
      const safeName = (guestName || "Generic Spectator").replace(/\|/g, '');
      const code = `GENERIC|${event.id}|${dateString}|${safeName}`;
      const url = await QRCodeLib.toDataURL(code, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrCodeUrl(url);
      setStep("pass");
    } catch (qrErr) {
      console.error("QR Generation failed", qrErr);
      toast.error("Failed to generate pass");
    }
  };

  const handleDownload = async () => {
    try {
      toast.info("Generating PDF...");
      const fileName = `${(guestName || 'Spectator').replace(/\s+/g, '_')}_Pass.pdf`;
      await downloadMultiTicketPDF(['generic-capture-area'], fileName);
      toast.success("Download complete!");
    } catch (err) {
      toast.error("Download failed. Please use Print -> Save as PDF.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-swim-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-swim-deep flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900/50 border border-red-500/20 rounded-3xl p-8 backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Error</h2>
          <p className="text-slate-400 font-extralight mb-8">{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-swim-deep relative overflow-hidden flex items-center justify-center p-6 text-white">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {step === "pin" ? (
          <motion.div
            key="pin-step"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            className="max-w-md w-full"
          >
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-[2.5rem] p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
              {/* Event Context */}
              <div className="text-center mb-10">
                {event.logoUrl && (
                  <img src={event.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain drop-shadow-2xl" />
                )}
                <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2 leading-none">
                  Generic Pass
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                  {event.name} • 2026
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-8">
                <div className="relative">
                  <div className="absolute -top-3 left-6 px-3 bg-slate-900 text-emerald-400 text-[10px] font-black uppercase tracking-widest z-10 border border-emerald-500/20 rounded-full">
                    Protected Access
                  </div>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Enter Security PIN"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-6 py-5 text-center text-white font-mono text-3xl tracking-[1em] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:tracking-normal placeholder:text-base placeholder:text-slate-600 shadow-inner"
                    autoFocus
                  />
                </div>

                <button
                  disabled={verifying || pin.length < 4}
                  className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-950/50 border border-emerald-400/20 relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  {verifying ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <span>Verify Access</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex items-center justify-center gap-2 text-slate-500">
                <Shield className="w-4 h-4 text-emerald-500/50" />
                <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Secure Portal</span>
              </div>
            </div>
          </motion.div>
        ) : step === "selection" ? (
          <motion.div
            key="selection-step"
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 1.1, x: -50 }}
            className="max-w-xl w-full"
          >
             <div className="bg-slate-900/40 border border-slate-800/50 rounded-[2.5rem] p-10 backdrop-blur-2xl shadow-2xl space-y-8">
                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <Calendar className="w-6 h-6 text-emerald-400" />
                    Pass Validity
                  </h2>
                  <p className="text-slate-400 text-sm font-light">Select the dates this pass will be valid for.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => setSelectedDates(eventDates)}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${isFullEvent ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700'}`}
                   >
                     <Sparkles className={`w-8 h-8 ${isFullEvent ? 'text-emerald-400' : 'text-slate-700'}`} />
                     <span className="font-black uppercase tracking-widest text-xs">Full Event</span>
                   </button>
                   <button 
                    onClick={() => setSelectedDates([])}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${!isFullEvent && selectedDates.length > 0 ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700'}`}
                   >
                     <Calendar className={`w-8 h-8 ${!isFullEvent && selectedDates.length > 0 ? 'text-emerald-400' : 'text-slate-700'}`} />
                     <span className="font-black uppercase tracking-widest text-xs">Custom Days</span>
                   </button>
                </div>

                 <div className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Guest Name</label>
                       <input 
                         type="text" 
                         value={guestName}
                         onChange={(e) => setGuestName(e.target.value)}
                         placeholder="Enter Full Name"
                         className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contact Email</label>
                       <input 
                         type="email" 
                         value={guestEmail}
                         onChange={(e) => setGuestEmail(e.target.value)}
                         placeholder="example@email.com"
                         className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                       />
                     </div>
                   </div>

                   <div className="flex flex-wrap justify-center gap-3">
                     {eventDates.map(date => (
                       <button
                         key={date}
                         onClick={() => toggleDate(date)}
                         className={`px-4 py-3 rounded-xl border-2 transition-all flex flex-col items-center min-w-[90px] ${selectedDates.includes(date) ? 'border-emerald-500/50 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/10' : 'border-slate-800/50 bg-slate-950/30 text-slate-500'}`}
                       >
                         <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5">
                           {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                         </span>
                         <span className="text-sm font-bold text-white">
                           {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                         </span>
                       </button>
                     ))}
                   </div>
                 </div>

                <button
                  onClick={() => generatePass()}
                  disabled={selectedDates.length === 0}
                  className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-950/50 border border-emerald-400/20 group"
                >
                  <span>Generate Access Pass</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => setStep("pin")}
                  className="w-full text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
                >
                  Change Security PIN
                </button>
             </div>
          </motion.div>
        ) : (
          <motion.div
            key={`pass-${qrCodeUrl ? 'ready' : 'loading'}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-6xl w-full flex flex-col items-center gap-12"
          >
            {/* THE OFFICIAL TICKET CARD */}
            <div className="relative group w-full flex justify-center">
               <div className="shrink-0 scale-[0.55] xs:scale-[0.55] sm:scale-75 md:scale-90 lg:scale-100 origin-top">
                  {qrCodeUrl && (
                    <SpectatorTicketCard 
                      order={{
                        qr_code_id: `GEN-${(eventId || '0000').slice(0, 8).toUpperCase()}`,
                        customer_name: (guestName || "OFFICIAL SPECTATOR").toUpperCase(),
                        customer_email: guestEmail || "official@apx.com",
                        payment_status: 'paid',
                        payment_provider: 'magnati',
                        selected_dates: selectedDates || []
                      }}
                      event={event || { name: 'EVENT', location: 'VENUE' }}
                      qrCodeUrl={qrCodeUrl}
                      ticket={{
                        ticket_name: isFullEvent ? 'FULL EVENT PASS' : 'SPECTATOR ACCESS',
                        price: 0,
                        valid_date: isFullEvent ? 'Full Event' : (selectedDates?.length === 1 ? selectedDates[0] : `${selectedDates?.length || 0} Days`)
                      }}
                      isPrinting={false}
                    />
                  )}
               </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                <button 
                  onClick={handleDownload}
                  className="group flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-950/20 hover:scale-105 active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
                <button 
                  onClick={() => window.print()}
                  className="group flex items-center gap-3 px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-black/20 hover:scale-105 active:scale-95"
                >
                  <Printer className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  Print Pass
                </button>
              </div>
              <button 
                onClick={() => setStep("selection")}
                className="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors border-b border-transparent hover:border-white/20 pb-1"
              >
                Edit Attendance Days
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .min-h-screen, .min-h-screen * { visibility: hidden; }
          #app, #app * { visibility: hidden; }
          
          /* Show ONLY the Ticket Card */
          #spectator-ticket-card, #spectator-ticket-card * { visibility: visible; }
          
          #spectator-ticket-card {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) scale(1.0) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            visibility: visible !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}} />

      {/* Hidden Capture Area for PDF Generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="generic-capture-area" style={{ width: '600px', height: '240px', backgroundColor: 'white', position: 'relative', visibility: 'visible', opacity: 1 }}>
          {qrCodeUrl && (
            <SpectatorTicketCard 
              order={{
                qr_code_id: `GEN-${(eventId || '0000').slice(0, 8).toUpperCase()}`,
                customer_name: (guestName || "OFFICIAL SPECTATOR").toUpperCase(),
                customer_email: guestEmail || "official@apx.com",
                payment_status: 'paid',
                payment_provider: 'magnati',
                selected_dates: selectedDates || []
              }}
              event={event || { name: 'EVENT', location: 'VENUE' }}
              qrCodeUrl={qrCodeUrl}
              ticket={{
                ticket_name: isFullEvent ? 'FULL EVENT PASS' : 'SPECTATOR ACCESS',
                price: 0,
                valid_date: isFullEvent ? 'Full Event' : (selectedDates?.length === 1 ? selectedDates[0] : `${selectedDates?.length || 0} Days`)
              }}
              isPrinting={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
