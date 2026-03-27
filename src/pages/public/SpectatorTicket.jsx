import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  Download, 
  Printer, 
  Share2,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import * as QRCodeLib from "qrcode";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { TicketingAPI, EventsAPI } from "../../lib/storage";
import Button from "../../components/ui/Button";
import Card, { CardContent } from "../../components/ui/Card";
import SwimmingBackground from "../../components/ui/SwimmingBackground";

export default function SpectatorTicketView() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [event, setEvent] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const ticketRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const orderData = await TicketingAPI.validateOrder(id);
      if (orderData) {
        setOrder(orderData);
        const eventData = await EventsAPI.getById(orderData.event_id);
        setEvent(eventData);

        // Generate QR Code
        const qrUrl = await QRCodeLib.toDataURL(orderData.qr_code_id, {
          width: 800,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        setQrCodeUrl(qrUrl);
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEventDatesCount = () => {
    if (!event?.startDate || !event?.endDate) return 0;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const isFullEvent = order?.selected_dates?.length === getEventDatesCount() && getEventDatesCount() > 1;
  const isSingleDayInMulti = !isFullEvent && getEventDatesCount() > 1;

  const downloadPDF = async () => {
    if (!ticketRef.current) return;
    const canvas = await html2canvas(ticketRef.current, {
      scale: 2, // Reduced from 3 to 2 for better balance
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false
    });
    
    // Switch to JPEG with 0.8 quality to drastically reduce file size
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [85, 150]
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Ticket_${order.customer_name.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-extralight tracking-widest">VALIDATING TICKET...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <Ticket className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase">Ticket Not Found</h2>
          <p className="text-slate-400 max-w-sm">This link might be invalid or the order has been cancelled.</p>
          <Link to="/">
            <Button variant="secondary" className="mt-4">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SwimmingBackground>
      <div className="min-h-screen py-12 px-4 flex flex-col items-center">
        
        {/* Navigation / Actions */}
        <div className="w-full max-w-[400px] flex justify-between items-center mb-8 px-2">
          <Link to={`/tickets/${event?.slug}`} className="text-cyan-400 hover:text-white flex items-center gap-1 transition-colors text-sm font-bold uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" />
            Portal
          </Link>
          <div className="flex gap-3">
             <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-white transition-colors" title="Print">
               <Printer className="w-5 h-5" />
             </button>
             <button onClick={downloadPDF} className="p-2 text-slate-400 hover:text-white transition-colors" title="Download">
               <Download className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* The Premium Ticket */}
        <motion.div 
          initial={{ opacity: 0, y: 30, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          className="relative group perspective-1000"
        >
          {/* Shine Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-primary-400 to-purple-500 rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
          
          <div 
            ref={ticketRef}
            className="relative w-full max-w-[360px] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col"
            style={{ minHeight: '600px' }}
          >
            {/* Header Section (F1 Inspired) */}
            <div className="h-52 relative bg-slate-950 overflow-hidden">
               {/* Carbon Fiber Pattern Overlay */}
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm20 20h20v20H20V20zM0 20h10v10H0V20zm10 10h10v10H10V30zM20 0h10v10H20V0zm10 10h10v10H30V10z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />
               
               {event?.bannerUrl ? (
                 <img src={event.bannerUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" alt="Banner" />
               ) : (
                 <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-950/50 to-cyan-900" />
               )}
               
               {/* Speed Accent */}
               <div className="absolute top-0 right-0 w-32 h-64 bg-cyan-500/10 -skew-x-12 translate-x-16" />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
               
               <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
                  <div className="px-3 py-1 bg-cyan-600 text-white rounded-md transform -skew-x-12 shadow-lg shadow-cyan-900/40">
                    <span className="text-[10px] font-black italic uppercase tracking-[0.2em] block skew-x-12">Spectator Pass</span>
                  </div>
                  {event?.logoUrl && (
                    <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
                      <img src={event.logoUrl} className="h-8 object-contain" alt="Logo" />
                    </div>
                  )}
               </div>

               <div className="absolute bottom-6 left-8 right-8 z-10">
                  <h2 className="text-lg font-[900] text-white uppercase mb-4 tracking-tight truncate transform -skew-x-2">
                    {event?.name}
                  </h2>
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] font-black">{new Date(event?.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                      <MapPin className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] font-black truncate max-w-[150px]">{event?.location}</span>
                    </div>
                  </div>
               </div>
            </div>

            {/* Body Section */}
            <div className="flex-1 bg-white p-8 flex flex-col items-center">
               <div className="w-full flex justify-between items-end mb-8 pt-2">
                 <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pass Holder</h3>
                    <p className="text-xl font-black text-slate-900 uppercase leading-none">{order.customer_name}</p>
                 </div>
                 <div className="text-right">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pass Type</h3>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase inline-block ${isFullEvent ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-primary-500'}`}>
                      {isFullEvent ? 'Full Event Pass' : 'General Entry'}
                    </div>
                 </div>
               </div>

               {/* Dates Section */}
               {(order.selected_dates?.length > 0 || isFullEvent) && (
                 <div className="w-full mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Calendar className="w-3 h-3 text-primary-500" /> 
                       Validity Period
                    </p>
                    <div className="flex flex-wrap gap-2">
                       {isFullEvent ? (
                         <div className="w-full flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900">FULL EVENT ACCESS</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{getEventDatesCount()} DAYS</span>
                         </div>
                       ) : (
                         order.selected_dates?.map(date => (
                           <span key={date} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 shadow-sm">
                             {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                           </span>
                         ))
                       )}
                    </div>
                 </div>
               )}

               {/* QR Code Container */}
               <div className="relative w-full aspect-square bg-slate-50 rounded-[2rem] p-6 border-4 border-slate-100 flex items-center justify-center group/qr">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Valid for {order.ticket_count} Persons
                    </span>
                  </div>
                  <img src={qrCodeUrl} className="w-full h-full object-contain mix-blend-multiply" alt="Ticket QR" />
               </div>

               <div className="mt-8 text-center space-y-1">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Official Entry Code</p>
                 <p className="text-sm font-mono text-slate-500 font-bold">{order.qr_code_id}</p>
               </div>
            </div>

            {/* Footer / Stub Effect */}
            <div className="relative h-16 bg-slate-50 border-t-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
               {/* Ticket Cut-outs */}
               <div className="absolute -left-4 w-8 h-8 rounded-full bg-swim-deep -translate-y-1/2 top-0 shadow-inner" />
               <div className="absolute -right-4 w-8 h-8 rounded-full bg-swim-deep -translate-y-1/2 top-0 shadow-inner" />
               
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em] transform rotate-180" style={{ writingMode: 'vertical-rl' }}>
                 Apex Accredit Pro • Apex Sports Finance
               </p>
            </div>
          </div>
        </motion.div>

        <p className="mt-12 text-slate-500 text-xs font-medium text-center max-w-[300px] leading-relaxed">
          This digital ticket is valid for one-time entry for the group size specified. 
          Please ensure the QR code is clearly visible on your screen.
        </p>

        <div className="mt-8 flex gap-4">
          <Button variant="ghost" icon={Share2} className="text-slate-400">Share Link</Button>
          <Button onClick={downloadPDF} icon={Download}>Get PDF</Button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #app, #app * { visibility: hidden; }
          .min-h-screen, .min-h-screen * { visibility: hidden; }
          [ref="ticketRef"], [ref="ticketRef"] * { visibility: visible; }
          .relative.w-full.max-w-\[360px\] { 
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
        .perspective-1000 { perspective: 1000px; }
      `}} />
    </SwimmingBackground>
  );
}
