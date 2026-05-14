// Deployment Trigger: 2026-03-31T17:39:00Z
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Ticket, 
  Users, 
  CreditCard, 
  Check, 
  ChevronRight, 
  ShoppingBag, 
  Plus, 
  Minus,
  Sparkles,
  Calendar,
  MapPin,
  X,
  Download
} from "lucide-react";
import Button from "../../components/ui/Button";
import { SpectatorTicketCard } from "../../components/public/SpectatorTicketCard";
import Card, { CardContent } from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import * as QRCodeLib from "qrcode";
import { sendTicketEmail } from "../../lib/email";

import { TicketingAPI, EventsAPI } from "../../lib/storage";
import { supabase, supabaseUrl, supabaseAnonKey } from "../../lib/supabase";

export default function SpectatorPortal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  // 1. State
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrCodes, setQrCodes] = useState({}); // APX-MOD: Map of ticket_code -> QR URL
  const [customerData, setCustomerData] = useState({ name: "", email: "" });
  const [selectedDates, setSelectedDates] = useState([]);

  // 2. Memoized Values
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

  // 3. Effects
  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    if (eventDates.length === 1 && selectedDates.length === 0) {
      setSelectedDates(eventDates);
    }
  }, [eventDates]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');

    // APX-101: Auto-Recovery & Persistent Verification State
    const initVerification = async () => {
      // 1. If we have a session_id in the URL, prioritize it
      if (sessionId) {
        // Immediately clean URL to prevent refresh loops
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Deduplicate: Don't verify the same session twice in the same browser session
        if (sessionStorage.getItem('last_processed_session') === sessionId) return;
        sessionStorage.setItem('last_processed_session', sessionId);
        
        await verifyAndCompleteOrder(sessionId);
      } else {
        // 2. Self-Healing: Check if there's a recent pending order in localStorage
        const latestOrderId = localStorage.getItem('latest_apx_order_id');
        if (latestOrderId) {
          console.log("APX-INFO: Checking status of latest local order:", latestOrderId);
          const order = await TicketingAPI.validateOrder(latestOrderId);
          if (order) {
            if (order.payment_status === 'paid') {
              // Successfully paid! Load it.
              loadCompletedOrder(order);
            } else if (order.payment_status === 'pending') {
              // Still pending: Attempt one-shot verification with orderId recovery
              console.log("APX-INFO: Order still pending. Attempting autonomous recovery...");
              verifyAndCompleteOrder(null, latestOrderId);
            }
          }
        }
      }
    };

    initVerification();
  }, []);

  const loadCompletedOrder = async (order) => {
    try {
      const qrs = {};
      const ticketsToProcess = order.tickets?.length > 0 ? order.tickets : [{ ticket_code: order.qr_code_id }];
      
      await Promise.all(ticketsToProcess.map(async (t, idx) => {
        // [APX-FIX] Use a consistent key for mapping (ticket_code or fallback to orderId_index)
        const code = t.ticket_code || order.qr_code_id || ("TKT-" + Math.random().toString(36).substr(2,9));
        const key = t.ticket_code || `fallback_${idx}`;
        
        qrs[key] = await QRCodeLib.toDataURL(code, {
          width: 400,
          margin: 2,
          color: { dark: '#0e7490', light: '#ffffff' }
        });
      }));

      setQrCodes(qrs);
      // Fallback for legacy components
      setQrCodeUrl(Object.values(qrs)[0]);
      setCompletedOrder(order);
    } catch (err) {
      console.error("Order load error:", err);
    }
  };

  const verifyAndCompleteOrder = async (sessionId, orderId = null) => {
    try {
      setIsSubmitting(true);
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${authSession?.access_token || supabaseAnonKey}`
        },
        body: JSON.stringify({ sessionId, orderId })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Successful verification!
        const finalOrderId = data.session.metadata.orderId || orderId;
        const order = await TicketingAPI.validateOrder(finalOrderId);
        
        if (order) {
          await loadCompletedOrder(order);
          // If a webhook was supposed to send the email, this is a safety fallback
          if (order.customer_email) {
            const eData = await EventsAPI.getById(order.event_id);
            sendTicketEmail({
              to: order.customer_email,
              name: order.customer_name,
              eventName: eData?.name || "Event",
              ticketCount: order.ticket_count,
              amountPaid: order.total_amount,
              paymentMethod: "Card / Stripe",
              eventData: eData,
              qrCodeDataUrl: await QRCodeLib.toDataURL(order.qr_code_id),
              qrCodeId: order.qr_code_id,
              orderId: order.id
            }).catch(e => console.error("Ticket email error:", e));
          }
        }
        toast.success("Payment successful!");
      } else {
        // If it failed but it wasn't a manual action, we don't necessarily want to toast error
        // as it might just be the autonomous check failing in the background.
        if (sessionId) {
          toast.error("Payment verification pending. Please refresh in a moment if you have already paid.");
        }
      }
    } catch (err) {
      console.error(err);
      if (sessionId) toast.error("Failed to verify payment status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Methods
  const loadData = async () => {
    setLoading(true);
    try {
      let eventData;
      if (slug && slug !== 'undefined') {
        eventData = await EventsAPI.getBySlug(slug);
      }
      
      // FALLBACK Logic: If slug is missing or event not found, get the latest active event
      // This prevents 'Scan to Book' QR codes from bouncing back to Home Page
      if (!eventData) {
        const all = await EventsAPI.getAll();
        eventData = all.find(e => e.registrationOpen) || all[0];
        if (eventData) {
          // Auto-fix URL silently for consistency
          navigate(`/tickets/${eventData.slug}`, { replace: true });
        }
      }

      setEvent(eventData);
      if (eventData) {
        const [types, pkgs] = await Promise.all([
          TicketingAPI.getTypes(eventData.id),
          TicketingAPI.getPackages(eventData.id)
        ]);
        setTicketTypes(types.filter(t => t.isActive));
        setPackages(pkgs.filter(p => p.isActive));
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
      toast.error("Failed to load ticketing information");
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      
      // APX-MOD: Removed auto-selection of dates for Full Event passes to give spectators manual control

      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const toggleDate = (date) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      return [...prev, date].sort();
    });
  };

  const selectFullEvent = () => {
    if (isFullEvent) {
      setSelectedDates([]);
    } else {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const validDates = eventDates.filter(d => d >= todayStr);
      setSelectedDates(validDates);
    }
  };

  const hasFullEventInCart = Object.keys(cart).some(id => {
    const item = [...ticketTypes, ...packages].find(i => i.id === id);
    return item?.isFullEvent;
  });

  // Base total for the main selection bar (Quantity * Price)
  const totalAmount = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    return sum + (Number(item.price) * qty);
  }, 0);

  // Final calculated total for dynamic day selection in checkout
  const finalTotal = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    const itemPrice = Number(item.price) * qty;
    // Multiplicative factor: 1 if full event pass, else number of days for individual tickets
    const factor = item.isFullEvent ? 1 : (selectedDates.length || 1);
    return sum + (itemPrice * factor);
  }, 0);

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // APX-MOD: Mandatory day selection validation
    const hasIndividualTickets = Object.keys(cart).some(id => {
      const item = [...ticketTypes, ...packages].find(i => i.id === id);
      return !item?.isFullEvent;
    });

    if (hasIndividualTickets && selectedDates.length === 0) {
      toast.error("Please select at least one attendance day");
      return;
    }

    setShowCheckout(true);
  };

  const handleConfirmPurchase = async (e) => {
    e.preventDefault();
    if (!customerData.name || !customerData.email) {
      toast.error("Please fill in your details");
      return;
    }

    const hasIndividualTickets = Object.keys(cart).some(id => {
      const item = [...ticketTypes, ...packages].find(i => i.id === id);
      return !item?.isFullEvent;
    });

    if (hasIndividualTickets && selectedDates.length === 0 && eventDates.length > 0) {
      toast.error("Please select at least one date");
      return;
    }

    setIsSubmitting(true);
    try {
      // APX-MOD: Calculate physical physical tickets (One per person per day for individual, one per person for packages)
      const expandedTickets = [];
      Object.entries(cart).forEach(([id, qty]) => {
        const item = [...ticketTypes, ...packages].find(i => i.id === id);
        if (!item || qty <= 0) return;

        if (item.isFullEvent) {
          // Packages/Full Event are 1 ticket per qty
          for (let i = 0; i < qty; i++) {
            expandedTickets.push({
              name: item.name,
              price: Number(item.price),
              date: 'Full Event',
              isFullEvent: true
            });
          }
        } else {
          // Individual tickets are 1 per qty PER day
          for (let i = 0; i < qty; i++) {
            selectedDates.forEach(date => {
              expandedTickets.push({
                name: item.name,
                price: Number(item.price),
                date: date,
                isFullEvent: false
              });
            });
          }
        }
      });

      const orderData = {
        eventId: event.id,
        customerName: customerData.name,
        customerEmail: customerData.email,
        totalAmount: finalTotal,
        ticketCount: expandedTickets.length,
        ticketItems: expandedTickets, // APX-MOD: Pass expanded items
        selectedDates: selectedDates,
        paymentStatus: 'pending'
      };

      // 1. Create order record first
      const order = await TicketingAPI.createOrder(orderData);
      
      // APX-101: Persist for autonomous self-healing on refresh
      localStorage.setItem('latest_apx_order_id', order.qr_code_id);

      const itemsForStripe = [];
      Object.entries(cart).forEach(([id, qty]) => {
        if (qty > 0) {
          const item = [...ticketTypes, ...packages].find(i => i.id === id);
          if (item) {
            const factor = item.isFullEvent ? 1 : (selectedDates.length || 1);
            itemsForStripe.push({ 
              name: item.name,
              description: item.description || '',
              price: Number(item.price) * factor,
              quantity: qty 
            });
          }
        }
      });

      // 2. call Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`
        },
        body: JSON.stringify({ 
          type: 'spectator',
          items: itemsForStripe, 
          eventId: event.id,
          eventSlug: event.slug || slug,
          customerEmail: customerData.email,
          customerName: customerData.name,
          metadata: {
            orderId: order.qr_code_id
          }
        })
      });
      
      const data = await res.json();
      if (data.url) {
        // Store the session ID in the order before redirecting (if provided)
        if (data.id) {
          try {
            await supabase
              .from('spectator_orders')
              .update({ stripe_session_id: data.id })
              .eq('qr_code_id', order.qr_code_id);
          } catch (storeErr) {
            console.warn("Failed to store session ID:", storeErr);
          }
        } else {
          console.log("APX-INFO: Checkout session ID not returned by Edge Function. Proceeding anyway.");
        }
        
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to initialize checkout');
      }
    } catch (err) {
      console.error("Order failed:", err);
      toast.error("Failed to initiate secure checkout process");
      setIsSubmitting(false);
    }
  };

  return (
    <SwimmingBackground>
      <div className="min-h-screen py-12 px-4 md:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-[0.2em] max-w-full overflow-hidden truncate">
              <Ticket className="w-4 h-4 shrink-0" />
              <span className="truncate">{event?.name || 'Official Ticketing Portal'}</span>
            </div>
            <h1 className="text-3xl md:text-6xl font-black text-white tracking-tight uppercase leading-tight">
               Get Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Tickets</span>
            </h1>
            <p className="text-base md:text-lg text-slate-300 font-light max-w-2xl mx-auto px-2">
               Secure your spot at <span className="font-bold text-white">{event?.name || 'the event'}</span>.
            </p>
          </motion.div>

          {/* Ticket Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Individual Tickets */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-cyan-500" />
                Individual Tickets
              </h2>
              {ticketTypes.map((ticket, idx) => (
                <TicketCard 
                  key={ticket.id} 
                  item={ticket} 
                  quantity={cart[ticket.id] || 0} 
                  onUpdate={updateQuantity}
                  delay={idx * 0.1}
                />
              ))}
              {ticketTypes.length === 0 && (
                <p className="text-slate-500 text-sm italic">No individual tickets available.</p>
              )}
            </section>

            {/* Packages */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Featured Packages
              </h2>
              {packages.map((pkg, idx) => (
                <TicketCard 
                  key={pkg.id} 
                  item={pkg} 
                  quantity={cart[pkg.id] || 0} 
                  onUpdate={updateQuantity}
                  isPackage
                  delay={idx * 0.1 + 0.2}
                />
              ))}
              {packages.length === 0 && (
                <p className="text-slate-500 text-sm italic">No packages available.</p>
              )}
            </section>
          </div>

          {/* APX-MOD: Main Page Day Selection (Migrated from Modal for Price Transparency) */}
          {Object.keys(cart).some(id => {
            const item = [...ticketTypes, ...packages].find(i => i.id === id);
            return !item?.isFullEvent;
          }) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 border border-slate-700/50 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    Choose Attendance Days
                  </h3>
                  <p className="text-sm text-slate-400">Select which days you want to attend (Mandatory for individual tickets)</p>
                </div>
                
                {/* Global Toggle for Convenience */}
                {!isFullEvent && (
                  <button
                    onClick={selectFullEvent}
                    className="text-xs font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors py-2 px-4 rounded-full bg-cyan-400/5 border border-cyan-400/10"
                  >
                    Select All Days
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {eventDates.map(date => {
                   const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                   const isPast = date < todayStr;
                   const isSelected = selectedDates.includes(date);

                   return (
                    <button
                      key={date}
                      disabled={isPast}
                      onClick={() => toggleDate(date)}
                      className={`group relative overflow-hidden px-5 py-3 rounded-2xl border-2 transition-all duration-300 flex flex-col items-start gap-0.5 min-w-[110px] ${
                        isSelected 
                          ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      } ${isPast ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none bg-slate-950' : ''}`}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-black">
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {isPast && (
                         <span className="text-[9px] font-black text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase mt-1 leading-none">
                            Passed
                         </span>
                      )}
                      {isSelected && !isPast && (
                        <motion.div 
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute top-3 right-3"
                        >
                          <div className="bg-cyan-500 rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5 text-white" strokeWidth={5} />
                          </div>
                        </motion.div>
                      )}
                    </button>
                   );
                })}
              </div>
            </motion.div>
          )}

          {/* Checkout Summary Bar (Updated to use finalTotal) */}
          <AnimatePresence>
            {totalAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-0 md:bottom-8 left-0 md:left-1/2 md:-translate-x-1/2 w-full md:max-w-2xl z-50 p-0 md:px-4"
              >
                <div className="bg-slate-950/80 backdrop-blur-xl md:bg-slate-900 border-t md:border border-white/10 md:rounded-2xl p-4 md:p-6 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex flex-row items-center justify-between gap-4">
                  <div className="shrink-0">
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1">Total Amount</p>
                    <p className="text-2xl md:text-3xl font-black text-white leading-none">{finalTotal.toFixed(2)} <span className="text-xs md:text-base text-slate-400">AED</span></p>
                  </div>
                  <Button 
                    size="lg" 
                    icon={CreditCard} 
                    className="flex-1 md:flex-initial px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 active:scale-95 transition-all text-sm md:text-base font-black tracking-widest uppercase shadow-lg shadow-cyan-500/20"
                    onClick={handleCheckout}
                  >
                    Checkout
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-700/50 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-[0_0_80px_rgba(0,0,0,0.6)] relative overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-primary-500 to-blue-600" />
            
            <button 
              onClick={() => setShowCheckout(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">Checkout</h3>
            <p className="text-slate-200 font-light mb-8">Enter your details to receive your tickets.</p>

            <form onSubmit={handleConfirmPurchase} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={customerData.name}
                    onChange={e => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-all text-lg"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={customerData.email}
                    onChange={e => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-all text-lg"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 transition-all flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Amount</p>
                  <p className="text-xl font-black text-white">{finalTotal.toFixed(2)} <span className="text-xs">AED</span></p>
                </div>
                {selectedDates.length > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-500">Selected Days</p>
                    <p className="text-xs font-bold text-white">{selectedDates.length} Days</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full py-4 text-lg font-black tracking-widest shadow-lg shadow-cyan-500/20"
                  loading={isSubmitting}
                >
                  PAY & GET TICKETS
                </Button>
                
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all"
                >
                  Back to Tickets
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Success Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-6 sm:p-10 w-full max-w-2xl shadow-2xl text-center relative overflow-hidden"
          >
            {/* Design Elements */}
            <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-cyan-600 to-primary-600" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mb-6">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              
              <h3 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Thank You!</h3>
              <p className="text-white/80 font-bold mb-8 uppercase tracking-widest text-xs">Your order is confirmed ({completedOrder.ticket_count || 1} Tickets)</p>

              <div className="w-full mb-8 flex flex-col gap-8 items-center bg-slate-50/50 rounded-2xl border border-slate-100/50 p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {(completedOrder.tickets?.length > 0 ? completedOrder.tickets : [{ ticket_code: completedOrder.qr_code_id || "LEGACY" }]).map((t, idx) => (
                  <div key={t.ticket_code || idx} id={`ticket-preview-${idx}`} className="shrink-0 scale-[0.55] xs:scale-[0.65] sm:scale-[0.85] md:scale-95 lg:scale-100 origin-top mb-10">
                    <SpectatorTicketCard 
                      order={completedOrder} 
                      event={event} 
                      qrCodeUrl={qrCodes[t.ticket_code || `fallback_${idx}`]} 
                      ticket={t}
                      ticketIndex={idx + 1}
                      totalTickets={completedOrder.tickets?.length || 1}
                    />
                  </div>
                ))}
              </div>

              <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 mb-8 max-w-sm mx-auto">
                <p className="text-cyan-800 text-sm font-semibold leading-relaxed">
                  Please save your QR code. You will need to show it at the entrance for scanning.
                </p>
                <p className="text-cyan-600 text-[11px] font-bold uppercase mt-2 tracking-wider">
                  Tip: Take a screenshot now for quick offline access
                </p>
              </div>

              <div className="mt-8 flex gap-4 w-full">
                <Button 
                  onClick={() => {
                    localStorage.removeItem('latest_apx_order_id');
                    setCompletedOrder(null);
                  }} 
                  variant="secondary" 
                  className="flex-1"
                >
                  Done
                </Button>
                <Link to={`/view-ticket/${completedOrder.qr_code_id}`} className="flex-1">
                  <Button className="w-full" icon={Download}>
                    View Ticket
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </SwimmingBackground>
  );
}

function TicketCard({ item, quantity, onUpdate, isPackage, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <Card className={`overflow-hidden border-slate-800 hover:border-white/20 transition-all ${quantity > 0 ? 'bg-slate-800/50 ring-2 ring-cyan-500/30' : 'bg-slate-900/40'}`}>
        <CardContent className="p-4 md:p-5 flex flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-1.5 truncate">
              {item.name}
              {isPackage && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </h3>
            <p className="text-xs md:text-sm text-slate-500 font-light truncate">{item.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg md:text-xl font-black text-cyan-400">{item.price} <span className="text-[10px] text-slate-600 uppercase">AED</span></p>
              {item.isFullEvent && (
                <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-tighter shrink-0">
                  Full Pass
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
            <button 
              onClick={() => onUpdate(item.id, -1)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center text-lg font-black text-white">{quantity}</span>
            <button 
              onClick={() => onUpdate(item.id, 1)}
              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
