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
  Sparkles,
  CreditCard
} from "lucide-react";
import * as QRCodeLib from "qrcode";

import { supabaseUrl, supabaseAnonKey } from "../../lib/supabase";
import { TicketingAPI, EventsAPI } from "../../lib/storage";
import Button from "../../components/ui/Button";
import Card, { CardContent } from "../../components/ui/Card";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { SpectatorTicketCard } from "../../components/public/SpectatorTicketCard";

export default function SpectatorTicketView() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [qrCodes, setQrCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const ticketRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    let pollInterval;
    let pollAttempts = 0;
    const maxAttempts = 15; // Poll for 45 seconds max

    if (order && order.payment_status === 'pending') {
      const autoVerify = async () => {
        try {
          const verifyPayload = order.stripe_session_id 
            ? { sessionId: order.stripe_session_id }
            : { orderId: order.qr_code_id };

          console.log(`Self-healing attempt:`, verifyPayload);
          const res = await fetch(`${supabaseUrl}/functions/v1/verify-session`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify(verifyPayload)
          });
          const result = await res.json();
          
          if (result.success) {
            console.log("Self-healing successful: Order approved autonomously.");
            const orderData = await TicketingAPI.validateOrder(id);
            setOrder(orderData);
            loadData();
            return true;
          }
        } catch (err) {
          console.error("Auto-verify failed:", err);
        }
        return false;
      };

      pollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts >= maxAttempts) {
          clearInterval(pollInterval);
          return;
        }
        
        console.log(`Self-healing polling (Attempt ${pollAttempts})...`);
        const done = await autoVerify();
        if (done) clearInterval(pollInterval);
      }, 3000);
      
      // Also run immediately on mount
      autoVerify();
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id, order?.payment_status]);

  const loadData = async () => {
    // We only set loading true on the initial load to avoid flickering during polling
    if (!order) setLoading(true); 
    try {
      const orderData = await TicketingAPI.validateOrder(id);
      if (orderData) {
        setOrder(orderData);
        
        const [eventData, ticketsData] = await Promise.all([
          EventsAPI.getById(orderData.event_id),
          TicketingAPI.getTicketsForOrder(orderData.id)
        ]);
        
        setEvent(eventData);
        
        const finalTickets = ticketsData.length > 0 ? ticketsData : [{ ticket_code: orderData.qr_code_id }];
        setTickets(finalTickets);

        // Generate QRs for all tickets
        const qrs = {};
        await Promise.all(finalTickets.map(async (t) => {
          const code = t.ticket_code || orderData.qr_code_id || ("TKT-" + Math.random().toString(36).substr(2,9));
          const url = await QRCodeLib.toDataURL(code, {
            width: 800,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          });
          qrs[t.ticket_code || code] = url;
        }));
        setQrCodes(qrs);
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
    try {
      const { downloadMultiTicketPDF } = await import("../../components/accreditation/cardExport");
      const ticketIds = tickets.map((t, i) => `ticket-capture-${i}`);
      const sanitizeName = (order.customer_name || "Customer").replace(/[^a-z0-9]/gi, '_');
      const fileName = `${sanitizeName}_Tickets.pdf`;
      
      await downloadMultiTicketPDF(ticketIds, fileName);
    } catch (err) {
      console.error("PDF Download failed:", err);
    }
  };

  const isApproved = order?.payment_status === 'paid' || ['cash', 'magnati'].includes(order?.payment_provider);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-extralight tracking-widest">VALIDATING TICKETS...</p>
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
          <h2 className="text-3xl font-black text-white uppercase">Order Not Found</h2>
          <p className="text-slate-400 max-w-sm">This link might be invalid or the order has been cancelled.</p>
          <Link to="/">
            <Button variant="secondary" className="mt-4">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 animate-pulse">
            <CreditCard className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Payment Pending</h2>
          <p className="text-slate-400 max-w-sm mx-auto">We're waiting for payment confirmation. Please refresh the page in a few moments.</p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button onClick={() => window.location.reload()} variant="primary" className="w-full">
              Refresh Status
            </Button>
            <Link to={`/tickets/${event?.slug}`} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
              Return to Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SwimmingBackground>
      <div className="min-h-screen py-12 px-4 flex flex-col items-center">
        
        {/* Navigation / Actions */}
        <div className="w-full max-w-[600px] flex justify-between items-center mb-8 px-2">
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

        {/* Multi-Ticket Display List */}
        <div className="flex flex-col gap-12 w-full items-center">
          {tickets.map((t, index) => (
            <motion.div 
              key={t.ticket_code}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative group w-full flex justify-center"
            >
              <div className="shrink-0 scale-[0.55] xs:scale-[0.6] sm:scale-75 md:scale-85 lg:scale-100 origin-top">
                <SpectatorTicketCard 
                  order={order} 
                  event={event} 
                  qrCodeUrl={qrCodes[t.ticket_code]} 
                  ticketIndex={index + 1}
                  totalTickets={tickets.length}
                  isPrinting={false} 
                  ticket={t}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 bg-white/5 border border-white/10 rounded-2xl p-6 text-center max-w-[500px] backdrop-blur-sm shadow-xl">
          <p className="text-cyan-100 text-sm font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> Entry Instructions
          </p>
          <p className="text-slate-300 text-sm leading-relaxed">
            These tickets are valid for one-time entry. To ensure a smooth experience at the venue, please have your QR codes clearly visible on your screen. 
            <span className="block mt-2 font-bold text-white">We recommend taking a screenshot of your tickets now for quick offline access, or downloading the PDF version below.</span>
          </p>
        </div>

        <div className="mt-12 flex gap-4 sticky bottom-8 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 shadow-2xl">
          <Button variant="ghost" icon={Share2} className="text-slate-400">Share Link</Button>
          <Button onClick={downloadPDF} icon={Download} className="shadow-lg shadow-cyan-500/20">Download All PDF</Button>
        </div>

        {/* Hidden Capture Area (for high-quality PDF generation) */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '600px', backgroundColor: 'white' }}>
          {tickets.map((t, index) => (
             <div 
               key={`cap-${t.ticket_code}`} 
               id={`ticket-capture-${index}`} 
               style={{ 
                 width: '600px', 
                 height: '240px', 
                 overflow: 'hidden',
                 backgroundColor: 'white',
                 position: 'relative'
               }}
             >
                <SpectatorTicketCard 
                  order={order} 
                  event={event} 
                  qrCodeUrl={qrCodes[t.ticket_code]} 
                  ticketIndex={index + 1}
                  totalTickets={tickets.length}
                  isPrinting={true} 
                  ticket={t}
                />
             </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #app, #app * { visibility: hidden; }
          .min-h-screen, .min-h-screen * { visibility: hidden; }
          [ref="ticketRef"], [ref="ticketRef"] * { visibility: visible; }
          /* Ensure horizontal ticket fits on paper */
          .origin-top { 
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 600px !important;
            transform: scale(1) !important;
          }
        }
        .perspective-1000 { perspective: 1000px; }
      `}} />
    </SwimmingBackground>
  );
}
