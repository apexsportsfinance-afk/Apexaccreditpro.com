import React, { useState, useEffect } from "react";
import { Copy, Check, Ticket, User, CreditCard, Plus, Minus, DollarSign, Loader2, Calendar } from "lucide-react";
import Button from "../ui/Button";
import { TicketingAPI, EventsAPI } from "../../lib/storage";
import { useToast } from "../ui/Toast";
import * as QRCodeLib from "qrcode";
import { sendTicketEmail } from "../../lib/email";
import { SpectatorTicketCard } from "../public/SpectatorTicketCard";

export default function BoxOfficeTab({ eventId, eventSlug, onSuccess }) {
  const toast = useToast();
  const [ticketTypes, setTicketTypes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerData, setCustomerData] = useState({ name: "Walk-in Customer", email: "" });
  const [paymentMethod, setPaymentMethod] = useState("magnati"); // magnati | cash

  const [completedOrder, setCompletedOrder] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrCodes, setQrCodes] = useState({}); // APX-MOD: Map of ticket_code -> QR URL

  const [eventData, setEventData] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);

  // APX-MOD: Generate event dates for selection
  const eventDates = React.useMemo(() => {
    if (!eventData?.startDate || !eventData?.endDate) return [];
    const dates = [];
    let current = new Date(eventData.startDate);
    const end = new Date(eventData.endDate);
    while (current <= end) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [eventData?.startDate, eventData?.endDate]);

  const isFullEvent = selectedDates.length === eventDates.length && eventDates.length > 1;

  useEffect(() => {
    if (eventId) loadTicketingData();
  }, [eventId]);

  // APX-MOD: Default to first day if single day event
  useEffect(() => {
    if (eventDates.length === 1 && selectedDates.length === 0) {
      setSelectedDates(eventDates);
    }
  }, [eventDates]);

  const loadTicketingData = async () => {
    setLoading(true);
    try {
      const [types, pkgs, eData] = await Promise.all([
        TicketingAPI.getTypes(eventId),
        TicketingAPI.getPackages(eventId),
        EventsAPI.getById(eventId)
      ]);
      setTicketTypes(types.filter(t => t.isActive));
      setPackages(pkgs.filter(p => p.isActive));
      setEventData(eData);
    } catch (err) {
      toast.error("Failed to load ticketing inventory");
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

  const totalAmount = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    // APX-MOD: Apply date multiplier for individual (non-full-event) tickets
    const multiplier = (!item.isFullEvent && selectedDates.length > 0) ? selectedDates.length : 1;
    return sum + (Number(item.price) * qty * multiplier);
  }, 0);

  // APX-MOD: Calculate physical physical tickets (One per person per day for individual, one per person for packages)
  const expandedTickets = React.useMemo(() => {
    const list = [];
    [...ticketTypes, ...packages].forEach(item => {
      const qty = cart[item.id] || 0;
      if (qty <= 0) return;

      if (item.isFullEvent) {
        // Packages/Full Event are 1 ticket per qty
        for (let i = 0; i < qty; i++) {
          list.push({
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
            list.push({
              name: item.name,
              price: Number(item.price),
              date: date,
              isFullEvent: false
            });
          });
        }
      }
    });
    return list;
  }, [cart, ticketTypes, packages, selectedDates]);

  const totalTickets = expandedTickets.length;

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (totalTickets === 0) {
      toast.error("Cart is empty!");
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

    setIsSubmitting(true);
    try {
      const orderData = {
        eventId,
        customerName: customerData.name || "Walk-in Customer",
        customerEmail: customerData.email || "no-reply@apex-sports.local",
        totalAmount,
        ticketCount: totalTickets,
        ticketItems: expandedTickets, // APX-MOD: Pass expanded items for individual ticket generation
        selectedDates,
        paymentProvider: paymentMethod,
        paymentStatus: 'paid'
      };

      const order = await TicketingAPI.createOrder(orderData);

      // APX-MOD: Generate QR codes for all itemized tickets
      const qrs = {};
      const ticketsToProcess = order.tickets?.length > 0 ? order.tickets : [{ ticket_code: order.qr_code_id }];

      await Promise.all(ticketsToProcess.map(async (t) => {
        const code = t.ticket_code || order.qr_code_id || ("TKT-" + Math.random().toString(36).substr(2, 9));
        qrs[t.ticket_code || code] = await QRCodeLib.toDataURL(code, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      }));

      setQrCodes(qrs);
      const mainQrUrl = qrs[order.qr_code_id] || Object.values(qrs)[0];
      setQrCodeUrl(mainQrUrl);
      setCompletedOrder(order);
      setCart({});
      toast.success("Box Office Sale Complete!");

      // Try sending the email if an email was provided
      if (order.customer_email && order.customer_email !== "no-reply@apex-sports.local") {
        toast.info(`📧 Sending ticket email... [${new Date().toLocaleTimeString()}]`);
        sendTicketEmail({
          to: order.customer_email,
          name: order.customer_name,
          eventName: eventData?.name || "Event",
          ticketCount: order.ticket_count,
          amountPaid: order.total_amount,
          paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'Magnati POS',
          eventData: eventData,
          qrCodeDataUrl: mainQrUrl,
          qrCodeId: order.qr_code_id || Object.keys(qrs)[0],
          orderId: order.id
        }).then(res => {
          if (res.success) toast.success(`✅ Email sent to ${order.customer_email}`);
          else {
            console.error("Email send failed details:", res.error);
            toast.error(`❌ Email failed: ${res.error || "Check SMTP settings"}`);
          }
        }).catch(e => {
          console.error("Ticket email error:", e);
          toast.error("⚠️ Email service connection error.");
        });
      }

      // Trigger refresh if callback exists
      if (onSuccess) onSuccess(order);
    } catch (err) {
      console.error(err);
      toast.error("Failed to process local sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCart = () => {
    setCompletedOrder(null);
    setQrCodeUrl("");
    setCart({});
    setCustomerData({ name: "Walk-in Customer", email: "" });
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;

  if (completedOrder) {
    try {
      return (
        <div className="max-w-2xl mx-auto space-y-6 text-center py-8">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl">
            <Check className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Sale Confirmed</h2>
            <p className="text-emerald-400 font-bold mb-6">Payment collected via {paymentMethod === 'cash' ? 'Cash' : 'Magnati POS'}</p>

            <div className="w-full mb-8 flex flex-col gap-6 items-center bg-slate-50 rounded-[2rem] p-8 border border-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar">
              {(completedOrder?.tickets?.length > 0 ? completedOrder.tickets : [{ ticket_code: completedOrder?.qr_code_id || (qrCodes && Object.keys(qrCodes)[0]) }]).map((t, idx) => (
                <div key={t?.ticket_code || idx} id={`ticket-preview-${idx}`} className="shrink-0 mb-4">
                  <SpectatorTicketCard
                    order={completedOrder}
                    event={eventData}
                    qrCodeUrl={qrCodes?.[t?.ticket_code || '']}
                    ticket={t}
                    ticketIndex={idx + 1}
                    totalTickets={completedOrder?.tickets?.length || 1}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-left text-sm text-slate-300 bg-slate-900 rounded-xl p-4 mb-8 border border-slate-800">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Customer</p>
                <p className="font-bold text-white">{completedOrder?.customer_name || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-slate-500">Total Paid</p>
                <p className="font-bold text-emerald-400 text-lg">{completedOrder?.total_amount || 0} AED</p>
              </div>
            </div>

            <Button onClick={resetCart} className="w-full" size="lg">
              Start New Sale
            </Button>
          </div>
        </div>
      );
    } catch (renderErr) {
      console.error("SUCCESS MODAL RENDER ERROR:", renderErr);
      return (
        <div className="max-w-xl mx-auto p-12 text-center bg-red-900/10 border border-red-500/20 rounded-2xl">
          <h2 className="text-xl font-bold text-red-500 mb-4">Rendering Error</h2>
          <p className="text-slate-400 mb-6">{renderErr.message}</p>
          <Button onClick={resetCart} className="bg-red-600 text-white">Return to Box Office</Button>
        </div>
      );
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Ticket className="w-5 h-5 text-cyan-500" />
            Select Tickets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...ticketTypes, ...packages].map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} className={`p-4 rounded-xl border transition-all ${qty > 0 ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <p className="text-cyan-400 font-black text-lg">{item.price} <span className="text-[10px] text-slate-500">AED</span></p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 rounded-lg p-1 border border-slate-800">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-2 text-slate-400 hover:text-white"><Minus className="w-4 h-4" /></button>
                    <span className="font-black text-white w-8 text-center">{qty}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-2 text-cyan-400 hover:text-cyan-300"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* APX-MOD: Box Office Day Selection (Mirroring Public Portal) */}
        {Object.keys(cart).some(id => {
          const item = [...ticketTypes, ...packages].find(i => i.id === id);
          return !item?.isFullEvent;
        }) && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Choose Attendance Days
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Mandatory for individual tickets</p>
                </div>

                {!isFullEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toLocaleDateString('en-CA');
                      const validDates = eventDates.filter(d => d >= todayStr);
                      setSelectedDates(validDates);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors py-1.5 px-3 rounded-full bg-cyan-400/5 border border-cyan-400/10"
                  >
                    Select All
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {eventDates.map(date => {
                   const todayStr = new Date().toLocaleDateString('en-CA');
                   const isPast = date < todayStr;
                   const isSelected = selectedDates.includes(date);

                   return (
                    <button
                      key={date}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        setSelectedDates(prev => {
                          if (prev.includes(date)) return prev.filter(d => d !== date);
                          return [...prev, date].sort();
                        });
                      }}
                      className={`group relative overflow-hidden px-4 py-2.5 rounded-xl border transition-all duration-300 flex flex-col items-start gap-0.5 min-w-[100px] ${isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        } ${isPast ? 'opacity-40 grayscale pointer-events-none cursor-not-allowed bg-slate-900' : ''}`}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-colors ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-black">
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {isPast && (
                         <span className="text-[8px] font-black text-red-500/80 bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20 uppercase mt-0.5 leading-none">
                            Ended
                         </span>
                      )}
                      {isSelected && !isPast && (
                        <div className="absolute top-2 right-2">
                          <div className="bg-cyan-500 rounded-full p-0.5">
                            <Check className="w-2 h-2 text-white" strokeWidth={5} />
                          </div>
                        </div>
                      )}
                    </button>
                   );
                })}
              </div>
            </div>
          )}
      </div>

      {/* Checkout Column */}
      <div className="lg:col-span-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-6">
          <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Cart Summary</h3>

          <form onSubmit={handleCheckout} className="space-y-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={customerData.name}
                    onChange={e => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    onFocus={e => { if (customerData.name === "Walk-in Customer") setCustomerData(prev => ({ ...prev, name: "" })) }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Email (Optional)</label>
                <input
                  type="email"
                  value={customerData.email}
                  onChange={e => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="For email receipt"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payment Method Completed</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('magnati')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'magnati' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase">Magnati POS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  <DollarSign className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase">Cash</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Total to Collect</p>
                <p className="text-3xl font-black text-white">{totalAmount} <span className="text-sm text-slate-400">AED</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Tickets</p>
                <p className="text-xl font-bold text-slate-300">{totalTickets}</p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-4 uppercase tracking-widest font-black"
              loading={isSubmitting}
              disabled={totalTickets === 0}
              variant={paymentMethod === 'cash' ? 'primary' : 'primary'} // Just keeping it generic
            >
              Confirm Sale & Generate Ticket
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
