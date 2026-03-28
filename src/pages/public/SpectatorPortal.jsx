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
import Card, { CardContent } from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import * as QRCodeLib from "qrcode";
import { sendTicketEmail } from "../../lib/email";

import { TicketingAPI, EventsAPI } from "../../lib/storage";

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
    if (slug) loadData();
  }, [slug]);

  useEffect(() => {
    if (eventDates.length === 1 && selectedDates.length === 0) {
      setSelectedDates(eventDates);
    }
  }, [eventDates]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');

    if (sessionId) {
      verifyAndCompleteOrder(sessionId);
    }
  }, []);

  const verifyAndCompleteOrder = async (sessionId) => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      
      if (data.success) {
        const metadata = data.session.metadata;
        const orderData = {
          eventId: metadata.eventId,
          customerName: metadata.customerName,
          customerEmail: metadata.customerEmail,
          totalAmount: data.session.amount_total,
          ticketCount: parseInt(metadata.ticketCount, 10),
          selectedDates: JSON.parse(metadata.selectedDates),
          paymentProvider: 'stripe',
          paymentStatus: 'paid'
        };

        const order = await TicketingAPI.createOrder(orderData);
        
        const qrUrl = await QRCodeLib.toDataURL(order.qr_code_id, {
          width: 400,
          margin: 2,
          color: { dark: '#0e7490', light: '#ffffff' }
        });
        
        setQrCodeUrl(qrUrl);
        setCompletedOrder(order);
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        toast.success("Payment successful!");

        // Fire off email delivery in background
        if (orderData.customerEmail) {
          const eData = await EventsAPI.getById(orderData.eventId);
          sendTicketEmail({
            to: orderData.customerEmail,
            name: orderData.customerName,
            eventName: eData?.name || "Event",
            ticketCount: orderData.ticketCount,
            amountPaid: orderData.totalAmount,
            paymentMethod: "Card / Stripe",
            eventData: eData,
            qrCodeDataUrl: qrUrl,
            qrCodeId: order.qr_code_id
          }).catch(e => console.error("Ticket email error:", e));
        }
      } else {
        toast.error("Payment verification failed. Status: " + data.status);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Methods
  const loadData = async () => {
    setLoading(true);
    try {
      const eventData = await EventsAPI.getBySlug(slug);
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
      setSelectedDates(eventDates);
    }
  };

  const totalAmount = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    const itemPrice = Number(item.price) * qty;
    const daysCount = selectedDates.length || 1;
    return sum + (itemPrice * daysCount);
  }, 0);

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) {
      toast.error("Your cart is empty");
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

    if (selectedDates.length === 0 && eventDates.length > 0) {
      toast.error("Please select at least one date");
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketCount = Object.values(cart).reduce((a, b) => a + b, 0);
      
      let totalTickets = 0;
      Object.entries(cart).forEach(([id, qty]) => {
        const item = [...ticketTypes, ...packages].find(i => i.id === id);
        if (item) {
          totalTickets += qty * (item.quantityIncluded || 1);
        }
      });

      const orderData = {
        eventId: event.id,
        customerName: customerData.name,
        customerEmail: customerData.email,
        totalAmount: totalAmount,
        ticketCount: totalTickets * (selectedDates.length || 1),
        selectedDates: selectedDates,
      };

      const itemsForStripe = [];
      Object.entries(cart).forEach(([id, qty]) => {
        if (qty > 0) {
          const item = [...ticketTypes, ...packages].find(i => i.id === id);
          if (item) itemsForStripe.push({ ...item, quantity: qty });
        }
      });

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsForStripe, 
          eventId: event.id,
          eventSlug: event.slug || slug,
          orderData 
        })
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to secure Stripe Checkout
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
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight uppercase">
              Get Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Tickets</span>
            </h1>
            <p className="text-lg text-slate-300 font-light max-w-2xl mx-auto">
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

          {/* Checkout Summary Bar */}
          <AnimatePresence>
            {totalAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50"
              >
                <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300 mb-1">Total Amount</p>
                    <p className="text-3xl font-black text-white">{totalAmount.toFixed(2)} <span className="text-base text-slate-300">AED</span></p>
                  </div>
                  <Button 
                    size="lg" 
                    icon={CreditCard} 
                    className="px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 active:scale-95 transition-all"
                    onClick={handleCheckout}
                  >
                    Checkout Now
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
            className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-primary-500 to-purple-500" />
            
            <button 
              onClick={() => setShowCheckout(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
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

              {eventDates.length > 1 && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest block">Choose Attendance Days</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={selectFullEvent}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${isFullEvent ? 'border-cyan-500 bg-cyan-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="font-bold text-sm">Full Event Pass</p>
                          <p className="text-[10px] opacity-70">Access for all {eventDates.length} days</p>
                        </div>
                        {isFullEvent && <Check className="w-4 h-4" />}
                      </div>
                    </button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-800"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-slate-900 px-2 text-slate-600 font-bold tracking-widest text-[9px]">or pick specific days</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {eventDates.map(date => (
                        <button
                          key={date}
                          type="button"
                          onClick={() => toggleDate(date)}
                          className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${selectedDates.includes(date) && !isFullEvent ? 'border-cyan-500 bg-cyan-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}
                        >
                          {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {eventDates.length === 1 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Event Date</p>
                      <p className="text-sm font-bold text-white">
                        {new Date(eventDates[0]).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
              )}

              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-slate-300">Total Amount</span>
                  <span className="text-white font-bold">{totalAmount.toFixed(2)} AED</span>
                </div>
                <p className="text-[10px] text-slate-400 italic">Secure payment via Stripe & Magnati</p>
              </div>

              <Button 
                type="submit" 
                className="w-full py-4 text-lg font-black tracking-widest"
                loading={isSubmitting}
              >
                PAY & GET TICKETS
              </Button>
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
            className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl text-center relative overflow-hidden"
          >
            {/* Design Elements */}
            <div className="absolute top-0 left-0 w-full h-56 bg-gradient-to-br from-cyan-600 to-primary-600" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mb-6">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              
              <h3 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Thank You!</h3>
              <p className="text-white/80 font-bold mb-8 uppercase tracking-widest text-xs">Your order is confirmed</p>

              <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 mb-8 w-full">
                <img src={qrCodeUrl} className="w-full aspect-square object-contain mb-4" alt="Ticket QR Code" />
                <div className="space-y-1">
                  <h4 className="text-slate-900 font-black text-xl leading-none uppercase">{completedOrder.customer_name}</h4>
                  <p className="text-slate-500 text-sm font-medium">{completedOrder.ticket_count} Spectator Tickets</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                   <div className="text-left">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Order ID</p>
                     <p className="text-xs font-mono text-slate-600">{completedOrder.qr_code_id}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                     <p className="text-xs font-bold text-slate-900">{completedOrder.total_amount} AED</p>
                   </div>
                </div>
              </div>

              <p className="text-slate-600 text-sm font-medium mb-8 max-w-[250px]">
                Please save this QR code. You will need to show it at the entrance for scanning.
              </p>

              <div className="mt-8 flex gap-4 w-full">
                <Button onClick={() => setCompletedOrder(null)} variant="secondary" className="flex-1">
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
      <Card className={`overflow-hidden border-slate-800 hover:border-white/20 transition-all ${quantity > 0 ? 'bg-slate-800/50 ring-2 ring-cyan-500/50' : 'bg-slate-900/40'}`}>
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {item.name}
              {isPackage && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            </h3>
            <p className="text-sm text-slate-500 font-light">{item.description}</p>
            <p className="text-xl font-black text-cyan-400 mt-2">{item.price} <span className="text-xs text-slate-600">AED</span></p>
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
